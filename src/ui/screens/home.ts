import { t } from '../../i18n';
import { h, icon } from '../dom';
import { screen, type ScreenContext } from './context';

export function homeScreen(ctx: ScreenContext): HTMLElement {
  // The most recently played puzzle gets a big "Continue" card.
  const latest = ctx.saves.find((s) => ctx.picture(s.pictureId));
  const latestPicture = latest ? ctx.picture(latest.pictureId) : undefined;
  return screen(
    h(
      'div',
      { class: 'home' },
      h('h1', { class: 'home-title' }, t('appTitle')),
      h('p', { class: 'home-subtitle' }, t('homeSubtitle')),
      latest && latestPicture
        ? h(
            'button',
            {
              class: 'continue-card',
              type: 'button',
              onclick: () => void ctx.continuePuzzle(latest.pictureId),
            },
            h('img', { src: latestPicture.thumbUrl, alt: '' }),
            h(
              'span',
              { class: 'continue-text' },
              h('strong', {}, t('continuePuzzle')),
              h('span', {}, latestPicture.title),
              h(
                'span',
                { class: 'muted' },
                t('progressLabel', { placed: latest.placed, total: latest.total }),
              ),
            ),
            icon('play'),
          )
        : null,
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
      ctx.saves.length > 0
        ? h(
            'button',
            { class: 'btn btn-big', type: 'button', onclick: () => ctx.go({ name: 'puzzles' }) },
            icon('stack'),
            h('span', {}, t('myPuzzlesCount', { n: ctx.saves.length })),
          )
        : null,
      h(
        'button',
        { class: 'btn btn-big', type: 'button', onclick: () => ctx.go({ name: 'settings' }) },
        icon('settings'),
        h('span', {}, t('settings')),
      ),
    ),
  );
}
