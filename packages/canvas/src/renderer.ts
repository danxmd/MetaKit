import type { ConnectorId, ElementId } from '@metakit-app/core';
import type { Point, Rect } from './geometry';
import { intersects } from './geometry';
import { HANDLE_NAMES, HANDLE_PX, handlePoint } from './handles';
import { arrowHead } from './route';
import type { ConnectorItem, ElementItem, Scene } from './scene';
import {
  CONNECTOR_COLOR,
  FONT_WORLD_PX,
  SELECT_COLOR,
  STROKE,
  TEXT_COLOR,
  traceShape,
} from './shapes';
import { visibleRect, type View } from './view';

/** Text smaller than this on screen is skipped (level of detail). */
export const MIN_TEXT_PX = 4;
/** Elements smaller than this on screen are drawn as plain batched shapes without a cached path. */
const BATCH_PX = 8;
/** Outlines of elements under this size on screen are invisible detail. */
const MIN_OUTLINE_PX = 2;
const MIN_ARROW_PX = 6;

export interface GridSettings {
  size: number;
  visible: boolean;
}

/** Geometry of an element while it is being moved or resized; the model has not changed yet. */
export type Preview = Rect;

/** Everything the active layer draws on top of the cached scene. Set by the interaction tools. */
export interface ActiveState {
  selectedElements: ReadonlySet<ElementId>;
  selectedConnectors: ReadonlySet<ConnectorId>;
  /** Elements shown somewhere other than the model says, by element id. */
  previews: ReadonlyMap<ElementId, Preview>;
  /** Connector routes shown differently from the scene (bend or end being dragged). */
  routes: ReadonlyMap<ConnectorId, readonly Point[]>;
  /** Rubber band, in screen pixels. */
  band: Rect | null;
  /** Snap guides in world coordinates. */
  guides: { x: readonly number[]; y: readonly number[] };
  /** A connector being drawn: from a point to a point, and whether dropping here would work. */
  link: { from: Point; to: Point; ok: boolean } | null;
  /** An element to highlight as a drop target. */
  target: ElementId | null;
  /** Show resize handles on a single selected element. */
  handles: boolean;
}

/** True when the active layer has nothing to show, so that it can be left out of a gesture. */
export function isActiveEmpty(state: ActiveState): boolean {
  return (
    state.selectedElements.size === 0 &&
    state.selectedConnectors.size === 0 &&
    state.previews.size === 0 &&
    state.routes.size === 0 &&
    state.band === null &&
    state.link === null &&
    state.guides.x.length === 0 &&
    state.guides.y.length === 0
  );
}

export function emptyActiveState(): ActiveState {
  return {
    selectedElements: new Set(),
    selectedConnectors: new Set(),
    previews: new Map(),
    routes: new Map(),
    band: null,
    guides: { x: [], y: [] },
    link: null,
    target: null,
    handles: true,
  };
}

export interface RenderStats {
  sceneMs: number;
  activeMs: number;
  visibleElements: number;
  visibleConnectors: number;
  labels: number;
}

/**
 * Three stacked canvases: grid background, static scene (a cached bitmap that is re-rendered only
 * when content or view settles) and an active layer that redraws every frame with just the items
 * being touched, the selection, handles and guides.
 */
export class Renderer {
  readonly background = document.createElement('canvas');
  readonly sceneCanvas = document.createElement('canvas');
  readonly active = document.createElement('canvas');
  view: View = { s: 1, ox: 0, oy: 0 };
  /** The view each layer's bitmap was drawn with; differs from `view` during a pan or zoom gesture. */
  renderedView: View = { s: 1, ox: 0, oy: 0 };
  private activeView: View = { s: 1, ox: 0, oy: 0 };
  /** Items left out of the scene bitmap because the active layer draws them. */
  excluded: ReadonlySet<string> = new Set();
  width = 0;
  height = 0;
  grid: GridSettings = { size: 10, visible: true };
  stats: RenderStats = {
    sceneMs: 0,
    activeMs: 0,
    visibleElements: 0,
    visibleConnectors: 0,
    labels: 0,
  };

