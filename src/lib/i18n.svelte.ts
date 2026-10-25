import { resolve } from '$app/paths';
import { load, save } from './storage.ts';

const plRules = new Intl.PluralRules('pl');
/** "1 hasło", "3 hasła", "5 haseł", "22 hasła". */
function pln(n: number, one: string, few: string, many: string) {
	const form = plRules.select(n);
	return `${n} ${form === 'one' ? one : form === 'few' ? few : many}`;
}
const enn = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

const pl = {
	tagline: 'Plansze na imprezy, streamy i spotkania',
	home: 'Bingo, strona główna',
	theme: 'Zmień motyw',
	streamer: 'Tryb streamera: ukrywa kod pokoju',
	streamerShort: 'Streamer',
	hideCode: 'Ukryj kod',
	showCode: 'Pokaż kod',
	otherLang: { code: 'en', short: 'EN', label: 'Switch to English' },

	// Odd entries render as <code> chips.
	intro: [
		'Wpisz hasła, wylosuj planszę i skreślaj, co się wydarzy. Albo ',
		'stwórz pokój',
		', wyślij znajomym kod i sprawdźcie, kto pierwszy ma ',
		'BINGO',
		'.'
	],
	board: (n: number) => `Plansza ${n}×${n}`,
	lines: (n: number) => pln(n, 'linia', 'linie', 'linii'),
	items: (n: number) => pln(n, 'hasło', 'hasła', 'haseł'),
	needMore: (k: number, n: number) =>
		`Dodaj jeszcze ${pln(k, 'hasło', 'hasła', 'haseł')}, żeby wylosować planszę ${n}×${n}.`,
	generate: 'Wylosuj planszę',
	regenerate: 'Wylosuj ponownie',
	clearMarks: 'Wyczyść zaznaczenia',
	stale: 'Ustawienia zmienione. Wylosuj ponownie, żeby je zastosować.',

	settings: 'Ustawienia',
	boardSize: 'Rozmiar planszy',
	freeCell: 'Pole FREE w środku',
	oddOnly: '(tylko nieparzyste)',

	phrases: 'Hasła',
	min: 'min.',
	newItem: 'Nowe hasło',
	itemPlaceholder: 'np. Ktoś się spóźni',
	add: 'Dodaj',
	pasteList: 'Wklej listę',
	bulkLabel: 'Lista haseł, jedno w linii',
	bulkPlaceholder: 'Jedno hasło w linii',
	addFromList: 'Dodaj z listy',
	skipped: (n: number, full: boolean) =>
		`Pominięto ${n}: ${full ? 'limit haseł albo ' : ''}już są na liście.`,
	noItems: 'Brak haseł. Dodaj pierwsze albo wklej całą listę naraz.',
	remove: (item: string) => `Usuń: ${item}`,

	withFriends: 'Graj ze znajomymi',
	newRoom: 'Nowy pokój',
	newRoomHint: (n: number) =>
		`Każdy dostaje własną planszę z Twoich haseł (${n}×${n}). Wygrywa, kto pierwszy skreśli linię.`,
	nick: 'Twój nick',
	roomName: 'Nazwa pokoju (opcjonalnie)',
	createRoom: 'Stwórz pokój',
	creating: 'Tworzę…',
	addFirst: (items: string) => `Najpierw dodaj co najmniej ${items}.`,
	rules: 'Zasady gry online',
	rulesList: (players: number) => [
		'Każdy gracz dostaje własną, losowo ułożoną planszę z haseł pokoju. Rozmiar, pole FREE i hasła ustala twórca pokoju.',
		'Skreślaj tylko to, co naprawdę się wydarzyło. Nikt tego nie sprawdza, gracie na słowo honoru.',
		'BINGO to pełny wiersz, kolumna albo przekątna, a pole FREE liczy się jako skreślone. Wygrywa, kto zrobi je pierwszy; dalej liczą się linie i skreślone pola.',
		'Jeśli odznaczysz pole i nie zostanie Ci żadna pełna linia, tracisz BINGO i jego czas.',
		`Pokój mieści ${players} graczy i znika po dobie bez aktywności. Twoje miejsce pamięta ta przeglądarka; na innym urządzeniu dołączysz jako nowy gracz.`
	],
	haveCode: 'Mam kod',
	haveCodeHint: 'Wpisz kod zaproszenia od znajomego.',
	roomCode: 'Kod pokoju',
	join: 'Dołącz',
	badCode: 'Kod ma 6 znaków, np. K7QX2M.',

	exportFile: 'Eksportuj do pliku',
	importFile: 'Importuj z pliku',
	deleteAll: 'Usuń wszystkie hasła',
	confirmDelete: 'Usunąć wszystkie hasła i planszę?',
	imported: (items: string) => `Wczytano ${items}.`,
	badFile: 'Ten plik nie wygląda na eksport z Bingo.',

	room: 'Pokój',
	invalidCode: 'Ten kod nie wygląda poprawnie.',
	backHome: 'Wróć na start',
	live: 'Na żywo',
	connecting: 'Łączę',
	offline: 'Brak połączenia, ponawiam',
	codeLabel: (spelled: string) => `Kod pokoju: ${spelled}`,
	codeHidden: 'Kod pokoju ukryty',
	streamerHint: 'Tryb streamera: kod jest ukryty, także w pasku adresu. Skopiuj link przyciskiem powyżej i wyślij go znajomym poza streamem.',
	copyFailed: 'Nie udało się skopiować linku.',
	copyLink: 'Kopiuj link',
	copied: 'Skopiowano',
	copyPrompt: 'Skopiuj link:',
	share: 'Udostępnij',
	shareText: (code: string) => `Zagraj ze mną w bingo, kod ${code}`,
	joinGame: 'Dołącz do gry',
	joinHint: 'Dostaniesz własną, losową planszę. Kto pierwszy skreśli linię, wygrywa.',
	joining: 'Dołączam…',
	yourBoard: 'Twoja plansza',
	notSaved: 'Nie zapisano, ponawiam',
	loadingBoard: 'Wczytuję planszę…',
	players: 'Gracze',
	firstBingo: 'Pierwsze bingo',
	you: 'ty',
	progress: (marked: number, total: number) => `${marked} z ${total} pól`,
	nobody: 'Nikogo jeszcze nie ma.',
	gotBingo: (name: string) => `${name} ma BINGO!`,

	serverError: (status: number) => `Błąd serwera (${status}).`,
	// Keys are the codes the API sends as `message`.
	errors: {
		network: 'Brak połączenia z serwerem.',
		rate_limited: 'Za dużo prób. Odczekaj minutę.',
		too_large: 'Za dużo danych.',
		bad_request: 'Niepoprawne dane.',
		name_required: 'Podaj swój nick.',
		too_few_items: 'Za mało haseł na taką planszę.',
		create_failed: 'Nie udało się utworzyć pokoju. Spróbuj ponownie.',
		room_not_found: 'Nie ma takiego pokoju albo już wygasł.',
		room_full: 'Pokój jest pełny.',
		name_taken: 'Ten nick jest już zajęty w tym pokoju.',
		join_failed: 'Spróbuj dołączyć jeszcze raz.',
		not_in_room: 'Nie ma cię w tym pokoju.',
		forbidden: 'Brak dostępu do tej planszy.'
	}
};

