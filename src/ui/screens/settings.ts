import { catalog, thumbUrl } from '../../content/catalog';
import { currentLanguage, t, type MessageKey } from '../../i18n';
import { BACKGROUNDS, type Background, type LanguageSetting } from '../../settings';
import { h, icon } from '../dom';
import { screen, screenHeader, type ScreenContext } from './context';

/** A row of large buttons of which exactly one is selected. */
function choiceGroup<T extends string | boolean>(
  label: string,
  options: { value: T; label: string; swatch?: string }[],
  selected: T,
  onSelect: (value: T) => void,
): HTMLElement {
  const id = `group-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return h(
    'section',
    { class: 'setting' },
    h('h2', { class: 'section-title', id }, label),
    h(
      'div',
      { class: 'choice-group', role: 'group', 'aria-labelledby': id },
      ...options.map((o) =>
        h(
          'button',
          {
            class: 'choice-btn',
            type: 'button',
            'aria-pressed': String(o.value === selected),
            onclick: () => onSelect(o.value),
          },
          o.swatch ? h('span', { class: 'swatch', style: `background:${o.swatch}` }) : null,
          h('span', {}, o.label),
        ),
      ),
    ),
  );
}

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
    choiceGroup<LanguageSetting>(
      t('language'),
      [
        { value: 'auto', label: t('languageAuto') },
        { value: 'de', label: 'Deutsch' },
        { value: 'en', label: 'English' },
      ],
      s.language,
      (language) => ctx.updateSettings({ language }),
    ),
    choiceGroup(t('sound'), onOff, s.sound, (sound) => ctx.updateSettings({ sound })),
    choiceGroup(t('vibration'), onOff, s.vibration, (vibration) =>
      ctx.updateSettings({ vibration }),
    ),
    choiceGroup<Background>(
      t('background'),
      (Object.keys(BACKGROUNDS) as Background[]).map((b) => ({
        value: b,
        label: t(bgLabels[b]),
        swatch: BACKGROUNDS[b],
      })),
      s.background,
      (background) => ctx.updateSettings({ background }),
    ),
    h(
      'button',
      { class: 'btn btn-big', type: 'button', onclick: () => ctx.go({ name: 'credits' }) },
      icon('info'),
      h('span', {}, t('credits')),
    ),
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
