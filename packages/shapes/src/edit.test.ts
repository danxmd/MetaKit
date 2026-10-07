import type { NodeShape, Part } from '@metakit-app/core';
import { describe, expect, it } from 'vitest';
import {
  addPart,
  defaultPart,
  describePart,
  duplicatePart,
  getPart,
  groupParts,
  hitTestParts,
  movePart,
  removePart,
  reorderPart,
  resizePart,
  resolvePartBoxes,
  setLet,
  setPartProp,
  shiftDim,
  switchToFixed,
  switchToFormula,
  ungroupPart,
} from './edit';

const base = (parts: Part[] = []): NodeShape => ({
  id: 'shp_edit',
  kind: 'node',
  size: { width: 140, height: 70 },
  parts,
});

const rect = (extra: Partial<Part> = {}): Part =>
  ({
    type: 'rect',
    x: 0,
    y: 0,
    width: 20,
    height: 10,
    ...extra,
  }) as Part;

describe('shiftDim', () => {
  it.each([
    [10, 5, 15],
    ['100% - 22', 5, '100% - 17'],
    ['100% - 22', 22, '100%'],
    ['50% + 4', -4, '50%'],
    ['50%', 3, '50% + 3'],
    ['12', 3, 15],
    ['= Wide', 5, '= Wide'],
    ['wide', 5, 'wide'],
  ])('%s moved by %s gives %s', (dim, delta, expected) => {
    expect(shiftDim(dim, delta, 0)).toBe(expected);
  });

  it('uses the fallback for a missing size', () => {
    expect(shiftDim(undefined, -10, '100%')).toBe('100% - 10');
    expect(shiftDim(undefined, 4, 0)).toBe(4);
  });
});

