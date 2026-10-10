import type { Placement } from './tours';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placed {
  x: number;
  y: number;
  /** The side used, or null when the pop-up is centred (no control to point at). */
  side: Placement | null;
}

/** Space between the control and the pop-up, and between the pop-up and the window's edge. */
export const GAP = 12;

const SIDES: readonly Placement[] = ['right', 'left', 'bottom', 'top'];

function room(target: Box, viewport: Size): Record<Placement, number> {
  return {
    right: viewport.width - (target.x + target.width),
    left: target.x,
    bottom: viewport.height - (target.y + target.height),
    top: target.y,
  };
}

function fits(
  side: Placement,
  space: Record<Placement, number>,
  popup: Size,
): boolean {
  const needed =
    side === 'left' || side === 'right' ? popup.width : popup.height;
  return space[side] >= needed + 2 * GAP;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

/**
 * Where the pop-up goes: on the preferred side if it fits there, otherwise on the side with the
 * most room, and always inside the window.
 */
export function placePopup(
  target: Box | null,
  popup: Size,
  viewport: Size,
  preferred?: Placement,
): Placed {
  const maxX = viewport.width - popup.width - GAP;
  const maxY = viewport.height - popup.height - GAP;
  if (!target) {
    return {
      x: clamp((viewport.width - popup.width) / 2, GAP, maxX),
      y: clamp((viewport.height - popup.height) / 2, GAP, maxY),
      side: null,
    };
  }
  const space = room(target, viewport);
  let side: Placement;
  if (preferred && fits(preferred, space, popup)) side = preferred;
  else {
    const fitting = SIDES.filter((s) => fits(s, space, popup));
    // Of the sides that fit, the one with the most room; if none fits, still the roomiest.
    const pool = fitting.length > 0 ? fitting : SIDES;
    side = pool.reduce((best, s) => (space[s] > space[best] ? s : best));
  }
  const centreX = target.x + target.width / 2 - popup.width / 2;
  const centreY = target.y + target.height / 2 - popup.height / 2;
  let x: number;
  let y: number;
  if (side === 'right') {
    x = target.x + target.width + GAP;
    y = centreY;
  } else if (side === 'left') {
    x = target.x - GAP - popup.width;
    y = centreY;
  } else if (side === 'bottom') {
    x = centreX;
    y = target.y + target.height + GAP;
  } else {
    x = centreX;
    y = target.y - GAP - popup.height;
  }
  return { x: clamp(x, GAP, maxX), y: clamp(y, GAP, maxY), side };
}
