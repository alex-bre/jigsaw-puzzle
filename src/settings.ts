import type { Language } from './i18n';

export type LanguageSetting = 'auto' | Language;
export type Background = 'felt' | 'wood' | 'night';

export interface Settings {
  language: LanguageSetting;
  sound: boolean;
  vibration: boolean;
  background: Background;
}

/** Board background colours. Mid-dark tones so that both light and dark pieces stand out. */
export const BACKGROUNDS: Record<Background, string> = {
  felt: '#35514a',
  wood: '#5c4636',
  night: '#2b3542',
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  sound: true,
  vibration: true,
  background: 'felt',
};

// Stored in localStorage for now; milestone 6 moves this behind the storage abstraction
// (Capacitor Preferences on Android).
const KEY = 'jigsaw.settings.v1';

/** Reads settings, falling back to defaults for anything missing or invalid. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode etc.) – settings simply are not remembered */
  }
}

export function sanitize(data: unknown): Settings {
  const d = (data && typeof data === 'object' ? data : {}) as Partial<
    Record<keyof Settings, unknown>
  >;
  return {
    language: d.language === 'de' || d.language === 'en' ? d.language : 'auto',
    sound: typeof d.sound === 'boolean' ? d.sound : DEFAULT_SETTINGS.sound,
    vibration: typeof d.vibration === 'boolean' ? d.vibration : DEFAULT_SETTINGS.vibration,
    background:
      d.background === 'wood' || d.background === 'night' || d.background === 'felt'
        ? d.background
        : DEFAULT_SETTINGS.background,
  };
}
