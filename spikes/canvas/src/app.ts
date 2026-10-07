import type { Model } from './model';
import { Renderer, type DragState, type Selection } from './renderer';
import { Scene } from './scene';

export interface FrameLog {
  /** Time between animation frames. */
  raf: number[];
  /** CPU time spent issuing draw commands in the frame. */
  work: number[];
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
/** After a pan or zoom gesture stops, the scene re-renders sharp following this pause. */
const GESTURE_SETTLE_MS = 150;

type Mode = 'idle' | 'drag' | 'band' | 'pan';

export class App {
  readonly scene: Scene;
  readonly renderer: Renderer;
  readonly selection: Selection = { nodes: new Set(), connectors: new Set() };
  /** Milliseconds from page code start to first complete frame. */
  openMs = 0;
  lastDragStartMs = 0;
  lastCommitMs = 0;
  lastSharpRenderMs = 0;

  private mode: Mode = 'idle';
  private drag: DragState | null = null;
  private band: { x0: number; y0: number; x1: number; y1: number } | null =
    null;
  private panLast = { x: 0, y: 0 };
  private dragOrigin = { x: 0, y: 0 };
  private sceneDirty = true;
  private activeDirty = true;
  private backgroundDirty = true;
  private gestureTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFrame = performance.now();
  private log: FrameLog | null = null;
  private spaceHeld = false;
  /** Overlay hook: called after each frame with the frame interval and work time. */
  onFrame: (interval: number, work: number) => void = () => undefined;

  constructor(
    readonly container: HTMLElement,
    model: Model,
  ) {
    const started = performance.now();
    this.scene = new Scene(model);
    this.renderer = new Renderer(container, this.scene);
    this.resize();
    this.fitAll();
    this.attach();
    this.frame(performance.now(), true);
    this.openMs = performance.now() - started;
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.renderer.resize(
      Math.max(1, Math.floor(rect.width)),
      Math.max(1, Math.floor(rect.height)),
    );
    this.sceneDirty = this.activeDirty = this.backgroundDirty = true;
  }

  // --- view ---------------------------------------------------------------------------

  fitAll(): void {
    let maxX = 0;
    let maxY = 0;
    for (const n of this.scene.nodes) {
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    const s = Math.min(
      this.renderer.width / (maxX + 100),
      this.renderer.height / (maxY + 100),
    );
    this.setView({ s, ox: 40 * s, oy: 40 * s });
  }

  /** Centres the model's middle at the given zoom (1 = 100%). */
  zoomTo(s: number): void {
    let maxX = 0;
    let maxY = 0;
    for (const n of this.scene.nodes) {
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    this.setView({
      s,
      ox: this.renderer.width / 2 - (maxX / 2) * s,
      oy: this.renderer.height / 2 - (maxY / 2) * s,
    });
  }

  setView(view: { s: number; ox: number; oy: number }): void {
    this.renderer.view = view;
    this.sceneDirty = this.activeDirty = this.backgroundDirty = true;
  }

  private gestureMoved(): void {
    this.renderer.applyGestureTransform();
    this.backgroundDirty = this.activeDirty = true;
    if (this.gestureTimer) clearTimeout(this.gestureTimer);
    this.gestureTimer = setTimeout(() => {
      this.sceneDirty = true;
      this.gestureTimer = null;
    }, GESTURE_SETTLE_MS);
  }

  private zoomAt(px: number, py: number, factor: number): void {
    const { s, ox, oy } = this.renderer.view;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s * factor));
    const f = next / s;
    this.renderer.view = {
      s: next,
      ox: px - (px - ox) * f,
      oy: py - (py - oy) * f,
    };
    this.gestureMoved();
  }

  // --- coordinates --------------------------------------------------------------------

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.renderer.active.getBoundingClientRect();
    const { s, ox, oy } = this.renderer.view;
    return {
      x: (clientX - rect.left - ox) / s,
      y: (clientY - rect.top - oy) / s,
    };
  }

