import { describe, expect, it } from 'vitest';
import { GAP, placePopup, type Box } from './placement';

const viewport = { width: 1200, height: 800 };
const popup = { width: 300, height: 160 };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

describe('placePopup', () => {
  it('uses the preferred side when it fits', () => {
    const target = { x: 500, y: 300, width: 100, height: 40 };
    const placed = placePopup(target, popup, viewport, 'bottom');
    expect(placed.side).toBe('bottom');
    expect(placed.y).toBe(target.y + target.height + GAP);
    expect(overlaps({ ...placed, ...popup }, target)).toBe(false);
  });

  it('picks the side with the most room when the preferred one does not fit', () => {
    // A button at the right end of the top bar: neither right nor top has room; left has most.
    const target = { x: 1100, y: 8, width: 80, height: 32 };
    const placed = placePopup(target, popup, viewport, 'right');
    expect(placed.side).toBe('left');
    expect(overlaps({ ...placed, ...popup }, target)).toBe(false);
    expect(placed.x + popup.width).toBeLessThanOrEqual(viewport.width - GAP);
  });

  it('chooses a side when none is preferred', () => {
    const target = { x: 10, y: 300, width: 200, height: 60 };
    expect(placePopup(target, popup, viewport).side).toBe('right');
  });

  it('stays inside the window even when nothing fits', () => {
    const target = { x: 0, y: 0, width: 1200, height: 800 };
    const placed = placePopup(target, popup, viewport, 'left');
    expect(placed.x).toBeGreaterThanOrEqual(GAP);
    expect(placed.y).toBeGreaterThanOrEqual(GAP);
    expect(placed.x + popup.width).toBeLessThanOrEqual(viewport.width - GAP);
    expect(placed.y + popup.height).toBeLessThanOrEqual(viewport.height - GAP);
  });

  it('centres the pop-up when there is no control', () => {
    expect(placePopup(null, popup, viewport)).toEqual({
      x: 450,
      y: 320,
      side: null,
    });
  });
});
