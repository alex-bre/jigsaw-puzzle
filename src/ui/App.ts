import { findImage, imageUrl, imagesIn, loadCatalogImage, thumbUrl } from '../content/catalog';
import type { PhotoMeta, Repository, SaveMeta, Stats } from '../data/repository';
import { GameController } from '../game/GameController';
import type { SourceImage } from '../game/render/PieceFactory';
import { currentLanguage, detectLanguage, formatDuration, setLanguage, t } from '../i18n';
import { SoundEffects } from '../platform/audio';
import { appReady, exitApp, onBackButton, onPause, vibrate } from '../platform/device';
import { BACKGROUNDS, type Settings } from '../settings';
import { h, nextFrame } from './dom';
import { button, fillDialog, toolButton } from './kit';
import { loadPhoto } from './loadPhoto';
import { navigate, onRouteChange, parentRoute, parseRoute, type Route } from './router';
import type { ConfirmOptions, PictureRef, ScreenContext } from './screens/context';
import { homeScreen } from './screens/home';
import { categoryScreen, picturesScreen } from './screens/pictures';
import { puzzlesScreen } from './screens/puzzles';
import { creditsScreen, settingsScreen } from './screens/settings';
import { setupScreen } from './screens/setup';

/** Autosave this long after the last change (and always when leaving the game or the app). */
const SAVE_DELAY_MS = 1500;

/**
 * Application shell: routes between the menu screens (HTML) and the game view. The game view
 * (Pixi canvas, top bar, helper toolbar) is created once and only hidden while menus are shown.
 */
