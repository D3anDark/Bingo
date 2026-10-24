import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;

// Set by the Upstash Redis integration on Vercel. Unset locally: rooms live in memory.
export const variables = defineEnvVars({
	KV_REST_API_URL: { schema: optional, description: 'Upstash Redis REST URL' },
	KV_REST_API_TOKEN: { schema: optional, description: 'Upstash Redis REST token' },
	API_ORIGIN: {
		public: true,
		static: true,
		schema: optional,
		description: 'Where /api lives when the pages are hosted elsewhere (GitHub Pages build)'
	}
});
