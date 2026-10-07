import type { Rect } from '../geometry';

export type AlignMode =
  'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface Placed {
  id: string;
  rect: Rect;
}

export interface Move {
  id: string;
  x: number;
  y: number;
}

/** New top-left corners that line the items up. Only items that actually move are returned. */
export function align(items: readonly Placed[], mode: AlignMode): Move[] {
  if (items.length < 2) return [];
  const minX = Math.min(...items.map((i) => i.rect.minX));
  const maxX = Math.max(...items.map((i) => i.rect.maxX));
  const minY = Math.min(...items.map((i) => i.rect.minY));
  const maxY = Math.max(...items.map((i) => i.rect.maxY));
  const moves: Move[] = [];
  for (const { id, rect } of items) {
    const w = rect.maxX - rect.minX;
    const h = rect.maxY - rect.minY;
    let x = rect.minX;
    let y = rect.minY;
    if (mode === 'left') x = minX;
    else if (mode === 'right') x = maxX - w;
    else if (mode === 'centre') x = (minX + maxX) / 2 - w / 2;
    else if (mode === 'top') y = minY;
    else if (mode === 'bottom') y = maxY - h;
    else y = (minY + maxY) / 2 - h / 2;
    if (x !== rect.minX || y !== rect.minY) moves.push({ id, x, y });
  }
  return moves;
}

/**
 * Spreads the items so that the gaps between neighbours are equal. The outermost items stay where
 * they are. Needs three items or more.
 */
export function distribute(
  items: readonly Placed[],
  axis: DistributeAxis,
): Move[] {
  if (items.length < 3) return [];
  const horizontal = axis === 'horizontal';
  const lo = (r: Rect) => (horizontal ? r.minX : r.minY);
  const hi = (r: Rect) => (horizontal ? r.maxX : r.maxY);
  const sorted = [...items].sort(
    (a, b) => lo(a.rect) - lo(b.rect) || (a.id < b.id ? -1 : 1),
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const total = hi(last.rect) - lo(first.rect);
  const sizes = sorted.reduce((sum, i) => sum + (hi(i.rect) - lo(i.rect)), 0);
  // Items that overlap too much to leave a gap are placed edge to edge.
  const gap = Math.max(0, (total - sizes) / (sorted.length - 1));
  const moves: Move[] = [];
  let cursor = lo(first.rect) + (hi(first.rect) - lo(first.rect)) + gap;
  for (const item of sorted.slice(1, -1)) {
    const size = hi(item.rect) - lo(item.rect);
    const x = horizontal ? cursor : item.rect.minX;
    const y = horizontal ? item.rect.minY : cursor;
    if (x !== item.rect.minX || y !== item.rect.minY)
      moves.push({ id: item.id, x, y });
    cursor += size + gap;
  }
  return moves;
}
