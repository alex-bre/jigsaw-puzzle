import type { Language } from './i18n';

export type LanguageSetting = 'auto' | Language;
export type Background = 'felt' | 'wood' | 'night';

export interface Settings {
  language: LanguageSetting;
  sound: boolean;
  vibration: boolean;
  background: Background;
  /** Pinch / mouse-wheel zoom on the board (helps on small screens). Off: fixed view. */
  zoom: boolean;
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
  zoom: false,
};

/** Reads stored settings, falling back to defaults for anything missing or invalid. */
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
    zoom: typeof d.zoom === 'boolean' ? d.zoom : DEFAULT_SETTINGS.zoom,
  };
}
