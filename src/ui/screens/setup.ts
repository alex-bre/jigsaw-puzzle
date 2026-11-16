import { PIECE_COUNTS } from '../../game/core/grid';
import { formatDuration, t } from '../../i18n';
import { h } from '../dom';
import { button, tile, twoLine } from '../kit';
import { screen, screenHeader, type ScreenContext } from './context';

/**
 * Big preview of the chosen picture and the piece-count buttons, which start the puzzle.
 * A puzzle in progress for this picture gets a large "Continue" button first.
 */
export function setupScreen(ctx: ScreenContext, pictureId: string): HTMLElement {
  const picture = ctx.picture(pictureId);
  if (!picture) {
    queueMicrotask(() => ctx.go({ name: 'pictures' }));
    return screen();
  }
  const save = ctx.saves.find((s) => s.pictureId === pictureId);
  const best = ctx.stats[pictureId]?.best ?? {};
  const isPhoto = picture.categoryId === 'photos';

  const start = async (n: number) => {
    if (save) {
      const ok = await ctx.confirm({
        title: t('startOverTitle'),
        text: t('startOverText'),
        confirmLabel: t('startOver'),
      });
      if (!ok) return;
    }
    await ctx.startPuzzle(picture.id, n);
  };

  // Pieces counts are approximate (the grid keeps pieces square), so best times are matched
  // to the nearest offered count.
  const bestFor = (n: number): number | undefined => {
    const entries = Object.entries(best).map(([k, v]) => [Number(k), v] as const);
    const match = entries.find(([k]) => nearestCount(k) === n);
    return match?.[1];
  };

  const buttons = PIECE_COUNTS.map((n) => {
    const b = bestFor(n);
    return tile({
      value: String(n),
      unit: t('piecesUnit'),
      note: b !== undefined ? t('bestTime', { time: formatDuration(b) }) : undefined,
      onClick: () => void start(n),
    });
  });

  return screen(
    screenHeader(ctx, picture.title),
    h(
      'div',
      { class: 'setup' },
      h('img', { class: 'setup-preview', src: picture.previewUrl, alt: picture.title }),
      h(
        'div',
        { class: 'setup-counts' },
        save
          ? button({
              label: twoLine(
                t('continuePuzzle'),
                t('progressLabel', { placed: save.placed, total: save.total }),
              ),
              icon: 'play',
              tone: 'primary',
              size: 'lg',
              block: true,
              class: 'setup-continue',
              onClick: () => void ctx.continuePuzzle(picture.id),
            })
          : null,
        h('h2', { class: 'section-title' }, save ? t('startOver') : t('choosePieces')),
        h('div', { class: 'tile-grid' }, ...buttons),
        isPhoto
          ? button({
              label: t('deletePhoto'),
              icon: 'trash',
              tone: 'danger',
              quiet: true,
              class: 'setup-delete',
              onClick: async () => {
                const ok = await ctx.confirm({
                  title: t('deletePhotoTitle'),
                  text: t('deletePhotoText'),
                  confirmLabel: t('delete'),
                  danger: true,
                });
                if (!ok) return;
                await ctx.deletePhoto(picture.id);
                ctx.go({ name: 'pictures' });
              },
            })
          : null,
      ),
    ),
  );
}

function nearestCount(actual: number): number {
  return PIECE_COUNTS.reduce((best, n) =>
    Math.abs(n - actual) < Math.abs(best - actual) ? n : best,
  );
}
