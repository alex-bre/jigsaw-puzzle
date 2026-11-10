import { findImage, imageUrl, imagesIn, loadCatalogImage, thumbUrl } from '../content/catalog';
import { GameController } from '../game/GameController';
import type { SourceImage } from '../game/render/PieceFactory';
import { currentLanguage, detectLanguage, formatDuration, setLanguage, t } from '../i18n';
import { SoundEffects } from '../platform/audio';
import { BACKGROUNDS, loadSettings, saveSettings, type Settings } from '../settings';
import { h, icon, nextFrame } from './dom';
import { loadPhoto } from './loadPhoto';
import { navigate, onRouteChange, parentRoute, parseRoute, type Route } from './router';
import type { CurrentPuzzle, PictureRef, ScreenContext } from './screens/context';
import { homeScreen } from './screens/home';
import { categoryScreen, picturesScreen } from './screens/pictures';
import { creditsScreen, settingsScreen } from './screens/settings';
import { setupScreen } from './screens/setup';

interface Photo {
  ref: PictureRef;
  image: HTMLCanvasElement;
}

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
  private readonly sfx = new SoundEffects();
  private readonly helpers = { ghost: false, edgesOnly: false };
  private settings: Settings = loadSettings();
  private route: Route = { name: 'home' };
  /** Where "Back" leads from the setup screen (the category or the pictures overview). */
  private setupParent: Route = { name: 'pictures' };
  private current: CurrentPuzzle | null = null;
  private starting = false;
  private readonly photos: Photo[] = [];

  constructor(private readonly root: HTMLElement) {
    this.applyLanguage();
    this.buildGameChrome();
    this.gameEl.append(this.topbar, this.stage, this.toolbar);
    root.append(this.screens, this.gameEl, this.loadingEl, this.doneDialog);

    this.game = new GameController(
      this.stage,
      {
        onProgress: (placed, total) => this.setProgress(placed, total),
        onComplete: (ms, n) => {
          if (this.current) this.current.complete = true;
          this.sfx.complete();
          this.showCompleted(ms, n);
        },
        onSnap: (locked) => {
          this.sfx.snap(locked);
          if (this.settings.vibration) navigator.vibrate?.(locked ? 25 : 12);
        },
        onActivity: () => this.sfx.unlock(),
      },
      { noEdgePieces: t('noEdgePieces') },
    );
  }

  async start(): Promise<void> {
    await this.game.init();
    this.applySettings();
    onRouteChange((route) => this.render(route));
    this.render(parseRoute(location.hash));
    if (import.meta.env.DEV) {
      // Debug handle for manual testing / automated browser checks. Stripped from production builds.
      (window as unknown as { __game: GameController }).__game = this.game;
    }
  }

  // --- Routing --------------------------------------------------------------

  private render(route: Route): void {
    if (route.name === 'play' && !this.current && !this.starting) {
      navigate({ name: 'home' }, { replace: true });
      return;
    }
    this.route = route;
    if (route.name === 'category') this.setupParent = route;
    if (route.name === 'pictures') this.setupParent = { name: 'pictures' };

    const inGame = route.name === 'play';
    this.gameEl.hidden = !inGame;
    this.screens.hidden = inGame;
    if (inGame) return;
    if (this.doneDialog.open) this.doneDialog.close();

    const ctx = this.context();
    const el =
      route.name === 'pictures'
        ? picturesScreen(ctx)
        : route.name === 'category'
          ? categoryScreen(ctx, route.categoryId)
          : route.name === 'setup'
            ? setupScreen(ctx, route.imageId)
            : route.name === 'settings'
              ? settingsScreen(ctx)
              : route.name === 'credits'
                ? creditsScreen(ctx)
                : homeScreen(ctx);
    this.screens.replaceChildren(el);
    this.screens.scrollTop = 0;
  }

  private context(): ScreenContext {
    return {
      go: (route) => navigate(route),
      back: () => this.back(),
      settings: this.settings,
      updateSettings: (patch) => this.updateSettings(patch),
      current: this.current,
      picture: (id) => this.picture(id),
      photos: this.photos.map((p) => p.ref),
      addPhoto: (file) => this.addPhoto(file),
      startPuzzle: (id, n) => this.startPuzzle(id, n),
    };
  }

  /** Goes to the parent of the current screen (also used for the Android back button later). */
  back(): void {
    const parent = parentRoute(this.route, this.setupParent);
    if (parent) navigate(parent);
  }

  // --- Pictures -------------------------------------------------------------

  private picture(id: string): PictureRef | undefined {
    const photo = this.photos.find((p) => p.ref.id === id);
    if (photo) return photo.ref;
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

  private async addPhoto(file: File): Promise<PictureRef> {
    const image = await loadPhoto(file);
    const n = this.photos.length + 1;
    const thumb = thumbnailDataUrl(image);
    const ref: PictureRef = {
      id: `photo-${Date.now()}`,
      title: t('photoTitle', { n }),
      thumbUrl: thumb,
      previewUrl: thumb,
      categoryId: 'photos',
    };
    // Own photos live only for this session for now; milestone 6 stores them on the device.
    this.photos.push({ ref, image });
    return ref;
  }

  private async loadPicture(id: string): Promise<SourceImage> {
    const photo = this.photos.find((p) => p.ref.id === id);
    return photo ? photo.image : loadCatalogImage(id);
  }

  /** The picture after `id` in the same category (wrapping around), for "Next picture". */
  private nextPicture(id: string): PictureRef | undefined {
    const photoIndex = this.photos.findIndex((p) => p.ref.id === id);
    if (photoIndex >= 0) return this.photos[(photoIndex + 1) % this.photos.length].ref;
    const img = findImage(id);
    if (!img) return undefined;
    const list = imagesIn(img.category);
    const next = list[(list.findIndex((i) => i.id === id) + 1) % list.length];
    return this.picture(next.id);
  }

  // --- Game -----------------------------------------------------------------

  private async startPuzzle(pictureId: string, pieceCount: number): Promise<void> {
    const picture = this.picture(pictureId);
    if (!picture) return;
    const returnTo = this.route;
    this.starting = true;
    this.loadingEl.replaceChildren(h('div', { class: 'loading-card' }, t('loading')));
    this.loadingEl.hidden = false;
    navigate({ name: 'play' }); // show the game view first so the canvas has its real size
    try {
      const image = await this.loadPicture(pictureId);
      // Let the loading message paint before the (synchronous) piece generation.
      await nextFrame();
      await nextFrame();
      this.game.startPuzzle(image, pictureId, pieceCount);
      this.current = { picture, placed: 0, total: this.game.pieceCount, complete: false };
      this.setProgress(0, this.game.pieceCount);
    } catch (err) {
      console.error(err);
      alert(t('imageError'));
      navigate(returnTo, { replace: true });
    } finally {
      this.starting = false;
      this.loadingEl.hidden = true;
    }
  }

  private setProgress(placed: number, total: number): void {
    this.progressEl.textContent = t('progress', { placed, total });
    this.progressEl.setAttribute('aria-label', t('progressLabel', { placed, total }));
    if (this.current) Object.assign(this.current, { placed, total });
  }

  /** Top bar and helper toolbar of the game view; rebuilt when the language changes. */
  private buildGameChrome(): void {
    const topbar = h(
      'header',
      { class: 'topbar' },
      h(
        'button',
        { class: 'btn', type: 'button', onclick: () => navigate({ name: 'home' }) },
        icon('home'),
        h('span', {}, t('menu')),
      ),
      this.progressEl,
      h(
        'button',
        { class: 'btn', type: 'button', onclick: () => this.game.fitView() },
        icon('fit'),
        h('span', {}, t('fitView')),
      ),
    );
    const toggle = (
      key: keyof typeof this.helpers,
      iconName: 'eye' | 'edges',
      label: string,
      hint: string,
    ) => {
      const btn = h(
        'button',
        {
          class: 'tool-btn',
          type: 'button',
          title: hint,
          'aria-pressed': String(this.helpers[key]),
        },
        icon(iconName),
        h('span', {}, label),
      );
      btn.addEventListener('click', () => {
        this.helpers[key] = !this.helpers[key];
        btn.setAttribute('aria-pressed', String(this.helpers[key]));
        this.game.setHelperOptions(this.helpers);
      });
      return btn;
    };
    const toolbar = h(
      'nav',
      { class: 'toolbar' },
      toggle('ghost', 'eye', t('ghost'), t('ghostHint')),
      toggle('edgesOnly', 'edges', t('edges'), t('edgesHint')),
      h(
        'button',
        {
          class: 'tool-btn',
          type: 'button',
          title: t('sortHint'),
          onclick: () => this.game.sortTray(),
        },
        icon('sort'),
        h('span', {}, t('sort')),
      ),
    );
    this.topbar.replaceWith(topbar);
    this.toolbar.replaceWith(toolbar);
    this.topbar = topbar;
    this.toolbar = toolbar;
    if (this.current) this.setProgress(this.current.placed, this.current.total);
  }

  private showCompleted(elapsedMs: number, pieceCount: number): void {
    const next = this.current ? this.nextPicture(this.current.picture.id) : undefined;
    this.doneDialog.replaceChildren(
      h('div', { class: 'done-badge' }, icon('check')),
      h('h2', {}, t('wellDone')),
      h(
        'p',
        { class: 'lead' },
        t('finishedIn', { n: pieceCount, time: formatDuration(elapsedMs) }),
      ),
      h(
        'div',
        { class: 'dialog-actions stacked' },
        next
          ? h(
              'button',
              {
                class: 'btn btn-primary',
                type: 'button',
                onclick: () => navigate({ name: 'setup', imageId: next.id }),
              },
              icon('next'),
              h('span', {}, t('nextPicture')),
            )
          : null,
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => {
              this.doneDialog.close();
              this.game.fitView();
            },
          },
          icon('image'),
          h('span', {}, t('lookAtPicture')),
        ),
        h(
          'button',
          { class: 'btn', type: 'button', onclick: () => navigate({ name: 'home' }) },
          icon('home'),
          h('span', {}, t('backToMenu')),
        ),
      ),
    );
    // Give the final snap animation a moment before the dialog appears.
    setTimeout(() => {
      if (this.route.name === 'play' && !this.doneDialog.open) this.doneDialog.showModal();
    }, 500);
  }

  // --- Settings -------------------------------------------------------------

  private updateSettings(patch: Partial<Settings>): void {
    const languageChanged =
      patch.language !== undefined && patch.language !== this.settings.language;
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    if (languageChanged) {
      this.applyLanguage();
      this.buildGameChrome();
      this.game.setLabels({ noEdgePieces: t('noEdgePieces') });
      // Titles of own photos are generated text, too.
      this.photos.forEach((p, i) => (p.ref.title = t('photoTitle', { n: i + 1 })));
    }
    this.applySettings();
    this.render(this.route);
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

function thumbnailDataUrl(image: HTMLCanvasElement): string {
  const c = document.createElement('canvas');
  const scale = 480 / Math.max(image.width, image.height);
  c.width = Math.round(image.width * scale);
  c.height = Math.round(image.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
