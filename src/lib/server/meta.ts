import type { Lang } from '#lib/i18n.svelte.ts';

// Link preview tags, rendered into the static HTML by hooks.server.ts.
// Absolute URLs, since link previews (Discord and others) resolve nothing relative.
const HOME = 'https://deandark.me/Bingo/';

const copy = {
	pl: {
		url: HOME,
		locale: 'pl_PL',
		description:
			'Twórz plansze bingo na imprezy, streamy i spotkania. Graj sam albo ze znajomymi na kod zaproszenia.',
		summary: 'Plansze bingo. Sam albo ze znajomymi na kod zaproszenia.',
		image: HOME + 'og.png',
		alt: 'Przykładowa plansza 5×5 z bingo po przekątnej',
		kicker: 'DeanDark · plansze bingo',
		lead: 'Twórz plansze na imprezy, streamy i spotkania. Graj sam albo ze znajomymi na kod zaproszenia.',
		features: [
			'**Sam** · własne hasła, plansze zapisane w przeglądarce, eksport do pliku',
			'**Ze znajomymi** · pokój na kod, każdy dostaje pola w innej kolejności',
			'**Tryb streamera** · kod pokoju ukryty na ekranie i w pasku adresu',
			'-# Plansze od 3×3 do 6×6, do 50 graczy w pokoju'
		],
		play: 'Zagraj'
	},
	en: {
		url: HOME + 'en',
		locale: 'en_US',
		description:
			'Make bingo boards for parties, streams and meetings. Play solo or with friends using an invite code.',
		summary: 'Bingo boards. Solo or with friends using an invite code.',
		image: HOME + 'og-en.png',
		alt: 'Sample 5×5 board with a diagonal bingo',
		kicker: 'DeanDark · bingo boards',
		lead: 'Make boards for parties, streams and meetings. Play solo or with friends using an invite code.',
		features: [
			'**Solo** · your own phrases, boards saved in the browser, export to a file',
			'**With friends** · a room behind a code, everyone gets the cells in a different order',
			'**Streamer mode** · the room code stays off the screen and out of the address bar',
			'-# Boards from 3×3 to 6×6, up to 50 players per room'
		],
		play: 'Play'
	}
} satisfies Record<Lang, unknown>;

// Discord component embed: a Components V2 card in place of the Open Graph preview.
// Discord runs no JS, so it has to be in the static HTML.
// Spec: https://docs.discord.com/developers/link-previews/component-embeds
function card(c: (typeof copy)[Lang]) {
	const json = JSON.stringify({
		component: {
			type: 17,
			accent_color: 0xd71921,
			components: [
				{ type: 12, items: [{ media: { url: c.image }, description: c.alt }] },
				{
					type: 9,
					components: [{ type: 10, content: `# [Bingo](${c.url})\n-# ${c.kicker}\n${c.lead}` }],
					accessory: { type: 11, media: { url: HOME + 'apple-touch-icon.png' } }
				},
				{ type: 14 },
				{ type: 10, content: c.features.join('\n') },
				{
					type: 1,
					components: [
						{ type: 2, style: 5, url: c.url, label: c.play },
						{ type: 2, style: 5, url: 'https://github.com/D3anDark/Bingo', label: 'GitHub' },
						{ type: 2, style: 5, url: 'https://deandark.me/', label: 'deandark.me' }
					]
				}
			]
		}
	}).replace(/</g, '\\u003c');
	// Over 3,000 bytes Discord silently falls back to Open Graph, so fail the build instead.
	const size = new TextEncoder().encode(json).length;
	if (size > 3000) throw new Error(`Discord component embed is ${size} bytes, the limit is 3000`);
	return `<script id="discord:component-embed" type="application/json">${json}</script>`;
}

function render(lang: Lang) {
	const c = copy[lang];
	const other = copy[lang === 'pl' ? 'en' : 'pl'];
	return [
		`<meta name="description" content="${c.description}" />`,
		`<meta property="og:title" content="Bingo" />`,
		`<meta property="og:description" content="${c.summary}" />`,
		`<meta property="og:type" content="website" />`,
		`<meta property="og:site_name" content="DeanDark" />`,
		`<meta property="og:locale" content="${c.locale}" />`,
		`<meta property="og:locale:alternate" content="${other.locale}" />`,
		`<meta property="og:image" content="${c.image}" />`,
		`<meta property="og:image:width" content="1200" />`,
		`<meta property="og:image:height" content="630" />`,
		`<meta property="og:image:alt" content="${c.alt}" />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
		card(c)
	].join('\n\t\t');
}

export const meta = { pl: render('pl'), en: render('en') };
