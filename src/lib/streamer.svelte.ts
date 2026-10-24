import { resolve } from '$app/paths';
import { load, save } from './storage.ts';

const KEY = 'bingo:streamer';
// Per tab, so a reload of /r finds its room again without the code in the address bar.
const ROOM = 'bingo:stream-room';

let on = $state(load<boolean>(KEY) === true);

/** Streamer mode keeps room codes off the screen, so viewers cannot join from the stream. */
export const streamer = {
	get on() {
		return on;
	},
	toggle() {
		on = !on;
		save(KEY, on);
	}
};

export function rememberedRoom(): string | null {
	try {
		return sessionStorage.getItem(ROOM);
	} catch {
		return null;
	}
}

/** Where a room lives in the address bar: without its code while streaming. */
export function roomPath(code: string) {
	if (!on) return resolve('/r/[[code]]', { code });
	try {
		sessionStorage.setItem(ROOM, code);
	} catch {
		// Reloading /r then shows the invalid-code page; the room itself still works.
	}
	return resolve('/r/[[code]]', {});
}
