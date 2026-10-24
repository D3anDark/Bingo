import { i18n } from './i18n.svelte.ts';

/** A non-2xx response. `code` is the API's error code, translated by `describe`. */
export class ApiError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string) {
		super(code);
		this.status = status;
		this.code = code;
	}
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(path, {
		...init,
		headers: { accept: 'application/json', 'content-type': 'application/json', ...init.headers }
	});
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new ApiError(res.status, typeof data?.message === 'string' ? data.message : '');
	return data as T;
}

/** User-facing text for anything `api` throws, in the current language. */
export function describe(err: unknown): string {
	const { t } = i18n;
	if (!(err instanceof ApiError)) return t.errors.network;
	const known: Record<string, string> = t.errors;
	return Object.hasOwn(known, err.code) ? known[err.code] : t.serverError(err.status);
}