export class App {
  private readonly game: GameController;
  private readonly screens = h('div', { class: 'screens' });
  private readonly gameEl = h('div', { class: 'game', hidden: true });
  private readonly stage = h('main', { class: 'stage' });
  private readonly progressEl = h('div', { class: 'progress', role: 'status' });
  private topbar = h('header');
  private toolbar = h('nav');
  private readonly loadingEl = h('div', { class: 'loading', hidden: true });
  private readonly doneDialog = h('dialog', { class: 'dialog' });
  private readonly confirmDialog = h('dialog', { class: 'dialog' });
  private readonly sfx = new SoundEffects();
  private readonly helpers = { ghost: false, edgesOnly: false };
  private route: Route = { name: 'home' };
  /** Where "Back" leads from the setup screen (the category or the pictures overview). */
  private setupParent: Route = { name: 'pictures' };
  /** The puzzle currently loaded in the game view. */
  private live: { pictureId: string; complete: boolean } | null = null;
  private starting = false;
  private saves: SaveMeta[] = [];
  private stats: Stats = {};
  private photos: PhotoMeta[] = [];
  /** Object URLs of the stored photos (full image), by photo id. */
  private readonly photoUrls = new Map<string, string>();
  private saveTimer: number | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly repo: Repository,
    private settings: Settings,
  ) {
    this.applyLanguage();
    this.buildGameChrome();
    this.gameEl.append(this.topbar, this.stage, this.toolbar);
    root.append(this.screens, this.gameEl, this.loadingEl, this.doneDialog, this.confirmDialog);

    this.game = new GameController(
      this.stage,
      {
        onProgress: (placed, total) => this.setProgress(placed, total),
        onComplete: (ms, n) => void this.onComplete(ms, n),
        onSnap: (locked) => {
          this.sfx.snap(locked);
          if (this.settings.vibration) vibrate(locked);
        },
        onActivity: () => this.sfx.unlock(),
        onStateChange: () => this.scheduleSave(),
      },
      { noEdgePieces: t('noEdgePieces') },
    );
  }

  async start(): Promise<void> {
    const [saves, stats, photos] = await Promise.all([
      this.repo.listSaves(),
      this.repo.loadStats(),
      this.repo.listPhotos(),
    ]);
    this.saves = saves;
    this.stats = stats;
    this.photos = photos;
    await Promise.all(
      photos.map(async (p) => {
        const blob = await this.repo.photoBlob(p.id);
        if (blob) this.photoUrls.set(p.id, URL.createObjectURL(blob));
      }),
    );
    await this.game.init();
    this.applySettings();
    // Save when the app goes to the background or the page is closed.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.saveNow();
    });
    window.addEventListener('pagehide', () => void this.saveNow());
    onPause(() => void this.saveNow());
    onBackButton(() => this.onBackButton());
    onRouteChange((route) => this.render(route));
    this.render(parseRoute(location.hash));
    appReady();
    if (import.meta.env.DEV) {
      // Debug handle for manual testing / automated browser checks. Stripped from production builds.
      Object.assign(window, { __game: this.game, __app: this });
    }
  }

  // --- Routing --------------------------------------------------------------

  private render(route: Route): void {
    if (route.name === 'play' && !this.live && !this.starting) {
      navigate({ name: 'home' }, { replace: true });
      return;
    }
    if (this.route.name === 'play' && route.name !== 'play') void this.saveNow();
    this.route = route;
    if (route.name === 'category') this.setupParent = route;
    if (route.name === 'pictures') this.setupParent = { name: 'pictures' };

    const inGame = route.name === 'play';
    this.gameEl.hidden = !inGame;
    this.screens.hidden = inGame;
    if (inGame) return;
    if (this.doneDialog.open) this.doneDialog.close();
    this.renderScreen();
    this.screens.scrollTop = 0;
  }

  /** Re-renders the current menu screen, e.g. after data changed. */
  private renderScreen(): void {
    const route = this.route;
    if (route.name === 'play') return;
    const ctx = this.context();
    const el =
      route.name === 'pictures'
        ? picturesScreen(ctx)
        : route.name === 'category'
          ? categoryScreen(ctx, route.categoryId)
          : route.name === 'setup'
            ? setupScreen(ctx, route.imageId)
            : route.name === 'puzzles'
              ? puzzlesScreen(ctx)
              : route.name === 'settings'
                ? settingsScreen(ctx)
                : route.name === 'credits'
                  ? creditsScreen(ctx)
                  : homeScreen(ctx);
    this.screens.replaceChildren(el);
  }

  private context(): ScreenContext {
    return {
      go: (route) => navigate(route),
      back: () => this.back(),
      settings: this.settings,
      updateSettings: (patch) => this.updateSettings(patch),
      picture: (id) => this.picture(id),
      photos: this.photos.map((p) => this.photoRef(p)),
      addPhoto: (file) => this.addPhoto(file),
      deletePhoto: (id) => this.deletePhoto(id),
      saves: this.saves,
      stats: this.stats,
      startPuzzle: (id, n) => this.startPuzzle(id, n),
      continuePuzzle: (id) => this.continuePuzzle(id),
      deleteSave: (id) => this.deleteSave(id),
      confirm: (options) => this.confirm(options),
    };
  }

  /** Goes to the parent of the current screen. */
  back(): void {
    const parent = parentRoute(this.route, this.setupParent);
    if (parent) navigate(parent);
  }

  /**
   * Android back button: close the open dialog, else leave the puzzle (it is saved on the
   * way out), else go up one screen, and on the home screen leave the app.
   */
  private onBackButton(): void {
    if (this.starting) return; // a puzzle is being prepared
    const dialog = [this.confirmDialog, this.doneDialog].find((d) => d.open);
    if (dialog) {
      dialog.close(); // a confirmation closed this way counts as "no"
      return;
    }
    if (this.route.name === 'home') {
      void this.saveNow().finally(exitApp);
      return;
    }
    if (this.route.name === 'play') navigate({ name: 'home' });
    else this.back();
  }

  // --- Pictures -------------------------------------------------------------

  private photoRef(p: PhotoMeta): PictureRef {
    return {
      id: p.id,
      title: t('photoTitle', { n: p.n }),
      thumbUrl: p.thumb,
      previewUrl: this.photoUrls.get(p.id) ?? p.thumb,
      categoryId: 'photos',
    };
  }

  private picture(id: string): PictureRef | undefined {
    const photo = this.photos.find((p) => p.id === id);
    if (photo) return this.photoRef(photo);
    const img = findImage(id);
    if (!img) return undefined;
    return {
      id: img.id,
      title: img.title[currentLanguage()],
      thumbUrl: thumbUrl(img.id),
      previewUrl: imageUrl(img.id),
      categoryId: img.category,
    };
  }

  private async addPhoto(file: Blob): Promise<PictureRef> {
    const canvas = await loadPhoto(file);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('encode failed'))),
        'image/jpeg',
        0.92,
      ),
    );
    // The stored JPEG (not the canvas) is what puzzles are cut from, now and after a restart.
    const decoded = await createImageBitmap(blob);
    const meta = await this.repo.addPhoto(
      blob,
      decoded.width,
      decoded.height,
      thumbnailDataUrl(decoded),
    );
    decoded.close();
    this.photos = [...this.photos, meta];
    this.photoUrls.set(meta.id, URL.createObjectURL(blob));
    return this.photoRef(meta);
  }

  private async deletePhoto(id: string): Promise<void> {
    if (this.live?.pictureId === id) this.live = null;
    await this.repo.deletePhoto(id);
    this.photos = this.photos.filter((p) => p.id !== id);
    const url = this.photoUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.photoUrls.delete(id);
    this.saves = this.saves.filter((s) => s.pictureId !== id);
    delete this.stats[id];
  }

  private async loadPicture(id: string): Promise<SourceImage> {
    if (this.photos.some((p) => p.id === id)) {
      const blob = await this.repo.photoBlob(id);
      if (!blob) throw new Error(`Photo ${id} is missing`);
      return createImageBitmap(blob);
    }
    return loadCatalogImage(id);
  }

  /** The picture after `id` in the same category (wrapping around), for "Next picture". */
  private nextPicture(id: string): PictureRef | undefined {
    const photoIndex = this.photos.findIndex((p) => p.id === id);
    if (photoIndex >= 0) return this.photoRef(this.photos[(photoIndex + 1) % this.photos.length]);
    const img = findImage(id);
    if (!img) return undefined;
    const list = imagesIn(img.category);
    const next = list[(list.findIndex((i) => i.id === id) + 1) % list.length];
    return this.picture(next.id);
  }

  // --- Game -----------------------------------------------------------------

  /** Shows the game view with a loading message while `task` prepares the puzzle. */
  private async openGame(task: () => Promise<void>, onError: () => void): Promise<void> {
    this.starting = true;
    this.loadingEl.replaceChildren(h('div', { class: 'loading-card' }, t('loading')));
    this.loadingEl.hidden = false;
    navigate({ name: 'play' }); // show the game view first so the canvas has its real size
    try {
      await task();
    } catch (err) {
      console.error(err);
      onError();
    } finally {
      this.starting = false;
      this.loadingEl.hidden = true;
    }
  }

  private async startPuzzle(pictureId: string, pieceCount: number): Promise<void> {
    if (!this.picture(pictureId)) return;
    const returnTo = this.route;
    await this.saveNow(); // keep the progress of the puzzle we are leaving
    await this.openGame(
      async () => {
        const image = await this.loadPicture(pictureId);
        // Let the loading message paint before the (synchronous) piece generation.
        await nextFrame();
        await nextFrame();
        this.game.startPuzzle(image, pictureId, pieceCount);
        this.live = { pictureId, complete: false };
        await this.saveNow(); // a new puzzle replaces any earlier one for this picture
      },
      () => {
        alert(t('imageError'));
        navigate(returnTo, { replace: true });
      },
    );
  }

  private async continuePuzzle(pictureId: string): Promise<void> {
    if (
      this.live?.pictureId === pictureId &&
      !this.live.complete &&
      this.game.puzzleId === pictureId
    ) {
      navigate({ name: 'play' }); // already loaded
      return;
    }
    await this.saveNow();
    const save = await this.repo.loadSave(pictureId);
    if (!save) {
      navigate({ name: 'setup', imageId: pictureId });
      return;
    }
    await this.openGame(
      async () => {
        const image = await this.loadPicture(pictureId);
        await nextFrame();
        await nextFrame();
        this.game.resumePuzzle(save, image);
        this.live = { pictureId, complete: false };
      },
      () => {
        // A save that cannot be restored is of no use; remove it so it does not come back.
        alert(t('restoreError'));
        void this.deleteSave(pictureId);
        navigate({ name: 'setup', imageId: pictureId }, { replace: true });
      },
    );
  }

  private async deleteSave(pictureId: string): Promise<void> {
    if (this.live?.pictureId === pictureId) this.live = null;
    await this.repo.deleteSave(pictureId);
    this.saves = this.saves.filter((s) => s.pictureId !== pictureId);
    this.renderScreen();
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.saveNow(), SAVE_DELAY_MS);
  }

  /** Saves the live puzzle right away (no-op if there is nothing unsaved worth keeping). */
  private async saveNow(): Promise<void> {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const live = this.live;
    if (!live || live.complete || this.game.puzzleId !== live.pictureId) return;
    const snapshot = this.game.snapshot();
    if (!snapshot) return;
    try {
      const meta = await this.repo.storeSave(
        live.pictureId,
        snapshot,
        this.game.placedCount,
        this.game.pieceCount,
      );
      if (this.live !== live || live.complete) return; // finished or deleted meanwhile
      this.saves = [meta, ...this.saves.filter((s) => s.pictureId !== meta.pictureId)];
    } catch (err) {
      console.warn('Saving failed', err);
    }
  }

  private async onComplete(elapsedMs: number, pieceCount: number): Promise<void> {
    this.sfx.complete();
    const live = this.live;
    if (!live) return;
    live.complete = true;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    let newBest = false;
    try {
      await this.repo.deleteSave(live.pictureId);
      newBest = await this.repo.recordCompletion(live.pictureId, pieceCount, elapsedMs);
      this.stats = await this.repo.loadStats();
    } catch (err) {
      console.warn('Recording the result failed', err);
    }
    this.saves = this.saves.filter((s) => s.pictureId !== live.pictureId);
    this.showCompleted(live.pictureId, elapsedMs, pieceCount, newBest);
  }

  private setProgress(placed: number, total: number): void {
    this.progressEl.textContent = t('progress', { placed, total });
    this.progressEl.setAttribute('aria-label', t('progressLabel', { placed, total }));
  }

  /** Top bar and helper toolbar of the game view; rebuilt when the language changes. */
  private buildGameChrome(): void {
    const topbar = h(
      'header',
      { class: 'topbar' },
      button({
        label: t('menu'),
        icon: 'home',
        size: 'sm',
        onClick: () => navigate({ name: 'home' }),
      }),
      this.progressEl,
      button({
        label: t('fitView'),
        icon: 'fit',
        size: 'sm',
        onClick: () => this.game.fitView(),
      }),
    );
    const helperToggle = (
      key: keyof typeof this.helpers,
      iconName: 'eye' | 'edges',
      label: string,
      hint: string,
    ) =>
      toolButton({
        icon: iconName,
        label,
        title: hint,
        pressed: this.helpers[key],
        onToggle: (on) => {
          this.helpers[key] = on;
          this.game.setHelperOptions(this.helpers);
        },
      });
    const toolbar = h(
      'nav',
      { class: 'toolbar' },
      helperToggle('ghost', 'eye', t('ghost'), t('ghostHint')),
      helperToggle('edgesOnly', 'edges', t('edges'), t('edgesHint')),
    );
    this.topbar.replaceWith(topbar);
    this.toolbar.replaceWith(toolbar);
    this.topbar = topbar;
    this.toolbar = toolbar;
    if (this.live) this.setProgress(this.game.placedCount, this.game.pieceCount);
  }

  private showCompleted(
    pictureId: string,
    elapsedMs: number,
    pieceCount: number,
    newBest: boolean,
  ): void {
    const next = this.nextPicture(pictureId);
    fillDialog(this.doneDialog, {
      icon: 'check',
      title: t('wellDone'),
      text: t('finishedIn', { n: pieceCount, time: formatDuration(elapsedMs) }),
      extra: newBest ? [h('p', { class: 'new-best' }, t('newBest'))] : [],
      actions: [
        ...(next
          ? [
              button({
                label: t('nextPicture'),
                icon: 'next',
                tone: 'primary',
                block: true,
                onClick: () => navigate({ name: 'setup', imageId: next.id }),
              }),
            ]
          : []),
        button({
          label: t('lookAtPicture'),
          icon: 'image',
          block: true,
          onClick: () => {
            this.doneDialog.close();
            this.game.fitView();
          },
        }),
        button({
          label: t('backToMenu'),
          icon: 'home',
          block: true,
          onClick: () => navigate({ name: 'home' }),
        }),
      ],
    });
    // Give the final snap animation a moment before the dialog appears.
    setTimeout(() => {
      if (this.route.name === 'play' && !this.doneDialog.open) this.doneDialog.showModal();
    }, 500);
  }

  /** A simple yes/no question with large buttons. Escape or "Cancel" answer no. */
  private confirm(options: ConfirmOptions): Promise<boolean> {
    const dialog = this.confirmDialog;
    return new Promise((resolve) => {
      const done = (answer: boolean) => {
        dialog.removeEventListener('close', onClose);
        if (dialog.open) dialog.close();
        resolve(answer);
      };
      const onClose = () => done(false);
      fillDialog(dialog, {
        title: options.title,
        text: options.text,
        actions: [
          button({
            label: options.confirmLabel,
            tone: options.danger ? 'danger' : 'primary',
            block: true,
            onClick: () => done(true),
          }),
          button({ label: t('cancel'), block: true, onClick: () => done(false) }),
        ],
      });
      dialog.addEventListener('close', onClose);
      dialog.showModal();
    });
  }

  // --- Settings -------------------------------------------------------------

  private updateSettings(patch: Partial<Settings>): void {
    const languageChanged =
      patch.language !== undefined && patch.language !== this.settings.language;
    this.settings = { ...this.settings, ...patch };
    void this.repo
      .saveSettings(this.settings)
      .catch((err) => console.warn('Saving settings failed', err));
    if (languageChanged) {
      this.applyLanguage();
      this.buildGameChrome();
      this.game.setLabels({ noEdgePieces: t('noEdgePieces') });
    }
    this.applySettings();
    this.renderScreen();
  }

  private applyLanguage(): void {
    const s = this.settings.language;
    setLanguage(s === 'auto' ? detectLanguage() : s);
    document.title = t('appTitle');
  }

  private applySettings(): void {
    this.sfx.enabled = this.settings.sound;
    const color = BACKGROUNDS[this.settings.background];
    this.root.style.setProperty('--felt', color);
    this.game.setBackground(color);
  }
}

function thumbnailDataUrl(image: CanvasImageSource & { width: number; height: number }): string {
  const c = document.createElement('canvas');
  const scale = 480 / Math.max(image.width, image.height);
  c.width = Math.round(image.width * scale);
  c.height = Math.round(image.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
