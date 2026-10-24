import type { Handle } from '@sveltejs/kit/hooks';

// The GitHub Pages copy at deandark.me/Bingo calls this API cross-origin.
const CORS = {
	'access-control-allow-origin': 'https://deandark.me',
	'access-control-allow-methods': 'GET, POST, PUT',
	'access-control-allow-headers': 'content-type',
	// Chrome caps this at 2h; saves a preflight before every mark.
	'access-control-max-age': '7200'
};

export const handle: Handle = async ({ event, resolve }) => {
	const api = event.url.pathname.startsWith('/api/');
	if (api && event.request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: CORS });
	}
	const response = await resolve(event);
	if (api) for (const [name, value] of Object.entries(CORS)) response.headers.set(name, value);
	return response;
};
