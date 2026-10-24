import staticAdapter from '@sveltejs/adapter-static';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const base = process.env.BASE_PATH ?? '';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// BASE_PATH set: static copy for GitHub Pages (deandark.me/Bingo) that calls the Vercel API.
			// 404.html doubles as the SPA fallback, so /Bingo/r/CODE links still open the room.
			// Otherwise: Vercel, in the same region as the Upstash database so Redis calls stay local.
			adapter: base ? staticAdapter({ fallback: '404.html' }) : vercelAdapter({ regions: ['fra1'] }),
			paths: { base: base as '' | `/${string}` }
		})
	]
});
