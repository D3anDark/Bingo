<script lang="ts">
	import { LIMITS } from '#lib/bingo.ts';
	import { i18n } from '#lib/i18n.svelte.ts';

	const t = $derived(i18n.t);
</script>

<ol>
	{#each t.rulesList(LIMITS.players) as rule, i (i)}
		<li>{rule}</li>
	{/each}
</ol>

<style>
	ol {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding-left: 2.5em;
		list-style: decimal-leading-zero;
	}

	li::marker {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--muted-fg);
	}
</style>
