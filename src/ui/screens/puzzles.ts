import { formatDate, t } from '../../i18n';
import { h, icon } from '../dom';
import { screen, screenHeader, type ScreenContext } from './context';

/** All puzzles in progress, with "Continue" and "Delete". */
export function puzzlesScreen(ctx: ScreenContext): HTMLElement {
  const rows = ctx.saves.flatMap((save) => {
    const picture = ctx.picture(save.pictureId);
    if (!picture) return [];
    return [
      h(
        'li',
        { class: 'puzzle-row' },
        h(
          'button',
          {
            class: 'puzzle-main',
            type: 'button',
            onclick: () => void ctx.continuePuzzle(save.pictureId),
          },
          h('img', { src: picture.thumbUrl, alt: '' }),
          h(
            'span',
            { class: 'puzzle-text' },
            h('strong', {}, picture.title),
            h('span', {}, t('progressLabel', { placed: save.placed, total: save.total })),
            h('span', { class: 'muted' }, t('lastPlayed', { date: formatDate(save.updatedAt) })),
          ),
        ),
        h(
          'div',
          { class: 'puzzle-actions' },
          h(
            'button',
            {
              class: 'btn btn-primary',
              type: 'button',
              onclick: () => void ctx.continuePuzzle(save.pictureId),
            },
            icon('play'),
            h('span', {}, t('continueShort')),
          ),
          h(
            'button',
            {
              class: 'btn btn-danger-quiet',
              type: 'button',
              onclick: async () => {
                const ok = await ctx.confirm({
                  title: t('deletePuzzleTitle'),
                  text: t('deletePuzzleText', { title: picture.title }),
                  confirmLabel: t('delete'),
                  danger: true,
                });
                if (ok) await ctx.deleteSave(save.pictureId);
              },
            },
            icon('trash'),
            h('span', {}, t('delete')),
          ),
        ),
      ),
    ];
  });

  return screen(
    screenHeader(ctx, t('myPuzzles')),
    rows.length > 0
      ? h('ul', { class: 'puzzle-list' }, ...rows)
      : h(
          'div',
          { class: 'empty' },
          h('p', { class: 'lead-text' }, t('noPuzzles')),
          h(
            'button',
            {
              class: 'btn btn-primary btn-big',
              type: 'button',
              onclick: () => ctx.go({ name: 'pictures' }),
            },
            icon('plus'),
            h('span', {}, t('newPuzzle')),
          ),
        ),
  );
}
