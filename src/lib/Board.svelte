<script lang="ts">
	import type { Snippet } from 'svelte';
	import { winningLines } from '#lib/bingo.ts';
	import { i18n } from '#lib/i18n.svelte.ts';

	type Props = {
		size: number;
		/** Cell labels, `null` for the FREE cell. `null` overall: no board yet. */
		cells: (string | null)[] | null;
		marks: number[];
		onToggle?: (cell: number) => void;
		empty?: Snippet;
	};

	let { size, cells, marks, onToggle, empty }: Props = $props();

	const marked = $derived(new Set(marks));
	const isOn = (i: number) => marked.has(i) || cells?.[i] === null;
	const lines = $derived(cells ? winningLines(size, isOn) : []);
	const inLine = $derived(new Set(lines.flat()));

	let party = $state(false);
	let seen = -1;

	// Celebrate only when a line is added by a click, not when a saved board loads.
	$effect(() => {
		const n = lines.length;
		const grew = seen >= 0 && n > seen;
		seen = n;
		if (!grew) return;
		party = true;
		const timer = setTimeout(() => (party = false), 2200);
		return () => {
			clearTimeout(timer);
			party = false;
		};
	});
</script>

<div class="board" style:--n={size}>
	<div class="grid" class:blank={!cells}>
		{#if cells}
			{#each cells as label, i (i)}
				{#if label === null}
					<div class="cell free" class:win={inLine.has(i)}>
						<span>FREE</span>
					</div>
				{:else}
					<button
						type="button"
						class="cell"
						class:on={marked.has(i)}
						class:win={inLine.has(i)}
						aria-pressed={marked.has(i)}
						title={label}
						onclick={() => onToggle?.(i)}
					>
						<span>{label}</span>
					</button>
				{/if}
			{/each}
		{:else}
			{#each { length: size * size }, i (i)}
				<div class="cell ghost"></div>
			{/each}
		{/if}
	</div>

	{#if !cells && empty}
		<div class="empty">{@render empty()}</div>
	{/if}

	{#if party}
		<div class="party" aria-hidden="true"><span>BINGO</span></div>
	{/if}

	<p class="visually-hidden" aria-live="polite">
		{lines.length > 0 ? `Bingo: ${i18n.t.lines(lines.length)}` : ''}
	</p>
</div>

<style>
	.board {
		position: relative;
		container-type: inline-size;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: 4px;
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		min-width: 0;
		padding: 4%;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: clamp(0.625rem, calc(15cqi / var(--n)), 1rem);
		font-weight: 500;
		line-height: 1.2;
		text-align: center;
		overflow: hidden;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.cell span {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
		line-clamp: 5;
		overflow: hidden;
		overflow-wrap: anywhere;
		hyphens: auto;
	}

	button.cell {
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	button.cell:hover {
		border-color: var(--border-strong);
	}

	.cell.on {
		background: var(--fg);
		border-color: var(--fg);
		color: var(--bg);
	}

	/* The red dot: Nothing's single accent, marking a stamped cell. */
	.cell.on::after {
		content: '';
		position: absolute;
		top: 7%;
		right: 7%;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
	}

	.cell.free {
		border-style: dashed;
		border-color: var(--border-strong);
		background: transparent;
		color: var(--muted-fg);
		font-family: var(--font-dot);
		font-weight: 800;
		font-size: clamp(0.75rem, calc(22cqi / var(--n)), 1.5rem);
		letter-spacing: 0.04em;
	}

	.cell.win {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
	}

	.cell.win::after {
		background: var(--accent-fg);
	}

	.cell.ghost {
		border-style: dashed;
		background: transparent;
	}

	.empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: var(--space-6);
		text-align: center;
	}

	.party {
		position: absolute;
		inset: 0;
		z-index: var(--z-overlay);
		display: grid;
		place-items: center;
		pointer-events: none;
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		border-radius: var(--radius);
	}

	.party span {
		font-family: var(--font-dot);
		font-weight: 900;
		font-size: 22cqi;
		line-height: 1;
		color: var(--accent-text);
		letter-spacing: 0.02em;
	}

	@media (prefers-reduced-motion: no-preference) {
		button.cell:active {
			transform: scale(0.96);
		}

		.cell.on,
		.cell.win {
			animation: stamp 0.25s var(--ease-out);
		}

		.party {
			animation: fade 2.2s var(--ease-out) both;
		}

		.party span {
			animation: pop 0.5s var(--ease-out) both;
		}
	}

	@keyframes stamp {
		from {
			transform: scale(0.9);
		}
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(1.4);
			filter: blur(8px);
		}
	}

	@keyframes fade {
		80% {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
</style>