  private readonly dpr = window.devicePixelRatio || 1;
  private readonly bgCtx = this.background.getContext('2d')!;
  private readonly sceneCtx = this.sceneCanvas.getContext('2d')!;
  private readonly activeCtx = this.active.getContext('2d')!;

  constructor(
    container: HTMLElement,
    private readonly scene: Scene,
  ) {
    for (const canvas of [this.background, this.sceneCanvas, this.active]) {
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      container.append(canvas);
    }
    for (const canvas of [this.background, this.sceneCanvas, this.active])
      canvas.style.transformOrigin = '0 0';
    this.active.style.touchAction = 'none';
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const canvas of [this.background, this.sceneCanvas, this.active]) {
      canvas.width = Math.max(1, Math.round(width * this.dpr));
      canvas.height = Math.max(1, Math.round(height * this.dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }

  visible(view: View = this.view): Rect {
    return visibleRect(view, this.width, this.height);
  }

  private setTransform(ctx: CanvasRenderingContext2D, view: View): void {
    ctx.setTransform(
      this.dpr * view.s,
      0,
      0,
      this.dpr * view.s,
      this.dpr * view.ox,
      this.dpr * view.oy,
    );
  }

  renderBackground(): void {
    const ctx = this.bgCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.background.width, this.background.height);
    this.background.style.visibility = '';
    this.background.style.transform = '';
    if (!this.grid.visible) return;
    const { s } = this.view;
    let step = this.grid.size;
    // Lines closer than 8 px only add noise, so use a coarser step.
    while (step * s < 8) step *= 5;
    this.setTransform(ctx, this.view);
    const r = this.visible();
    ctx.beginPath();
    for (let x = Math.floor(r.minX / step) * step; x <= r.maxX; x += step) {
      ctx.moveTo(x, r.minY);
      ctx.lineTo(x, r.maxY);
    }
    for (let y = Math.floor(r.minY / step) * step; y <= r.maxY; y += step) {
      ctx.moveTo(r.minX, y);
      ctx.lineTo(r.maxX, y);
    }
    ctx.lineWidth = 1 / s;
    ctx.strokeStyle = '#eceff3';
    ctx.stroke();
  }

  private routeOf(connector: ConnectorItem): readonly Point[] {
    return connector.route;
  }

  /** Re-renders the static scene bitmap at the current view. */
  renderScene(): void {
    const started = performance.now();
    const ctx = this.sceneCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.sceneCanvas.width, this.sceneCanvas.height);
    const view = this.view;
    this.setTransform(ctx, view);
    const { s } = view;
    const skip = this.excluded;
    const hits = this.scene.search(this.visible());

    const connectors: ConnectorItem[] = [];
    const elements: ElementItem[] = [];
    for (const box of hits) {
      if (skip.has(box.id)) continue;
      if (box.kind === 'connector') {
        const item = this.scene.connectors.get(box.id as ConnectorId);
        if (item) connectors.push(item);
      } else {
        const item = this.scene.elements.get(box.id as ElementId);
        if (item) elements.push(item);
      }
    }
    elements.sort((a, b) => a.rank - b.rank);

    this.drawConnectors(ctx, connectors, s);
    const labels = this.drawElements(ctx, elements, view);
    this.renderedView = { ...view };
    this.sceneCanvas.style.transform = '';
    this.stats = {
      ...this.stats,
      sceneMs: performance.now() - started,
      visibleElements: elements.length,
      visibleConnectors: connectors.length,
      labels,
    };
  }

