import { linkParts, type LegalDoc } from '../../content/legal';
import { h } from '../dom';
import { screen, screenHeader, type ScreenContext } from './context';

/**
 * Privacy policy or Impressum (src/content/legal.ts) as a menu screen. `title` is the short name
 * from the settings button: "Datenschutzerklärung" does not fit the header on a phone.
 */
export function legalScreen(ctx: ScreenContext, title: string, doc: LegalDoc): HTMLElement {
  return screen(
    screenHeader(ctx, title),
    h(
      'div',
      { class: 'legal' },
      ...doc.sections.flatMap((section) => [
        section.heading ? h('h2', {}, section.heading) : null,
        ...section.paragraphs.map((p) =>
          h(
            'p',
            {},
            ...linkParts(p).map((part) =>
              part.href
                ? h('a', { href: part.href, target: '_blank', rel: 'noopener' }, part.text)
                : part.text,
            ),
          ),
        ),
      ]),
      h('p', { class: 'muted' }, doc.updated),
    ),
  );
}
