<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Board from '#lib/Board.svelte';
	import Rules from '#lib/Rules.svelte';
	import { ApiError, api, describe } from '#lib/api.ts';
	import { CODE_RE, LIMITS, needed, winningLines, type RoomState } from '#lib/bingo.ts';
	import { i18n } from '#lib/i18n.svelte.ts';
	import { load, save, seatKey, type Seat } from '#lib/storage.ts';
	import { rememberedRoom, roomPath, streamer } from '#lib/streamer.svelte.ts';

	const t = $derived(i18n.t);

	const POLL_MS = 3000;
	const MAX_BACKOFF_MS = 30_000;

	const code = (page.params.code ?? rememberedRoom() ?? '').toUpperCase();
	const invalid = !CODE_RE.test(code);

	let seat = $state<Seat | null>(load<Seat>(seatKey(code)));
	let room = $state<RoomState | null>(null);
	let cells = $state<(string | null)[] | null>(null);
	let marks = $state<number[]>([]);
	let status = $state<'loading' | 'live' | 'offline' | 'missing'>(invalid ? 'missing' : 'loading');
	// A thunk, so the text follows a language switch.
	let problem = $state<(() => string) | null>(invalid ? () => t.invalidCode : null);

	// ---- Polling ----
	const bingoSeen = new Set<string>();
	let firstPoll = true;
	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	function announce(text: string) {
		toast = text;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 4000);
	}

	async function poll() {
		const wantBoard = seat && !cells;
		const state = await api<RoomState>(
			`/api/rooms/${code}${wantBoard ? `?me=${encodeURIComponent(seat!.id)}` : ''}`
		);
		if (wantBoard) {
			if (state.me) {
				cells = state.me.cells;
				marks = state.me.marks;
			} else {
				// Saved seat points at a player this room does not know: join again.
				seat = null;
				save(seatKey(code), null);
			}
		}
		for (const p of state.players) {
			if (!p.bingoAt) bingoSeen.delete(p.id);
			else if (!bingoSeen.has(p.id)) {
				bingoSeen.add(p.id);
				if (!firstPoll && p.id !== seat?.id) announce(t.gotBingo(p.name));
			}
		}
		firstPoll = false;
		room = state;
		status = 'live';
	}

	let wake = () => {};

	$effect(() => {
		if (invalid) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let alive = true;
		let busy = false;
		let failures = 0;

		async function tick() {
			if (busy) return;
			busy = true;
			try {
				if (!document.hidden) await poll();
				failures = 0;
			} catch (err) {
				if (err instanceof ApiError && err.status === 404) {
					status = 'missing';
					problem = () => describe(err);
					alive = false;
				} else {
					failures++;
					status = 'offline';
				}
			} finally {
				busy = false;
			}
			if (alive) timer = setTimeout(tick, Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
		}

		wake = () => {
			if (!alive || busy || document.hidden) return;
			clearTimeout(timer);
			tick();
		};

		// The loop reads `seat` and `cells`; it must not restart every time they change.
		untrack(tick);
		document.addEventListener('visibilitychange', wake);
		return () => {
			alive = false;
			clearTimeout(timer);
			clearTimeout(toastTimer);
			clearTimeout(retryTimer);
			document.removeEventListener('visibilitychange', wake);
		};
	});

	// ---- Joining ----
	let name = $state(load<string>('bingo:name') ?? '');
	let joining = $state(false);

	async function join(e: SubmitEvent) {
		e.preventDefault();
		joining = true;
		problem = null;
		try {
			const res = await api<Seat & { cells: (string | null)[] }>(`/api/rooms/${code}`, {
				method: 'POST',
				body: JSON.stringify({ name })
			});
			seat = { id: res.id, token: res.token };
			save(seatKey(code), seat);
			save('bingo:name', name.trim());
			cells = res.cells;
			marks = [];
			wake();
		} catch (err) {
			problem = () => describe(err);
		} finally {
			joining = false;
		}
	}

	// ---- Marking: one request in flight, always ending with the latest marks ----
	let saving = $state<'idle' | 'saving' | 'error'>('idle');
	let inFlight = false;
	let dirty = false;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	async function sync() {
		if (!seat) return;
		if (inFlight) {
			dirty = true;
			return;
		}
		inFlight = true;
		clearTimeout(retryTimer);
		saving = 'saving';
		try {
			do {
				dirty = false;
				await api(`/api/rooms/${code}`, {
					method: 'PUT',
					body: JSON.stringify({ ...seat, marks: $state.snapshot(marks) })
				});
			} while (dirty);
			saving = 'idle';
		} catch (err) {
			saving = 'error';
			// A lost seat or room will not come back by retrying.
			const gone = err instanceof ApiError && (err.status === 403 || err.status === 404);
			if (!gone) retryTimer = setTimeout(sync, POLL_MS);
		} finally {
			inFlight = false;
		}
	}

	function toggle(i: number) {
		marks = marks.includes(i) ? marks.filter((m) => m !== i) : [...marks, i];
		sync();
	}

	// ---- View ----
	const total = $derived(room ? needed(room) : 0);
	const myLines = $derived(
		cells && room ? winningLines(room.size, (i) => marks.includes(i) || cells?.[i] === null).length : 0
	);
	const players = $derived(
		(room?.players ?? []).map((p) =>
			p.id === seat?.id ? { ...p, marked: marks.length, lines: myLines } : p
		)
	);
	const winner = $derived(room?.players.find((p) => p.bingoAt));

	let copied = $state(false);
	const link = $derived(page.url.origin + resolve('/r/[[code]]', { code }));

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// The prompt would show the link on stream.
			if (streamer.on) announce(t.copyFailed);
			else prompt(t.copyPrompt, link);
		}
	}

	// Follows the streamer toggle: drops the code from the address bar or puts it back.
	// page.url keeps the pre-shallow URL, so compare with the real address bar.
	$effect(() => {
		const path = roomPath(code);
		if (!invalid && location.pathname !== path) goto(path, { shallow: true, replace: true });
	});

	// Characters outside the code alphabet, so the noise never reads as a joinable code.
	const NOISE = '#%&*+=?@';
	let noise = $state('');
	$effect(() => {
		if (!streamer.on) return;
		const roll = () =>
			(noise = Array.from(code, () => NOISE[Math.floor(Math.random() * NOISE.length)]).join(''));
		roll();
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = setInterval(roll, 150);
		return () => clearInterval(timer);
	});

	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

	function share() {
		navigator.share({ title: room?.title ?? 'Bingo', text: t.shareText(code), url: link }).catch(() => {
			// Closing the share sheet rejects; nothing to do.
		});
	}
