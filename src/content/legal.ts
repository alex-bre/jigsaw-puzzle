/**
 * Privacy policy and Impressum, in both app languages.
 *
 * One source for two outputs: the in-app screens (src/ui/screens/legal.ts) and the static
 * privacy.html / imprint.html pages that the build writes next to index.html (vite.config.ts),
 * which is the URL the Play Console asks for. No runtime imports, so vite.config.ts can load it.
 *
 * When what the app stores or sends changes, this text has to change with it, and `UPDATED` too.
 */
import type { Language } from '../i18n/index.ts';

export interface Operator {
  name: string;
  /** Postal address that can receive mail (no PO box), one line per entry. */
  address: string[];
  email: string;
  /** A second fast way to reach you besides email: a phone number (or a contact form URL). */
  phone: string;
  /** Only if you have one. */
  vatId?: string;
}

/**
 * Who offers the app, as § 5 DDG (Impressum) and Art. 13 GDPR (privacy policy) require it to be
 * named. Empty fields are left out, so a narrower set (email only, or a c/o address) renders
 * without a gap. For an app that is sold, § 5 DDG asks for all of them: a postal address where
 * mail reaches you (no PO box), an email address and a second fast contact. Publishing them makes
 * them public for good. The build names whatever is still missing.
 */
export const OPERATOR: Operator = {
  name: 'Alexander Brenner',
  address: [], // e.g. ['Musterstraße 1', '12345 Musterstadt', 'Deutschland']
  email: 'alex.brenner.cs@gmail.com',
  phone: '',
};

/** Date of the last change to these texts. */
export const UPDATED = '2026-11-17';

/** The fields § 5 DDG asks for that are still empty, for the build's reminder. */
export function missingOperatorFields(op: Operator = OPERATOR): string[] {
  const missing: string[] = [];
  if (!op.name) missing.push('name');
  if (!op.address.some(Boolean)) missing.push('address');
  if (!op.email) missing.push('email');
  if (!op.phone) missing.push('phone');
  return missing;
}

export interface LegalSection {
  heading?: string;
  /** Paragraphs; a line break inside one is kept. URLs and email addresses become links. */
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  /** "Last updated …", already in the document's language. */
  updated: string;
  sections: LegalSection[];
}

