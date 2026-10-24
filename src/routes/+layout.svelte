<script lang="ts">
	import '@fontsource-variable/geist';
	import '@fontsource-variable/geist-mono';
	import '@fontsource/doto/800.css';
	import '@fontsource/doto/900.css';
	import '../app.css';
	import { resolve } from '$app/paths';
	import { i18n } from '#lib/i18n.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const t = $derived(i18n.t);

	$effect(() => {
		document.documentElement.lang = i18n.lang;
	});

	function toggleTheme() {
		const root = document.documentElement;
		const current =
			root.dataset.theme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
		const next = current === 'dark' ? 'light' : 'dark';
		root.dataset.theme = next;
		try {
			localStorage.setItem('bingo:theme', next);
		} catch {
			// Theme still switches for this visit.
		}
	}
</script>

<div class="page">
	<header>
		<a href={resolve('/')} class="brand" aria-label={t.home}>
			<svg class="logo" viewBox="0 0 20 20" aria-hidden="true">
				{#each { length: 25 }, i (i)}
					<circle
						cx={2 + (i % 5) * 4}
						cy={2 + Math.floor(i / 5) * 4}
						r="1.3"
						class:hit={i % 6 === 0}
					/>
				{/each}
			</svg>
			<span>
				<strong>Bingo</strong>
				<small>{t.tagline}</small>
			</span>
		</a>
		<div class="tools">
			<button
				type="button"
				class="btn ghost icon-btn lang"
				onclick={i18n.toggle}
				lang={t.otherLang.code}
				aria-label={t.otherLang.label}
			>
				{t.otherLang.short}
			</button>
			<button type="button" class="btn ghost icon-btn" onclick={toggleTheme} aria-label={t.theme}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
				</svg>
			</button>
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="label">
		<a href="https://github.com/D3anDark/Bingo">GitHub</a>
		<a href="https://deandark.me">DeanDark</a>
	</footer>
</div>

<style>
	.page {
		width: 100%;
		max-width: 42rem;
		margin: 0 auto;
		padding: 0 var(--space-4);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--border);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		text-decoration: none;
		min-width: 0;
	}

	.brand span {
		display: grid;
		min-width: 0;
	}

	.brand strong {
		font-weight: 500;
	}

	.brand small {
		font-size: var(--text-sm);
		color: var(--muted-fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tools {
		display: flex;
		flex: none;
		gap: var(--space-1);
	}

	.lang {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.08em;
	}

	.logo {
		width: 2.5rem;
		height: 2.5rem;
		flex: none;
		padding: 0.45rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface);
		fill: var(--border-strong);
	}

	.logo .hit {
		fill: var(--fg);
	}

	.logo .hit:last-child {
		fill: var(--accent);
	}

	main {
		padding: var(--space-8) 0 var(--space-12);
	}

	footer {
		display: flex;
		justify-content: space-between;
		padding: var(--space-4) 0 var(--space-8);
		border-top: 1px solid var(--border);
	}

	footer a {
		text-decoration: none;
	}

	footer a:hover {
		color: var(--fg);
	}
</style>
