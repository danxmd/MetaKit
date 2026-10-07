import type { Point, Rect } from './geometry';

/** screen = world * s + offset, in CSS pixels. */
export interface View {
  s: number;
  ox: number;
  oy: number;
}

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 8;

export function worldToScreen(view: View, p: Point): Point {
  return { x: p.x * view.s + view.ox, y: p.y * view.s + view.oy };
}

export function screenToWorld(view: View, p: Point): Point {
  return { x: (p.x - view.ox) / view.s, y: (p.y - view.oy) / view.s };
}

export function visibleRect(view: View, width: number, height: number): Rect {
  return {
    minX: -view.ox / view.s,
    minY: -view.oy / view.s,
    maxX: (width - view.ox) / view.s,
    maxY: (height - view.oy) / view.s,
  };
}

export function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Zooms by `factor` keeping the world point under `anchor` (screen) fixed. */
export function zoomAt(view: View, anchor: Point, factor: number): View {
  const s = clampScale(view.s * factor);
  const k = s / view.s;
  return {
    s,
    ox: anchor.x - (anchor.x - view.ox) * k,
    oy: anchor.y - (anchor.y - view.oy) * k,
  };
}

/** A view that shows `rect` centred with a margin, never zoomed in past 100 %. */
export function fitRect(
  rect: Rect,
  width: number,
  height: number,
  margin = 40,
): View {
  const w = Math.max(1, rect.maxX - rect.minX);
  const h = Math.max(1, rect.maxY - rect.minY);
  const s = clampScale(
    Math.min(
      1,
      Math.max(1, width - 2 * margin) / w,
      Math.max(1, height - 2 * margin) / h,
    ),
  );
  return {
    s,
    ox: (width - w * s) / 2 - rect.minX * s,
    oy: (height - h * s) / 2 - rect.minY * s,
  };
}

/** A view that keeps the scale and puts the world point `p` in the middle of the screen. */
export function centreOn(
  view: View,
  p: Point,
  width: number,
  height: number,
): View {
  return {
    s: view.s,
    ox: width / 2 - p.x * view.s,
    oy: height / 2 - p.y * view.s,
  };
}
