import { Redis } from '@upstash/redis';
import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import { KV_REST_API_URL, KV_REST_API_TOKEN } from '$app/env/private';
import {
	CODE_ALPHABET,
	CODE_LENGTH,
	FREE,
	LIMITS,
	SIZES,
	cleanItems,
	makeBoard,
	needed,
	rank,
	winningLines,
	type PlayerView,
	type RoomState
} from '#lib/bingo.ts';

/** The handful of Redis commands this app uses, with raw string values. */
interface Kv {
	hsetnx(key: string, field: string, value: string): Promise<0 | 1>;
	hset(key: string, kv: Record<string, string>): Promise<number>;
	hget(key: string, field: string): Promise<string | null>;
	hgetall(key: string): Promise<Record<string, string> | null>;
	expire(key: string, seconds: number): Promise<0 | 1>;
	incr(key: string): Promise<number>;
}

// ponytail: in-memory store for `npm run dev` without Upstash credentials; one process only.
function memoryKv(): Kv {
	const data = new Map<string, { value: Map<string, string>; until: number }>();
	const entry = (key: string) => {
		const e = data.get(key);
		if (e && e.until <= Date.now()) data.delete(key);
		return data.get(key);
	};
	const hash = (key: string) => {
		let e = entry(key);
		if (!e) data.set(key, (e = { value: new Map(), until: Infinity }));
		return e.value;
	};
	return {
		async hsetnx(key, field, value) {
			const h = hash(key);
			if (h.has(field)) return 0;
			h.set(field, value);
			return 1;
		},
		async hset(key, kv) {
			const h = hash(key);
			for (const [k, v] of Object.entries(kv)) h.set(k, v);
			return Object.keys(kv).length;
		},
		async hget(key, field) {
			return entry(key)?.value.get(field) ?? null;
		},
		async hgetall(key) {
			const e = entry(key);
			return e ? Object.fromEntries(e.value) : null;
		},
		async expire(key, seconds) {
			const e = entry(key);
			if (!e) return 0;
			e.until = Date.now() + seconds * 1000;
			return 1;
		},
		async incr(key) {
			const h = hash(key);
			const n = Number(h.get('n') ?? 0) + 1;
			h.set('n', String(n));
			return n;
		}
	};
}

function connect(): Kv {
	if (KV_REST_API_URL && KV_REST_API_TOKEN) {
		return new Redis({
			url: KV_REST_API_URL,
			token: KV_REST_API_TOKEN,
			automaticDeserialization: false,
			signal: () => AbortSignal.timeout(5000)
		});
	}
	if (!dev) throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be set');
	return memoryKv();
}

let kv: Kv | undefined;
const db = () => (kv ??= connect());

/** Rooms expire a day after the last join or mark. */
const TTL = 60 * 60 * 24;
const META = 'meta';
const roomKey = (code: string) => `room:${code}`;
const playerField = (id: string) => `p:${id}`;

type Meta = { title: string; items: string[]; size: number; free: boolean; createdAt: number };
type Player = {
	name: string;
	token: string;
	board: number[];
	marks: number[];
	lines: number;
	bingoAt: number | null;
};

// Error messages are codes; the client translates them (src/lib/i18n.svelte.ts).

/** Fixed-window limit per client IP: at most `max` calls per minute. */
export async function rateLimit(ip: string, bucket: string, max: number) {
	const key = `rl:${bucket}:${ip}`;
	const n = await db().incr(key);
	if (n === 1) await db().expire(key, 60);
	if (n > max) error(429, 'rate_limited');
}

