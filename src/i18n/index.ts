const en = {
  appTitle: 'Jigsaw Puzzle',
  newPuzzle: 'New puzzle',
  fitView: 'Show all',
  progress: '{placed} / {total}',
  progressLabel: '{placed} of {total} pieces placed',
  choosePieces: 'How many pieces?',
  piecesUnit: 'pieces',
  picture: 'Picture',
  samplePicture: 'Sample picture',
  myPhoto: 'My photo',
  chooseMyPhoto: 'Choose my own photo',
  photoError: 'This photo could not be opened. Please try another one.',
  cancel: 'Cancel',
  wellDone: 'Well done!',
  finishedIn: 'You finished the {n}-piece puzzle in {time}.',
  lookAtPicture: 'Look at the picture',
  loading: 'Preparing puzzle…',
  ghost: 'Preview',
  ghostHint: 'Show the picture faintly on the board',
  edges: 'Edges',
  edgesHint: 'Show only edge pieces in the tray',
  sort: 'Sort',
  sortHint: 'Sort the tray: edge pieces first, then by colour',
  noEdgePieces: 'All edge pieces are placed',
};

export type MessageKey = keyof typeof en;

const de: Record<MessageKey, string> = {
  appTitle: 'Puzzle',
  newPuzzle: 'Neues Puzzle',
  fitView: 'Alles zeigen',
  progress: '{placed} / {total}',
  progressLabel: '{placed} von {total} Teilen gelegt',
  choosePieces: 'Wie viele Teile?',
  piecesUnit: 'Teile',
  picture: 'Bild',
  samplePicture: 'Beispielbild',
  myPhoto: 'Mein Foto',
  chooseMyPhoto: 'Eigenes Foto wählen',
  photoError: 'Dieses Foto konnte nicht geöffnet werden. Bitte ein anderes wählen.',
  cancel: 'Abbrechen',
  wellDone: 'Geschafft!',
  finishedIn: 'Sie haben das Puzzle mit {n} Teilen in {time} gelöst.',
  lookAtPicture: 'Bild ansehen',
  loading: 'Puzzle wird vorbereitet …',
  ghost: 'Vorschau',
  ghostHint: 'Das Bild blass auf dem Spielfeld zeigen',
  edges: 'Ränder',
  edgesHint: 'Nur Randteile in der Ablage zeigen',
  sort: 'Sortieren',
  sortHint: 'Ablage sortieren: erst Randteile, dann nach Farbe',
  noEdgePieces: 'Alle Randteile sind gelegt',
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
