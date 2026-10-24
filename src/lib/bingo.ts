export const SIZES = [3, 4, 5, 6] as const;
export const FREE = -1;

export const LIMITS = { items: 200, item: 80, name: 24, title: 60, players: 50 };

// No I, L, O, 0, 1: codes get read out loud and typed on phones.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export type Settings = { size: number; free: boolean };

/** Public view of a player, safe to send to everyone in the room. */
export type PlayerView = {
	id: string;
	name: string;
	marked: number;
	lines: number;
	bingoAt: number | null;
};

export type RoomState = {
	code: string;
	title: string;
	size: number;
	free: boolean;
	players: PlayerView[];
	/** Present only when the request named a player: their own board. */
	me?: { cells: (string | null)[]; marks: number[] };
};

export const hasFree = ({ size, free }: Settings) => free && size % 2 === 1;

export const needed = (s: Settings) => s.size * s.size - (hasFree(s) ? 1 : 0);

/** Random board as item indices, with FREE in the centre cell. */
export function makeBoard(itemCount: number, s: Settings): number[] {
	const n = needed(s);
	if (itemCount < n) throw new RangeError(`need ${n} items, got ${itemCount}`);
	const pool = Array.from({ length: itemCount }, (_, i) => i);
	// Partial Fisher-Yates: only the first n slots need to be shuffled.
	for (let i = 0; i < n; i++) {
		const j = i + Math.floor(Math.random() * (itemCount - i));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const cells = pool.slice(0, n);
	if (hasFree(s)) cells.splice((s.size * s.size - 1) / 2, 0, FREE);
	return cells;
}

/** Every completed row, column and diagonal, as lists of cell indices. */
export function winningLines(size: number, on: (cell: number) => boolean): number[][] {
	const seq = (f: (i: number) => number) => Array.from({ length: size }, (_, i) => f(i));
	const lines: number[][] = [];
	for (let k = 0; k < size; k++) {
		lines.push(seq((i) => k * size + i), seq((i) => i * size + k));
	}
	lines.push(
		seq((i) => i * size + i),
		seq((i) => i * size + size - 1 - i)
	);
	return lines.filter((line) => line.every(on));
}

/** Trimmed, single-spaced, non-empty, case-insensitively unique. */
export function cleanItems(raw: unknown[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of raw) {
		if (typeof value !== 'string') continue;
		const item = value.replace(/\s+/g, ' ').trim().slice(0, LIMITS.item);
		const key = item.toLocaleLowerCase('pl');
		if (!item || seen.has(key)) continue;
		seen.add(key);
		out.push(item);
	}
	return out;
}

/** Leaderboard order: earliest bingo first, then most lines, then most marks. */
export function rank(a: PlayerView, b: PlayerView): number {
	if (a.bingoAt !== b.bingoAt) {
		if (a.bingoAt === null) return 1;
		if (b.bingoAt === null) return -1;
		return a.bingoAt - b.bingoAt;
	}
	return b.lines - a.lines || b.marked - a.marked || a.name.localeCompare(b.name, 'pl');
}