describe('adding and removing', () => {
  it('adds parts to the front and returns their path', () => {
    const a = addPart(base(), defaultPart('rect'));
    const b = addPart(a.shape, defaultPart('text'));
    expect(b.path).toEqual([1]);
    expect(b.shape.parts.map((p) => p.type)).toEqual(['rect', 'text']);
  });

  it('does not change the shape it was given', () => {
    const s = base([rect()]);
    const before = JSON.stringify(s);
    addPart(s, rect());
    removePart(s, [0]);
    movePart(s, [0], 5, 5);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('adds into a group at an index and removes parts', () => {
    const s = base([
      { type: 'group', parts: [rect({ x: 1 }), rect({ x: 2 })] },
    ]);
    const r = addPart(s, rect({ x: 9 }), [0], 1);
    expect(r.path).toEqual([0, 1]);
    expect((getPart(r.shape, [0, 1]) as { x: number }).x).toBe(9);
    const removed = removePart(r.shape, [0, 0]);
    expect((removed.parts[0] as { parts: Part[] }).parts).toHaveLength(2);
  });

  it('ignores a path that does not exist', () => {
    const s = base([rect()]);
    expect(removePart(s, [4])).toBe(s);
    expect(removePart(s, [0, 0])).toBe(s);
    expect(addPart(s, rect(), [3]).shape).toBe(s);
    expect(movePart(s, [5], 1, 1)).toBe(s);
  });

  it('has a default for each part type that compiles to a box', () => {
    for (const t of ['rect', 'ellipse', 'polygon', 'text', 'image'] as const)
      expect(defaultPart(t).type).toBe(t);
    expect(describePart(defaultPart('text'))).toBe('Text: Text');
  });
});

describe('moving and resizing', () => {
  it('moves fixed numbers', () => {
    const s = movePart(base([rect({ x: 4, y: 6 })]), [0], 3, -2);
    expect(s.parts[0]).toMatchObject({ x: 7, y: 4 });
  });

  it('keeps percentage positions stretching with the shape', () => {
    const s = movePart(base([rect({ x: '100% - 22', y: 4 })]), [0], 5, 0);
    expect(s.parts[0]).toMatchObject({ x: '100% - 17', y: 4 });
  });

  it('leaves formula positions alone', () => {
    const s = movePart(base([rect({ x: '= $width / 2' })]), [0], 5, 5);
    expect(s.parts[0]).toMatchObject({ x: '= $width / 2', y: 5 });
  });

  it('treats a missing size as full and resizes from any side', () => {
    const s = resizePart(base([{ type: 'rect' } as Part]), [0], {
      dw: -10,
      dx: 10,
    });
    expect(s.parts[0]).toMatchObject({ x: 10, width: '100% - 10' });
    const t = resizePart(base([rect()]), [0], { dh: 5, dy: -5 });
    expect(t.parts[0]).toMatchObject({ y: -5, height: 15, width: 20 });
  });

  it('moves a part inside a group', () => {
    const s = base([{ type: 'group', parts: [rect({ x: 1 })] }]);
    expect(getPart(movePart(s, [0, 0], 4, 0), [0, 0])).toMatchObject({ x: 5 });
  });
});

describe('reordering', () => {
  const s = base([rect({ x: 1 }), rect({ x: 2 }), rect({ x: 3 })]);
  const xs = (sh: NodeShape) => sh.parts.map((p) => p.x);

  it('moves one step', () => {
    const up = reorderPart(s, [0], 'up');
    expect(xs(up.shape)).toEqual([2, 1, 3]);
    expect(up.path).toEqual([1]);
    expect(xs(reorderPart(s, [2], 'down').shape)).toEqual([1, 3, 2]);
  });

  it('moves to the ends', () => {
    expect(xs(reorderPart(s, [0], 'top').shape)).toEqual([2, 3, 1]);
    expect(reorderPart(s, [2], 'bottom').path).toEqual([0]);
  });

  it('does nothing at the end of the list', () => {
    const r = reorderPart(s, [2], 'up');
    expect(r.shape).toBe(s);
    expect(r.path).toEqual([2]);
  });
});

describe('grouping', () => {
  it('wraps parts in a group that covers the parent and moves nothing', () => {
    const s = base([rect({ x: 1 }), rect({ x: 2 }), rect({ x: 3 })]);
    const g = groupParts(s, [[2], [0]]);
    expect(g.path).toEqual([0]);
    expect(g.shape.parts).toHaveLength(2);
    const group = g.shape.parts[0]!;
    expect(group).toMatchObject({
      type: 'group',
      width: '100%',
      height: '100%',
    });
    expect((group as { parts: Part[] }).parts.map((p) => p.x)).toEqual([1, 3]);
    const before = resolvePartBoxes(s, 140, 70).map((b) => b.box);
    const after = resolvePartBoxes(g.shape, 140, 70)
      .filter((b) => b.part.type !== 'group')
      .map((b) => b.box);
    expect(after).toEqual([before[0], before[2], before[1]]);
  });

  it('refuses parts with different parents', () => {
    const s = base([rect(), { type: 'group', parts: [rect()] }]);
    expect(groupParts(s, [[0], [1, 0]]).shape).toBe(s);
    expect(groupParts(s, []).shape).toBe(s);
  });

  it('ungroups a full group into its parts in place', () => {
    const s = base([rect({ x: 1 }), rect({ x: 2 }), rect({ x: 3 })]);
    const g = groupParts(s, [[1], [2]]);
    const u = ungroupPart(g.shape, [1]);
    expect(u.shape.parts).toEqual(s.parts);
    expect(u.paths).toEqual([[1], [2]]);
  });

  it('ungroups a smaller group without moving its parts', () => {
    const s = base([
      {
        type: 'group',
        x: 10,
        y: 5,
        width: 50,
        height: 40,
        parts: [rect({ x: 2, y: 3, width: '50%', height: 10 })],
      },
    ]);
    const before = resolvePartBoxes(s, 140, 70)[1]!.box;
    const u = ungroupPart(s, [0]);
    expect(u.shape.parts).toHaveLength(1);
    expect(resolvePartBoxes(u.shape, 140, 70)[0]!.box).toEqual(before);
  });

  it('ungroup of a plain part does nothing', () => {
    const s = base([rect()]);
    expect(ungroupPart(s, [0]).shape).toBe(s);
  });
});

describe('properties', () => {
  it('sets, replaces and removes a flat property', () => {
    let s = setPartProp(base([rect()]), [0], 'fill', '#ff0000');
    expect(s.parts[0]).toMatchObject({ fill: '#ff0000' });
    s = setPartProp(s, [0], 'fill', undefined);
    expect('fill' in s.parts[0]!).toBe(false);
  });

  it('sets nested properties and drops emptied objects', () => {
    let s = setPartProp(base([rect()]), [0], 'font.size', 14);
    s = setPartProp(s, [0], 'font.weight', 'bold');
    expect(s.parts[0]!.font).toEqual({ size: 14, weight: 'bold' });
    s = setPartProp(s, [0], 'font.size', undefined);
    s = setPartProp(s, [0], 'font.weight', undefined);
    expect('font' in s.parts[0]!).toBe(false);
  });

  it('stores formulas as given', () => {
    const s = setPartProp(base([rect()]), [0], 'stroke', '= Priority');
    expect(s.parts[0]!.stroke).toBe('= Priority');
  });

  it('switches between a fixed value and a formula', () => {
    let s = base([rect({ strokeWidth: 2, fill: "it's" })]);
    s = switchToFormula(s, [0], 'strokeWidth');
    expect(s.parts[0]!.strokeWidth).toBe('= 2');
    s = switchToFormula(s, [0], 'fill');
    expect(s.parts[0]!.fill).toBe("= 'it\\'s'");
    s = switchToFixed(s, [0], 'strokeWidth', 1);
    expect(s.parts[0]!.strokeWidth).toBe(2);
    s = switchToFixed(s, [0], 'fill', '#000');
    expect(s.parts[0]!.fill).toBe("it's");
  });

  it('falls back when the formula is a real one', () => {
    const s = switchToFixed(
      base([rect({ stroke: '= Priority == 1 ? "a" : "b"' })]),
      [0],
      'stroke',
      '#111111',
    );
    expect(s.parts[0]!.stroke).toBe('#111111');
  });

  it('starts a formula from the fallback when the property is not set', () => {
    const s = switchToFormula(base([rect()]), [0], 'opacity', 1);
    expect(s.parts[0]!.opacity).toBe('= 1');
  });

  it('reads negative and boolean literals back', () => {
    let s = base([rect({ opacity: '= -2', visible: '= false' })]);
    s = switchToFixed(s, [0], 'opacity', 1);
    s = switchToFixed(s, [0], 'visible', true);
    expect(s.parts[0]).toMatchObject({ opacity: -2, visible: false });
  });
});

describe('duplicating and naming', () => {
  it('copies a part in front of the original and nudges it', () => {
    const s = base([rect({ x: 5, y: 5 }), rect({ x: 50 })]);
    const d = duplicatePart(s, [0]);
    expect(d.path).toEqual([1]);
    expect(d.shape.parts).toHaveLength(3);
    expect(d.shape.parts[1]).toMatchObject({ x: 15, y: 15 });
    expect(d.shape.parts[0]).toMatchObject({ x: 5, y: 5 });
    expect(d.shape.parts[1]).not.toBe(d.shape.parts[0]);
  });

  it('sets and removes a let name', () => {
    let s = setLet(base(), 'accent', "= 'red'");
    expect(s.let).toEqual({ accent: "= 'red'" });
    s = setLet(s, 'accent', undefined);
    expect('let' in s).toBe(false);
  });
});

describe('boxes and hit testing', () => {
  const s = base([
    rect({ x: 0, y: 0, width: '100%', height: '100%' }),
    {
      type: 'group',
      x: 10,
      y: 10,
      width: 50,
      height: 40,
      parts: [rect({ x: 5, y: 5, width: '50%', height: 10 })],
    },
    rect({ x: '= $width', width: 10, height: 10 }),
  ]);

  it('resolves boxes against the parents', () => {
    const boxes = resolvePartBoxes(s, 200, 100);
    expect(boxes.map((b) => b.path)).toEqual([[0], [1], [1, 0], [2]]);
    expect(boxes[0]!.box).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(boxes[2]!.box).toEqual({ x: 15, y: 15, w: 25, h: 10 });
    expect(boxes[2]!.exact).toBe(true);
  });

  it('marks formula boxes as not exact and falls back to 0', () => {
    const last = resolvePartBoxes(s, 200, 100)[3]!;
    expect(last.exact).toBe(false);
    expect(last.box).toMatchObject({ x: 0, w: 10 });
  });

  it('finds the topmost leaf part', () => {
    const boxes = resolvePartBoxes(s, 200, 100);
    expect(hitTestParts(boxes, 20, 20)).toEqual([1, 0]);
    expect(hitTestParts(boxes, 150, 90)).toEqual([0]);
    expect(hitTestParts(boxes, 300, 300)).toBeNull();
  });
});
