import type { Settings } from '../../settings';
import { t } from '../../i18n';
import { h, icon } from '../dom';
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

export interface CurrentPuzzle {
  picture: PictureRef;
  placed: number;
  total: number;
  complete: boolean;
}

/** What screens may use from the app. */
export interface ScreenContext {
  go(route: Route): void;
  back(): void;
  settings: Settings;
  updateSettings(patch: Partial<Settings>): void;
  current: CurrentPuzzle | null;
  picture(id: string): PictureRef | undefined;
  photos: PictureRef[];
  addPhoto(file: File): Promise<PictureRef>;
  startPuzzle(pictureId: string, pieceCount: number): Promise<void>;
}

export type Screen = (ctx: ScreenContext) => HTMLElement;

/** Screen header with a large, labelled back button and a title. */
export function screenHeader(ctx: ScreenContext, title: string, showBack = true): HTMLElement {
  return h(
    'header',
    { class: 'screen-header' },
    showBack
      ? h(
          'button',
          { class: 'btn', type: 'button', onclick: () => ctx.back() },
          icon('back'),
          h('span', {}, t('back')),
        )
      : null,
    h('h1', {}, title),
  );
}

export function screen(...children: (Node | null)[]): HTMLElement {
  return h('div', { class: 'screen' }, h('div', { class: 'screen-inner' }, ...children));
}