  toClient(wx: number, wy: number): { x: number; y: number } {
    const rect = this.renderer.active.getBoundingClientRect();
    const { s, ox, oy } = this.renderer.view;
    return { x: rect.left + wx * s + ox, y: rect.top + wy * s + oy };
  }

  // --- selection ----------------------------------------------------------------------

  clearSelection(): void {
    this.selection.nodes.clear();
    this.selection.connectors.clear();
    this.activeDirty = true;
  }

  /** The n nodes closest to the middle of the screen; used by the benchmark and tests. */
  selectNearestToCenter(n: number): number[] {
    const c = this.toWorld(
      this.renderer.active.getBoundingClientRect().left +
        this.renderer.width / 2,
      this.renderer.active.getBoundingClientRect().top +
        this.renderer.height / 2,
    );
    let radius = 300;
    let found: { i: number; d: number }[] = [];
    while (found.length < n && radius < 40000) {
      found = this.scene
        .search({
          minX: c.x - radius,
          minY: c.y - radius,
          maxX: c.x + radius,
          maxY: c.y + radius,
        })
        .filter((b) => b.kind === 0)
        .map((b) => {
          const node = this.scene.nodes[b.i]!;
          return {
            i: b.i,
            d: Math.hypot(node.x + node.w / 2 - c.x, node.y + node.h / 2 - c.y),
          };
        });
      radius *= 2;
    }
    const chosen = found
      .sort((a, b) => a.d - b.d)
      .slice(0, n)
      .map((f) => f.i);
    this.clearSelection();
    for (const id of chosen) this.selection.nodes.add(id);
    this.activeDirty = true;
    return chosen;
  }

  // --- pointer input ------------------------------------------------------------------