function updated(lang: Language): string {
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${UPDATED}T00:00:00Z`),
  );
  return lang === 'de' ? `Stand: ${date}` : `Last updated: ${date}`;
}

function contactLines(op: Operator, lang: Language): string {
  const lines = [op.name, ...op.address].filter(Boolean);
  if (op.email) lines.push(`${lang === 'de' ? 'E-Mail' : 'Email'}: ${op.email}`);
  if (op.phone) lines.push(`${lang === 'de' ? 'Telefon' : 'Phone'}: ${op.phone}`);
  return lines.join('\n');
}

const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
const GITHUB_PRIVACY =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';

export function privacyPolicy(lang: Language, op: Operator = OPERATOR): LegalDoc {
  const controller = contactLines(op, lang);
  if (lang === 'de') {
    return {
      title: 'Datenschutzerklärung',
      updated: updated(lang),
      sections: [
        {
          heading: 'Kurz gesagt',
          paragraphs: [
            'Diese App erhebt keine personenbezogenen Daten. Es gibt kein Benutzerkonto, keine Werbung und keine Analyse- oder Tracking-Dienste. Die Android-App hat keinen Zugang zum Internet.',
          ],
        },
        {
          heading: 'Verantwortlicher',
          paragraphs: [controller],
        },
        {
          heading: 'Daten auf Ihrem Gerät',
          paragraphs: [
            'Angefangene Puzzles, Bestzeiten, Ihre Einstellungen und Fotos, die Sie selbst hinzufügen, werden ausschließlich auf Ihrem Gerät gespeichert: in der Android-App im privaten Speicher der App, in der Web-Version im Speicher Ihres Browsers. Sie werden weder an uns noch an Dritte übertragen. Die Cloud-Sicherung von Android ist für diese App abgeschaltet.',
            'Sie können Puzzles und Fotos jederzeit in der App löschen. Beim Deinstallieren der App oder beim Löschen der Website-Daten im Browser werden alle Daten vollständig entfernt.',
          ],
        },
        {
          heading: 'Kamera und Fotos',
          paragraphs: [
            'Wenn Sie ein eigenes Foto verwenden möchten, öffnet die App die Kamera oder die Fotoauswahl Ihres Geräts. Nur das Foto, das Sie dort auswählen oder aufnehmen, wird in die App übernommen und auf Ihrem Gerät gespeichert. Die App liest keine anderen Bilder und überträgt keine Fotos.',
          ],
        },
        {
          heading: 'Google Play',
          paragraphs: [
            `Wenn Sie die App über Google Play herunterladen oder kaufen, verarbeitet Google dabei Daten wie Ihr Google-Konto und Ihre Zahlungsdaten in eigener Verantwortung. Es gilt die Datenschutzerklärung von Google: ${GOOGLE_PRIVACY}`,
            'Von Google erhalten wir nur die Angaben, die Entwicklern zur Abwicklung und Abrechnung von Käufen bereitgestellt werden, sowie zusammengefasste Statistiken und anonyme Absturzberichte.',
          ],
        },
        {
          heading: 'Web-Version',
          paragraphs: [
            'Die Web-Version wird über GitHub Pages bereitgestellt, einen Dienst der GitHub, Inc. (USA). Beim Aufruf verarbeitet GitHub technisch notwendige Daten wie Ihre IP-Adresse, Datum und Uhrzeit des Zugriffs und Angaben zu Ihrem Browser, um die Seite auszuliefern und den Dienst abzusichern. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und zuverlässigen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO).',
            `Dabei können Daten in die USA übermittelt werden; GitHub ist nach dem EU-US Data Privacy Framework zertifiziert. Einzelheiten: ${GITHUB_PRIVACY}`,
            'Die Web-Version setzt keine Cookies und lädt keine Inhalte von anderen Servern; auch die Schrift ist in der App enthalten.',
          ],
        },
        {
          heading: 'Links zu anderen Websites',
          paragraphs: [
            'Die Bildnachweise und der Link zum Quellcode führen zu anderen Websites. Für diese gelten die Datenschutzerklärungen ihrer Betreiber.',
          ],
        },
        {
          heading: 'Ihre Rechte',
          paragraphs: [
            'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21 DSGVO). Wenden Sie sich dazu an den oben genannten Verantwortlichen. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).',
          ],
        },
      ],
    };
  }
  return {
    title: 'Privacy policy',
    updated: updated(lang),
    sections: [
      {
        heading: 'In short',
        paragraphs: [
          'This app collects no personal data. There is no account, no advertising and no analytics or tracking. The Android app has no internet access.',
        ],
      },
      {
        heading: 'Controller',
        paragraphs: [controller],
      },
      {
        heading: 'Data on your device',
        paragraphs: [
          "Puzzles in progress, best times, your settings and photos you add yourself are stored only on your device: in the Android app in the app's private storage, in the web version in your browser's storage. They are not sent to us or to anyone else. Android cloud backup is turned off for this app.",
          'You can delete puzzles and photos in the app at any time. Uninstalling the app, or clearing the site data in your browser, removes all of it.',
        ],
      },
      {
        heading: 'Camera and photos',
        paragraphs: [
          "If you want to use a photo of your own, the app opens your device's camera or photo picker. Only the photo you choose or take there is copied into the app and stored on your device. The app reads no other pictures and sends no photos anywhere.",
        ],
      },
      {
        heading: 'Google Play',
        paragraphs: [
          `When you download or buy the app on Google Play, Google processes data such as your Google account and payment details under its own responsibility. Google's privacy policy applies: ${GOOGLE_PRIVACY}`,
          'From Google we receive only the information provided to developers for handling and accounting for purchases, plus aggregated statistics and anonymous crash reports.',
        ],
      },
      {
        heading: 'Web version',
        paragraphs: [
          'The web version is served by GitHub Pages, a service of GitHub, Inc. (USA). When you open it, GitHub processes technically necessary data such as your IP address, the date and time of access and details of your browser, to deliver the page and keep the service secure. The legal basis is our legitimate interest in providing the site securely and reliably (Art. 6(1)(f) GDPR).',
          `This may involve a transfer to the USA; GitHub is certified under the EU-US Data Privacy Framework. Details: ${GITHUB_PRIVACY}`,
          'The web version sets no cookies and loads nothing from other servers; the font is part of the app as well.',
        ],
      },
      {
        heading: 'Links to other websites',
        paragraphs: [
          'The picture credits and the source code link lead to other websites. Their operators’ privacy policies apply there.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You have the right of access, rectification, erasure, restriction of processing, data portability and objection (Art. 15 to 21 GDPR). Contact the controller named above. You can also lodge a complaint with a data protection supervisory authority (Art. 77 GDPR).',
        ],
      },
    ],
  };
}

