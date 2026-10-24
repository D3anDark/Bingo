<script lang="ts">
	import { goto } from '$app/navigation';
	import Board from '#lib/Board.svelte';
	import { api, describe } from '#lib/api.ts';
	import {
		CODE_RE,
		FREE,
		LIMITS,
		SIZES,
		cleanItems,
		hasFree,
		makeBoard,
		needed,
		winningLines
	} from '#lib/bingo.ts';
	import { i18n } from '#lib/i18n.svelte.ts';
	import { load, save, seatKey, type Seat } from '#lib/storage.ts';

	type Solo = {
		items: string[];
		size: number;
		free: boolean;
		cells: (string | null)[] | null;
		marks: number[];
	};

	const t = $derived(i18n.t);

	const KEY = 'bingo:solo';
	const fresh = (): Solo => ({ items: [], size: 5, free: true, cells: null, marks: [] });

	let s = $state<Solo>({ ...fresh(), ...load<Solo>(KEY) });
	$effect(() => save(KEY, $state.snapshot(s)));

	const min = $derived(needed(s));
	const boardSize = $derived(s.cells ? Math.sqrt(s.cells.length) : s.size);
	const total = $derived(s.cells ? s.cells.filter((c) => c !== null).length : min);
	const lines = $derived(
		s.cells ? winningLines(boardSize, (i) => s.marks.includes(i) || s.cells?.[i] === null).length : 0
	);
	const stale = $derived(
		s.cells !== null && (boardSize !== s.size || s.cells.includes(null) !== hasFree(s))
	);

	// Notes are thunks so they follow a language switch.
	type Note = (() => string) | null;

	let draft = $state('');
	let bulk = $state('');
	let bulkOpen = $state(false);
	let itemsNote = $state<Note>(null);

	function addItems(raw: string[]) {
		const before = s.items.length;
		const next = cleanItems([...s.items, ...raw]).slice(0, LIMITS.items);
		const added = next.length - before;
		const skipped = raw.filter((r) => r.trim()).length - added;
		const full = next.length >= LIMITS.items;
		s.items = next;
		itemsNote = skipped > 0 ? () => t.skipped(skipped, full) : null;
		return added;
	}

	function addOne(e: SubmitEvent) {
		e.preventDefault();
		if (addItems([draft]) > 0 || !draft.trim()) draft = '';
	}

	function addBulk() {
		addItems(bulk.split('\n'));
		bulk = '';
		bulkOpen = false;
	}

	function generate() {
		const board = makeBoard(s.items.length, s);
		s.cells = board.map((i) => (i === FREE ? null : s.items[i]));
		s.marks = [];
	}

	function toggle(i: number) {
		s.marks = s.marks.includes(i) ? s.marks.filter((m) => m !== i) : [...s.marks, i];
	}

	// Multiplayer
	let name = $state(load<string>('bingo:name') ?? '');
	let title = $state('');
	let joinCode = $state('');
	let roomNote = $state<Note>(null);
	let creating = $state(false);

	async function createRoom(e: SubmitEvent) {
		e.preventDefault();
		creating = true;
		roomNote = null;
		try {
			const res = await api<Seat & { code: string }>('/api/rooms', {
				method: 'POST',
				body: JSON.stringify({ name, title, items: s.items, size: s.size, free: s.free })
			});
			save('bingo:name', name.trim());
			save(seatKey(res.code), { id: res.id, token: res.token });
			await goto(`/r/${res.code}`);
		} catch (err) {
			roomNote = () => describe(err);
		} finally {
			creating = false;
		}
	}

	const normalizedCode = $derived(joinCode.toUpperCase().replace(/[^A-Z0-9]/g, ''));

	function joinRoom(e: SubmitEvent) {
		e.preventDefault();
		if (CODE_RE.test(normalizedCode)) goto(`/r/${normalizedCode}`);
		else roomNote = () => t.badCode;
	}

	// Backup
	function exportData() {
		const blob = new Blob([JSON.stringify($state.snapshot(s), null, 2)], {
			type: 'application/json'
		});
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'bingo.json';
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function importData(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			// Also reads files exported by the old version, which only need `items`.
			const data = JSON.parse(await file.text());
			if (!Array.isArray(data?.items)) throw new Error('no items');
			const size = SIZES.includes(data.size) ? data.size : s.size;
			const cells =
				Array.isArray(data.cells) && data.cells.length === size * size ? data.cells : null;
			s = {
				items: cleanItems(data.items).slice(0, LIMITS.items),
				size,
				free: typeof data.free === 'boolean' ? data.free : s.free,
				cells,
				marks: cells && Array.isArray(data.marks) ? data.marks.filter(Number.isInteger) : []
			};
			const count = s.items.length;
			itemsNote = () => t.imported(t.items(count));
		} catch {
			itemsNote = () => t.badFile;
		}
	}

	function resetAll() {
		if (confirm(t.confirmDelete)) s = fresh();
	}
