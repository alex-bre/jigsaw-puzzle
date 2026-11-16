import { t } from '../../i18n';
import { h } from '../dom';
import { button, heroCard } from '../kit';
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
        ? heroCard({
            image: latestPicture.thumbUrl,
            title: t('continuePuzzle'),
            lines: [
              latestPicture.title,
              t('progressLabel', { placed: latest.placed, total: latest.total }),
            ],
            onClick: () => void ctx.continuePuzzle(latest.pictureId),
          })
        : null,
      button({
        label: t('newPuzzle'),
        icon: 'plus',
        tone: 'primary',
        size: 'lg',
        block: true,
        onClick: () => ctx.go({ name: 'pictures' }),
      }),
      ctx.saves.length > 0
        ? button({
            label: t('myPuzzlesCount', { n: ctx.saves.length }),
            icon: 'stack',
            size: 'lg',
            block: true,
            onClick: () => ctx.go({ name: 'puzzles' }),
          })
        : null,
      button({
        label: t('settings'),
        icon: 'settings',
        size: 'lg',
        block: true,
        onClick: () => ctx.go({ name: 'settings' }),
      }),
    ),
  );
}
