# Jigsaw Puzzle

A calm, senior-friendly jigsaw puzzle game. PixiJS v8 + TypeScript + Vite, packaged for Android with Capacitor 8. Fully offline, no ads.

## Development

```bash
npm install
npm run dev        # dev server (also reachable from a phone on the same network)
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # production build into dist/
```

## Pictures

The built-in pictures are listed in [content/images.json](content/images.json) with title (en/de), category, author, licence and source page.
Only **CC0 or public-domain** pictures are allowed (the build script refuses anything else).

```bash
npm run images     # downloads new originals into .cache/ (not committed), writes public/images/*.webp,
                   # thumbnails and src/content/catalog.json (shown on the Credits screen)
```

To add a picture: add an entry to `content/images.json`, run `npm run images`, commit the generated files.

## Android app

Needs **Android Studio** (it brings the Android SDK and a JDK 21). The `android/` folder is a normal Android Studio project and is committed; the web build inside it (`android/app/src/main/assets/public`) is not, so always sync before building.

```bash
npm run android:sync    # build the web app and copy it into android/
npm run android:open    # open the project in Android Studio (run/debug from there)
npm run android:run     # build, sync and install on a connected phone / emulator
npm run android:dev     # live reload: start `npm run dev` first, then this (phone on the same Wi-Fi)
npm run android:apk     # release APK  → android/app/build/outputs/apk/release/app-release.apk
npm run android:bundle  # release AAB for the Play Store → android/app/build/outputs/bundle/release/
npm run android:icons   # redraw app icon + splash (scripts/app-icons.ts) and regenerate all sizes
```

- **Version**: `versionName` and `versionCode` come from `package.json` (`1.2.3` → code `10203`). Raise the version there before every Play Store upload.
- **Storage**: on Android everything is saved as files in the app's private folder (`FileStorage` + `src/platform/nativeFiles.ts`). It survives restarts and updates and is only removed on uninstall. Writes go to a temp file first, so a killed app never leaves a broken save. Cloud backup is off (`allowBackup="false"`) because all data stays on the device.
- **Offline**: release builds have no `INTERNET` permission. Debug builds add it back for live reload (`android/app/src/debug/AndroidManifest.xml`).
- **Orientation**: phones are locked to portrait; tablets (smallest width ≥ 600dp) can rotate (`MainActivity.java`).
- **Back button**: closes an open dialog → leaves the puzzle (saved) → goes up one screen → leaves the app.

### Release signing

Create the upload key once and **back it up together with its passwords**. Without it, updates to the Play Store app are not possible:

```bash
keytool -genkey -v -keystore android/upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android/keystore.properties` (ignored by git):

```properties
storeFile=upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

`npm run android:apk` / `android:bundle` sign automatically when this file exists. Without it they produce an unsigned build and print a warning.

## Structure

- `src/game/core/` – pure puzzle logic (cut geometry, model, snapping, scattering, save format). No Pixi/DOM; unit-tested in `tests/`.
- `src/game/render/` – Pixi rendering: piece texture atlas, puzzle view (board), tray view, camera, pointer input.
- `src/game/GameController.ts` – connects core, rendering and input; renders only on demand.
- `src/ui/` – HTML/CSS user interface: hash router, menu screens (`screens/`), game chrome and dialogs.
- `src/content/` – picture catalogue (generated `catalog.json` + helpers).
- `src/settings.ts` – player settings (language, sound, vibration, background).
- `src/data/repository.ts` – everything kept on the device: puzzles in progress, best times, own photos, settings.
- `src/platform/` – device features: storage (IndexedDB on the web, files on Android), haptics, back button and app lifecycle, photo picker/camera, synthesized sound effects.
- `android/` – Capacitor Android project; `capacitor.config.ts` – app id, splash screen and system bar settings; `assets/` – app icon and splash sources.
- `src/i18n/` – German/English texts; language follows the system language.