  private drawConnectors(
    ctx: CanvasRenderingContext2D,
    connectors: readonly ConnectorItem[],
    s: number,
    colour: string = CONNECTOR_COLOR,
  ): void {
    if (connectors.length === 0) return;
    ctx.beginPath();
    for (const c of connectors) {
      const route = this.routeOf(c);
      ctx.moveTo(route[0]!.x, route[0]!.y);
      for (let i = 1; i < route.length; i++)
        ctx.lineTo(route[i]!.x, route[i]!.y);
    }
    ctx.lineWidth = Math.max(1.2, 1 / s);
    ctx.strokeStyle = colour;
    ctx.stroke();
    this.drawArrows(
      ctx,
      connectors.map((c) => this.routeOf(c)),
      s,
      colour,
    );
  }

  private drawArrows(
    ctx: CanvasRenderingContext2D,
    routes: readonly (readonly Point[])[],
    s: number,
    colour: string,
  ): void {
    // Arrow heads are fine decoration: skipped when they would be a few pixels across.
    if (12 * s < MIN_ARROW_PX) return;
    ctx.beginPath();
    for (const route of routes) {
      const head = arrowHead(route, 10);
      if (!head) continue;
      ctx.moveTo(head[0].x, head[0].y);
      ctx.lineTo(head[1].x, head[1].y);
      ctx.lineTo(head[2].x, head[2].y);
      ctx.closePath();
    }
    ctx.fillStyle = colour;
    ctx.fill();
  }