</script>

<svelte:head>
	<title>{room?.title ?? 'Bingo'}{streamer.on ? '' : ` · ${code}`}</title>
</svelte:head>

{#if status === 'missing'}
	<section class="center">
		<p class="dot-big muted-dot" aria-hidden="true">404</p>
		<p>{problem?.()}</p>
		<a class="btn primary" href={resolve('/')}>{t.backHome}</a>
	</section>
{:else}
	<section class="head">
		<div class="row">
			<p class="label">{room?.title ?? t.room}</p>
			<p class="label status" class:offline={status === 'offline'}>
				<span class="pulse" aria-hidden="true"></span>
				{status === 'offline' ? t.offline : status === 'loading' ? t.connecting : t.live}
			</p>
		</div>
		<h1
			class="code"
			class:muted-dot={streamer.on}
			aria-label={streamer.on ? t.codeHidden : t.codeLabel(code.split('').join(' '))}
		>
			{streamer.on ? noise : code}
		</h1>
		<div class="actions">
			<button type="button" class="btn" onclick={copyLink}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
				</svg>
				{copied ? t.copied : t.copyLink}
			</button>
			{#if canShare && !streamer.on}
				<button type="button" class="btn ghost" onclick={share}>{t.share}</button>
			{/if}
		</div>
		{#if streamer.on}<p class="muted">{t.streamerHint}</p>{/if}
	</section>

	{#if !seat}
		<section>
			<form class="card join" onsubmit={join}>
				<h2>{t.joinGame}</h2>
				<p class="muted">{t.joinHint}</p>
				<label class="field">
					<span class="label">{t.nick}</span>
					<input class="input" bind:value={name} maxlength={LIMITS.name} required autocomplete="nickname" />
				</label>
				<button class="btn primary" disabled={joining || !name.trim()}>
					{joining ? t.joining : t.join}
				</button>
				{#if problem}<p class="label hit" role="alert">{problem()}</p>{/if}
			</form>
		</section>
	{:else if cells && room}
		<section aria-labelledby="board-h">
			<div class="row">
				<h2 id="board-h" class="label">{t.yourBoard}</h2>
				<p class="label tally">
					{#if saving === 'error'}<span class="hit">{t.notSaved}</span>{/if}
					{#if myLines > 0}<span class="hit">{t.lines(myLines)}</span>{/if}
					<span class="dot-num">{String(marks.length).padStart(2, '0')}</span>/{total}
				</p>
			</div>
			<Board size={room.size} {cells} {marks} onToggle={toggle} />
		</section>
	{:else}
		<p class="label center">{t.loadingBoard}</p>
	{/if}

	<section aria-labelledby="players-h">
		<div class="row">
			<h2 id="players-h" class="label">{t.players}</h2>
			<p class="label">{players.length}/{LIMITS.players}</p>
		</div>
		{#if winner}
			<p class="winner">
				<span class="label">{t.firstBingo}</span>
				<strong>{winner.name}</strong>
			</p>
		{/if}
		{#if players.length}
			<ol class="players">
				{#each players as p, i (p.id)}
					<li class:me={p.id === seat?.id} class:bingo={p.bingoAt}>
						<span class="rank">{String(i + 1).padStart(2, '0')}</span>
						<div class="who">
							<p>
								{p.name}
								{#if p.id === seat?.id}<span class="label">{t.you}</span>{/if}
							</p>
							<div class="dots" role="img" aria-label={t.progress(p.marked, total)}>
								{#each { length: total }, d (d)}
									<span class:on={d < p.marked}></span>
								{/each}
							</div>
						</div>
						<span class="score label">
							{#if p.bingoAt}<span class="badge">BINGO</span>{/if}
							{t.lines(p.lines)}
						</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="muted">{t.nobody}</p>
		{/if}
	</section>

	<section aria-labelledby="rules-h">
		<h2 id="rules-h" class="label">{t.rules}</h2>
		<Rules />
	</section>
{/if}

{#if toast}
	<div class="toast" role="status">{toast}</div>
{/if}

<style>
	section {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-12);
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.center {
		justify-items: center;
		text-align: center;
	}

	h2 {
		font-size: var(--text-base);
		font-weight: 500;
	}

	.muted {
		color: var(--muted-fg);
		font-size: var(--text-sm);
	}

	.hit {
		color: var(--accent-text);
	}

	.code,
	.dot-big {
		margin: 0;
		font-family: var(--font-dot);
		font-weight: 900;
		font-size: clamp(3rem, 16vw, 6rem);
		line-height: 1;
		letter-spacing: 0.06em;
	}

	.muted-dot {
		color: var(--muted-fg);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
	}

	.status.offline .pulse {
		background: var(--muted-fg);
	}

	.join {
		display: grid;
		gap: var(--space-3);
		max-width: 24rem;
	}

	.field {
		display: grid;
		gap: var(--space-1);
	}

	.tally {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.dot-num {
		font-family: var(--font-dot);
		font-weight: 900;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--fg);
	}

	.winner {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--accent);
		border-radius: var(--radius);
	}

	.players {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.players li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.players li.me {
		border-color: var(--border-strong);
	}

	.rank {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--muted-fg);
	}

	.bingo .rank {
		color: var(--accent-text);
	}

	.who {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}

	.who p {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dots {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 6px);
		gap: 2px;
	}

	.dots span {
		height: 6px;
		border-radius: 1px;
		background: var(--muted);
	}

	.dots span.on {
		background: var(--fg);
	}

	.bingo .dots span.on {
		background: var(--accent);
	}

	.score {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		white-space: nowrap;
	}

	.badge {
		padding: 0.1em 0.5em;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-fg);
	}

	.toast {
		position: fixed;
		left: 50%;
		bottom: var(--space-6);
		z-index: var(--z-toast);
		translate: -50% 0;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--fg);
		color: var(--bg);
		font-weight: 500;
		max-width: calc(100vw - 2 * var(--space-4));
	}

	@media (prefers-reduced-motion: no-preference) {
		.status:not(.offline) .pulse {
			animation: pulse 1.6s ease-in-out infinite;
		}

		.toast {
			animation: rise 0.3s var(--ease-out);
		}
	}

	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: -50% 0.5rem;
		}
	}
</style>
