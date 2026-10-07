import type { Point, Rect } from './geometry';

export type HandleName = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

export const HANDLE_NAMES: readonly HandleName[] = [
  'nw',
  'n',
  'ne',
  'w',
  'e',
  'sw',
  's',
  'se',
];

/** Handle size on screen, in CSS pixels. */
export const HANDLE_PX = 8;

export function handlePoint(r: Rect, name: HandleName): Point {
  const cx = (r.minX + r.maxX) / 2;
  const cy = (r.minY + r.maxY) / 2;
  switch (name) {
    case 'nw':
      return { x: r.minX, y: r.minY };
    case 'n':
      return { x: cx, y: r.minY };
    case 'ne':
      return { x: r.maxX, y: r.minY };
    case 'w':
      return { x: r.minX, y: cy };
    case 'e':
      return { x: r.maxX, y: cy };
    case 'sw':
      return { x: r.minX, y: r.maxY };
    case 's':
      return { x: cx, y: r.maxY };
    case 'se':
      return { x: r.maxX, y: r.maxY };
  }
}

/** The handle under a world point, given the current scale (handles keep their screen size). */
export function hitHandle(r: Rect, p: Point, scale: number): HandleName | null {
  const reach = (HANDLE_PX / 2 + 2) / scale;
  for (const name of HANDLE_NAMES) {
    const h = handlePoint(r, name);
    if (Math.abs(h.x - p.x) <= reach && Math.abs(h.y - p.y) <= reach)
      return name;
  }
  return null;
}

/** The rectangle after dragging handle `name` by (dx, dy), never smaller than `min`. */
export function resizeRect(
  r: Rect,
  name: HandleName,
  dx: number,
  dy: number,
  min: number,
): Rect {
  let { minX, minY, maxX, maxY } = r;
  if (name.includes('w')) minX = Math.min(minX + dx, maxX - min);
  if (name.includes('e')) maxX = Math.max(maxX + dx, minX + min);
  if (name.includes('n')) minY = Math.min(minY + dy, maxY - min);
  if (name.includes('s')) maxY = Math.max(maxY + dy, minY + min);
  return { minX, minY, maxX, maxY };
}

export const CURSORS: Record<HandleName, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  w: 'ew-resize',
  e: 'ew-resize',
};
