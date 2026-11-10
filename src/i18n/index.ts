const en = {
  appTitle: 'Jigsaw Puzzle',
  homeSubtitle: 'Choose a picture and start puzzling.',
  continuePuzzle: 'Continue puzzle',
  newPuzzle: 'New puzzle',
  settings: 'Settings',
  back: 'Back',
  menu: 'Menu',
  fitView: 'Show all',
  progress: '{placed} / {total}',
  progressLabel: '{placed} of {total} pieces placed',
  choosePicture: 'Choose a picture',
  picturesCount: '{n} pictures',
  myPhotos: 'My photos',
  photoTitle: 'Photo {n}',
  chooseMyPhoto: 'Choose my own photo',
  photoError: 'This photo could not be opened. Please try another one.',
  imageError: 'The picture could not be loaded. Please try again.',
  choosePieces: 'How many pieces?',
  piecesUnit: 'pieces',
  wellDone: 'Well done!',
  finishedIn: 'You finished the {n}-piece puzzle in {time}.',
  nextPicture: 'Next picture',
  backToMenu: 'Back to menu',
  lookAtPicture: 'Look at the picture',
  loading: 'Preparing puzzle…',
  ghost: 'Preview',
  ghostHint: 'Show the picture faintly on the board',
  edges: 'Edges',
  edgesHint: 'Show only edge pieces in the tray',
  sort: 'Sort',
  sortHint: 'Sort the tray: edge pieces first, then by colour',
  noEdgePieces: 'All edge pieces are placed',
  language: 'Language',
  languageAuto: 'Automatic',
  sound: 'Sounds',
  vibration: 'Vibration',
  on: 'On',
  off: 'Off',
  background: 'Background',
  bgFelt: 'Green',
  bgWood: 'Wood',
  bgNight: 'Night blue',
  credits: 'Picture credits',
  creditsIntro:
    'All pictures may be used freely (public domain or CC0). Many thanks to the photographers, artists and museums who shared them.',
  creditBy: 'by {author}',
  creditSource: 'Source',
  softwareCredits: 'This app uses PixiJS (MIT licence).',
};

export type MessageKey = keyof typeof en;

const de: Record<MessageKey, string> = {
  appTitle: 'Puzzle',
  homeSubtitle: 'Wählen Sie ein Bild und legen Sie los.',
  continuePuzzle: 'Puzzle fortsetzen',
  newPuzzle: 'Neues Puzzle',
  settings: 'Einstellungen',
  back: 'Zurück',
  menu: 'Menü',
  fitView: 'Alles zeigen',
  progress: '{placed} / {total}',
  progressLabel: '{placed} von {total} Teilen gelegt',
  choosePicture: 'Bild auswählen',
  picturesCount: '{n} Bilder',
  myPhotos: 'Meine Fotos',
  photoTitle: 'Foto {n}',
  chooseMyPhoto: 'Eigenes Foto wählen',
  photoError: 'Dieses Foto konnte nicht geöffnet werden. Bitte ein anderes wählen.',
  imageError: 'Das Bild konnte nicht geladen werden. Bitte noch einmal versuchen.',
  choosePieces: 'Wie viele Teile?',
  piecesUnit: 'Teile',
  wellDone: 'Geschafft!',
  finishedIn: 'Sie haben das Puzzle mit {n} Teilen in {time} gelöst.',
  nextPicture: 'Nächstes Bild',
  backToMenu: 'Zum Menü',
  lookAtPicture: 'Bild ansehen',
  loading: 'Puzzle wird vorbereitet …',
  ghost: 'Vorschau',
  ghostHint: 'Das Bild blass auf dem Spielfeld zeigen',
  edges: 'Ränder',
  edgesHint: 'Nur Randteile in der Ablage zeigen',
  sort: 'Sortieren',
  sortHint: 'Ablage sortieren: erst Randteile, dann nach Farbe',
  noEdgePieces: 'Alle Randteile sind gelegt',
  language: 'Sprache',
  languageAuto: 'Automatisch',
  sound: 'Töne',
  vibration: 'Vibration',
  on: 'An',
  off: 'Aus',
  background: 'Hintergrund',
  bgFelt: 'Grün',
  bgWood: 'Holz',
  bgNight: 'Nachtblau',
  credits: 'Bildnachweise',
  creditsIntro:
    'Alle Bilder sind frei verwendbar (gemeinfrei oder CC0). Herzlichen Dank an die Fotografen, Künstler und Museen, die sie geteilt haben.',
  creditBy: 'von {author}',
  creditSource: 'Quelle',
  softwareCredits: 'Diese App verwendet PixiJS (MIT-Lizenz).',
};

const dictionaries = { en, de } as const;
export type Language = keyof typeof dictionaries;

/** Picks the first supported language from the system preferences, English otherwise. */
export function detectLanguage(
  preferred: readonly string[] = navigator.languages ?? [navigator.language],
): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base in dictionaries) return base as Language;
  }
  return 'en';
}

let current: Language = 'en';

export function currentLanguage(): Language {
  return current;
}

export function setLanguage(lang: Language): void {
  current = lang;
  document.documentElement.lang = lang;
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return dictionaries[current][key].replace(/\{(\w+)\}/g, (_, k: string) =>
    String(params[k] ?? `{${k}}`),
  );
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
