import { formatDate, t } from '../../i18n';
import { h } from '../dom';
import { button } from '../kit';
import { screen, screenHeader, type ScreenContext } from './context';

/** All puzzles in progress, with "Continue" and "Delete". */
export function puzzlesScreen(ctx: ScreenContext): HTMLElement {
  const rows = ctx.saves.flatMap((save) => {
    const picture = ctx.picture(save.pictureId);
    if (!picture) return [];
    return [
      h(
        'li',
        { class: 'panel' },
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
          button({
            label: t('continueShort'),
            icon: 'play',
            tone: 'primary',
            onClick: () => void ctx.continuePuzzle(save.pictureId),
          }),
          button({
            label: t('delete'),
            icon: 'trash',
            tone: 'danger',
            quiet: true,
            onClick: async () => {
              const ok = await ctx.confirm({
                title: t('deletePuzzleTitle'),
                text: t('deletePuzzleText', { title: picture.title }),
                confirmLabel: t('delete'),
                danger: true,
              });
              if (ok) await ctx.deleteSave(save.pictureId);
            },
          }),
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
          button({
            label: t('newPuzzle'),
            icon: 'plus',
            tone: 'primary',
            size: 'lg',
            block: true,
            onClick: () => ctx.go({ name: 'pictures' }),
          }),
        ),
  );
}
