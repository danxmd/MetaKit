import { describe, expect, it } from 'vitest';
import { pdfLayout } from './pdf';

const base = { orientation: 'portrait', fitToPage: false, margin: 36 } as const;

describe('pdfLayout', () => {
  it('makes one page the size of the drawing for "fit"', () => {
    const l = pdfLayout(400, 200, { ...base, pageSize: 'fit' });
    expect(l.pages).toHaveLength(1);
    expect(l.page.width).toBeCloseTo(300 + 72);
    expect(l.page.height).toBeCloseTo(150 + 72);
  });

  it('keeps real size and spreads over pages when not fitting', () => {
    // 2000 x 1200 px is 1500 x 900 pt; A4 portrait prints 523 x 770 pt.
    const l = pdfLayout(2000, 1200, { ...base, pageSize: 'a4' });
    expect(l.scale).toBe(0.75);
    expect(l.pages).toHaveLength(3 * 2);
    expect(l.pages[0]).toEqual({ x: 36, y: 36 });
  });

  it('fits a large drawing on one centred page', () => {
    const l = pdfLayout(2000, 1000, {
      ...base,
      pageSize: 'a4',
      fitToPage: true,
      orientation: 'auto',
    });
    expect(l.pages).toHaveLength(1);
    // Auto picks landscape for a wide drawing.
    expect(l.page.width).toBeGreaterThan(l.page.height);
    expect(2000 * l.scale).toBeLessThanOrEqual(l.page.width - 72 + 1e-6);
  });

  it('swaps the page for landscape', () => {
    const l = pdfLayout(10, 10, {
      ...base,
      pageSize: 'letter',
      orientation: 'landscape',
    });
    expect(l.page).toEqual({ width: 792, height: 612 });
  });
});
