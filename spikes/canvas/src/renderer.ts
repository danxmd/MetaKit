import type { NodeItem } from './model';
import { ROUTE_FLOATS, ROUTE_POINTS, routeBetween } from './route';
import type { Rect, Scene } from './scene';

/** screen = world * s + offset, in CSS pixels. */
export interface View {
  s: number;
  ox: number;
  oy: number;
}

export interface DragState {
  nodes: number[];
  connectors: number[];
  dx: number;
  dy: number;
}

export interface Selection {
  nodes: Set<number>;
  connectors: Set<number>;
}

export interface RenderStats {
  sceneMs: number;
  visibleNodes: number;
  visibleConnectors: number;
  labels: number;
}

const FONT_WORLD_PX = 12;
/** Text smaller than this on screen is skipped (level of detail). */
export const MIN_TEXT_PX = 4;

const FILL = ['#eef4ff', '#fff4e6', '#ebfbee'];
const STROKE = '#364fc7';
const CONNECTOR = '#6b7a90';
const SELECT = '#e8590c';

function nodePath(ctx: CanvasRenderingContext2D, n: NodeItem): void {
  if (n.kind === 0) {
    ctx.rect(n.x, n.y, n.w, n.h);
  } else if (n.kind === 1) {
    ctx.moveTo(n.x + n.w, n.y + n.h / 2);
    ctx.ellipse(
      n.x + n.w / 2,
      n.y + n.h / 2,
      n.w / 2,
      n.h / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.roundRect(n.x, n.y, n.w, n.h, 12);
  }
}

/**
 * Three stacked canvases: grid background, static scene (a cached bitmap that is only
 * re-rendered when the content or the view settles) and an active layer that redraws every
 * frame with just the dragged items, selection and handles.
 */
export class Renderer {
  readonly background = document.createElement('canvas');
  readonly sceneCanvas = document.createElement('canvas');
  readonly active = document.createElement('canvas');
  view: View = { s: 1, ox: 0, oy: 0 };
  /** The view the scene bitmap was drawn with; differs from `view` during a gesture. */
  renderedView: View = { s: 1, ox: 0, oy: 0 };
  /** Items left out of the scene bitmap because the active layer draws them. */
  excluded: { nodes: Set<number>; connectors: Set<number> } | null = null;
  width = 0;
  height = 0;
  stats: RenderStats = {
    sceneMs: 0,
    visibleNodes: 0,
    visibleConnectors: 0,
    labels: 0,
  };

  private readonly dpr = window.devicePixelRatio || 1;
  private readonly bgCtx = this.background.getContext('2d')!;
  private readonly sceneCtx = this.sceneCanvas.getContext('2d')!;
  private readonly activeCtx = this.active.getContext('2d')!;
  private readonly scratch = new Float64Array(ROUTE_FLOATS);

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
    this.sceneCanvas.style.transformOrigin = '0 0';
    this.active.style.touchAction = 'none';
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const canvas of [this.background, this.sceneCanvas, this.active]) {
      canvas.width = Math.round(width * this.dpr);
      canvas.height = Math.round(height * this.dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }

  visibleRect(view: View = this.view): Rect {
    return {
      minX: -view.ox / view.s,
      minY: -view.oy / view.s,
      maxX: (this.width - view.ox) / view.s,
      maxY: (this.height - view.oy) / view.s,
    };
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
    const { s } = this.view;
    let step = 100;
    // Grid lines closer than 8 px only add noise, so use a coarser step.
    while (step * s < 8) step *= 10;
    this.setTransform(ctx, this.view);
    const r = this.visibleRect();
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
    ctx.strokeStyle = '#e9ecef';
    ctx.stroke();
  }

  /** Re-renders the static scene bitmap at the current view. */
  renderScene(): void {
    const started = performance.now();
    const ctx = this.sceneCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.sceneCanvas.width, this.sceneCanvas.height);
    this.setTransform(ctx, this.view);
    const { s } = this.view;
    const hits = this.scene.search(this.visibleRect());
    const skip = this.excluded;

    ctx.beginPath();
    let connectorCount = 0;
    for (const box of hits) {
      if (box.kind !== 1 || skip?.connectors.has(box.i)) continue;
      const o = box.i * ROUTE_FLOATS;
      const r = this.scene.routes;
      ctx.moveTo(r[o]!, r[o + 1]!);
      for (let p = 1; p < ROUTE_POINTS; p++)
        ctx.lineTo(r[o + p * 2]!, r[o + p * 2 + 1]!);
      connectorCount += 1;
    }
    ctx.lineWidth = Math.max(1.2, 1 / s);
    ctx.strokeStyle = CONNECTOR;
    ctx.stroke();

    const visible: number[][] = [[], [], []];
    for (const box of hits) {
      if (box.kind !== 0 || skip?.nodes.has(box.i)) continue;
      visible[this.scene.nodes[box.i]!.kind]!.push(box.i);
    }
    ctx.lineWidth = Math.max(1.5, 1 / s);
    ctx.strokeStyle = STROKE;
    let nodeCount = 0;
    for (let kind = 0; kind < 3; kind++) {
      const ids = visible[kind]!;
      if (ids.length === 0) continue;
      ctx.beginPath();
      for (const id of ids) nodePath(ctx, this.scene.nodes[id]!);
      ctx.fillStyle = FILL[kind]!;
      ctx.fill();
      // Outlines under 2 px of screen size are invisible detail.
      if (s * 50 >= 2) ctx.stroke();
      nodeCount += ids.length;
    }

    let labels = 0;
    if (FONT_WORLD_PX * s >= MIN_TEXT_PX) {
      ctx.font = `${FONT_WORLD_PX}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#212529';
      for (const ids of visible) {
        for (const id of ids) {
          const n = this.scene.nodes[id]!;
          ctx.fillText(n.label, n.x + n.w / 2, n.y + n.h / 2);
          labels += 1;
        }
      }
    }
    this.renderedView = { ...this.view };
    this.sceneCanvas.style.transform = '';
    this.stats = {
      sceneMs: performance.now() - started,
      visibleNodes: nodeCount,
      visibleConnectors: connectorCount,
      labels,
    };
  }

  /** During pan and zoom the cached bitmap is moved by the browser; no scene redraw. */
  applyGestureTransform(): void {
    const from = this.renderedView;
    const to = this.view;
    const k = to.s / from.s;
    const tx = to.ox - from.ox * k;
    const ty = to.oy - from.oy * k;
    this.sceneCanvas.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
  }

  renderActive(
    selection: Selection,
    drag: DragState | null,
    band: { x0: number; y0: number; x1: number; y1: number } | null,
  ): void {
    const ctx = this.activeCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.active.width, this.active.height);
    this.setTransform(ctx, this.view);
    const { s } = this.view;
    const nodes = this.scene.nodes;
    const shifted = (id: number): NodeItem => {
      const n = nodes[id]!;
      return drag && drag.nodes.includes(id)
        ? { ...n, x: n.x + drag.dx, y: n.y + drag.dy }
        : n;
    };

    if (drag) {
      ctx.beginPath();
      for (const c of drag.connectors) {
        const connector = this.scene.connectors[c]!;
        routeBetween(
          shifted(connector.from),
          shifted(connector.to),
          this.scratch,
        );
        ctx.moveTo(this.scratch[0]!, this.scratch[1]!);
        for (let p = 1; p < ROUTE_POINTS; p++) {
          ctx.lineTo(this.scratch[p * 2]!, this.scratch[p * 2 + 1]!);
        }
      }
      ctx.lineWidth = Math.max(1.2, 1 / s);
      ctx.strokeStyle = CONNECTOR;
      ctx.stroke();
      ctx.lineWidth = Math.max(1.5, 1 / s);
      ctx.strokeStyle = STROKE;
      const showText = FONT_WORLD_PX * s >= MIN_TEXT_PX;
      if (showText) {
        ctx.font = `${FONT_WORLD_PX}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
      for (const id of drag.nodes) {
        const n = shifted(id);
        ctx.beginPath();
        nodePath(ctx, n);
        ctx.fillStyle = FILL[n.kind]!;
        ctx.fill();
        ctx.stroke();
        if (showText) {
          ctx.fillStyle = '#212529';
          ctx.fillText(n.label, n.x + n.w / 2, n.y + n.h / 2);
        }
      }
    }

    ctx.strokeStyle = SELECT;
    ctx.lineWidth = Math.max(2, 2 / s);
    ctx.beginPath();
    for (const id of selection.nodes) {
      const n = shifted(id);
      ctx.rect(n.x - 3 / s, n.y - 3 / s, n.w + 6 / s, n.h + 6 / s);
    }
    ctx.stroke();
    for (const c of selection.connectors) {
      const o = c * ROUTE_FLOATS;
      const r = this.scene.routes;
      ctx.beginPath();
      ctx.moveTo(r[o]!, r[o + 1]!);
      for (let p = 1; p < ROUTE_POINTS; p++)
        ctx.lineTo(r[o + p * 2]!, r[o + p * 2 + 1]!);
      ctx.stroke();
    }
    // Resize handles on up to 50 selected nodes; more would only clutter.
    if (selection.nodes.size <= 50) {
      const h = 6 / s;
      ctx.beginPath();
      for (const id of selection.nodes) {
        const n = shifted(id);
        for (const [hx, hy] of [
          [n.x, n.y],
          [n.x + n.w / 2, n.y],
          [n.x + n.w, n.y],
          [n.x, n.y + n.h / 2],
          [n.x + n.w, n.y + n.h / 2],
          [n.x, n.y + n.h],
          [n.x + n.w / 2, n.y + n.h],
          [n.x + n.w, n.y + n.h],
        ] as const) {
          ctx.rect(hx - h / 2, hy - h / 2, h, h);
        }
      }
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 1 / s;
      ctx.stroke();
    }

    if (band) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = 'rgba(232, 89, 12, 0.12)';
      ctx.strokeStyle = SELECT;
      ctx.lineWidth = 1;
      const x = Math.min(band.x0, band.x1);
      const y = Math.min(band.y0, band.y1);
      ctx.fillRect(
        x,
        y,
        Math.abs(band.x1 - band.x0),
        Math.abs(band.y1 - band.y0),
      );
      ctx.strokeRect(
        x,
        y,
        Math.abs(band.x1 - band.x0),
        Math.abs(band.y1 - band.y0),
      );
    }
  }
}
