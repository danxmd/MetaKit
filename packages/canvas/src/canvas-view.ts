import type { Point, Rect } from './geometry';
import {
  emptyActiveState,
  isActiveEmpty,
  Renderer,
  type ActiveState,
  type GridSettings,
} from './renderer';
import type { Scene } from './scene';
import {
  centreOn,
  fitRect,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type View,
} from './view';

/** After a pan or zoom gesture stops this long, the scene is drawn sharp again. */
const SETTLE_MS = 150;

export interface CanvasViewOptions {
  grid?: GridSettings;
}

/**
 * The drawing surface: the three canvases, the overlay for text editing, the viewport and the
 * frame scheduling. Interaction tools talk to it through `setActive` (what the active layer shows)
 * and the coordinate helpers.
 */
export class CanvasView {
  readonly root: HTMLElement;
  /** A layer above the canvases for text editors and tooltips; it does not take pointer events itself. */
  readonly overlay: HTMLElement;
  readonly renderer: Renderer;
  active: ActiveState = emptyActiveState();
  private readonly viewListeners = new Set<() => void>();
  /** Called after each painted frame with the time the drawing took; used by the benchmark. */
  onFrame: ((workMs: number) => void) | null = null;

  private dirtyBackground = true;
  private dirtyScene = true;
  private dirtyActive = true;
  private frame = 0;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly resizeObserver: ResizeObserver;
  private readonly stopScene: () => void;
  private panning: { id: number; x: number; y: number } | null = null;
  private spaceDown = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    readonly container: HTMLElement,
    readonly scene: Scene,
    options: CanvasViewOptions = {},
  ) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:relative;width:100%;height:100%;overflow:hidden;background:#fff;user-select:none;';
    container.append(this.root);
    this.renderer = new Renderer(this.root, scene);
    if (options.grid) this.renderer.grid = options.grid;
    this.overlay = document.createElement('div');
    this.overlay.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    this.root.append(this.overlay);

    this.resizeObserver = new ResizeObserver(() => this.fitToContainer());
    this.resizeObserver.observe(this.root);
    this.fitToContainer();

    this.stopScene = scene.onChange(() => {
      this.dirtyScene = true;
      this.dirtyActive = true;
      this.schedule();
    });
    this.installViewportControls();
  }

  /** The element that receives pointer events; tools listen here. */
  get surface(): HTMLCanvasElement {
    return this.renderer.active;
  }

  get view(): View {
    return this.renderer.view;
  }

  get width(): number {
    return this.renderer.width;
  }

  get height(): number {
    return this.renderer.height;
  }

  private fitToContainer(): void {
    const rect = this.root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.renderer.resize(rect.width, rect.height);
    for (const l of this.viewListeners) l();
    this.dirtyBackground = this.dirtyScene = this.dirtyActive = true;
    this.schedule();
  }

  /** World position of a pointer event. */
  toWorld(event: { clientX: number; clientY: number }): Point {
    return screenToWorld(this.view, this.toScreen(event));
  }

  /** Position of a pointer event inside the canvas, in CSS pixels. */
  toScreen(event: { clientX: number; clientY: number }): Point {
    const r = this.root.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  toScreenFromWorld(p: Point): Point {
    return worldToScreen(this.view, p);
  }

  /** Replaces the viewport. A gesture moves the cached bitmap and settles later. */
  setView(view: View, gesture = true): void {
    this.renderer.view = view;
    if (gesture) {
      // The browser moves the three bitmaps; they are drawn sharp again when the gesture stops.
      this.renderer.applyGestureTransform(!isActiveEmpty(this.active));
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        this.dirtyBackground = this.dirtyScene = this.dirtyActive = true;
        this.schedule();
      }, SETTLE_MS);
    } else {
      this.dirtyBackground = this.dirtyScene = this.dirtyActive = true;
    }
    for (const l of this.viewListeners) l();
    this.schedule();
  }

  /** Calls `listener` after the viewport changed or the canvas was resized. */
  onViewChange(listener: () => void): () => void {
    this.viewListeners.add(listener);
    return () => this.viewListeners.delete(listener);
  }

  zoomAtScreen(anchor: Point, factor: number): void {
    this.setView(zoomAt(this.view, anchor, factor));
  }

  panBy(dx: number, dy: number): void {
    const v = this.view;
    this.setView({ s: v.s, ox: v.ox + dx, oy: v.oy + dy });
  }

  /** Zooms and moves so that `rect` (or the whole model) is in view. */
  fit(rect: Rect | null = this.scene.bounds()): void {
    this.setView(
      rect ? fitRect(rect, this.width, this.height) : { s: 1, ox: 40, oy: 40 },
      false,
    );
  }

  centreOnWorld(p: Point): void {
    this.setView(centreOn(this.view, p, this.width, this.height), false);
  }

  /** Changes what the active layer shows. The scene is redrawn if the set of left-out items changed. */
  setActive(state: Partial<ActiveState>): void {
    this.active = { ...this.active, ...state };
    const excluded = this.renderer.excludedBy(this.active);
    const before = this.renderer.excluded;
    if (
      excluded.size !== before.size ||
      [...excluded].some((id) => !before.has(id))
    ) {
      this.renderer.excluded = excluded;
      this.dirtyScene = true;
    }
    this.dirtyActive = true;
    this.schedule();
  }

  setGrid(grid: GridSettings): void {
    this.renderer.grid = grid;
    this.dirtyBackground = true;
    this.schedule();
  }

  invalidate(): void {
    this.dirtyScene = this.dirtyActive = this.dirtyBackground = true;
    this.schedule();
  }

  private schedule(): void {
    if (this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const started = performance.now();
      this.paint();
      this.onFrame?.(performance.now() - started);
    });
  }

  /** Draws whatever is out of date. Called from the animation frame; tests and benchmarks may call it directly. */
  paint(): void {
    if (this.renderer.width === 0) return;
    if (this.dirtyBackground) {
      this.dirtyBackground = false;
      this.renderer.renderBackground();
    }
    if (this.dirtyScene) {
      this.dirtyScene = false;
      this.renderer.renderScene();
    }
    if (this.dirtyActive) {
      this.dirtyActive = false;
      this.renderer.renderActive(this.active);
    }
  }

  private installViewportControls(): void {
    const surface = this.surface;
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K | string,
      handler: (e: never) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.cleanups.push(() =>
        target.removeEventListener(type, handler as EventListener, options),
      );
    };
    on(
      surface,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey || !e.shiftKey) {
          // The wheel zooms about the cursor, as in the spike; shift+wheel pans.
          const factor = Math.exp(-e.deltaY * 0.0015);
          this.zoomAtScreen(this.toScreen(e), factor);
        } else {
          this.panBy(-e.deltaY, 0);
        }
      },
      { passive: false },
    );
    on(surface, 'pointerdown', (e: PointerEvent) => {
      const wantsPan =
        e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown);
      if (!wantsPan) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      surface.setPointerCapture(e.pointerId);
      this.panning = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    on(surface, 'pointermove', (e: PointerEvent) => {
      if (!this.panning || this.panning.id !== e.pointerId) return;
      e.stopImmediatePropagation();
      this.panBy(e.clientX - this.panning.x, e.clientY - this.panning.y);
      this.panning = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    const end = (e: PointerEvent) => {
      if (this.panning?.id === e.pointerId) {
        e.stopImmediatePropagation();
        this.panning = null;
      }
    };
    on(surface, 'pointerup', end);
    on(surface, 'pointercancel', end);
    on(surface, 'contextmenu', (e: Event) => e.preventDefault());
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        this.spaceDown = true;
        surface.style.cursor = 'grab';
        e.preventDefault();
      }
    });
    on(window, 'keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        surface.style.cursor = '';
      }
    });
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.settleTimer);
    this.resizeObserver.disconnect();
    this.stopScene();
    for (const c of this.cleanups) c();
    this.root.remove();
  }
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}