export function imprint(lang: Language, op: Operator = OPERATOR): LegalDoc {
  const vat = op.vatId
    ? [
        {
          heading: lang === 'de' ? 'Umsatzsteuer-ID' : 'VAT ID',
          paragraphs: [
            lang === 'de'
              ? `Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${op.vatId}`
              : `VAT identification number according to § 27a UStG: ${op.vatId}`,
          ],
        },
      ]
    : [];
  if (lang === 'de') {
    return {
      title: 'Impressum',
      updated: updated(lang),
      sections: [
        { heading: 'Angaben gemäß § 5 DDG', paragraphs: [contactLines(op, lang)] },
        ...vat,
        {
          heading: 'Haftung',
          paragraphs: [
            'Die App wird ohne Gewähr für Richtigkeit oder Eignung für einen bestimmten Zweck bereitgestellt. Die Abschnitte 15 und 16 der Lizenz (GNU AGPL 3.0) schließen Gewährleistung und Haftung aus, soweit das gesetzlich zulässig ist; zwingende gesetzliche Ansprüche bleiben unberührt.',
            'Für verlinkte Websites sind deren Betreiber verantwortlich. Bei konkreten Hinweisen auf Rechtsverletzungen wird ein Link entfernt.',
          ],
        },
        {
          heading: 'Urheberrecht',
          paragraphs: [
            'Der Quellcode steht unter der GNU Affero General Public License, nur Version 3.0. Die enthaltenen Bibliotheken, die Schrift und die Bilder behalten ihre eigenen Lizenzen, aufgeführt unter „Über diese App“ und „Bildnachweise“. Die Lizenz gewährt keine Rechte am Namen der App.',
          ],
        },
      ],
    };
  }
  return {
    title: 'Legal notice',
    updated: updated(lang),
    sections: [
      {
        heading: 'Information according to § 5 DDG (German Digital Services Act)',
        paragraphs: [contactLines(op, lang)],
      },
      ...vat,
      {
        heading: 'Liability',
        paragraphs: [
          'The app comes with no guarantee that it is correct or fit for any purpose. Sections 15 and 16 of the licence (GNU AGPL 3.0) disclaim warranty and liability as far as the law allows; mandatory statutory claims are unaffected.',
          'Linked websites are the responsibility of their operators. A link will be removed on concrete indication of an infringement.',
        ],
      },
      {
        heading: 'Copyright',
        paragraphs: [
          'The source code is under the GNU Affero General Public License, version 3.0 only. The bundled libraries, the font and the pictures keep their own licences, listed under “About this app” and “Picture credits”. The licence grants no rights to the app’s name.',
        ],
      },
    ],
  };
}

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * A standalone page with the German and the English version of one document, for the static
 * privacy.html / imprint.html the build writes (no JavaScript, so any crawler can read it).
 */
export function legalPageHtml(de: LegalDoc, en: LegalDoc, appName: string): string {
  const article = (doc: LegalDoc, lang: Language) => {
    const body = doc.sections
      .map((s) => {
        const heading = s.heading ? `<h2>${escapeHtml(s.heading)}</h2>\n` : '';
        const paragraphs = s.paragraphs
          .map((p) => {
            const html = linkParts(p)
              .map((part) =>
                part.href
                  ? `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>`
                  : escapeHtml(part.text),
              )
              .join('')
              .replace(/\n/g, '<br>\n');
            return `<p>${html}</p>`;
          })
          .join('\n');
        return heading + paragraphs;
      })
      .join('\n');
    return `<article lang="${lang}" id="${lang}">
<h1>${escapeHtml(doc.title)}</h1>
${body}
<p class="muted">${escapeHtml(doc.updated)}</p>
</article>`;
  };
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${de.title} · ${en.title} – ${appName}`)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #fffaf2; color: #1f2a28;
    font: 18px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; overflow-wrap: anywhere; }
  h1 { font-size: 30px; line-height: 1.2; margin: 0 0 16px; }
  h2 { font-size: 22px; line-height: 1.25; margin: 28px 0 8px; }
  p { margin: 0 0 12px; }
  a { color: #1f6f5c; }
  .muted { color: #4d5a57; }
  hr { border: 0; border-top: 2px solid #d6cbb9; margin: 40px 0; }
</style>
</head>
<body>
<main>
<p><a href="#en">English version</a> · <a href="./">${escapeHtml(appName)}</a></p>
${article(de, 'de')}
<hr>
${article(en, 'en')}
</main>
</body>
</html>
`;
}

/** Splits text into plain parts and links (URLs and email addresses), for both renderers. */
export function linkParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const re = /(https?:\/\/[^\s]+[^\s.,;:)])|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], href: m[1] ? m[1] : `mailto:${m[2]}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
