# Jigsaw Puzzle

A calm, senior-friendly jigsaw puzzle game. PixiJS v8 + TypeScript + Vite, later packaged for Android with Capacitor. Fully offline, no ads.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the full plan and milestones.

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

## Structure

- `src/game/core/` – pure puzzle logic (cut geometry, model, snapping, scattering, save format). No Pixi/DOM; unit-tested in `tests/`.
- `src/game/render/` – Pixi rendering: piece texture atlas, puzzle view (board), tray view, camera, pointer input.
- `src/game/GameController.ts` – connects core, rendering and input; renders only on demand.
- `src/ui/` – HTML/CSS user interface: hash router, menu screens (`screens/`), game chrome and dialogs.
- `src/content/` – picture catalogue (generated `catalog.json` + helpers).
- `src/settings.ts` – player settings (language, sound, vibration, background).
- `src/platform/` – device features (currently synthesized sound effects; storage and haptics follow).
- `src/i18n/` – German/English texts; language follows the system language.