/** Parses a JSON body, refusing anything larger than a full item list needs. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
	if (Number(request.headers.get('content-length') ?? 0) > 64 * 1024) {
		error(413, 'too_large');
	}
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) error(400, 'bad_request');
	return body as Record<string, unknown>;
}

export function parseName(value: unknown): string {
	const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
	if (!name) error(400, 'name_required');
	return name.slice(0, LIMITS.name);
}

export function parseMeta(body: Record<string, unknown>): Meta {
	const size = Number(body.size);
	if (!SIZES.includes(size as (typeof SIZES)[number])) error(400, 'bad_request');
	const free = body.free === true;
	const items = cleanItems(Array.isArray(body.items) ? body.items : []).slice(0, LIMITS.items);
	if (items.length < needed({ size, free })) error(400, 'too_few_items');
	const title =
		(typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : '').slice(
			0,
			LIMITS.title
		) || 'Bingo';
	return { title, items, size, free, createdAt: Date.now() };
}

function newCode() {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
	// 256 % 31 leaves a slight bias towards the first letters; irrelevant for invite codes.
	return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export async function createRoom(meta: Meta): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = newCode();
		if (await db().hsetnx(roomKey(code), META, JSON.stringify(meta))) {
			await db().expire(roomKey(code), TTL);
			return code;
		}
	}
	error(503, 'create_failed');
}

async function load(code: string) {
	const hash = await db().hgetall(roomKey(code));
	if (!hash?.[META]) error(404, 'room_not_found');
	const meta: Meta = JSON.parse(hash[META]);
	const players = new Map<string, Player>();
	for (const [field, value] of Object.entries(hash)) {
		if (field.startsWith('p:')) players.set(field.slice(2), JSON.parse(value));
	}
	return { meta, players };
}

const cellsOf = (meta: Meta, board: number[]) =>
	board.map((i) => (i === FREE ? null : meta.items[i]));

export async function joinRoom(code: string, name: string) {
	const { meta, players } = await load(code);
	// ponytail: count and name checks race with concurrent joins; worst case a few extra players.
	if (players.size >= LIMITS.players) error(409, 'room_full');
	const key = name.toLocaleLowerCase('pl');
	for (const p of players.values()) {
		if (p.name.toLocaleLowerCase('pl') === key) error(409, 'name_taken');
	}
	const id = crypto.randomUUID().slice(0, 8);
	const token = crypto.randomUUID();
	const board = makeBoard(meta.items.length, meta);
	const player: Player = { name, token, board, marks: [], lines: 0, bingoAt: null };
	if (!(await db().hsetnx(roomKey(code), playerField(id), JSON.stringify(player)))) {
		error(503, 'join_failed');
	}
	await db().expire(roomKey(code), TTL);
	return { id, token, cells: cellsOf(meta, board) };
}

export async function roomState(code: string, me: string | null): Promise<RoomState> {
	const { meta, players } = await load(code);
	const views: PlayerView[] = [];
	for (const [id, p] of players) {
		views.push({ id, name: p.name, marked: p.marks.length, lines: p.lines, bingoAt: p.bingoAt });
	}
	const own = me ? players.get(me) : undefined;
	return {
		code,
		title: meta.title,
		size: meta.size,
		free: meta.free,
		players: views.sort(rank),
		...(own && { me: { cells: cellsOf(meta, own.board), marks: own.marks } })
	};
}

/** Replaces a player's marks. Idempotent, so the client can simply resend on failure. */
export async function setMarks(code: string, id: string, token: string, marks: unknown) {
	const raw = await db().hget(roomKey(code), playerField(id));
	if (!raw) error(404, 'not_in_room');
	const player: Player = JSON.parse(raw);
	if (player.token !== token) error(403, 'forbidden');
	if (!Array.isArray(marks)) error(400, 'bad_request');

	const valid = new Set<number>();
	for (const m of marks) {
		if (Number.isInteger(m) && m >= 0 && m < player.board.length && player.board[m] !== FREE) {
			valid.add(m);
		}
	}
	const size = Math.sqrt(player.board.length);
	const lines = winningLines(size, (i) => valid.has(i) || player.board[i] === FREE).length;
	// Unmarking a line loses the bingo; the timestamp only counts a bingo that still stands.
	const bingoAt = lines === 0 ? null : (player.bingoAt ?? Date.now());

	const next: Player = { ...player, marks: [...valid].sort((a, b) => a - b), lines, bingoAt };
	await db().hset(roomKey(code), { [playerField(id)]: JSON.stringify(next) });
	await db().expire(roomKey(code), TTL);
	return { lines, bingoAt };
}
