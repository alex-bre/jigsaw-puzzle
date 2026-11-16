import { Application, Container, Ticker } from 'pixi.js';
import { createCut } from './core/cut';
import { chooseGrid } from './core/grid';
import { createPuzzle, isComplete, lockedCount, moveGroup, type PuzzleState } from './core/model';
import { computePlayArea, contentBounds, type Rect } from './core/playArea';
import { randomSeed } from './core/rng';
import { deserializePuzzle, serializePuzzle, type PuzzleSave } from './core/serialize';
import { dropGroup } from './core/snap';
import { canReturnToTray, fillTray, returnToTray, takeFromTray, visibleTray } from './core/tray';
import { Camera } from './render/Camera';
import { Input } from './render/Input';
import { buildPieceGraphics, type SourceImage } from './render/PieceFactory';
import { PuzzleView } from './render/PuzzleView';
import { TrayView, type TrayRect } from './render/TrayView';

export interface GameEvents {
  onProgress(placed: number, total: number): void;
  onComplete(elapsedMs: number, pieceCount: number): void;
  /** Called after a piece/group snapped into place (for sound / haptics). */
  onSnap(locked: boolean): void;
  /** Any touch on the game (e.g. to unlock audio on the first touch). */
  onActivity(): void;
  /** The puzzle changed in a way worth saving (piece moved, …). */
  onStateChange(): void;
}

export interface GameLabels {
  /** Shown in the tray when "edges only" is on but no edge pieces are left in it. */
  noEdgePieces: string;
}

export interface HelperOptions {
  ghost: boolean;
  edgesOnly: boolean;
}

/** Snap tolerance relative to the piece size, and its minimum in screen pixels. */
const SNAP_TOLERANCE = 0.28;
const SNAP_MIN_SCREEN_PX = 24;
/** Touches this close (screen px) to a piece still pick it up. */
const TOUCH_SLOP_PX = 14;
/** A dragged piece's grab point stays at least this far inside the canvas edges. */
const DRAG_EDGE_MARGIN_PX = 12;

interface Drag {
  groupId: number;
  ids: number[];
  lastX: number;
  lastY: number;
}

/** Glues the pure game core to the Pixi rendering and the input handling. */
export class GameController {
  private app!: Application;
  private camera!: Camera;
  private input!: Input;
  /** Camera-transformed container holding the board; the tray sits above it in screen space. */
  private readonly worldRoot = new Container();
  private state: PuzzleState | null = null;
  private view: PuzzleView | null = null;
  private tray: TrayView | null = null;
  private trayRect: TrayRect = { x: 0, y: 0, width: 1, height: 1, axis: 'x' };
  private playArea: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private drag: Drag | null = null;
  private options: HelperOptions = { ghost: false, edgesOnly: false };
  private rafPending = false;
  private resumedAt: number | null = null;
  private resizeObserver?: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private readonly events: GameEvents,
    private labels: GameLabels,
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
    this.app.stage.addChild(this.worldRoot);

