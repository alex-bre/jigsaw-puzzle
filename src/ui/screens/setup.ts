import { PIECE_COUNTS } from '../../game/core/grid';
import { t } from '../../i18n';
import { h } from '../dom';
import { screen, screenHeader, type ScreenContext } from './context';

/** Big preview of the chosen picture and the piece-count buttons, which start the puzzle. */
export function setupScreen(ctx: ScreenContext, pictureId: string): HTMLElement {
  const picture = ctx.picture(pictureId);
  if (!picture) {
    queueMicrotask(() => ctx.go({ name: 'pictures' }));
    return screen();
  }
  const buttons = PIECE_COUNTS.map((n) =>
    h(
      'button',
      {
        class: 'btn count-btn',
        type: 'button',
        onclick: () => void ctx.startPuzzle(picture.id, n),
      },
      h('strong', {}, String(n)),
      h('span', {}, t('piecesUnit')),
    ),
  );
  return screen(
    screenHeader(ctx, picture.title),
    h(
      'div',
      { class: 'setup' },
      h('img', { class: 'setup-preview', src: picture.previewUrl, alt: picture.title }),
      h(
        'div',
        { class: 'setup-counts' },
        h('h2', { class: 'section-title' }, t('choosePieces')),
        h('div', { class: 'count-grid' }, ...buttons),
      ),
    ),
  );
}
