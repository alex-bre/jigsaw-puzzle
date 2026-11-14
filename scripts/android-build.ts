/**
 * Builds the web app, copies it into the Android project and runs a Gradle release build.
 *
 *   npm run android:apk     → android/app/build/outputs/apk/release/app-release.apk
 *   npm run android:bundle  → android/app/build/outputs/bundle/release/app-release.aab (Play Store)
 *
 * Needs JDK 21 and the Android SDK (Android Studio installs both). The build is signed when
 * android/keystore.properties exists (see README), otherwise Gradle produces an unsigned file.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kind = process.argv[2] === 'bundle' ? 'bundle' : 'apk';
const win = process.platform === 'win32';

function run(cmd: string, args: string[], cwd = root): void {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(join(root, 'android', 'keystore.properties'))) {
  console.warn('android/keystore.properties not found: the release build will be UNSIGNED.');
}
run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);
run(
  win ? 'gradlew.bat' : './gradlew',
  [kind === 'bundle' ? 'bundleRelease' : 'assembleRelease'],
  join(root, 'android'),
);
console.log(
  `\nDone: android/app/build/outputs/${
    kind === 'bundle' ? 'bundle/release/app-release.aab' : 'apk/release/app-release.apk'
  }`,
);
