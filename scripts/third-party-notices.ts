/**
 * Regenerates THIRD-PARTY-NOTICES from the installed production dependency tree.
 *
 *   npm run notices
 *
 * The MIT, BSD and ISC licences of our dependencies require their copyright notices to travel with
 * the *distributed* app, not merely with the repository, and the font's OFL asks the same. Vite
 * strips comments when minifying, so this file is what carries them: the build ships it and the
 * About screen shows it. Regenerate whenever the production dependencies change; the Tests
 * workflow fails when it is stale. Dev dependencies are excluded: they never reach a player.
 *
 * Covers the npm packages. The AndroidX libraries that Gradle compiles into the APK are not
 * listed (yet).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const OUT = 'THIRD-PARTY-NOTICES';
const LICENSE_FILE = /^(LICENSE|LICENCE|COPYING)/i;

/**
 * Licence texts for packages that declare a licence but ship no licence file.
 *
 * Each entry is the licence the package declares, filled in with the copyright holder its own
 * metadata names. Keyed by name; the version is recorded so an upgrade is a prompt to re-check
 * whether upstream now ships a file of its own.
 */
const MANUAL_NOTICES: Record<string, { version: string; text: string }> = {
  '@pixi/colord': {
    version: '2.9.6',
    text: `MIT License

Copyright (c) Vlad Shilov <omgovich@ya.ru>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  },
};

/**
 * Directories of every installed production package. `npm ls` exits non-zero over things that do
 * not matter here (an unmet optional peer, say) while still printing the full list, so the output
 * is trusted, not the exit code. One command string so a shell resolves `npm.cmd` on Windows.
 */
function packageDirs(): string[] {
  const opts = {
    cwd: root,
    encoding: 'utf8' as const,
    maxBuffer: 32e6,
    stdio: ['ignore', 'pipe', 'ignore'] as ['ignore', 'pipe', 'ignore'],
  };
  let out: string;
  try {
    out = execSync('npm ls --omit=dev --all --parseable', opts);
  } catch (err) {
    out = (err as { stdout?: string }).stdout ?? '';
    if (!out) throw err;
  }
  // The first line is the project itself.
  return out.split('\n').slice(1).filter(Boolean);
}

interface Pkg {
  name: string;
  version: string;
  license?: string;
  homepage?: string;
}

const seen = new Set<string>();
const sections: { key: string; text: string }[] = [];
const problems: string[] = [];

for (const dir of packageDirs()) {
  if (!existsSync(join(dir, 'package.json'))) continue;
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Pkg;
  // Type declarations are erased at build time and never reach the app.
  if (pkg.name.startsWith('@types/')) continue;
  const key = `${pkg.name} ${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const file = readdirSync(dir).find((f) => LICENSE_FILE.test(f));
  const manual = file ? undefined : MANUAL_NOTICES[pkg.name];
  if (!file && !manual) {
    problems.push(
      `${key} (${relative(root, dir)}): declares "${pkg.license ?? '?'}" but ships no licence file`,
    );
    continue;
  }
  if (manual && manual.version !== pkg.version) {
    problems.push(
      `${key}: the manual notice was written for ${manual.version}; check upstream again`,
    );
  }

  const text = manual ? manual.text : readFileSync(join(dir, file!), 'utf8');
  const rule = '-'.repeat(78);
  sections.push({
    key,
    text:
      `${rule}\n${key}\nLicence: ${pkg.license ?? 'see below'}\n` +
      `${pkg.homepage ? `Homepage: ${pkg.homepage}\n` : ''}${rule}\n\n${text.trimEnd()}\n`,
  });
}

if (problems.length) {
  console.error(`Packages needing a manual notice entry:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

sections.sort((a, b) => a.key.localeCompare(b.key));

const header = `THIRD-PARTY NOTICES

The open-source packages built into Jigsaw Puzzle, with their licences.
Generated by \`npm run notices\`; do not edit by hand.

Contents: ${sections.length} packages.

`;

writeFileSync(join(root, OUT), header + sections.map((s) => s.text).join('\n'));
console.log(`Wrote ${OUT} (${sections.length} packages).`);
