import type { Rect } from '../geometry';

export interface SnapResult {
  dx: number;
  dy: number;
  guides: { x: number[]; y: number[] };
}

export interface SnapOptions {
  /** Snap to the grid when no other element is close enough; 0 or less turns the grid off. */
  grid: number;
  /** Distance in world units within which edges and centres attract. */
  threshold: number;
}

function xs(r: Rect): number[] {
  return [r.minX, (r.minX + r.maxX) / 2, r.maxX];
}
function ys(r: Rect): number[] {
  return [r.minY, (r.minY + r.maxY) / 2, r.maxY];
}

function best(
  mine: number[],
  others: number[],
  threshold: number,
): { delta: number; at: number } | null {
  let result: { delta: number; at: number } | null = null;
  for (const m of mine)
    for (const o of others) {
      const d = o - m;
      if (
        Math.abs(d) <= threshold &&
        (!result || Math.abs(d) < Math.abs(result.delta))
      )
        result = { delta: d, at: o };
    }
  return result;
}

/**
 * How far to nudge a rectangle that is being moved so that it lines up with the edges or centres
 * of nearby rectangles, or else with the grid. Each axis snaps on its own. Guides are the world
 * coordinates of the lines that were matched.
 */
export function snapMove(
  moving: Rect,
  candidates: readonly Rect[],
  options: SnapOptions,
): SnapResult {
  const otherX = candidates.flatMap(xs);
  const otherY = candidates.flatMap(ys);
  const sx = best(xs(moving), otherX, options.threshold);
  const sy = best(ys(moving), otherY, options.threshold);
  let dx = 0;
  let dy = 0;
  const guides = { x: [] as number[], y: [] as number[] };
  if (sx) {
    dx = sx.delta;
    guides.x.push(sx.at);
  } else if (options.grid > 0) {
    dx = Math.round(moving.minX / options.grid) * options.grid - moving.minX;
  }
  if (sy) {
    dy = sy.delta;
    guides.y.push(sy.at);
  } else if (options.grid > 0) {
    dy = Math.round(moving.minY / options.grid) * options.grid - moving.minY;
  }
  return { dx, dy, guides };
}

/** Rounds a value to the grid; a grid of 0 or less leaves it alone. */
export function snapValue(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}