const en: typeof pl = {
	tagline: 'Boards for parties, streams and meetings',
	home: 'Bingo, home',
	theme: 'Toggle theme',
	streamer: 'Streamer mode: hides the room code',
	streamerShort: 'Streamer',
	hideCode: 'Hide code',
	showCode: 'Show code',
	otherLang: { code: 'pl', short: 'PL', label: 'Przełącz na polski' },

	intro: [
		'Add your phrases, draw a board and mark what happens. Or ',
		'create a room',
		', send friends the code and see who gets ',
		'BINGO',
		' first.'
	],
	board: (n) => `Board ${n}×${n}`,
	lines: (n) => enn(n, 'line', 'lines'),
	items: (n) => enn(n, 'phrase', 'phrases'),
	needMore: (k, n) => `Add ${k} more ${k === 1 ? 'phrase' : 'phrases'} to draw a ${n}×${n} board.`,
	generate: 'Draw a board',
	regenerate: 'Draw again',
	clearMarks: 'Clear marks',
	stale: 'Settings changed. Draw again to apply them.',

	settings: 'Settings',
	boardSize: 'Board size',
	freeCell: 'FREE cell in the middle',
	oddOnly: '(odd sizes only)',

	phrases: 'Phrases',
	min: 'min.',
	newItem: 'New phrase',
	itemPlaceholder: 'e.g. Someone shows up late',
	add: 'Add',
	pasteList: 'Paste a list',
	bulkLabel: 'List of phrases, one per line',
	bulkPlaceholder: 'One phrase per line',
	addFromList: 'Add from list',
	skipped: (n, full) => `Skipped ${n}: ${full ? 'phrase limit reached or ' : ''}already on the list.`,
	noItems: 'No phrases yet. Add the first one or paste a whole list.',
	remove: (item) => `Remove: ${item}`,

	withFriends: 'Play with friends',
	newRoom: 'New room',
	newRoomHint: (n) =>
		`Everyone gets their own board from your phrases (${n}×${n}). First to complete a line wins.`,
	nick: 'Your nickname',
	roomName: 'Room name (optional)',
	createRoom: 'Create room',
	creating: 'Creating…',
	addFirst: (items) => `Add at least ${items} first.`,
	rules: 'Online rules',
	rulesList: (players) => [
		"Each player gets their own randomly arranged board from the room's phrases. The room creator sets the size, the FREE cell and the phrases.",
		'Only mark what actually happened. Nobody checks, it is an honor system.',
		'BINGO is a full row, column or diagonal, and the FREE cell counts as marked. The first BINGO wins; after that, lines and marked cells decide.',
		'Unmark a cell and lose your last full line, and you lose your BINGO and its time.',
		`A room holds ${players} players and expires after a day without activity. This browser remembers your seat; on another device you join as a new player.`
	],
	haveCode: 'I have a code',
	haveCodeHint: 'Enter the invite code from a friend.',
	roomCode: 'Room code',
	join: 'Join',
	badCode: 'Codes are 6 characters, e.g. K7QX2M.',

	exportFile: 'Export to file',
	importFile: 'Import from file',
	deleteAll: 'Delete all phrases',
	confirmDelete: 'Delete all phrases and the board?',
	imported: (items) => `Loaded ${items}.`,
	badFile: 'This file does not look like a Bingo export.',

	room: 'Room',
	invalidCode: 'This code does not look right.',
	backHome: 'Back to start',
	live: 'Live',
	connecting: 'Connecting',
	offline: 'Offline, retrying',
	codeLabel: (spelled) => `Room code: ${spelled}`,
	codeHidden: 'Room code hidden',
	streamerHint: 'Streamer mode: the code is hidden, in the address bar too. Copy the link with the button above and send it to friends off stream.',
	copyFailed: 'Could not copy the link.',
	copyLink: 'Copy link',
	copied: 'Copied',
	copyPrompt: 'Copy the link:',
	share: 'Share',
	shareText: (code) => `Play bingo with me, code ${code}`,
	joinGame: 'Join the game',
	joinHint: 'You get your own random board. First to complete a line wins.',
	joining: 'Joining…',
	yourBoard: 'Your board',
	notSaved: 'Not saved, retrying',
	loadingBoard: 'Loading board…',
	players: 'Players',
	firstBingo: 'First bingo',
	you: 'you',
	progress: (marked, total) => `${marked} of ${total} cells`,
	nobody: 'Nobody here yet.',
	gotBingo: (name) => `${name} got BINGO!`,

	serverError: (status) => `Server error (${status}).`,
	errors: {
		network: 'Cannot reach the server.',
		rate_limited: 'Too many attempts. Wait a minute.',
		too_large: 'Too much data.',
		bad_request: 'Invalid data.',
		name_required: 'Enter your nickname.',
		too_few_items: 'Not enough phrases for this board.',
		create_failed: 'Could not create the room. Try again.',
		room_not_found: 'This room does not exist or has expired.',
		room_full: 'The room is full.',
		name_taken: 'This nickname is already taken in this room.',
		join_failed: 'Try joining again.',
		not_in_room: 'You are not in this room.',
		forbidden: 'No access to this board.'
	}
};

export type Lang = 'pl' | 'en';
const dict = { pl, en };
const KEY = 'bingo:lang';

function initial(): Lang {
	// An English link (/en) wins over the saved choice for that visit; it is not saved.
	if (location.pathname === resolve('/en')) return 'en';
	const saved = load<string>(KEY);
	if (saved === 'pl' || saved === 'en') return saved;
	return navigator.languages.some((l) => l.toLowerCase().startsWith('pl')) ? 'pl' : 'en';
}

let lang = $state<Lang>(initial());

export const i18n = {
	get lang() {
		return lang;
	},
	get t() {
		return dict[lang];
	},
	toggle() {
		lang = lang === 'pl' ? 'en' : 'pl';
		save(KEY, lang);
	}
};