  private attach(): void {
    const el = this.renderer.active;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        this.zoomAt(
          e.clientX - rect.left,
          e.clientY - rect.top,
          Math.exp(-e.deltaY * 0.0015),
        );
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') this.spaceHeld = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceHeld = false;
    });
  }

  private onDown(e: PointerEvent): void {
    try {
      this.renderer.active.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events from the benchmark have no capturable pointer.
    }
    const rect = this.renderer.active.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (e.button === 1 || e.button === 2 || this.spaceHeld) {
      this.mode = 'pan';
      this.panLast = { x: sx, y: sy };
      return;
    }
    const w = this.toWorld(e.clientX, e.clientY);
    const nodeId = this.scene.nodeAt(w.x, w.y);
    if (nodeId >= 0) {
      if (!this.selection.nodes.has(nodeId)) {
        if (!e.shiftKey) this.clearSelection();
        this.selection.nodes.add(nodeId);
      }
      this.beginDrag(w.x, w.y);
      return;
    }
    const connectorId = this.scene.connectorAt(
      w.x,
      w.y,
      4 / this.renderer.view.s,
    );
    if (!e.shiftKey) this.clearSelection();
    if (connectorId >= 0) {
      this.selection.connectors.add(connectorId);
      this.activeDirty = true;
      return;
    }
    this.mode = 'band';
    this.band = { x0: sx, y0: sy, x1: sx, y1: sy };
    this.activeDirty = true;
  }

  private beginDrag(wx: number, wy: number): void {
    const started = performance.now();
    const nodes = [...this.selection.nodes];
    const connectors = new Set<number>();
    for (const id of nodes)
      for (const c of this.scene.adjacency[id]!) connectors.add(c);
    this.drag = { nodes, connectors: [...connectors], dx: 0, dy: 0 };
    this.dragOrigin = { x: wx, y: wy };
    this.mode = 'drag';
    // The scene bitmap is redrawn once without the dragged items; after that, frames only
    // touch the active layer.
    this.renderer.excluded = { nodes: new Set(nodes), connectors };
    this.renderer.renderScene();
    this.sceneDirty = false;
    this.activeDirty = true;
    this.lastDragStartMs = performance.now() - started;
  }

  private onMove(e: PointerEvent): void {
    const rect = this.renderer.active.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (this.mode === 'pan') {
      const v = this.renderer.view;
      this.renderer.view = {
        s: v.s,
        ox: v.ox + sx - this.panLast.x,
        oy: v.oy + sy - this.panLast.y,
      };
      this.panLast = { x: sx, y: sy };
      this.gestureMoved();
    } else if (this.mode === 'drag' && this.drag) {
      const w = this.toWorld(e.clientX, e.clientY);
      this.drag.dx = w.x - this.dragOrigin.x;
      this.drag.dy = w.y - this.dragOrigin.y;
      this.activeDirty = true;
    } else if (this.mode === 'band' && this.band) {
      this.band.x1 = sx;
      this.band.y1 = sy;
      this.activeDirty = true;
    }
  }

  private onUp(e: PointerEvent): void {
    if (this.mode === 'drag' && this.drag) {
      const started = performance.now();
      const { nodes, dx, dy } = this.drag;
      this.renderer.excluded = null;
      if (dx !== 0 || dy !== 0) this.scene.moveNodes(nodes, dx, dy);
      this.drag = null;
      this.sceneDirty = true;
      this.activeDirty = true;
      this.lastCommitMs = performance.now() - started;
    } else if (this.mode === 'band' && this.band) {
      const a = this.toWorld(
        this.renderer.active.getBoundingClientRect().left + this.band.x0,
        this.renderer.active.getBoundingClientRect().top + this.band.y0,
      );
      const b = this.toWorld(
        this.renderer.active.getBoundingClientRect().left + this.band.x1,
        this.renderer.active.getBoundingClientRect().top + this.band.y1,
      );
      const rect = {
        minX: Math.min(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxX: Math.max(a.x, b.x),
        maxY: Math.max(a.y, b.y),
      };
      if (!e.shiftKey) this.clearSelection();
      for (const box of this.scene.search(rect)) {
        const inside =
          box.minX >= rect.minX &&
          box.maxX <= rect.maxX &&
          box.minY >= rect.minY &&
          box.maxY <= rect.maxY;
        if (box.kind === 0) this.selection.nodes.add(box.i);
        else if (inside) this.selection.connectors.add(box.i);
      }
      this.band = null;
      this.activeDirty = true;
    }
    this.mode = 'idle';
  }

  // --- frame loop ---------------------------------------------------------------------

  start(): void {
    const loop = (now: number) => {
      this.frame(now, false);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  startRecording(): void {
    this.log = { raf: [], work: [] };
  }

  stopRecording(): FrameLog {
    const log = this.log ?? { raf: [], work: [] };
    this.log = null;
    return log;
  }

  private frame(now: number, force: boolean): void {
    const interval = now - this.lastFrame;
    this.lastFrame = now;
    const started = performance.now();
    if (this.backgroundDirty || force) {
      this.renderer.renderBackground();
      this.backgroundDirty = false;
    }
    if (this.sceneDirty || force) {
      this.renderer.renderScene();
      this.lastSharpRenderMs = this.renderer.stats.sceneMs;
      this.sceneDirty = false;
    }
    if (this.activeDirty || force) {
      this.renderer.renderActive(this.selection, this.drag, this.band);
      this.activeDirty = false;
    }
    const work = performance.now() - started;
    if (this.log) {
      this.log.raf.push(interval);
      this.log.work.push(work);
    }
    this.onFrame(interval, work);
  }

  /** Resolves after the next animation frame has run. */
  nextFrame(): Promise<number> {
    return new Promise((resolve) => requestAnimationFrame((t) => resolve(t)));
  }

  isSettled(): boolean {
    return (
      !this.sceneDirty &&
      !this.gestureTimer &&
      this.renderer.sceneCanvas.style.transform === ''
    );
  }
}