</script>

<section class="intro">
	<p>
		{#each t.intro as part, i (i)}{#if i % 2}<code>{part}</code>{:else}{part}{/if}{/each}
	</p>
</section>

<section aria-labelledby="board-h">
	<div class="row">
		<h2 id="board-h" class="label">{t.board(boardSize)}</h2>
		<p class="label tally">
			{#if lines > 0}<span class="hit">{t.lines(lines)}</span>{/if}
			<span class="dot-num">{String(s.marks.length).padStart(2, '0')}</span>/{total}
		</p>
	</div>

	<Board size={boardSize} cells={s.cells} marks={s.marks} onToggle={toggle}>
		{#snippet empty()}
			<p class="empty-note">
				{#if s.items.length < min}
					{t.needMore(min - s.items.length, s.size)}
				{:else}
					<button type="button" class="btn primary" onclick={generate}>{t.generate}</button>
				{/if}
			</p>
		{/snippet}
	</Board>

	{#if s.cells}
		<div class="actions">
			<button type="button" class="btn" onclick={generate} disabled={s.items.length < min}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
				</svg>
				{t.regenerate}
			</button>
			<button type="button" class="btn ghost" onclick={() => (s.marks = [])} disabled={!s.marks.length}>
				{t.clearMarks}
			</button>
			{#if stale}
				<p class="label">{t.stale}</p>
			{/if}
		</div>
	{/if}
</section>

<section aria-labelledby="settings-h">
	<h2 id="settings-h" class="label">[01] {t.settings}</h2>
	<div class="settings">
		<fieldset class="segmented">
			<legend class="visually-hidden">{t.boardSize}</legend>
			{#each SIZES as n (n)}
				<label>
					<input type="radio" name="size" value={n} bind:group={s.size} />
					<span>{n}×{n}</span>
				</label>
			{/each}
		</fieldset>
		<label class="switch" class:off={s.size % 2 === 0}>
			<input type="checkbox" bind:checked={s.free} disabled={s.size % 2 === 0} />
			<span class="track" aria-hidden="true"></span>
			{t.freeCell}
			{#if s.size % 2 === 0}<span class="label">{t.oddOnly}</span>{/if}
		</label>
	</div>
</section>

<section aria-labelledby="items-h">
	<div class="row">
		<h2 id="items-h" class="label">[02] {t.phrases}</h2>
		<p class="label">
			<span class:hit={s.items.length < min}>{s.items.length}</span> / {t.min} {min}
		</p>
	</div>

	<form class="add" onsubmit={addOne}>
		<label class="visually-hidden" for="draft">{t.newItem}</label>
		<input
			id="draft"
			class="input"
			bind:value={draft}
			maxlength={LIMITS.item}
			placeholder={t.itemPlaceholder}
			autocomplete="off"
		/>
		<button class="btn primary" disabled={!draft.trim()}>{t.add}</button>
		<button type="button" class="btn ghost" aria-expanded={bulkOpen} onclick={() => (bulkOpen = !bulkOpen)}>
			{t.pasteList}
		</button>
	</form>

	{#if bulkOpen}
		<div class="bulk">
			<label class="visually-hidden" for="bulk">{t.bulkLabel}</label>
			<textarea id="bulk" class="input" bind:value={bulk} rows="6" placeholder={t.bulkPlaceholder}
			></textarea>
			<button type="button" class="btn primary" onclick={addBulk} disabled={!bulk.trim()}>
				{t.addFromList}
			</button>
		</div>
	{/if}

	<p class="label note" aria-live="polite">{itemsNote?.() ?? ''}</p>

	{#if s.items.length}
		<ul class="chips">
			{#each s.items as item (item)}
				<li>
					<span>{item}</span>
					<button
						type="button"
						aria-label={t.remove(item)}
						onclick={() => (s.items = s.items.filter((x) => x !== item))}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">{t.noItems}</p>
	{/if}
</section>

<section aria-labelledby="room-h">
	<h2 id="room-h" class="label">[03] {t.withFriends}</h2>
	<div class="rooms">
		<form class="card" onsubmit={createRoom}>
			<h3>{t.newRoom}</h3>
			<p class="muted">{t.newRoomHint(s.size)}</p>
			<label class="field">
				<span class="label">{t.nick}</span>
				<input class="input" bind:value={name} maxlength={LIMITS.name} required autocomplete="nickname" />
			</label>
			<label class="field">
				<span class="label">{t.roomName}</span>
				<input class="input" bind:value={title} maxlength={LIMITS.title} placeholder="Bingo" />
			</label>
			<button class="btn primary" disabled={creating || s.items.length < min || !name.trim()}>
				{creating ? t.creating : t.createRoom}
			</button>
			{#if s.items.length < min}
				<p class="label">{t.addFirst(t.items(min))}</p>
			{/if}
		</form>

		<form class="card" onsubmit={joinRoom}>
			<h3>{t.haveCode}</h3>
			<p class="muted">{t.haveCodeHint}</p>
			<label class="field">
				<span class="label">{t.roomCode}</span>
				<input
					class="input code-input"
					bind:value={joinCode}
					maxlength="8"
					placeholder="K7QX2M"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
				/>
			</label>
			<button class="btn" disabled={normalizedCode.length !== 6}>{t.join}</button>
		</form>
	</div>
	<p class="label note hit" aria-live="polite">{roomNote?.() ?? ''}</p>
</section>

<details class="more">
	<summary class="label">{t.more}</summary>
	<div class="actions">
		<button type="button" class="btn ghost" onclick={exportData}>{t.exportFile}</button>
		<label class="btn ghost">
			{t.importFile}
			<input type="file" accept=".json,application/json" class="visually-hidden" onchange={importData} />
		</label>
		<button type="button" class="btn ghost danger" onclick={resetAll}>{t.deleteAll}</button>
	</div>
</details>

<style>
	section,
	.more {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-12);
	}

	.intro {
		max-width: 34rem;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
	}

	h3 {
		margin: 0;
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
		letter-spacing: 0.02em;
	}

	.empty-note {
		max-width: 20rem;
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--bg);
		font-size: var(--text-sm);
		color: var(--muted-fg);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.settings {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
	}

	.segmented {
		display: inline-flex;
		margin: 0;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.segmented label {
		position: relative;
	}

	.segmented input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}

	.segmented span {
		display: block;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--muted-fg);
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.segmented input:checked + span {
		background: var(--fg);
		color: var(--bg);
	}

	.segmented input:focus-visible + span {
		outline: 2px solid var(--fg);
		outline-offset: 2px;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.switch.off {
		color: var(--muted-fg);
		cursor: not-allowed;
	}

	.switch input {
		position: absolute;
		opacity: 0;
	}

	.track {
		position: relative;
		width: 2rem;
		height: 1.125rem;
		border-radius: var(--radius-full);
		background: var(--muted);
		transition: background-color 0.15s;
	}

	.track::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: calc(1.125rem - 6px);
		height: calc(1.125rem - 6px);
		border-radius: 50%;
		background: var(--muted-fg);
		transition:
			transform 0.2s var(--ease-out),
			background-color 0.15s;
	}

	.switch input:checked + .track {
		background: var(--accent);
	}

	.switch input:checked + .track::after {
		transform: translateX(0.875rem);
		background: var(--accent-fg);
	}

	.switch input:focus-visible + .track {
		outline: 2px solid var(--fg);
		outline-offset: 2px;
	}

	.add {
		display: flex;
		gap: var(--space-2);
	}

	.add .input {
		flex: 1;
		min-width: 0;
	}

	.bulk {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}

	textarea.input {
		resize: vertical;
		field-sizing: content;
		min-height: 6rem;
		max-height: 50vh;
	}

	.note:empty {
		display: none;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chips li {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		border-radius: var(--radius-full);
		background: var(--muted);
		font-size: var(--text-sm);
	}

	.chips span {
		padding: var(--space-1) 0 var(--space-1) var(--space-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chips button {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		flex: none;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: var(--muted-fg);
		cursor: pointer;
	}

	.chips button:hover {
		color: var(--accent-text);
	}

	.chips svg {
		width: 0.875rem;
		height: 0.875rem;
	}

	.rooms {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-3);
	}

	.rooms .card {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	.field {
		display: grid;
		gap: var(--space-1);
	}

	.code-input {
		font-family: var(--font-mono);
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}

	.more summary {
		cursor: pointer;
		width: fit-content;
	}

	.more summary:hover {
		color: var(--fg);
	}
</style>
