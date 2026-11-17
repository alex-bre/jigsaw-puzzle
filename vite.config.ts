import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import {
  imprint,
  legalPageHtml,
  missingOperatorFields,
  privacyPolicy,
} from './src/content/legal.ts';

const read = (file: string): string => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');

const pkg = JSON.parse(read('package.json')) as {
  version: string;
  author: string;
  repository: { url: string };
};

/**
 * Licence texts that ship inside the build as `[source, servedAs]`, shown on the About screen.
 *
 * The AGPL asks the app to show its licence, and the MIT/BSD/ISC/OFL terms of the dependencies
 * require their notices to accompany the *distributed* app (web build, release zip and APK alike),
 * while minified bundles carry none. The root files stay the single source; the build takes a
 * copy. `.txt` so a static host serves them as text rather than as a download.
 */
const SHIPPED_TEXTS = [
  ['LICENSE', 'LICENSE.txt'],
  ['THIRD-PARTY-NOTICES', 'THIRD-PARTY-NOTICES.txt'],
] as const;

function shipLicenceTexts(): Plugin {
  return {
    name: 'ship-licence-texts',
    // Emitted rather than copied by hand so they follow `outDir`.
    generateBundle() {
      for (const [source, fileName] of SHIPPED_TEXTS) {
        this.emitFile({ type: 'asset', fileName, source: read(source) });
      }
    },
    // The About screen loads them, so they have to resolve in `vite dev` too.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const entry = SHIPPED_TEXTS.find(([, fileName]) => path === `/${fileName}`);
        if (!entry) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(read(entry[0]));
      });
    },
  };
}

/**
 * Static privacy.html and imprint.html next to index.html, from src/content/legal.ts: the Play
 * Console needs a plain URL for the privacy policy, and the website should name its operator.
 * Reminds about Impressum fields that are still empty, without failing the build.
 */
function legalPages(): Plugin {
  return {
    name: 'legal-pages',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'privacy.html',
        source: legalPageHtml(privacyPolicy('de'), privacyPolicy('en'), 'Jigsaw Puzzle'),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'imprint.html',
        source: legalPageHtml(imprint('de'), imprint('en'), 'Jigsaw Puzzle'),
      });
      const missing = missingOperatorFields();
      if (missing.length) {
        this.warn(
          `Impressum has no ${missing.join(', ')} yet: § 5 DDG asks for them once the app is sold (OPERATOR in src/content/legal.ts).`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [shipLicenceTexts(), legalPages()],
  // Relative base so the build also works inside the Capacitor WebView.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_AUTHOR__: JSON.stringify(pkg.author),
    // The AGPL asks a modified copy offered over a network to point its users at the source.
    // Taken from package.json, so a fork only has to change it there.
    __SOURCE_URL__: JSON.stringify(pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
