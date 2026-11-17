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
  takePhoto: 'Take a photo',
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
  softwareCredits: 'The software this app is built with is listed under Settings → About this app.',
  about: 'About this app',
  appVersion: 'Version {version}',
  aboutLicence:
    'This app is free software: you may use, share and change it under the terms of the GNU Affero General Public License, version 3. It comes with no warranty.',
  sourceCode: 'Source code',
  licenceText: 'Licence text (GNU AGPL 3.0)',
  thirdPartyNotices: 'Open-source components',
  thirdPartyIntro:
    'This app is built with the following open-source components. Their licences ask for these notices to be shown.',
  textLoading: 'Loading…',
  privacy: 'Privacy policy',
  imprint: 'Legal notice',
  textLoadError: 'This text could not be loaded.',
  myPuzzles: 'My puzzles',
  myPuzzlesCount: 'My puzzles ({n})',
  noPuzzles: 'No puzzles in progress. Choose a picture to start one.',
  continueShort: 'Continue',
  solved: 'Solved',
  started: 'Started',
  bestTime: 'Best: {time}',
  newBest: 'New best time!',
  startOverTitle: 'Start again?',
  startOverText: 'Your progress on this picture will be lost.',
  startOver: 'Start again',
  cancel: 'Cancel',
  delete: 'Delete',
  deletePuzzleTitle: 'Delete this puzzle?',
  deletePuzzleText: 'Your progress on "{title}" will be lost.',
  deletePhoto: 'Delete photo',
  deletePhotoTitle: 'Delete this photo?',
  deletePhotoText: 'It is removed from this app only. The photo in your gallery is not affected.',
  restoreError: 'This puzzle could not be restored. Please start it again.',
  lastPlayed: 'Last played {date}',
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
  takePhoto: 'Foto aufnehmen',
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
  softwareCredits:
    'Die Software, mit der diese App gebaut ist, steht unter Einstellungen → Über diese App.',
  about: 'Über diese App',
  appVersion: 'Version {version}',
  aboutLicence:
    'Diese App ist freie Software: Sie dürfen sie unter den Bedingungen der GNU Affero General Public License, Version 3, verwenden, weitergeben und verändern. Sie wird ohne jede Gewährleistung bereitgestellt.',
  sourceCode: 'Quellcode',
  licenceText: 'Lizenztext (GNU AGPL 3.0)',
  thirdPartyNotices: 'Open-Source-Komponenten',
  thirdPartyIntro:
    'Diese App ist mit den folgenden Open-Source-Komponenten gebaut. Deren Lizenzen verlangen, dass diese Hinweise angezeigt werden.',
  textLoading: 'Wird geladen …',
  privacy: 'Datenschutz',
  imprint: 'Impressum',
  textLoadError: 'Dieser Text konnte nicht geladen werden.',
  myPuzzles: 'Meine Puzzles',
  myPuzzlesCount: 'Meine Puzzles ({n})',
  noPuzzles: 'Noch keine angefangenen Puzzles. Wählen Sie ein Bild, um eines zu beginnen.',
  continueShort: 'Weiterspielen',
  solved: 'Gelöst',
  started: 'Begonnen',
  bestTime: 'Bestzeit: {time}',
  newBest: 'Neue Bestzeit!',
  startOverTitle: 'Neu beginnen?',
  startOverText: 'Ihr bisheriger Fortschritt bei diesem Bild geht verloren.',
  startOver: 'Neu beginnen',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  deletePuzzleTitle: 'Dieses Puzzle löschen?',
  deletePuzzleText: 'Ihr Fortschritt bei „{title}“ geht verloren.',
  deletePhoto: 'Foto löschen',
  deletePhotoTitle: 'Dieses Foto löschen?',
  deletePhotoText:
    'Es wird nur aus dieser App entfernt. Das Foto in Ihrer Galerie bleibt erhalten.',
  restoreError: 'Dieses Puzzle konnte nicht wiederhergestellt werden. Bitte neu beginnen.',
  lastPlayed: 'Zuletzt gespielt: {date}',
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

/** Short, friendly date in the current language, e.g. "10 Nov 2026, 14:05". */
export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(current, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}
