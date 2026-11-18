import { describe, expect, it } from 'vitest';
import { parentRoute, parseRoute, routeToHash, type Route } from '../src/ui/router';
import { DEFAULT_SETTINGS, sanitize } from '../src/settings';
import { catalog as catalogData } from '../src/content/catalog';
import manifest from '../content/images.json';
import { reflow } from '../src/ui/reflow';
import {
  imprint,
  legalPageHtml,
  linkParts,
  missingOperatorFields,
  privacyPolicy,
  type Operator,
} from '../src/content/legal';

describe('router', () => {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'pictures' },
    { name: 'category', categoryId: 'animals' },
    { name: 'setup', imageId: 'great-wave' },
    { name: 'play' },
    { name: 'settings' },
    { name: 'credits' },
    { name: 'about' },
    { name: 'privacy' },
    { name: 'imprint' },
  ];

  it('round-trips every route through the URL hash', () => {
    for (const r of routes) expect(parseRoute(routeToHash(r))).toEqual(r);
  });

  it('falls back to safe routes for unknown or incomplete hashes', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/nonsense')).toEqual({ name: 'home' });
    expect(parseRoute('#/setup')).toEqual({ name: 'pictures' });
  });

  it('knows where "Back" leads', () => {
    const fromCategory: Route = { name: 'category', categoryId: 'art' };
    expect(parentRoute({ name: 'home' }, fromCategory)).toBeNull();
    expect(parentRoute(fromCategory, fromCategory)).toEqual({ name: 'pictures' });
    expect(parentRoute({ name: 'setup', imageId: 'x' }, fromCategory)).toEqual(fromCategory);
    expect(parentRoute({ name: 'credits' }, fromCategory)).toEqual({ name: 'settings' });
    expect(parentRoute({ name: 'about' }, fromCategory)).toEqual({ name: 'settings' });
    expect(parentRoute({ name: 'privacy' }, fromCategory)).toEqual({ name: 'settings' });
    expect(parentRoute({ name: 'settings' }, fromCategory)).toEqual({ name: 'home' });
  });
});

describe('settings', () => {
  it('fills in defaults for missing or invalid values', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitize({ language: 'fr', sound: 'yes', background: 'pink' })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(
      sanitize({ language: 'de', sound: false, vibration: false, background: 'wood', zoom: true }),
    ).toEqual({
      language: 'de',
      sound: false,
      vibration: false,
      background: 'wood',
      zoom: true,
    });
  });
});

describe('picture catalogue', () => {
  it('only contains pictures with a free licence and full attribution', () => {
    for (const img of manifest.images) {
      expect(img.license).toMatch(/^(CC0|Public domain)/);
      expect(img.author.length).toBeGreaterThan(0);
      expect(img.sourcePage).toMatch(/^https:\/\//);
      expect(img.licenseUrl).toMatch(/^https:\/\//);
    }
  });

  it('every picture belongs to a known category and has both languages', () => {
    const categories = new Set(manifest.categories.map((c) => c.id));
    for (const img of manifest.images) {
      expect(categories.has(img.category)).toBe(true);
      expect(img.title.en && img.title.de).toBeTruthy();
    }
    for (const c of manifest.categories) expect(c.title.en && c.title.de).toBeTruthy();
  });

  it('the generated catalogue matches the manifest', () => {
    expect(catalogData.images.map((i) => i.id)).toEqual(manifest.images.map((i) => i.id));
    for (const img of catalogData.images) {
      expect(Math.max(img.width, img.height)).toBeLessThanOrEqual(2048);
      expect(img.width).toBeGreaterThan(img.height); // landscape format for phones & tablets
    }
  });
});

describe('licence text reflow', () => {
  it('joins hard-wrapped lines into paragraphs', () => {
    const text =
      'Permission is hereby granted, free of charge, to any person obtaining a copy\n' +
      'of this software and associated documentation files (the "Software"), to deal\n' +
      'in the Software without restriction.\n' +
      '\n' +
      'Next paragraph.';
    expect(reflow(text)).toBe(
      'Permission is hereby granted, free of charge, to any person obtaining a copy of this ' +
        'software and associated documentation files (the "Software"), to deal in the Software ' +
        'without restriction.\n\nNext paragraph.',
    );
  });

  it('keeps short lines, list items and turns rules into breaks', () => {
    const rule = '-'.repeat(78);
    const text =
      `${rule}\npixi.js 8.22.0\nLicence: MIT\n${rule}\n\nMIT License\n\n` +
      'Copyright (c) 2013-2023 Mathew Groves, Chad Engler\n\n' +
      'Redistribution and use in source and binary forms, with or without modification,\n' +
      '1. Redistributions of source code must retain the above copyright notice, this\n' +
      '   list of conditions and the following disclaimer.\n';
    expect(reflow(text)).toBe(
      'pixi.js 8.22.0\nLicence: MIT\n\nMIT License\n\n' +
        'Copyright (c) 2013-2023 Mathew Groves, Chad Engler\n\n' +
        'Redistribution and use in source and binary forms, with or without modification,\n' +
        '1. Redistributions of source code must retain the above copyright notice, this\n' +
        '   list of conditions and the following disclaimer.',
    );
  });
});

describe('privacy policy and Impressum', () => {
  const filled: Operator = {
    name: 'Erika Mustermann',
    address: ['Musterstraße 1', '12345 Musterstadt'],
    email: 'erika@example.org',
    phone: '+49 30 1234567',
  };

  it('has the same sections in both languages', () => {
    const count = (lang: 'de' | 'en') => privacyPolicy(lang, filled).sections.length;
    expect(count('de')).toBe(count('en'));
  });

  it('names the controller with full contact details', () => {
    const controller = privacyPolicy('de', filled).sections[1].paragraphs.join('\n');
    for (const part of [filled.name, ...filled.address, filled.email, filled.phone]) {
      expect(controller).toContain(part);
    }
  });

  it('shows the filled-in Impressum fields and leaves out the empty ones', () => {
    expect(missingOperatorFields(filled)).toEqual([]);
    expect(imprint('de', filled).sections[0].paragraphs[0]).toBe(
      'Erika Mustermann\nMusterstraße 1\n12345 Musterstadt\nE-Mail: erika@example.org\nTelefon: +49 30 1234567',
    );
    const emailOnly: Operator = {
      name: 'Erika Mustermann',
      address: [''],
      email: 'e@x.org',
      phone: '',
    };
    expect(missingOperatorFields(emailOnly)).toEqual(['address', 'phone']);
    expect(imprint('en', emailOnly).sections[0].paragraphs[0]).toBe(
      'Erika Mustermann\nEmail: e@x.org',
    );
  });

  it('has the same Impressum sections in both languages', () => {
    expect(imprint('de', filled).sections.length).toBe(imprint('en', filled).sections.length);
  });

  it('turns URLs and email addresses into links, without trailing punctuation', () => {
    expect(linkParts('See https://example.org/a. Or mail erika@example.org')).toEqual([
      { text: 'See ' },
      { text: 'https://example.org/a', href: 'https://example.org/a' },
      { text: '. Or mail ' },
      { text: 'erika@example.org', href: 'mailto:erika@example.org' },
    ]);
  });

  it('renders a static page with both languages and escaped text', () => {
    const html = legalPageHtml(
      privacyPolicy('de', { ...filled, name: 'A <b>' }),
      privacyPolicy('en', filled),
      'Jigsaw Puzzle',
    );
    expect(html).toContain('<article lang="de" id="de">');
    expect(html).toContain('<article lang="en" id="en">');
    expect(html).toContain('A &lt;b&gt;');
    expect(html).not.toContain('<script');
  });
});
