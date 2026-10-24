import { error, json } from '@sveltejs/kit';
import { CODE_RE } from '#lib/bingo.ts';
import { joinRoom, parseName, rateLimit, readBody, roomState, setMarks } from '#lib/server/rooms.ts';
import type { RequestHandler } from './$types';

function code(params: { code: string }) {
	const value = params.code.toUpperCase();
	if (!CODE_RE.test(value)) error(404, 'room_not_found');
	return value;
}

/** Room state for polling; `?me=<id>` adds that player's own board. */
export const GET: RequestHandler = async ({ params, url }) => {
	const state = await roomState(code(params), url.searchParams.get('me'));
	return json(state, { headers: { 'cache-control': 'no-store' } });
};

/** Joins the room. */
export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	await rateLimit(getClientAddress(), 'join', 20);
	const body = await readBody(request);
	return json(await joinRoom(code(params), parseName(body.name)), { status: 201 });
};

/** Replaces the caller's marks: `{ id, token, marks }`. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const { id, token, marks } = await readBody(request);
	if (typeof id !== 'string' || typeof token !== 'string') error(401, 'forbidden');
	return json(await setMarks(code(params), id, token, marks));
};
