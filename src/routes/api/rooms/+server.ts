import { json } from '@sveltejs/kit';
import { createRoom, joinRoom, parseMeta, parseName, rateLimit, readBody } from '#lib/server/rooms.ts';
import type { RequestHandler } from './$types';

/** Creates a room and joins its creator as the first player. */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	await rateLimit(getClientAddress(), 'create', 10);
	const body = await readBody(request);
	const name = parseName(body.name);
	const code = await createRoom(parseMeta(body));
	return json({ code, ...(await joinRoom(code, name)) }, { status: 201 });
};
