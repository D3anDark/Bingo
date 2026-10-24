// localStorage throws in some private modes and when site data is blocked; the app still works without it.

export function load<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? null : (JSON.parse(raw) as T);
	} catch {
		return null;
	}
}

export function save(key: string, value: unknown) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Not persisted; the in-memory state is still correct.
	}
}

export type Seat = { id: string; token: string };
export const seatKey = (code: string) => `bingo:room:${code}`;
