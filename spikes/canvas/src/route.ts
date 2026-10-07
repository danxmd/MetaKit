import type { NodeItem } from './model';

/** Points per orthogonal connector: start, two bends, end. */
export const ROUTE_POINTS = 4;
export const ROUTE_FLOATS = ROUTE_POINTS * 2;

/**
 * Three-segment orthogonal route between two nodes, attached to the facing edges.
 * Real routing arrives with the shape compiler; this has the same segment count and length
 * profile, which is what the renderer cost depends on.
 */
export function routeBetween(
  a: NodeItem,
  b: NodeItem,
  out: Float64Array,
  offset = 0,
): void {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) * a.h >= Math.abs(dy) * a.w) {
    const sx = ax + Math.sign(dx || 1) * (a.w / 2);
    const ex = bx - Math.sign(dx || 1) * (b.w / 2);
    const mx = (sx + ex) / 2;
    out.set([sx, ay, mx, ay, mx, by, ex, by], offset);
  } else {
    const sy = ay + Math.sign(dy || 1) * (a.h / 2);
    const ey = by - Math.sign(dy || 1) * (b.h / 2);
    const my = (sy + ey) / 2;
    out.set([ax, sy, ax, my, bx, my, bx, ey], offset);
  }
}

export function routeBounds(
  routes: Float64Array,
  offset: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let p = 0; p < ROUTE_POINTS; p++) {
    const x = routes[offset + p * 2]!;
    const y = routes[offset + p * 2 + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Distance from a point to the nearest segment of a route. */
export function distanceToRoute(
  routes: Float64Array,
  offset: number,
  px: number,
  py: number,
): number {
  let best = Infinity;
  for (let p = 0; p < ROUTE_POINTS - 1; p++) {
    const x1 = routes[offset + p * 2]!;
    const y1 = routes[offset + p * 2 + 1]!;
    const x2 = routes[offset + p * 2 + 2]!;
    const y2 = routes[offset + p * 2 + 3]!;
    const vx = x2 - x1;
    const vy = y2 - y1;
    const len2 = vx * vx + vy * vy;
    const t =
      len2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
    const d = Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
    if (d < best) best = d;
  }
  return best;
}
