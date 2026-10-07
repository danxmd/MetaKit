import type {
  CompiledRelation,
  DrawOp,
  OpStyle,
  OutlineKind,
} from '@metakit-app/shapes';
import type { Point } from './geometry';

/** Loads images once by source; the draw falls back to nothing until one has arrived. */
export class ImageCache {
  private readonly images = new Map<string, HTMLImageElement | 'failed'>();

  /** Called when an image finishes loading, so that the owner can redraw. */
  onLoaded: (() => void) | null = null;

  constructor(
    /** Turns an `assets/` path into something a browser can load; data URIs pass through. */
    private readonly resolve: (src: string) => string | null = (s) =>
      s.startsWith('data:') ? s : null,
  ) {}

  get(src: string): HTMLImageElement | null {
    const hit = this.images.get(src);
    if (hit === 'failed') return null;
    if (hit) return hit.complete && hit.naturalWidth > 0 ? hit : null;
    const url = this.resolve(src);
    if (url === null) {
      this.images.set(src, 'failed');
      return null;
    }
    const img = new Image();
    this.images.set(src, img);
    img.onload = () => this.onLoaded?.();
    img.onerror = () => this.images.set(src, 'failed');
    img.src = url;
    return null;
  }
}

export interface PaintOptions {
  /** Screen pixels per world unit, used for shadows, level of detail and hairlines. */
  scale: number;
  /** Text under this size on screen is skipped. */
  minTextPx: number;
  images: ImageCache;
}

const pathCache = new WeakMap<object, Path2D>();

function gradient(
  ctx: CanvasRenderingContext2D,
  paint: Extract<NonNullable<OpStyle['fill']>, object>,
) {
  const { box, angle, stops } = paint;
  const a = (angle * Math.PI) / 180;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const half =
    (Math.abs(Math.cos(a)) * box.w + Math.abs(Math.sin(a)) * box.h) / 2;
  const g = ctx.createLinearGradient(
    cx - Math.cos(a) * half,
    cy - Math.sin(a) * half,
    cx + Math.cos(a) * half,
    cy + Math.sin(a) * half,
  );
  for (const s of stops)
    g.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
  return g;
}

/** Fills and strokes the current path with a part's style. */
function paintPath(
  ctx: CanvasRenderingContext2D,
  style: OpStyle,
  o: PaintOptions,
  path?: Path2D,
): void {
  ctx.globalAlpha = style.opacity;
  if (style.shadow) {
    ctx.shadowColor = style.shadow.color ?? 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = (style.shadow.blur ?? 4) * o.scale;
    ctx.shadowOffsetX = (style.shadow.x ?? 0) * o.scale;
    ctx.shadowOffsetY = (style.shadow.y ?? 2) * o.scale;
  }
  if (style.fill !== null) {
    ctx.fillStyle =
      typeof style.fill === 'string' ? style.fill : gradient(ctx, style.fill);
    if (path) ctx.fill(path);
    else ctx.fill();
  }
  if (style.shadow && style.fill !== null) {
    // A shadow under the stroke as well would double it.
    ctx.shadowColor = 'transparent';
  }
  if (style.stroke !== null && style.strokeWidth > 0) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.setLineDash(style.dash ?? []);
    if (path) ctx.stroke(path);
    else ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1;
}

function fit(
  box: { x: number; y: number; w: number; h: number },
  img: HTMLImageElement,
  mode: 'contain' | 'cover' | 'stretch',
) {
  if (mode === 'stretch')
    return {
      ...box,
      sx: 0,
      sy: 0,
      sw: img.naturalWidth,
      sh: img.naturalHeight,
    };
  const k = (mode === 'contain' ? Math.min : Math.max)(
    box.w / img.naturalWidth,
    box.h / img.naturalHeight,
  );
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
    sx: 0,
    sy: 0,
    sw: img.naturalWidth,
    sh: img.naturalHeight,
  };
}

/**
 * Replays a compiled draw list. The context must already be translated to the element's origin.
 * Returns how many text lines were drawn.
 */
