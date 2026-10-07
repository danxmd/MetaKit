import { boundsOf, type Point, type Rect } from './geometry';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const centre = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** The point where the line from the box centre towards `target` leaves the box. */
export function edgePoint(box: Box, target: Point): Point {
  const c = centre(box);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const kx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
  const ky = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
  const k = Math.min(kx, ky);
  return { x: c.x + dx * k, y: c.y + dy * k };
}

/**
 * The route of a connector. With bend points it runs from the first box towards the first bend,
 * through the bends as given, and into the second box. Without bend points it is a three-segment
 * orthogonal route between the facing edges. Routing runs when an item changes, not every frame.
 */
export function routeConnector(
  a: Box,
  b: Box,
  bends: readonly Point[],
  routing: 'straight' | 'orthogonal' | 'curved' = 'orthogonal',
): Point[] {
  if (bends.length > 0) {
    return [
      edgePoint(a, bends[0]!),
      ...bends,
      edgePoint(b, bends[bends.length - 1]!),
    ];
  }
  const ca = centre(a);
  const cb = centre(b);
  if (routing === 'straight') return [edgePoint(a, cb), edgePoint(b, ca)];
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  if (Math.abs(dx) * a.h >= Math.abs(dy) * a.w) {
    const dir = Math.sign(dx || 1);
    const sx = ca.x + dir * (a.w / 2);
    const ex = cb.x - dir * (b.w / 2);
    const mx = (sx + ex) / 2;
    return [
      { x: sx, y: ca.y },
      { x: mx, y: ca.y },
      { x: mx, y: cb.y },
      { x: ex, y: cb.y },
    ];
  }
  const dir = Math.sign(dy || 1);
  const sy = ca.y + dir * (a.h / 2);
  const ey = cb.y - dir * (b.h / 2);
  const my = (sy + ey) / 2;
  return [
    { x: ca.x, y: sy },
    { x: ca.x, y: my },
    { x: cb.x, y: my },
    { x: cb.x, y: ey },
  ];
}

export function routeBounds(route: readonly Point[]): Rect {
  return boundsOf(route);
}

/** The two barbs of an arrow head at the end of a polyline, or null for a degenerate line. */
export function arrowHead(
  route: readonly Point[],
  size: number,
): [Point, Point, Point] | null {
  if (route.length < 2) return null;
  const tip = route[route.length - 1]!;
  let from = route[route.length - 2]!;
  for (
    let i = route.length - 2;
    i >= 0 && from.x === tip.x && from.y === tip.y;
    i--
  ) {
    from = route[i]!;
  }
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const back = { x: tip.x - ux * size, y: tip.y - uy * size };
  return [
    tip,
    { x: back.x - uy * size * 0.5, y: back.y + ux * size * 0.5 },
    { x: back.x + uy * size * 0.5, y: back.y - ux * size * 0.5 },
  ];
}
