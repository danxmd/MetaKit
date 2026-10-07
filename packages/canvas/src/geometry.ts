export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function rectOf(x: number, y: number, w: number, h: number): Rect {
  return { minX: x, minY: y, maxX: x + w, maxY: y + h };
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  );
}

export function contains(outer: Rect, inner: Rect): boolean {
  return (
    outer.minX <= inner.minX &&
    outer.maxX >= inner.maxX &&
    outer.minY <= inner.minY &&
    outer.maxY >= inner.maxY
  );
}

export function containsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

export function union(a: Rect, b: Rect): Rect {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function inflate(r: Rect, by: number): Rect {
  return {
    minX: r.minX - by,
    minY: r.minY - by,
    maxX: r.maxX + by,
    maxY: r.maxY + by,
  };
}

export function boundsOf(points: readonly Point[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Distance from a point to the segment a-b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** Distance from a point to the nearest segment of a polyline. */
export function distanceToPolyline(p: Point, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const d = distanceToSegment(p, line[i]!, line[i + 1]!);
    if (d < best) best = d;
  }
  return best;
}

/** Index of the polyline segment nearest to a point (segment i runs from point i to i + 1). */
export function nearestSegment(p: Point, line: readonly Point[]): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const d = distanceToSegment(p, line[i]!, line[i + 1]!);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}
