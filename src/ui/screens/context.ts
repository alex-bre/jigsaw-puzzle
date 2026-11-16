import type { SaveMeta, Stats } from '../../data/repository';
import type { Settings } from '../../settings';
import { t } from '../../i18n';
import { h } from '../dom';
import { badge, button } from '../kit';
import type { Route } from '../router';

/** A picture the player can puzzle: from the catalogue or one of their own photos. */
export interface PictureRef {
  id: string;
  title: string;
  thumbUrl: string;
  /** Whole, uncropped picture for the setup screen. */
  previewUrl: string;
  /** Category the picture belongs to ('photos' for the player's own pictures). */
  categoryId: string;
}

export interface ConfirmOptions {
  title: string;
  text: string;
  confirmLabel: string;
  /** Destructive actions get a warning-coloured confirm button. */
  danger?: boolean;
}

/** What screens may use from the app. */
export interface ScreenContext {
  go(route: Route): void;
  back(): void;
  settings: Settings;
  updateSettings(patch: Partial<Settings>): void;
  picture(id: string): PictureRef | undefined;
  photos: PictureRef[];
  addPhoto(image: Blob): Promise<PictureRef>;
  deletePhoto(id: string): Promise<void>;
  /** Puzzles in progress, most recently played first. */
  saves: SaveMeta[];
  stats: Stats;
  startPuzzle(pictureId: string, pieceCount: number): Promise<void>;
  continuePuzzle(pictureId: string): Promise<void>;
  deleteSave(pictureId: string): Promise<void>;
  confirm(options: ConfirmOptions): Promise<boolean>;
}

export type Screen = (ctx: ScreenContext) => HTMLElement;

/** Screen header with a large, labelled back button and a title. */
export function screenHeader(ctx: ScreenContext, title: string, showBack = true): HTMLElement {
  return h(
    'header',
    { class: 'screen-header' },
    showBack ? button({ label: t('back'), icon: 'back', onClick: () => ctx.back() }) : null,
    h('h1', {}, title),
  );
}

export function screen(...children: (Node | null)[]): HTMLElement {
  return h('div', { class: 'screen' }, h('div', { class: 'screen-inner' }, ...children));
}

/** "Solved" / "Started 40 %" badge for picture cards. */
export function statusBadge(ctx: ScreenContext, pictureId: string): HTMLElement | null {
  const save = ctx.saves.find((s) => s.pictureId === pictureId);
  if (save) {
    const pct = Math.round((100 * save.placed) / Math.max(1, save.total));
    return badge(`${t('started')} · ${pct} %`);
  }
  if (ctx.stats[pictureId]?.solved) {
    return badge(t('solved'), { tone: 'primary', icon: 'check' });
  }
  return null;
}