  /** Draws elements bottom to top; returns how many labels were drawn. */
  private drawElements(
    ctx: CanvasRenderingContext2D,
    elements: readonly ElementItem[],
    view: View,
  ): number {
    const { s } = view;
    const outline = Math.max(1.5, 1 / s);
    const showText = FONT_WORLD_PX * s >= MIN_TEXT_PX;
    let labels = 0;
    ctx.lineWidth = outline;
    ctx.strokeStyle = STROKE;

    // Tiny elements are batched per fill colour into one path each; everything else uses its
    // cached outline. Drawing order is kept by flushing the batch before a large element.
    let batch = new Map<string, ElementItem[]>();
    const flush = () => {
      for (const [fill, items] of batch) {
        ctx.beginPath();
        for (const e of items) traceShape(ctx, e.shape, e.x, e.y, e.w, e.h);
        ctx.fillStyle = fill;
        ctx.fill();
        if (s * 50 >= MIN_OUTLINE_PX) ctx.stroke();
      }
      batch = new Map();
    };

    for (const e of elements) {
      if (Math.min(e.w, e.h) * s < BATCH_PX) {
        const list = batch.get(e.fill);
        if (list) list.push(e);
        else batch.set(e.fill, [e]);
        continue;
      }
      flush();
      this.setElementTransform(ctx, view, e.x, e.y);
      ctx.fillStyle = e.fill;
      const path = e.draw.outline();
      ctx.fill(path);
      ctx.stroke(path);
    }
    flush();

    if (showText) {
      this.setTransform(ctx, view);
      ctx.font = `${FONT_WORLD_PX}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = TEXT_COLOR;
      for (const e of elements) {
        if (Math.min(e.w, e.h) * s < BATCH_PX) continue;
        for (const run of e.draw.text) {
          ctx.fillText(run.text, e.x + run.x, e.y + run.y);
          labels += 1;
        }
      }
    }
    return labels;
  }

  private setElementTransform(
    ctx: CanvasRenderingContext2D,
    view: View,
    x: number,
    y: number,
  ): void {
    ctx.setTransform(
      this.dpr * view.s,
      0,
      0,
      this.dpr * view.s,
      this.dpr * (view.ox + x * view.s),
      this.dpr * (view.oy + y * view.s),
    );
  }

  /** During pan and zoom the cached bitmaps are moved by the browser; nothing is redrawn. */
  applyGestureTransform(keepActive: boolean): void {
    // Each moved bitmap costs compositing time, so the grid is hidden while the view moves and the
    // active layer moves only when it has something on it (a selection, for instance).
    this.background.style.visibility = 'hidden';
    this.active.style.visibility = keepActive ? '' : 'hidden';
    const apply = (canvas: HTMLCanvasElement, from: View) => {
      const to = this.view;
      const k = to.s / from.s;
      const tx = to.ox - from.ox * k;
      const ty = to.oy - from.oy * k;
      canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
    };
    apply(this.sceneCanvas, this.renderedView);
    if (keepActive) apply(this.active, this.activeView);
  }

  /** The items that the scene bitmap leaves out while `state` is on screen. */
  excludedBy(state: ActiveState): Set<string> {
    const out = new Set<string>();
    for (const id of state.previews.keys()) {
      out.add(id);
      for (const c of this.scene.connectorsOf(id)) out.add(c);
    }
    for (const id of state.routes.keys()) out.add(id);
    return out;
  }

  renderActive(state: ActiveState): void {
    const started = performance.now();
    const ctx = this.activeCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.active.width, this.active.height);
    this.activeView = { ...this.view };
    this.active.style.visibility = '';
    this.active.style.transform = '';
    const view = this.view;
    this.setTransform(ctx, view);
    const { s } = view;
    const area = this.visible();

    // Items the scene bitmap leaves out: connectors first, then elements.
    const movedConnectors = new Set<ConnectorId>();
    for (const id of state.previews.keys())
      for (const c of this.scene.connectorsOf(id)) movedConnectors.add(c);
    const routes: (readonly Point[])[] = [];
    for (const id of movedConnectors) {
      if (state.routes.has(id)) continue;
      const item = this.scene.connectors.get(id);
      if (!item) continue;
      routes.push(this.routeWithPreviews(item, state));
    }
    for (const [, route] of state.routes) routes.push(route);
    if (routes.length > 0) {
      ctx.beginPath();
      for (const route of routes) {
        ctx.moveTo(route[0]!.x, route[0]!.y);
        for (let i = 1; i < route.length; i++)
          ctx.lineTo(route[i]!.x, route[i]!.y);
      }
      ctx.lineWidth = Math.max(1.2, 1 / s);
      ctx.strokeStyle = CONNECTOR_COLOR;
      ctx.stroke();
      this.drawArrows(ctx, routes, s, CONNECTOR_COLOR);
    }

    const previewed: ElementItem[] = [];
    for (const [id, rect] of state.previews) {
      const item = this.scene.elements.get(id);
      if (!item) continue;
      previewed.push({
        ...item,
        x: rect.minX,
        y: rect.minY,
        w: rect.maxX - rect.minX,
        h: rect.maxY - rect.minY,
        draw:
          rect.maxX - rect.minX === item.w && rect.maxY - rect.minY === item.h
            ? item.draw
            : this.scene.cache.get(
                undefined,
                item.shape,
                rect.maxX - rect.minX,
                rect.maxY - rect.minY,
                item.label,
                item.fill,
              ),
      });
    }
    previewed.sort((a, b) => a.rank - b.rank);
    if (previewed.length > 0) this.drawElements(ctx, previewed, view);

    // Selection outlines and handles.
    this.setTransform(ctx, view);
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = Math.max(2, 2 / s);
    const selectedBoxes: Rect[] = [];
    ctx.beginPath();
    for (const id of state.selectedElements) {
      const rect = this.boxOf(id, state);
      if (!rect || !intersects(rect, area)) continue;
      selectedBoxes.push(rect);
      const pad = 3 / s;
      ctx.rect(
        rect.minX - pad,
        rect.minY - pad,
        rect.maxX - rect.minX + 2 * pad,
        rect.maxY - rect.minY + 2 * pad,
      );
    }
    ctx.stroke();

    for (const id of state.selectedConnectors) {
      const item = this.scene.connectors.get(id);
      if (!item) continue;
      const route = state.routes.get(id) ?? this.routeWithPreviews(item, state);
      ctx.beginPath();
      ctx.moveTo(route[0]!.x, route[0]!.y);
      for (let i = 1; i < route.length; i++)
        ctx.lineTo(route[i]!.x, route[i]!.y);
      ctx.stroke();
      const override = state.routes.get(id);
      this.drawConnectorHandles(
        ctx,
        route,
        override ? override.slice(1, -1) : item.bends,
        s,
      );
    }

    // Resize handles on up to 50 selected elements; more would only clutter.
    if (
      state.handles &&
      selectedBoxes.length > 0 &&
      selectedBoxes.length <= 50
    ) {
      const h = HANDLE_PX / s;
      ctx.beginPath();
      for (const rect of selectedBoxes) {
        for (const name of HANDLE_NAMES) {
          const p = handlePoint(rect, name);
          ctx.rect(p.x - h / 2, p.y - h / 2, h, h);
        }
      }
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 1 / s;
      ctx.stroke();
    }

    if (state.target) {
      const rect = this.boxOf(state.target, state);
      if (rect) {
        ctx.strokeStyle = '#2f9e44';
        ctx.lineWidth = Math.max(3, 3 / s);
        ctx.strokeRect(
          rect.minX,
          rect.minY,
          rect.maxX - rect.minX,
          rect.maxY - rect.minY,
        );
      }
    }

    if (state.link) {
      ctx.beginPath();
      ctx.moveTo(state.link.from.x, state.link.from.y);
      ctx.lineTo(state.link.to.x, state.link.to.y);
      ctx.setLineDash([6 / s, 4 / s]);
      ctx.strokeStyle = state.link.ok ? '#2f9e44' : '#e03131';
      ctx.lineWidth = Math.max(2, 2 / s);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.guides.x.length > 0 || state.guides.y.length > 0) {
      ctx.beginPath();
      for (const x of state.guides.x) {
        ctx.moveTo(x, area.minY);
        ctx.lineTo(x, area.maxY);
      }
      for (const y of state.guides.y) {
        ctx.moveTo(area.minX, y);
        ctx.lineTo(area.maxX, y);
      }
      ctx.strokeStyle = '#d6336c';
      ctx.lineWidth = 1 / s;
      ctx.stroke();
    }

    if (state.band) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const b = state.band;
      ctx.fillStyle = 'rgba(232, 89, 12, 0.12)';
      ctx.strokeStyle = SELECT_COLOR;
      ctx.lineWidth = 1;
      ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    }
    this.stats = { ...this.stats, activeMs: performance.now() - started };
  }

  private boxOf(id: ElementId, state: ActiveState): Rect | null {
    const preview = state.previews.get(id);
    if (preview) return preview;
    const e = this.scene.elements.get(id);
    return e
      ? { minX: e.x, minY: e.y, maxX: e.x + e.w, maxY: e.y + e.h }
      : null;
  }

  private routeWithPreviews(
    connector: ConnectorItem,
    state: ActiveState,
  ): readonly Point[] {
    const a = state.previews.get(connector.from);
    const b = state.previews.get(connector.to);
    if (!a && !b) return connector.route;
    return this.scene.routeWithRects(connector, a, b);
  }

  private drawConnectorHandles(
    ctx: CanvasRenderingContext2D,
    route: readonly Point[],
    bends: readonly Point[],
    s: number,
  ): void {
    const h = HANDLE_PX / s;
    ctx.beginPath();
    // Ends are round handles, bend points square ones.
    for (const p of [route[0]!, route[route.length - 1]!]) {
      ctx.moveTo(p.x + h / 2, p.y);
      ctx.arc(p.x, p.y, h / 2, 0, Math.PI * 2);
    }
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 1 / s;
    ctx.stroke();
    ctx.beginPath();
    for (const p of bends) ctx.rect(p.x - h / 2, p.y - h / 2, h, h);
    ctx.fill();
    ctx.stroke();
  }
}
