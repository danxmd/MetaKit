import { describe, expect, it } from 'vitest';
import {
  contains,
  distanceToPolyline,
  distanceToSegment,
  intersects,
  nearestSegment,
  union,
} from './geometry';
import { arrowHead, edgePoint, routeConnector } from './route';
import {
  centreOn,
  fitRect,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from './view';

describe('geometry', () => {
  it('intersects, contains and unions rectangles', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
    expect(intersects(a, b)).toBe(true);
    expect(intersects(a, { minX: 11, minY: 0, maxX: 20, maxY: 5 })).toBe(false);
    expect(contains(a, { minX: 1, minY: 1, maxX: 9, maxY: 9 })).toBe(true);
    expect(contains(a, b)).toBe(false);
    expect(union(a, b)).toEqual({ minX: 0, minY: 0, maxX: 15, maxY: 15 });
  });

  it('measures distance to segments and polylines', () => {
    expect(
      distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(3);
    expect(
      distanceToSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(5);
    expect(
      distanceToSegment({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 }),
    ).toBeCloseTo(Math.SQRT2);
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(distanceToPolyline({ x: 12, y: 5 }, line)).toBe(2);
    expect(nearestSegment({ x: 12, y: 5 }, line)).toBe(1);
  });
});

describe('route', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 };
  const b = { x: 300, y: 0, w: 100, h: 50 };

  it('leaves each box by the facing edge', () => {
    const r = routeConnector(a, b, []);
    expect(r[0]).toEqual({ x: 100, y: 25 });
    expect(r[r.length - 1]).toEqual({ x: 300, y: 25 });
    for (let i = 1; i < r.length; i++)
      expect(r[i]!.x === r[i - 1]!.x || r[i]!.y === r[i - 1]!.y).toBe(true);
  });

  it('goes through bend points as given', () => {
    const r = routeConnector(a, b, [{ x: 200, y: 200 }]);
    expect(r).toHaveLength(3);
    expect(r[1]).toEqual({ x: 200, y: 200 });
    expect(r[0]!.y).toBeGreaterThan(25);
  });

  it('finds the edge point towards a target, and handles a target at the centre', () => {
    expect(edgePoint(a, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(edgePoint(a, { x: 50, y: 25 })).toEqual({ x: 50, y: 25 });
  });

  it('puts the arrow tip at the end of the route', () => {
    const head = arrowHead(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      10,
    )!;
    expect(head[0]).toEqual({ x: 100, y: 0 });
    expect(head[1]!.x).toBe(90);
    expect(
      arrowHead(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        10,
      ),
    ).toBeNull();
  });
});

describe('view', () => {
  it('converts both ways and zooms about a point', () => {
    const view = { s: 2, ox: 10, oy: 20 };
    const p = { x: 7, y: 9 };
    expect(screenToWorld(view, worldToScreen(view, p))).toEqual(p);
    const zoomed = zoomAt(view, { x: 100, y: 100 }, 1.5);
    const before = screenToWorld(view, { x: 100, y: 100 });
    const after = screenToWorld(zoomed, { x: 100, y: 100 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('fits and centres', () => {
    const v = fitRect({ minX: 0, minY: 0, maxX: 2000, maxY: 1000 }, 1000, 600);
    expect(v.s).toBeLessThan(1);
    const c = centreOn({ s: 1, ox: 0, oy: 0 }, { x: 500, y: 300 }, 1000, 600);
    expect(c).toEqual({ s: 1, ox: 0, oy: 0 });
  });
});
