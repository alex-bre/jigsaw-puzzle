# Jigsaw Puzzle – Implementation Plan

Stack: **PixiJS v8 + TypeScript + Vite**, packaged for Android with **Capacitor**. iOS comes later.
The app works fully offline. It has no ads, no accounts and no network calls, and all data stays on the device.

## 1. Product decisions

| Topic          | Decision                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Images         | About 30 built-in, freely licensed photos in categories, plus "make a puzzle from my own photo"                                 |
| Categories     | e.g. Animals, Nature, Flowers, Cities, Food, Art, plus "My Photos"                                                              |
| Piece shape    | Classic tabs and blanks generated from a seed (Bézier curves)                                                                   |
| Piece counts   | 12 · 24 · 48 · 96 · 150 · 240                                                                                                   |
| Rotation       | Off by default. Optional setting (90° steps, rotated with a tap)                                                                |
| Helpers        | Toggle buttons for: ghost image on the board, edge pieces only, sort tray (edges first / by color)                              |
| Layout         | The board is on top. A scrollable piece tray at the bottom (on the right in landscape). Pinch zoom and pan on the board         |
| Snapping       | Generous tolerance. Pieces lock into their correct place on the board and also join neighbors anywhere, so groups move together |
| Saving         | Auto-save. Several puzzles can be in progress at once and resumed later                                                         |
| Stats          | A "completed" badge plus best time for each image and piece count. No scores or leaderboards                                    |
| Language       | Follows the system language (German if `de*`, otherwise English). Can be changed in Settings                                    |
| Orientation    | Portrait first on phones. Both orientations on tablets                                                                          |
| Sound/haptics  | Soft snap click, short vibration, gentle completion sound. One on/off switch for each                                           |
| Style          | Calm, warm and high contrast. Buttons at least 56dp with icon **and** text label. Text at least 18sp                            |
| Target devices | Smooth on mid-range Android phones about 5 years old                                                                            |
| Tests          | Vitest for the logic (generation, snapping, groups, save/load)                                                                  |

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│  HTML/CSS UI layer (menus, dialogs, top bar buttons) │  ← plain TS + DOM, accessible, scales with system font
├──────────────────────────────────────────────────────┤
│  Pixi canvas (game only: board, pieces, tray)        │  ← one Application, created once, reused
├──────────────────────────────────────────────────────┤
│  Game core (pure TS, no Pixi): model, rules, snapping│  ← unit-tested
├──────────────────────────────────────────────────────┤
│  Platform layer: storage, haptics, photo picker,     │  ← web + Capacitor implementations
│  back button, i18n                                   │
└──────────────────────────────────────────────────────┘
```

**Why the menus are HTML and not Pixi:** real text rendering, system font scaling, screen-reader support, simple layout with CSS, and fast startup. Pixi only renders the part that needs it, which is the puzzle itself. The menus don't use a framework (vanilla TS with a tiny screen router), which keeps the bundle small. Preact can be added later if the UI grows.

### Project structure

```
src/
  main.ts                 bootstrap, router
  ui/                     screens: Home, Category, ImagePicker, NewPuzzle (piece count), Settings, Credits, dialogs
  ui/styles/              CSS tokens (colors, sizes), components
  game/
    core/                 PURE logic – no Pixi imports
      rng.ts              seeded PRNG (mulberry32)
      cut.ts              grid + tab generation → edge paths per piece
      model.ts            PuzzleState, Piece, Group (union-find)
      snap.ts             neighbor & board snapping rules
      serialize.ts        save/load (versioned)
    render/
      PieceFactory.ts     cut image into piece textures (atlas)
      BoardView.ts        board frame, ghost image, locked layer
      PieceView.ts        sprite + hitArea polygon
      TrayView.ts         scrollable tray
      Camera.ts           pinch zoom / pan / bounds
      Input.ts            pointer handling, drag, multi-touch arbitration
      Effects.ts          snap pulse, completion celebration
    GameController.ts     glues core ↔ render ↔ storage ↔ sound
  platform/
    storage.ts            interface + IndexedDB (web) / Capacitor implementations
    photos.ts             file input (web) / @capacitor/camera (Android)
    haptics.ts, audio.ts, backButton.ts
  i18n/  de.json, en.json, index.ts
  content/catalog.ts      categories + images (generated from manifest)
