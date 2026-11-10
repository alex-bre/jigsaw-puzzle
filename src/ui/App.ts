import { PIECE_COUNTS } from '../game/core/grid';
import { createDemoImage } from '../game/demoImage';
import { GameController } from '../game/GameController';
import type { SourceImage } from '../game/render/PieceFactory';
import { formatDuration, t } from '../i18n';
import { SoundEffects } from '../platform/audio';
import { h, icon, nextFrame } from './dom';
import { loadPhoto } from './loadPhoto';

interface PictureChoice {
  id: string;
  image: SourceImage;
}

/**
 * Game shell: top bar, game canvas (board + tray), helper toolbar, "new puzzle" and completion dialogs.
 * The full menu structure (categories, saved games, settings) follows in milestone 5.
 */
export class App {
  private readonly game: GameController;
  private readonly progressEl: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly newDialog: HTMLDialogElement;
  private readonly doneDialog: HTMLDialogElement;
  private readonly loadingEl: HTMLElement;
  private readonly sample: PictureChoice = { id: 'demo:landscape', image: createDemoImage() };
  private photo: PictureChoice | null = null;
  private picture: PictureChoice = this.sample;
  private readonly sfx = new SoundEffects();
  private readonly helpers = { ghost: false, edgesOnly: false };

  constructor(root: HTMLElement) {
    this.progressEl = h('div', { class: 'progress', role: 'status' });
    const topbar = h(
      'header',
      { class: 'topbar' },
      h(
        'button',
        { class: 'btn btn-primary', type: 'button', onclick: () => this.openNewDialog() },
        icon('plus'),
        h('span', {}, t('newPuzzle')),
      ),
      this.progressEl,
      h(
        'button',
        { class: 'btn', type: 'button', onclick: () => this.game.fitView() },
        icon('fit'),
        h('span', {}, t('fitView')),
      ),
    );
    this.stage = h('main', { class: 'stage' });
    const tools = this.buildToolbar();
    this.loadingEl = h(
      'div',
      { class: 'loading', hidden: true },
      h('div', { class: 'loading-card' }, t('loading')),
    );
    this.newDialog = this.buildNewDialog();
    this.doneDialog = h('dialog', { class: 'dialog' });
    root.append(topbar, this.stage, tools, this.loadingEl, this.newDialog, this.doneDialog);

    this.game = new GameController(
      this.stage,
      {
        onProgress: (placed, total) => this.setProgress(placed, total),
        onComplete: (ms, n) => {
          this.sfx.complete();
          this.showCompleted(ms, n);
        },
        onSnap: (locked) => {
          this.sfx.snap(locked);
          navigator.vibrate?.(locked ? 25 : 12);
        },
        onActivity: () => this.sfx.unlock(),
      },
      { noEdgePieces: t('noEdgePieces') },
    );
  }

  /** Helper buttons: preview image, edge pieces only, sort the tray. */
  private buildToolbar(): HTMLElement {
    const toggle = (
      key: keyof typeof this.helpers,
      iconName: 'eye' | 'edges',
      label: string,
      hint: string,
    ) => {
      const btn = h(
        'button',
        { class: 'tool-btn', type: 'button', title: hint, 'aria-pressed': 'false' },
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
    return h(
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
  }

  async start(): Promise<void> {
    await this.game.init();
    await this.startPuzzle(24);
    if (import.meta.env.DEV) {
      // Debug handle for manual testing / automated browser checks. Stripped from production builds.
      (window as unknown as { __game: GameController }).__game = this.game;
    }
  }

  private setProgress(placed: number, total: number): void {
    this.progressEl.textContent = t('progress', { placed, total });
    this.progressEl.setAttribute('aria-label', t('progressLabel', { placed, total }));
  }

  private async startPuzzle(pieceCount: number): Promise<void> {
    this.loadingEl.hidden = false;
    // Let the loading message paint before the (synchronous) piece generation.
    await nextFrame();
    await nextFrame();
    try {
      this.game.startPuzzle(this.picture.image, this.picture.id, pieceCount);
    } finally {
      this.loadingEl.hidden = true;
    }
  }

  // --- New puzzle dialog ----------------------------------------------------

  private pictureButtons: { sample: HTMLButtonElement; photo: HTMLButtonElement } | null = null;
  private photoThumb = h('span', { class: 'thumb thumb-empty' }, icon('photo'));

  private buildNewDialog(): HTMLDialogElement {
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/*',
      class: 'visually-hidden',
      tabindex: -1,
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const image = await loadPhoto(file);
        this.photo = { id: `photo:${Date.now()}`, image };
        this.photoThumb.replaceChildren(thumbnail(image));
        this.photoThumb.classList.remove('thumb-empty');
        this.selectPicture(this.photo);
      } catch {
        alert(t('photoError'));
      }
    });

    const sample = h(
      'button',
      { class: 'choice', type: 'button', onclick: () => this.selectPicture(this.sample) },
      h('span', { class: 'thumb' }, thumbnail(this.sample.image)),
      h('span', {}, t('samplePicture')),
    );
    const photo = h(
      'button',
      {
        class: 'choice',
        type: 'button',
        onclick: () => (this.photo ? this.selectPicture(this.photo) : fileInput.click()),
      },
      this.photoThumb,
      h('span', {}, t('myPhoto')),
    );
    this.pictureButtons = { sample, photo };

    const counts = h(
      'div',
      { class: 'count-grid' },
      ...PIECE_COUNTS.map((n) =>
        h(
          'button',
          {
            class: 'btn count-btn',
            type: 'button',
            onclick: () => {
              this.newDialog.close();
              void this.startPuzzle(n);
            },
          },
          h('strong', {}, String(n)),
          h('span', {}, t('piecesUnit')),
        ),
      ),
    );

    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': 'new-title' },
      h('h2', { id: 'new-title' }, t('newPuzzle')),
      h('h3', {}, t('picture')),
      h('div', { class: 'choice-row' }, sample, photo),
      h(
        'button',
        { class: 'btn btn-link', type: 'button', onclick: () => fileInput.click() },
        icon('photo'),
        h('span', {}, t('chooseMyPhoto')),
      ),
      fileInput,
      h('h3', {}, t('choosePieces')),
      counts,
      h(
        'div',
        { class: 'dialog-actions' },
        h(
          'button',
          { class: 'btn', type: 'button', onclick: () => dialog.close() },
          icon('close'),
          h('span', {}, t('cancel')),
        ),
      ),
    );
    return dialog;
  }

  private selectPicture(choice: PictureChoice): void {
    this.picture = choice;
    if (!this.pictureButtons) return;
    this.pictureButtons.sample.setAttribute('aria-pressed', String(choice === this.sample));
    this.pictureButtons.photo.setAttribute('aria-pressed', String(choice === this.photo));
  }

  private openNewDialog(): void {
    this.doneDialog.close();
    this.selectPicture(this.picture);
    this.newDialog.showModal();
  }

  // --- Completion -----------------------------------------------------------

  private showCompleted(elapsedMs: number, pieceCount: number): void {
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
        h(
          'button',
          { class: 'btn btn-primary', type: 'button', onclick: () => this.openNewDialog() },
          icon('plus'),
          h('span', {}, t('newPuzzle')),
        ),
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
      ),
    );
    // Give the final snap animation a moment before the dialog appears.
    setTimeout(() => this.doneDialog.showModal(), 500);
  }
}

function thumbnail(image: SourceImage): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const scale = 240 / Math.max(image.width, image.height);
  c.width = Math.round(image.width * scale);
  c.height = Math.round(image.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c;
}