export function paintOps(
  ctx: CanvasRenderingContext2D,
  ops: readonly DrawOp[],
  o: PaintOptions,
): number {
  let lines = 0;
  let depth = 0;
  for (const op of ops) {
    switch (op.op) {
      case 'save':
        ctx.save();
        depth++;
        break;
      case 'restore':
        if (depth > 0) {
          ctx.restore();
          depth--;
        }
        break;
      case 'transform':
        ctx.transform(...op.matrix);
        break;
      case 'clip': {
        ctx.beginPath();
        if (op.kind === 'ellipse')
          ctx.ellipse(
            op.box.x + op.box.w / 2,
            op.box.y + op.box.h / 2,
            op.box.w / 2,
            op.box.h / 2,
            0,
            0,
            Math.PI * 2,
          );
        else if (op.radius > 0)
          ctx.roundRect(op.box.x, op.box.y, op.box.w, op.box.h, op.radius);
        else ctx.rect(op.box.x, op.box.y, op.box.w, op.box.h);
        ctx.clip();
        break;
      }
      case 'rect':
        ctx.beginPath();
        if (op.radius > 0)
          ctx.roundRect(
            op.box.x,
            op.box.y,
            op.box.w,
            op.box.h,
            Math.min(op.radius, op.box.w / 2, op.box.h / 2),
          );
        else ctx.rect(op.box.x, op.box.y, op.box.w, op.box.h);
        paintPath(ctx, op.style, o);
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(
          op.box.x + op.box.w / 2,
          op.box.y + op.box.h / 2,
          op.box.w / 2,
          op.box.h / 2,
          0,
          0,
          Math.PI * 2,
        );
        paintPath(ctx, op.style, o);
        break;
      case 'polygon': {
        ctx.beginPath();
        op.points.forEach(([x, y], i) =>
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
        );
        ctx.closePath();
        paintPath(ctx, op.style, o);
        break;
      }
      case 'path': {
        let path = pathCache.get(op);
        if (!path) {
          path = new Path2D(op.d);
          pathCache.set(op, path);
        }
        ctx.save();
        ctx.translate(op.box.x, op.box.y);
        const vb = op.viewBox;
        if (vb) {
          const kx = op.box.w / vb[2];
          const ky = op.box.h / vb[3];
          ctx.scale(kx, ky);
          ctx.translate(-vb[0], -vb[1]);
          const k = (kx + ky) / 2 || 1;
          paintPath(
            ctx,
            { ...op.style, strokeWidth: op.style.strokeWidth / k },
            o,
            path,
          );
        } else paintPath(ctx, op.style, o, path);
        ctx.restore();
        break;
      }
      case 'text': {
        if (op.font.size * o.scale < o.minTextPx) break;
        ctx.font = `${op.font.style} ${op.font.weight} ${op.font.size}px ${op.font.family}`;
        ctx.fillStyle = op.font.color;
        ctx.textAlign = op.align;
        ctx.textBaseline = 'middle';
        for (const line of op.lines) {
          ctx.fillText(line.text, line.x, line.y);
          lines++;
        }
        break;
      }
      case 'image': {
        const img = o.images.get(op.src);
        if (!img) break;
        const r = fit(op.box, img, op.fit);
        ctx.globalAlpha = op.opacity;
        ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
  while (depth-- > 0) ctx.restore();
  return lines;
}

/** Adds an outline to the current path, for the cheap batched drawing of tiny elements. */
export function traceOutline(
  ctx: CanvasRenderingContext2D,
  outline: OutlineKind,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  switch (outline.kind) {
    case 'rect':
      ctx.rect(x, y, w, h);
      break;
    case 'ellipse':
      ctx.moveTo(x + w, y + h / 2);
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'polygon':
      outline.points.forEach(([px, py], i) =>
        i === 0 ? ctx.moveTo(x + px, y + py) : ctx.lineTo(x + px, y + py),
      );
      ctx.closePath();
      break;
  }
}

/** A polyline as a path, with rounded corners or smoothed curves when the line shape asks for them. */
export function tracePolyline(
  ctx: CanvasRenderingContext2D,
  route: readonly Point[],
  look: Pick<CompiledRelation['line'], 'routing' | 'corners'>,
): void {
  const first = route[0]!;
  ctx.moveTo(first.x, first.y);
  if (route.length < 3 || (look.routing !== 'curved' && look.corners <= 0)) {
    for (let i = 1; i < route.length; i++) ctx.lineTo(route[i]!.x, route[i]!.y);
    return;
  }
  if (look.routing === 'curved') {
    for (let i = 1; i < route.length - 1; i++) {
      const p = route[i]!;
      const n = route[i + 1]!;
      ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
    }
    const last = route[route.length - 1]!;
    ctx.lineTo(last.x, last.y);
    return;
  }
  for (let i = 1; i < route.length - 1; i++) {
    const p = route[i]!;
    const n = route[i + 1]!;
    ctx.arcTo(p.x, p.y, n.x, n.y, look.corners);
  }
  const last = route[route.length - 1]!;
  ctx.lineTo(last.x, last.y);
}

/** The point at a share of the route's length, and the direction there. */
export function pointAlong(
  route: readonly Point[],
  share: number,
): { x: number; y: number; angle: number } {
  let total = 0;
  for (let i = 1; i < route.length; i++)
    total += Math.hypot(
      route[i]!.x - route[i - 1]!.x,
      route[i]!.y - route[i - 1]!.y,
    );
  let want = total * share;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= len || i === route.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, want / len);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    want -= len;
  }
  return { x: first(route).x, y: first(route).y, angle: 0 };
}

const first = (route: readonly Point[]) => route[0]!;

/** Draws a marker with its tip at `tip`, pointing along `angle` (the direction the line travels towards the tip). */
export function drawMarker(
  ctx: CanvasRenderingContext2D,
  type: string,
  fill: string,
  size: number,
  tip: Point,
  angle: number,
): void {
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);
  ctx.beginPath();
  switch (type) {
    case 'arrow':
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size / 2);
      ctx.lineTo(-size, size / 2);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      break;
    case 'open-arrow':
      ctx.moveTo(-size, -size / 2);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size / 2);
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
    case 'triangle':
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size / 2);
      ctx.lineTo(-size, size / 2);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
    case 'diamond':
      ctx.moveTo(0, 0);
      ctx.lineTo(-size / 2, -size / 3);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size / 2, size / 3);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      break;
    case 'circle':
      ctx.arc(-size / 2, 0, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
    case 'cross':
      ctx.moveTo(-size, -size / 2);
      ctx.lineTo(0, size / 2);
      ctx.moveTo(-size, size / 2);
      ctx.lineTo(0, -size / 2);
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
    case 'bar':
      ctx.moveTo(-size / 3, -size / 2);
      ctx.lineTo(-size / 3, size / 2);
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Draws the labels of a relation shape along a route. */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  route: readonly Point[],
  look: CompiledRelation,
  scale: number,
  minTextPx: number,
): void {
  for (const label of look.labels) {
    if (label.font.size * scale < minTextPx) continue;
    const share = label.at === 'start' ? 0.08 : label.at === 'end' ? 0.92 : 0.5;
    const p = pointAlong(route, share);
    const x = p.x + label.offset.x;
    const y = p.y + label.offset.y;
    ctx.font = `${label.font.style} ${label.font.weight} ${label.font.size}px ${label.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (label.background) {
      const w = ctx.measureText(label.text).width + 6;
      ctx.fillStyle = label.background;
      ctx.fillRect(
        x - w / 2,
        y - label.font.size * 0.7,
        w,
        label.font.size * 1.4,
      );
    }
    ctx.fillStyle = label.font.color;
    ctx.fillText(label.text, x, y);
  }
}

/** The end of a route and the direction the line arrives there (or, for the start, leaves backwards). */
export function endpoint(
  route: readonly Point[],
  which: 'start' | 'end',
): (Point & { angle: number }) | null {
  if (route.length < 2) return null;
  const tip = which === 'end' ? route[route.length - 1]! : route[0]!;
  const step = which === 'end' ? -1 : 1;
  let i = which === 'end' ? route.length - 2 : 1;
  let from = route[i]!;
  while (i >= 0 && i < route.length && from.x === tip.x && from.y === tip.y) {
    i += step;
    from = route[i] ?? from;
    if (i < 0 || i >= route.length) break;
  }
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  if (dx === 0 && dy === 0) return null;
  return { x: tip.x, y: tip.y, angle: Math.atan2(dy, dx) };
}
