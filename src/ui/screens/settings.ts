import { catalog, thumbUrl } from '../../content/catalog';
import { currentLanguage, t, type MessageKey } from '../../i18n';
import { BACKGROUNDS, type Background, type LanguageSetting } from '../../settings';
import { h } from '../dom';
import { button, choiceGroup } from '../kit';
import { reflow } from '../reflow';
import { screen, screenHeader, type ScreenContext } from './context';

/** First publication year, for the copyright line on the About screen. */
const COPYRIGHT_YEARS = '2026';

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
    choiceGroup({
      label: t('zoom'),
      hint: t('zoomHint'),
      options: onOff,
      selected: s.zoom,
      onSelect: (zoom) => ctx.updateSettings({ zoom }),
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
    h(
      'div',
      { class: 'settings-links' },
      button({
        label: t('credits'),
        icon: 'image',
        size: 'lg',
        block: true,
        onClick: () => ctx.go({ name: 'credits' }),
      }),
      button({
        label: t('about'),
        icon: 'info',
        size: 'lg',
        block: true,
        onClick: () => ctx.go({ name: 'about' }),
      }),
      h(
        'div',
        { class: 'settings-links-row' },
        button({ label: t('privacy'), onClick: () => ctx.go({ name: 'privacy' }) }),
        button({ label: t('imprint'), onClick: () => ctx.go({ name: 'imprint' }) }),
      ),
    ),
  );
}

/**
 * Version, copyright, licence and source link, plus the full licence texts. The AGPL asks an
 * interactive program to show these, and the dependencies' licences ask for their notices to
 * travel with the app. The texts are files shipped next to index.html (see vite.config.ts), loaded
 * only when opened.
 */
export function aboutScreen(ctx: ScreenContext): HTMLElement {
  return screen(
    screenHeader(ctx, t('about')),
    h(
      'div',
      { class: 'about' },
      h('strong', {}, t('appTitle')),
      h('div', {}, t('appVersion', { version: __APP_VERSION__ })),
      h('div', {}, `© ${COPYRIGHT_YEARS} ${__APP_AUTHOR__}`),
    ),
    h('p', { class: 'lead-text' }, t('aboutLicence')),
    h(
      'p',
      { class: 'about-link' },
      h('a', { href: __SOURCE_URL__, target: '_blank', rel: 'noopener' }, t('sourceCode')),
    ),
    shippedText(t('licenceText'), 'LICENSE.txt'),
    shippedText(t('thirdPartyNotices'), 'THIRD-PARTY-NOTICES.txt', t('thirdPartyIntro')),
  );
}

/** A collapsed section that fetches and shows one of the shipped text files when opened. */
function shippedText(title: string, file: string, intro?: string): HTMLElement {
  const body = h('div', { class: 'licence-text' });
  let loaded = false;
  const section = h(
    'details',
    { class: 'licence' },
    h('summary', {}, title),
    intro ? h('p', { class: 'muted' }, intro) : null,
    body,
  );
  section.addEventListener('toggle', () => {
    if (!section.open || loaded) return;
    loaded = true;
    body.textContent = t('textLoading');
    fetch(`./${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        body.textContent = reflow(text);
      })
      .catch(() => {
        body.textContent = t('textLoadError');
        loaded = false;
      });
  });
  return section;
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
