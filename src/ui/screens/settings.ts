import { catalog, thumbUrl } from '../../content/catalog';
import { currentLanguage, t, type MessageKey } from '../../i18n';
import { BACKGROUNDS, type Background, type LanguageSetting } from '../../settings';
import { h } from '../dom';
import { button, choiceGroup } from '../kit';
import { screen, screenHeader, type ScreenContext } from './context';

export function settingsScreen(ctx: ScreenContext): HTMLElement {
  const s = ctx.settings;
  const onOff = [
    { value: true, label: t('on') },
    { value: false, label: t('off') },
  ];
  const bgLabels: Record<Background, MessageKey> = {
    felt: 'bgFelt',
    wood: 'bgWood',
    night: 'bgNight',
  };
  return screen(
    screenHeader(ctx, t('settings')),
    choiceGroup<LanguageSetting>({
      label: t('language'),
      options: [
        { value: 'auto', label: t('languageAuto') },
        { value: 'de', label: 'Deutsch' },
        { value: 'en', label: 'English' },
      ],
      selected: s.language,
      onSelect: (language) => ctx.updateSettings({ language }),
    }),
    choiceGroup({
      label: t('sound'),
      options: onOff,
      selected: s.sound,
      onSelect: (sound) => ctx.updateSettings({ sound }),
    }),
    choiceGroup({
      label: t('vibration'),
      options: onOff,
      selected: s.vibration,
      onSelect: (vibration) => ctx.updateSettings({ vibration }),
    }),
    choiceGroup<Background>({
      label: t('background'),
      options: (Object.keys(BACKGROUNDS) as Background[]).map((b) => ({
        value: b,
        label: t(bgLabels[b]),
        swatch: BACKGROUNDS[b],
      })),
      selected: s.background,
      onSelect: (background) => ctx.updateSettings({ background }),
    }),
    button({
      label: t('credits'),
      icon: 'info',
      size: 'lg',
      block: true,
      onClick: () => ctx.go({ name: 'credits' }),
    }),
  );
}

export function creditsScreen(ctx: ScreenContext): HTMLElement {
  const lang = currentLanguage();
  const items = catalog.images.map((img) =>
    h(
      'li',
      { class: 'credit' },
      h('img', { src: thumbUrl(img.id), alt: '', loading: 'lazy' }),
      h(
        'div',
        {},
        h('strong', {}, img.title[lang]),
        h('div', {}, t('creditBy', { author: img.author })),
        h(
          'div',
          { class: 'muted' },
          h('a', { href: img.licenseUrl, target: '_blank', rel: 'noopener' }, img.license),
          ' · ',
          h('a', { href: img.sourcePage, target: '_blank', rel: 'noopener' }, t('creditSource')),
        ),
      ),
    ),
  );
  return screen(
    screenHeader(ctx, t('credits')),
    h('p', { class: 'lead-text' }, t('creditsIntro')),
    h('ul', { class: 'credit-list' }, ...items),
    h('p', { class: 'muted' }, t('softwareCredits')),
  );
}