assets/images/            processed WebP images + thumbnails
scripts/prepare-images.ts resize/convert originals, build manifest + credits
tests/                    Vitest
```

## 3. Key technical design

### 3.1 Piece generation

- Choose a grid (cols × rows) from the piece count and the image aspect ratio, so pieces are close to square.
- Each inner edge gets a random tab direction and a small shape variation from a **seeded PRNG**. The **seed is stored in the save file**, so the shapes are regenerated exactly the same and we never store geometry.
- Each edge is a cubic-Bézier path. A piece outline is its four edges, and shared edges are mirrored.

### 3.2 Rendering (the performance-critical part)

- When a puzzle loads, draw each piece **once** into a `RenderTexture` (image region, masked by the outline, with a subtle bevel/highlight and a baked drop shadow). Pack everything into **one or a few atlas textures** so Pixi batches all pieces into very few draw calls.
- Each piece is then a plain `Sprite`. There are no masks or filters at runtime.
- Hit testing uses a simplified **polygon `hitArea`** sampled from the outline, so taps on the transparent area around a tab fall through to the piece underneath.
- When a piece locks into the board, it is drawn into a static "locked layer" texture (or a `cacheAsTexture` container), so finished areas cost almost nothing.
- Resolution is `min(devicePixelRatio, 2)`. Source images are at most 2048 px on the long side (1600 px on low-memory devices). Textures are released when leaving a puzzle.
- Rendering runs only while something is changing (`ticker` stops when idle), which saves battery.

### 3.3 Interaction

- **Drag:** the piece or group is lifted (slight scale-up and a stronger shadow), follows the finger, and is brought to the front.
- **Drop:**
  1. If near its correct board position → animate into place, lock, "click" + haptic.
  2. Else if any edge is near its matching neighbor (in the right relative position) → join the groups (union-find), snap, give feedback.
  3. Else it stays loose where it was dropped (on the board or its margin), or goes back to the tray if dropped over the tray.
- **Tolerance:** about 30% of the piece size, scaled by zoom, so it feels forgiving.
- **Tray:** horizontal scroll by swiping. Dragging a piece _upwards_ (or out of the tray) picks it up. Direction detection keeps scrolling and picking up from interfering with each other. Tray pieces are shown large enough to recognize.
- **Camera:** pinch zoom, two-finger pan, a "fit board" button, and a double-tap-free design (no gestures that elderly users struggle with). Zoom is clamped so pieces never get too small to grab.
- **Optional rotation:** tap a piece once to rotate it 90°. A piece only snaps when its rotation is correct.

### 3.4 Save data

- `PuzzleSave { version, id, imageId, pieceCount, seed, rotation, elapsedMs, pieces: [{x, y, rot, inTray, locked}], groups, settings }`
- Saves are debounced to at most every 2 seconds, and also happen on `visibilitychange` / app pause.
- **Storage interface** with two implementations:
  - Web: IndexedDB (via `idb-keyval`).
  - Android: `@capacitor/filesystem` for everything (settings, index, save files and user photos), written atomically. User photos are re-encoded to at most 2048 px JPEG before storing.
- A schema `version` field plus a migration function, so updates never break existing saves.

### 3.5 Images and licensing

- Source only images that **clearly allow bundling in an app**: CC0/public domain (Wikimedia Commons, Openverse filtered to CC0, Pexels, Unsplash). Unsplash and Pexels have their own licenses, which allow use in apps but not redistributing the images as a standalone collection. That is fine for a puzzle app, but we keep a record anyway.
- `assets/credits.json` stores the source URL, author and license for every image. A **Credits** screen shows them.
- `scripts/prepare-images.ts` (using `sharp`) resizes images to 2048 px WebP, creates 400 px thumbnails and generates the catalog manifest.
- Image choice: good contrast and varied detail. Avoid large uniform areas like plain sky, because they are frustrating for older players.

### 3.6 Language (i18n)

- On first start: `navigator.language` starts with `de` → German, otherwise English. The choice is saved, and Settings has an "Automatic / Deutsch / English" option.
- Dictionaries are flat JSON files with keys, and the type safety comes from `en.json`.

### 3.7 Accessibility and senior-friendly UI

- Touch targets at least 56dp, base font 20px, and the layout respects the Android system font size (WebView text zoom).
- Every button has an icon **and** a text label. No hidden gestures. Everything important can be reached with one tap.
- WCAG AA contrast, no color-only meaning, calm animations, and "reduce motion" is respected.
- Confirmation dialogs for destructive actions ("Start over?") with large Yes/No buttons.
- No timers shown by default, so there's no pressure (the time is shown only on completion).
- The Android back button always does the obvious thing: close the dialog → leave the puzzle (auto-saved) → leave the app.

### 3.8 Screens

1. **Home:** "Continue" (most recent puzzle, large), "New puzzle", "My puzzles" (in progress / finished), "Settings".
2. **Categories** → **Image grid** (large thumbnails with a completed badge).
3. **Piece count:** six big buttons with a preview of the grid drawn over the image, plus a rotation toggle.
4. **Game:** a minimal top bar with Back, Ghost image, Edges only, Sort, Fit view, and a progress indicator (e.g. 37/96).
5. **Completion:** the full image, a gentle animation, the time, and the buttons "Next puzzle" / "Back to menu".
6. **Settings:** language, sound, vibration, background color (wood/felt/dark), rotation default, and Credits.

## 4. Milestones

Each milestone ends in a working, demonstrable state.

**M1 – Project setup (½ day)**
Vite + TS + Pixi v8, ESLint/Prettier, Vitest, a basic CSS token system and the folder structure.
✅ `npm run dev` shows a Pixi canvas, and `npm test` runs.

**M2 – Core puzzle logic (1–2 days)**
Seeded PRNG, grid sizing, edge/tab generation, the model with union-find groups, snapping rules, serialization, all with unit tests.
✅ Tests cover generation determinism, neighbor matching, group merging and save→load round trips.

**M3 – Playable prototype (2–3 days)**
PieceFactory (atlas), sprites with hitAreas, dragging, snapping to the board and to neighbors, group movement, completion detection. One hard-coded image, pieces scattered around the board.
✅ A 48-piece puzzle can be solved smoothly in desktop and mobile browsers.

**M4 – Tray, camera and helpers (2–3 days)**
Bottom tray with scroll/drag arbitration, pinch zoom and pan, fit view, ghost image, edges-only filter, sorting, snap feedback (sound + animation).
✅ 240 pieces at 60 fps on a mid-range phone (Chrome remote debugging).

**M5 – Menus, content and i18n (2–3 days)**
HTML UI screens, router, categories, image prep script, first ~30 images with credits, German/English with system detection, settings.

**M6 – Persistence and stats (1–2 days)**
Storage abstraction, auto-save/resume, multiple saves, "My puzzles", completed badges and best times, own photos (web file input).

**M7 – Android via Capacitor (1–2 days)**
Capacitor setup, Android project, plugins (Preferences, Filesystem, Camera, Haptics, App, StatusBar, SplashScreen), Capacitor storage implementation, back button, app icon and splash, orientation config, release build signing.
✅ Installs from an APK/AAB, works in airplane mode, and saves survive restarts and app updates.
_Implementation notes:_ everything (settings and stats included) is stored as files through `@capacitor/filesystem` with write-to-temp-then-rename. `@capacitor/preferences` was dropped because it writes asynchronously (`apply()`), so the last write can be lost if the app is killed right after pausing. `@capacitor/status-bar` was replaced by Capacitor 8's built-in `SystemBars` (Android 15+ is always edge-to-edge). Photos use the system photo picker plus a separate "Take a photo" button instead of a source prompt, so no camera or storage permission is needed.

**M8 – Polish and testing with real users (ongoing)**
Test with older users (font size, contrast, tolerance tuning), low-end device profiling, completion celebration, empty states, Play Store listing.

**Later:** iOS (Capacitor iOS, with storage already abstracted), more image packs, daily puzzle, optional square pieces.

## 5. Dependencies

| Package                                                                                            | Purpose                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------- |
| `pixi.js` (v8)                                                                                     | Rendering                    |
| `idb-keyval`                                                                                       | IndexedDB storage on the web |
| `@capacitor/core`, `/cli`, `/android`                                                              | Native packaging             |
| `@capacitor/filesystem`, `/camera`, `/haptics`, `/app`, `/splash-screen` (+ built-in `SystemBars`) | Native features              |
| `vitest`                                                                                           | Unit tests                   |
| `sharp`, `tsx` (dev)                                                                               | Image preparation script     |

No analytics, no ad SDKs, no network permission needed beyond Capacitor's defaults. We can also remove `INTERNET` from the manifest.

## 6. Risks and how they are handled

| Risk                                      | Handling                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Memory on low-end devices with 240 pieces | Atlas packing, capped image resolution, release textures on exit, test early in M4             |
| Tray scroll vs. drag conflicts            | Direction-based gesture detection, tuned with real users                                       |
| Image licensing                           | Use only CC0/clearly permitted images and track each one in `credits.json`                     |
| WebView storage eviction                  | Use the Capacitor Filesystem on Android, not WebView IndexedDB                                 |
| Small screens + elderly users             | Generous tolerance, large tray pieces, zoom limits, a "fit view" button that is always visible |