    this.camera = new Camera(this.worldRoot, () => this.invalidate());
    this.applyLayout();
    this.input = new Input(canvas, this.camera, {
      activity: () => this.events.onActivity(),
      inTray: (x, y) => this.tray?.contains(x, y) ?? false,
      trayPieceAt: (x, y) => this.tray?.pieceAt(x, y) ?? null,
      trayAxis: () => this.trayRect.axis,
      trayScroll: (d) => {
        this.tray?.scrollBy(d);
        this.invalidate();
      },
      trayFling: (v) => {
        this.tray?.fling(v, performance.now());
        this.invalidate();
      },
      trayStop: () => this.tray?.stopFling(),
      pickFromTray: (id, x, y) => this.pickFromTray(id, x, y),
      pickFromBoard: (x, y) => this.pickFromBoard(x, y),
      dragMove: (x, y) => this.dragMove(x, y),
      dragEnd: (x, y) => this.dragEnd(x, y),
    });

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.host);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Starts a new puzzle from an image; all pieces start in the tray. */
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
    fillTray(state, seed);
    this.show(state, image);
  }

  /**
   * Restores a saved puzzle. The image must be the same picture at the same size it was cut
   * from; the piece shapes are regenerated from the saved seed. Throws on invalid saves.
   */
  resumePuzzle(save: unknown, image: SourceImage): void {
    const state = deserializePuzzle(save);
    if (state.imageWidth !== image.width || state.imageHeight !== image.height) {
      throw new Error(
        `Picture size changed (${image.width}×${image.height}, saved ${state.imageWidth}×${state.imageHeight})`,
      );
    }
    this.show(state, image);
  }

  /** Current puzzle in save format, with the play time up to this moment. */
  snapshot(): PuzzleSave | null {
    if (!this.state) return null;
    const save = serializePuzzle(this.state);
    if (this.resumedAt !== null) {
      save.elapsedMs = Math.round(this.state.elapsedMs + performance.now() - this.resumedAt);
    }
    return save;
  }

  /** Id of the picture of the puzzle currently loaded, if any. */
  get puzzleId(): string | null {
    return this.state?.imageId ?? null;
  }

  get placedCount(): number {
    return this.state ? lockedCount(this.state) : 0;
  }

  private show(state: PuzzleState, image: SourceImage): void {
    this.clear();
    const cut = createCut(state.cols, state.rows, state.imageWidth, state.imageHeight, state.seed);
    const gfx = buildPieceGraphics(image, cut);
    this.state = state;
    this.playArea = computePlayArea(state);
    this.view = new PuzzleView(state, gfx, image);
    this.view.setGhostVisible(this.options.ghost);
    this.worldRoot.addChild(this.view.world);
    this.tray = new TrayView(this.view.views, state.pieceWidth, state.pieceHeight);
    this.app.stage.addChild(this.tray.container);
    this.applyLayout();
    this.refreshTray();
    this.fitView();
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

  get pieceCount(): number {
    return this.state?.pieces.length ?? 0;
  }

  /** Zooms to show the board and every piece lying around it. */
  fitView(): void {
    if (this.state) this.camera.fitRect(contentBounds(this.state), 16);
  }

  // --- Helpers --------------------------------------------------------------

  /** Board background colour (CSS colour string). */
  setBackground(color: string): void {
    this.app.renderer.background.color = color;
    this.invalidate();
  }

  /** Texts drawn inside the canvas, e.g. after a language change. */
  setLabels(labels: GameLabels): void {
    this.labels = labels;
    this.refreshTray();
    this.invalidate();
  }

  setHelperOptions(options: Partial<HelperOptions>): void {
    const edgesChanged =
      options.edgesOnly !== undefined && options.edgesOnly !== this.options.edgesOnly;
    this.options = { ...this.options, ...options };
    this.view?.setGhostVisible(this.options.ghost);
    if (edgesChanged) {
      this.refreshTray();
      this.tray?.scrollToStart();
    }
    this.invalidate();
  }

  private refreshTray(): void {
    if (!this.state || !this.tray) return;
    const items = visibleTray(this.state, this.options.edgesOnly);
    const message =
      items.length === 0 && this.state.tray.length > 0 ? this.labels.noEdgePieces : '';
    this.tray.setItems(items, message);
  }

  // --- Debugging ------------------------------------------------------------

  /** Read-only snapshot for debugging and automated browser tests. */
  debugInfo() {
    if (!this.state) return null;
    return {
      pieces: this.state.pieces.map(({ x, y, col, row, locked, group, inTray }) => ({
        x,
        y,
        col,
        row,
        locked,
        group,
        inTray,
      })),
      tray: visibleTray(this.state, this.options.edgesOnly),
      trayRect: { ...this.trayRect },
      pieceWidth: this.state.pieceWidth,
      pieceHeight: this.state.pieceHeight,
      camera: { scale: this.camera.scale, x: this.camera.x, y: this.camera.y },
    };
  }

  /** Debug: which tray piece is at this canvas position. */
  debugTrayPieceAt(sx: number, sy: number): number | null {
    return this.tray?.pieceAt(sx, sy) ?? null;
  }

  private clear(): void {
    this.drag = null;
    // Destroy the view first: it owns all piece views, including those parented to the tray.
    if (this.view) {
      this.worldRoot.removeChild(this.view.world);
      this.view.destroy();
    }
    if (this.tray) {
      this.app.stage.removeChild(this.tray.container);
      this.tray.container.destroy({ children: true });
    }
    this.tray = null;
    this.view = null;
    this.state = null;
  }

  // --- Layout ---------------------------------------------------------------

  /** Splits the canvas into the board area and the tray (bottom in portrait, right in landscape). */
  private applyLayout(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (w === 0 || h === 0) return;
    const portrait = w < h * 1.1;
    const thickness = Math.round(Math.max(104, Math.min(160, Math.min(w, h) * 0.27)));
    this.trayRect = portrait
      ? { x: 0, y: h - thickness, width: w, height: thickness, axis: 'x' }
      : { x: w - thickness, y: 0, width: thickness, height: h, axis: 'y' };
    this.tray?.setRect(this.trayRect);
    this.configureCamera(portrait ? w : w - thickness, portrait ? h - thickness : h);
  }

  private configureCamera(viewW: number, viewH: number): void {
    if (this.state) {
      const pieceSize = Math.min(this.state.pieceWidth, this.state.pieceHeight);
      // Never zoom in further than one piece filling ~45% of the shorter side of the board area.
      const maxScale = Math.min(4, (Math.min(viewW, viewH) * 0.45) / pieceSize);
      this.camera.configure(this.playArea, maxScale);
    }
    this.camera.setViewSize(viewW, viewH);
  }

  // --- Dragging -------------------------------------------------------------

  private pickFromBoard(sx: number, sy: number): boolean {
    if (!this.state || !this.view) return false;
    const w = this.camera.screenToWorld(sx, sy);
    const id = this.view.hitTest(w.x, w.y, TOUCH_SLOP_PX / this.camera.scale);
    if (id === null) return false;
    this.beginDrag(id, w.x, w.y);
    return true;
  }

  private pickFromTray(id: number, sx: number, sy: number): void {
    if (!this.state || !this.view) return;
    const w = this.camera.screenToWorld(sx, sy);
    // The piece appears centred under the finger.
    takeFromTray(this.state, id, w.x - this.state.pieceWidth / 2, w.y - this.state.pieceHeight / 2);
    this.view.attachLoose(id);
    this.refreshTray();
    this.beginDrag(id, w.x, w.y);
    this.dragMove(sx, sy);
  }

  private beginDrag(pieceId: number, wx: number, wy: number): void {
    const state = this.state!;
    const groupId = state.pieces[pieceId].group;
    const ids = [...state.groups.get(groupId)!];
    this.drag = { groupId, ids, lastX: wx, lastY: wy };
    this.view!.liftGroup(ids);
    this.invalidate();
  }

  private dragMove(sx: number, sy: number): void {
    if (!this.drag || !this.state || !this.view) return;
    // The pointer may leave the canvas (pointer capture); keep the piece's grab point on screen.
    const m = DRAG_EDGE_MARGIN_PX;
    sx = Math.max(m, Math.min(this.host.clientWidth - m, sx));
    sy = Math.max(m, Math.min(this.host.clientHeight - m, sy));
    const w = this.camera.screenToWorld(sx, sy);
    // Keep the finger (and thus the piece) inside the play area.
    const a = this.playArea;
    const x = Math.max(a.x, Math.min(a.x + a.width, w.x));
    const y = Math.max(a.y, Math.min(a.y + a.height, w.y));
    moveGroup(this.state, this.drag.groupId, x - this.drag.lastX, y - this.drag.lastY);
    this.drag.lastX = x;
    this.drag.lastY = y;
    this.view.syncPieces(this.drag.ids);
    const returnable = this.drag.ids.length === 1 && canReturnToTray(this.state, this.drag.ids[0]);
    this.tray?.setHighlight(returnable && (this.tray?.contains(sx, sy) ?? false));
    this.invalidate();
  }

  private dragEnd(sx: number, sy: number): void {
    if (!this.drag || !this.state || !this.view || !this.tray) return;
    const state = this.state;
    const drag = this.drag;
    this.drag = null;
    this.tray.setHighlight(false);

    if (this.tray.contains(sx, sy)) {
      const id = drag.ids[0];
      if (drag.ids.length === 1 && canReturnToTray(state, id)) {
        returnToTray(state, id, this.tray.insertBeforeAt(sx, sy));
        this.view.prepareForTray(id);
        this.refreshTray();
        this.invalidate();
        this.events.onStateChange();
        return;
      }
    }

    const pieceSize = Math.min(state.pieceWidth, state.pieceHeight);
    const tolerance = Math.max(pieceSize * SNAP_TOLERANCE, SNAP_MIN_SCREEN_PX / this.camera.scale);
    const result = dropGroup(state, drag.groupId, tolerance);
    const allIds = state.groups.get(result.groupId)!;
    const now = performance.now();
    this.view.dropGroup(allIds, result.locked);
    this.view.animateSnap(drag.ids, result.dx, result.dy, now);
    this.view.syncPieces(allIds);
    // Pieces must never stay hidden under the tray (groups cannot go back into it).
    if (!result.snapped) this.slideClearOfTray(result.groupId, now);

    if (result.snapped) {
      // Glow on what just connected; for board locks only the dropped pieces, not the whole board.
      this.view.flash(result.locked ? drag.ids : allIds, now);
      this.events.onSnap(result.locked);
    }
    this.events.onProgress(lockedCount(state), state.pieces.length);
    if (isComplete(state)) {
      this.pauseClock();
      this.events.onComplete(state.elapsedMs, state.pieces.length);
    } else {
      this.events.onStateChange();
    }
    this.invalidate();
  }

  /** If any part of a loose group lies under the tray, slides the group out towards the board. */
  private slideClearOfTray(groupId: number, now: number): void {
    const state = this.state!;
    const ids = state.groups.get(groupId)!;
    const tab = Math.min(state.pieceWidth, state.pieceHeight) * 0.3;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const p = state.pieces[id];
      maxX = Math.max(maxX, p.x + state.pieceWidth + tab);
      maxY = Math.max(maxY, p.y + state.pieceHeight + tab);
    }
    const { scale, x: camX, y: camY } = this.camera;
    const r = this.trayRect;
    const gap = 8;
    const overlap =
      r.axis === 'x' ? maxY * scale + camY - (r.y - gap) : maxX * scale + camX - (r.x - gap);
    if (overlap <= 0) return;
    const dx = r.axis === 'y' ? -overlap / scale : 0;
    const dy = r.axis === 'x' ? -overlap / scale : 0;
    moveGroup(state, groupId, dx, dy);
    this.view!.animateSnap(ids, dx, dy, now);
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
    this.applyLayout();
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
    const viewAnimating = this.view?.update(now) ?? false;
    const trayAnimating = this.tray?.update(now) ?? false;
    Ticker.system.update(now);
    this.app.render();
    if (viewAnimating || trayAnimating) this.invalidate();
  };
}
