import { Application, Ticker } from 'pixi.js';
import { createCut } from './core/cut';
import { chooseGrid } from './core/grid';
import { createPuzzle, groupPieces, isComplete, lockedCount, type PuzzleState } from './core/model';
import { randomSeed } from './core/rng';
import { computePlayArea, scatterPieces, type Rect } from './core/scatter';
import { dropGroup } from './core/snap';
import { Camera } from './render/Camera';
import { Input } from './render/Input';
import { buildPieceGraphics, type SourceImage } from './render/PieceFactory';
import { PuzzleView } from './render/PuzzleView';

export interface GameEvents {
  onProgress(placed: number, total: number): void;
  onComplete(elapsedMs: number, pieceCount: number): void;
  /** Called after a piece/group snapped into place (for sound / haptics). */
  onSnap(locked: boolean): void;
}

/** Snap tolerance relative to the piece size, and its minimum in screen pixels. */
const SNAP_TOLERANCE = 0.28;
const SNAP_MIN_SCREEN_PX = 24;
/** Touches this close (screen px) to a piece still pick it up. */
const TOUCH_SLOP_PX = 14;

/** Glues the pure game core to the Pixi rendering and the input handling. */
export class GameController {
  private app!: Application;
  private camera!: Camera;
  private input!: Input;
  private state: PuzzleState | null = null;
  private view: PuzzleView | null = null;
  private playArea: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private drag: { groupId: number; ids: number[]; lastX: number; lastY: number } | null = null;
  private rafPending = false;
  private resumedAt: number | null = null;
  private resizeObserver?: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private readonly events: GameEvents,
  ) {}

  async init(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: '#35514a',
      antialias: true,
      autoStart: false,
      sharedTicker: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: Math.max(1, this.host.clientWidth),
      height: Math.max(1, this.host.clientHeight),
      preference: 'webgl',
    });
    // Pixi's internal system ticker (texture GC, event polling) would otherwise run its own
    // requestAnimationFrame loop forever. We advance it from our on-demand frames instead.
    Ticker.system.autoStart = false;
    Ticker.system.stop();
    const canvas = this.app.canvas;
    canvas.classList.add('game-canvas');
    this.host.appendChild(canvas);

    this.camera = new Camera(this.app.stage, () => this.invalidate());
    this.camera.setViewSize(this.host.clientWidth, this.host.clientHeight);
    this.input = new Input(canvas, this.camera, {
      dragStart: (x, y) => this.dragStart(x, y),
      dragMove: (x, y) => this.dragMove(x, y),
      dragEnd: () => this.dragEnd(),
    });

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.host);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Starts a new puzzle from an image. */
  startPuzzle(image: SourceImage, imageId: string, pieceCount: number): void {
    const { cols, rows } = chooseGrid(pieceCount, image.width, image.height);
    const seed = randomSeed();
    const state = createPuzzle({
      imageId,
      imageWidth: image.width,
      imageHeight: image.height,
      cols,
      rows,
      seed,
    });
    this.playArea = computePlayArea(
      state,
      this.host.clientWidth / Math.max(1, this.host.clientHeight),
    );
    scatterPieces(state, this.playArea, seed);
    this.show(state, image);
  }

  private show(state: PuzzleState, image: SourceImage): void {
    this.clear();
    const cut = createCut(state.cols, state.rows, state.imageWidth, state.imageHeight, state.seed);
    const gfx = buildPieceGraphics(image, cut);
    this.state = state;
    this.view = new PuzzleView(state, gfx);
    this.app.stage.addChild(this.view.world);
    this.configureCamera();
    this.camera.fit();
    this.resumedAt = isComplete(state) ? null : performance.now();
    this.events.onProgress(lockedCount(state), state.pieces.length);
    this.invalidate();
  }

  destroy(): void {
    this.clear();
    this.input.destroy();
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.app.destroy(true);
  }

  fitView(): void {
    this.camera.fit();
  }

  /** Read-only snapshot for debugging and automated browser tests. */
  debugInfo(): {
    pieces: { x: number; y: number; col: number; row: number; locked: boolean; group: number }[];
    pieceWidth: number;
    pieceHeight: number;
    camera: { scale: number; x: number; y: number };
  } | null {
    if (!this.state) return null;
    return {
      pieces: this.state.pieces.map(({ x, y, col, row, locked, group }) => ({
        x,
        y,
        col,
        row,
        locked,
        group,
      })),
      pieceWidth: this.state.pieceWidth,
      pieceHeight: this.state.pieceHeight,
      camera: { scale: this.camera.scale, x: this.camera.x, y: this.camera.y },
    };
  }

  get pieceCount(): number {
    return this.state?.pieces.length ?? 0;
  }

  private clear(): void {
    this.drag = null;
    if (this.view) {
      this.app.stage.removeChild(this.view.world);
      this.view.destroy();
    }
    this.view = null;
    this.state = null;
  }

  private configureCamera(): void {
    if (!this.state) return;
    const pieceSize = Math.min(this.state.pieceWidth, this.state.pieceHeight);
    const view = Math.min(this.host.clientWidth, this.host.clientHeight);
    // Never zoom in further than one piece filling ~45% of the shorter screen side.
    const maxScale = Math.min(4, (view * 0.45) / pieceSize);
    this.camera.configure(this.playArea, maxScale);
  }

  // --- Dragging -------------------------------------------------------------

  private dragStart(wx: number, wy: number): boolean {
    if (!this.state || !this.view) return false;
    const id = this.view.hitTest(wx, wy, TOUCH_SLOP_PX / this.camera.scale);
    if (id === null) return false;
    const groupId = this.state.pieces[id].group;
    const ids = [...this.state.groups.get(groupId)!];
    this.drag = { groupId, ids, lastX: wx, lastY: wy };
    this.view.liftGroup(ids);
    this.invalidate();
    return true;
  }

  private dragMove(wx: number, wy: number): void {
    if (!this.drag || !this.state || !this.view) return;
    // Keep the finger (and thus the piece) inside the play area.
    const a = this.playArea;
    const x = Math.max(a.x, Math.min(a.x + a.width, wx));
    const y = Math.max(a.y, Math.min(a.y + a.height, wy));
    const dx = x - this.drag.lastX;
    const dy = y - this.drag.lastY;
    this.drag.lastX = x;
    this.drag.lastY = y;
    for (const p of groupPieces(this.state, this.drag.groupId)) {
      p.x += dx;
      p.y += dy;
    }
    this.view.syncPieces(this.drag.ids);
    this.invalidate();
  }

  private dragEnd(): void {
    if (!this.drag || !this.state || !this.view) return;
    const state = this.state;
    const pieceSize = Math.min(state.pieceWidth, state.pieceHeight);
    const tolerance = Math.max(pieceSize * SNAP_TOLERANCE, SNAP_MIN_SCREEN_PX / this.camera.scale);
    const result = dropGroup(state, this.drag.groupId, tolerance);
    const allIds = state.groups.get(result.groupId)!;
    this.view.dropGroup(allIds, result.locked);
    this.view.animateSnap(this.drag.ids, result.dx, result.dy, performance.now());
    this.view.syncPieces(allIds);
    this.drag = null;

    if (result.snapped) this.events.onSnap(result.locked);
    this.events.onProgress(lockedCount(state), state.pieces.length);
    if (isComplete(state)) {
      this.pauseClock();
      this.events.onComplete(state.elapsedMs, state.pieces.length);
    }
    this.invalidate();
  }

  // --- Clock ----------------------------------------------------------------

  private pauseClock(): void {
    if (this.state && this.resumedAt !== null) {
      this.state.elapsedMs += performance.now() - this.resumedAt;
    }
    this.resumedAt = null;
  }

  private onVisibility = (): void => {
    if (!this.state || isComplete(this.state)) return;
    if (document.hidden) this.pauseClock();
    else this.resumedAt = performance.now();
  };

  // --- Rendering ------------------------------------------------------------

  private onResize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (w === 0 || h === 0) return;
    this.app.renderer.resize(w, h);
    this.configureCamera();
    this.camera.setViewSize(w, h);
    this.invalidate();
  }

  /** Requests a frame. The app only renders when something changed, which saves battery. */
  invalidate(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.rafPending = false;
    const animating = this.view?.update(now) ?? false;
    Ticker.system.update(now);
    this.app.render();
    if (animating) this.invalidate();
  };
}
