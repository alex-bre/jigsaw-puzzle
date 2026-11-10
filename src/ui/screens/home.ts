import { t } from '../../i18n';
import { h, icon } from '../dom';
import { screen, type ScreenContext } from './context';

export function homeScreen(ctx: ScreenContext): HTMLElement {
  const cur = ctx.current && !ctx.current.complete ? ctx.current : null;
  return screen(
    h(
      'div',
      { class: 'home' },
      h('h1', { class: 'home-title' }, t('appTitle')),
      h('p', { class: 'home-subtitle' }, t('homeSubtitle')),
      cur
        ? h(
            'button',
            { class: 'continue-card', type: 'button', onclick: () => ctx.go({ name: 'play' }) },
            h('img', { src: cur.picture.thumbUrl, alt: '' }),
            h(
              'span',
              { class: 'continue-text' },
              h('strong', {}, t('continuePuzzle')),
              h('span', {}, cur.picture.title),
              h(
                'span',
                { class: 'muted' },
                t('progressLabel', { placed: cur.placed, total: cur.total }),
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
      h(
        'button',
        { class: 'btn btn-big', type: 'button', onclick: () => ctx.go({ name: 'settings' }) },
        icon('settings'),
        h('span', {}, t('settings')),
      ),
    ),
  );
}
