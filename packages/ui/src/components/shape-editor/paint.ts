import { paintOps, type ImageCache } from '@metakit-app/canvas';
import type { Compiled } from '@metakit-app/shapes';

export interface PaintParams {
  compiled: Compiled;
  /** Size of the drawing in CSS pixels; the canvas is made this big. */
  width: number;
  height: number;
  /** Draws the compiled list this many times larger than it is. */
  zoom?: number;
  images: ImageCache;
}

/**
 * A Svelte action that draws a compiled shape on a canvas at the screen's pixel density and
 * redraws whenever the parameters change.
 */
export function paintCompiled(node: HTMLCanvasElement, initial: PaintParams) {
  let params = initial;
  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = params;
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    if (node.width !== pw) node.width = pw;
    if (node.height !== ph) node.height = ph;
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    const ctx = node.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const zoom = params.zoom ?? 1;
    ctx.save();
    ctx.scale(zoom, zoom);
    paintOps(ctx, params.compiled.ops, {
      scale: zoom * dpr,
      minTextPx: 0,
      images: params.images,
    });
    ctx.restore();
  };
  draw();
  return {
    update(next: PaintParams) {
      params = next;
      draw();
    },
  };
}
