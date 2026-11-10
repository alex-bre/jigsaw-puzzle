import { describe, expect, it } from 'vitest';
import { parentRoute, parseRoute, routeToHash, type Route } from '../src/ui/router';
import { DEFAULT_SETTINGS, sanitize } from '../src/settings';
import { catalog as catalogData } from '../src/content/catalog';
import manifest from '../content/images.json';

describe('router', () => {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'pictures' },
    { name: 'category', categoryId: 'animals' },
    { name: 'setup', imageId: 'great-wave' },
    { name: 'play' },
    { name: 'settings' },
    { name: 'credits' },
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
      sanitize({ language: 'de', sound: false, vibration: false, background: 'wood' }),
    ).toEqual({
      language: 'de',
      sound: false,
      vibration: false,
      background: 'wood',
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
