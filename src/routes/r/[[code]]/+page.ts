import type { EntryGenerator } from './$types';

// /r becomes a real file on GitHub Pages: invite links in the /r?CODE form answer 200
// instead of the 404.html fallback, which Discord and other unfurlers refuse to preview.
export const prerender = 'auto';
export const entries: EntryGenerator = () => [{}];
