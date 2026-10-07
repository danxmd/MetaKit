import {
  isFormula,
  type Dim,
  type GroupPart,
  type NodeShape,
  type Part,
} from '@metakit-app/core';
import { tokenize } from '@metakit-app/formula';
import { toBase64 } from './base64';
import { resolveDim } from './dim';
import type { Box } from './ops';

/**
 * Pure, immutable edits of a node shape. A part is addressed by a path of indexes: `[2]` is the
 * third part of the shape and `[1, 0]` the first part inside the group at index 1. Functions that
 * cannot find the path, or that would not make sense, return the shape they were given.
 */
export type PartPath = readonly number[];

export interface EditResult {
  shape: NodeShape;
  /** Where the part that was added, moved or wrapped now is. */
  path: PartPath;
}

export type EditablePartType =
  'rect' | 'ellipse' | 'polygon' | 'text' | 'image';

export type ReorderMove = 'up' | 'down' | 'top' | 'bottom';

export const pathKey = (path: PartPath): string => path.join('-');

export function samePath(a: PartPath, b: PartPath): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

export function isPrefix(prefix: PartPath, path: PartPath): boolean {
  return prefix.length <= path.length && prefix.every((n, i) => n === path[i]);
}

function listAt(parts: Part[], parent: PartPath): Part[] | undefined {
  let list: Part[] = parts;
  for (const i of parent) {
    const p = list[i];
    if (!p || p.type !== 'group') return undefined;
    list = p.parts;
  }
  return list;
}

/** The part at a path, or undefined. */
export function getPart(shape: NodeShape, path: PartPath): Part | undefined {
  if (path.length === 0) return undefined;
  const list = listAt(shape.parts, path.slice(0, -1));
  return list?.[path[path.length - 1]!];
}

/** Rebuilds the list at `parent` with `fn(list)`; undefined from `fn` means "no change". */
function withList(
  shape: NodeShape,
  parent: PartPath,
  fn: (list: Part[]) => Part[] | undefined,
): NodeShape {
  const rebuild = (list: Part[], depth: number): Part[] | undefined => {
    if (depth === parent.length) return fn(list);
    const i = parent[depth]!;
    const p = list[i];
    if (!p || p.type !== 'group') return undefined;
    const inner = rebuild(p.parts, depth + 1);
    if (!inner) return undefined;
    const next = list.slice();
    next[i] = { ...p, parts: inner };
    return next;
  };
  const parts = rebuild(shape.parts, 0);
  return parts ? { ...shape, parts } : shape;
}

function replacePart(
  shape: NodeShape,
  path: PartPath,
  fn: (part: Part) => Part,
): NodeShape {
  if (path.length === 0) return shape;
  return withList(shape, path.slice(0, -1), (list) => {
    const i = path[path.length - 1]!;
    const p = list[i];
    if (!p) return undefined;
    const next = list.slice();
    next[i] = fn(p);
    return next;
  });
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** A part with sensible starting values, ready to be added. */
export function defaultPart(type: EditablePartType): Part {
  switch (type) {
    case 'rect':
      return {
        type: 'rect',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        radius: 0,
        fill: '#E7F5FF',
        stroke: '#364FC7',
        strokeWidth: 1.5,
      };
    case 'ellipse':
      return {
        type: 'ellipse',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        fill: '#E7F5FF',
        stroke: '#364FC7',
        strokeWidth: 1.5,
      };
    case 'polygon':
      return {
        type: 'polygon',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        points: [
          ['50%', 0],
          ['100%', '100%'],
          [0, '100%'],
        ],
        fill: '#E7F5FF',
        stroke: '#364FC7',
        strokeWidth: 1.5,
      };
    case 'text':
      return {
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 20,
        text: 'Text',
        wrap: true,
        align: 'center',
        valign: 'middle',
        font: { size: 12 },
      };
    case 'image':
      return {
        type: 'image',
        x: 10,
        y: 10,
        width: 24,
        height: 24,
        src: PLACEHOLDER_IMAGE,
        fit: 'contain',
      };
  }
}

/** A grey picture symbol, so a new image part is visible before a file is chosen. */
const PLACEHOLDER_IMAGE = `data:image/svg+xml;base64,${toBase64(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#DEE2E6"/><circle cx="8" cy="8" r="3" fill="#868E96"/><path d="M2 22 L10 12 L15 18 L18 14 L22 22 Z" fill="#868E96"/></svg>',
)}`;

/** Adds a part at the front of a group or of the shape (or at `index`); returns its path. */
export function addPart(
  shape: NodeShape,
  part: Part,
  parent: PartPath = [],
  index?: number,
): EditResult {
  let at = -1;
  const next = withList(shape, parent, (list) => {
    at = index === undefined ? list.length : clamp(index, 0, list.length);
    return [...list.slice(0, at), part, ...list.slice(at)];
  });
  return next === shape
    ? { shape, path: [] }
    : { shape: next, path: [...parent, at] };
}

export function removePart(shape: NodeShape, path: PartPath): NodeShape {
  if (path.length === 0) return shape;
  return withList(shape, path.slice(0, -1), (list) => {
    const i = path[path.length - 1]!;
    return i >= 0 && i < list.length
      ? [...list.slice(0, i), ...list.slice(i + 1)]
      : undefined;
  });
}

const TERM = /[+-]?\s*\d+(?:\.\d+)?%?/g;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Adds `delta` pixels to a dimension and keeps its meaning: a number stays a number, and a
 * percentage sum such as `"100% - 22"` stays a sum (`"100% - 17"`), so a moved part still stretches
 * with the shape. A formula, or text that is not a size, is returned unchanged because the editor
 * cannot know where it ends up. `fallback` stands in for a missing dimension.
 */
export function shiftDim(
  dim: Dim | undefined,
  delta: number,
  fallback: Dim,
): Dim {
  const d = dim === undefined ? fallback : dim;
  if (typeof d === 'number') return round2(d + delta);
  if (d.trimStart().startsWith('=') || resolveDim(d, 100) === null) return d;
  let percent = 0;
  let constant = 0;
  for (const term of d.match(TERM) ?? []) {
    const clean = term.replace(/\s/g, '');
    if (clean.endsWith('%')) percent += Number(clean.slice(0, -1));
    else constant += Number(clean);
  }
  constant = round2(constant + delta);
  percent = round2(percent);
  if (percent === 0) return constant;
  if (constant === 0) return `${percent}%`;
  return `${percent}% ${constant < 0 ? '-' : '+'} ${Math.abs(constant)}`;
}

/** Moves a part by pixels. Formula positions are left alone. */
export function movePart(
  shape: NodeShape,
  path: PartPath,
  dx: number,
  dy: number,
): NodeShape {
  return replacePart(shape, path, (p) => ({
    ...p,
    x: shiftDim(p.x, dx, 0),
    y: shiftDim(p.y, dy, 0),
  }));
}

/**
 * Changes the size by `dw` and `dh` pixels and the position by `dx` and `dy` (dragging the left
 * or top handle changes both). A part without a width or height fills its parent, which counts as
 * `"100%"`.
 */
export function resizePart(
  shape: NodeShape,
  path: PartPath,
  change: { dw?: number; dh?: number; dx?: number; dy?: number },
): NodeShape {
  const { dw = 0, dh = 0, dx = 0, dy = 0 } = change;
  return replacePart(shape, path, (p) => ({
    ...p,
    ...(dx === 0 ? {} : { x: shiftDim(p.x, dx, 0) }),
    ...(dy === 0 ? {} : { y: shiftDim(p.y, dy, 0) }),
    ...(dw === 0 ? {} : { width: shiftDim(p.width, dw, '100%') }),
    ...(dh === 0 ? {} : { height: shiftDim(p.height, dh, '100%') }),
  }));
}

/** Moves a part in paint order: `up` towards the front, `down` towards the back. */
export function reorderPart(
  shape: NodeShape,
  path: PartPath,
  move: ReorderMove,
): EditResult {
  if (path.length === 0) return { shape, path };
  const parent = path.slice(0, -1);
  const from = path[path.length - 1]!;
  let to = from;
  const next = withList(shape, parent, (list) => {
    if (from < 0 || from >= list.length) return undefined;
    to =
      move === 'up'
        ? Math.min(list.length - 1, from + 1)
        : move === 'down'
          ? Math.max(0, from - 1)
          : move === 'top'
            ? list.length - 1
            : 0;
    if (to === from) return undefined;
    const copy = list.slice();
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item!);
    return copy;
  });
  return next === shape
    ? { shape, path }
    : { shape: next, path: [...parent, to] };
}

/**
 * Wraps parts that share a parent in a group. The group covers its parent (`0, 0, 100%, 100%`),
 * so every child keeps its position and meaning and nothing moves on the canvas. The group takes
 * the place of the lowest selected part.
 */
export function groupParts(
  shape: NodeShape,
  paths: readonly PartPath[],
): EditResult {
  if (paths.length === 0) return { shape, path: [] };
  const parent = paths[0]!.slice(0, -1);
  if (
    paths.some(
      (p) => p.length !== paths[0]!.length || !samePath(p.slice(0, -1), parent),
    )
  )
    return { shape, path: [] };
  const indexes = [...new Set(paths.map((p) => p[p.length - 1]!))].sort(
    (a, b) => a - b,
  );
  let at = -1;
  const next = withList(shape, parent, (list) => {
    if (indexes.some((i) => i < 0 || i >= list.length)) return undefined;
    const group: GroupPart = {
      type: 'group',
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      parts: indexes.map((i) => list[i]!),
    };
    const rest = list.filter((_, i) => !indexes.includes(i));
    at = indexes[0]!;
    return [...rest.slice(0, at), group, ...rest.slice(at)];
  });
  return next === shape
    ? { shape, path: [] }
    : { shape: next, path: [...parent, at] };
}

const isFull = (d: Dim | undefined, full: Dim) =>
  d === undefined || d === full || (typeof d === 'string' && d.trim() === full);

/**
 * Replaces a group by its parts, in the same place. When the group does not cover its parent, each
 * child gets its resolved pixel position and size in the parent so nothing moves; children whose
 * position is a formula keep it. Properties of the group itself (visibility, opacity) are lost.
 */
export function ungroupPart(
  shape: NodeShape,
  path: PartPath,
): { shape: NodeShape; paths: PartPath[] } {
  const group = getPart(shape, path);
  if (!group || group.type !== 'group') return { shape, paths: [] };
  const identity =
    (group.x === undefined || group.x === 0) &&
    (group.y === undefined || group.y === 0) &&
    isFull(group.width, '100%') &&
    isFull(group.height, '100%');
  let kids = group.parts;
  if (!identity) {
    const boxes = resolvePartBoxes(shape, shape.size.width, shape.size.height);
    const groupBox = boxes.find((b) => samePath(b.path, path))?.box;
    const parentBox = parentBoxOf(boxes, path, shape);
    if (groupBox) {
      kids = kids.map((k, i) => {
        const b = boxes.find((x) => samePath(x.path, [...path, i]));
        if (!b?.exact) return k;
        return {
          ...k,
          x: round2(b.box.x - parentBox.x),
          y: round2(b.box.y - parentBox.y),
          width: round2(b.box.w),
          height: round2(b.box.h),
        } as Part;
      });
    }
  }
  const parent = path.slice(0, -1);
  const at = path[path.length - 1]!;
  const next = withList(shape, parent, (list) => [
    ...list.slice(0, at),
    ...kids,
    ...list.slice(at + 1),
  ]);
  return {
    shape: next,
    paths: kids.map((_, i) => [...parent, at + i]),
  };
}

function parentBoxOf(boxes: PartBox[], path: PartPath, shape: NodeShape): Box {
  const parent = path.slice(0, -1);
  if (parent.length === 0)
    return { x: 0, y: 0, w: shape.size.width, h: shape.size.height };
  return (
    boxes.find((b) => samePath(b.path, parent))?.box ?? {
      x: 0,
      y: 0,
      w: shape.size.width,
      h: shape.size.height,
    }
  );
}

/** Reads a nested property such as `font.size`. */
export function getPartProp(part: Part, prop: string): unknown {
  let cur: unknown = part;
  for (const key of prop.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function setIn(
  obj: Record<string, unknown>,
  keys: string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = keys;
  const out = { ...obj };
  if (rest.length === 0) {
    if (value === undefined) delete out[head!];
    else out[head!] = value;
    return out;
  }
  const inner = obj[head!];
  const child = setIn(
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? (inner as Record<string, unknown>)
      : {},
    rest,
    value,
  );
  // An emptied object (the last `font` setting removed) is dropped so the file stays small.
  if (Object.keys(child).length === 0) delete out[head!];
  else out[head!] = child;
  return out;
}

/**
 * Sets a property, possibly nested (`font.size`, `transform.rotate`). `undefined` removes it. The
 * value is stored as given, so a string starting with `=` is a formula.
 */
export function setPartProp(
  shape: NodeShape,
  path: PartPath,
  prop: string,
  value: unknown,
): NodeShape {
  return replacePart(
    shape,
    path,
    (p) =>
      setIn(
        p as unknown as Record<string, unknown>,
        prop.split('.'),
        value,
      ) as unknown as Part,
  );
}

/** Formula text for a fixed value, used when a property is switched to *fx*. */
export function formulaFromValue(value: unknown): string {
  if (typeof value === 'string')
    return `= '${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  if (typeof value === 'number' || typeof value === 'boolean')
    return `= ${value}`;
  if (Array.isArray(value)) return `= [${value.map(literalText).join(', ')}]`;
  return '= null';
}

const literalText = (v: unknown) => formulaFromValue(v).replace(/^= /, '');

/**
 * The fixed value a formula stands for when it is only a literal (`= 12`, `= 'red'`, `= true`);
 * `fallback` otherwise, since a real formula cannot be turned back into one value.
 */
export function valueFromFormula(source: string, fallback: unknown): unknown {
  try {
    const t = tokenize(source.trimStart().slice(1));
    const [a, b, c] = t;
    if (a?.kind === 'str' && b?.kind === 'end') return a.value;
    if (a?.kind === 'num' && b?.kind === 'end') return a.value;
    if (
      a?.kind === 'op' &&
      a.text === '-' &&
      b?.kind === 'num' &&
      c?.kind === 'end'
    )
      return -(b.value as number);
    if (a?.kind === 'name' && b?.kind === 'end') {
      if (a.text === 'true') return true;
      if (a.text === 'false') return false;
    }
  } catch {
    // Not readable as a literal; the fallback is used.
  }
  return fallback;
}

/** Switches a property to a formula, keeping what it showed. */
export function switchToFormula(
  shape: NodeShape,
  path: PartPath,
  prop: string,
  fallback?: unknown,
): NodeShape {
  const part = getPart(shape, path);
  if (!part) return shape;
  const current = getPartProp(part, prop);
  if (isFormula(current)) return shape;
  return setPartProp(
    shape,
    path,
    prop,
    formulaFromValue(current === undefined ? fallback : current),
  );
}

/** Switches a property back to a fixed value: the formula's literal, else `fallback`. */
export function switchToFixed(
  shape: NodeShape,
  path: PartPath,
  prop: string,
  fallback: unknown,
): NodeShape {
  const part = getPart(shape, path);
  if (!part) return shape;
  const current = getPartProp(part, prop);
  if (!isFormula(current)) return shape;
  return setPartProp(shape, path, prop, valueFromFormula(current, fallback));
}

const cloneJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Copies a part just in front of the original, nudged by 10 px so it can be told apart. */
export function duplicatePart(
  shape: NodeShape,
  path: PartPath,
  offset = 10,
): EditResult {
  const part = getPart(shape, path);
  if (!part) return { shape, path };
  const copy = cloneJson(part);
  copy.x = shiftDim(copy.x, offset, 0);
  copy.y = shiftDim(copy.y, offset, 0);
  return addPart(shape, copy, path.slice(0, -1), path[path.length - 1]! + 1);
}

/** Names `let` values; the formula is stored as given. `undefined` removes the name. */
export function setLet(
  shape: NodeShape,
  name: string,
  formula: string | undefined,
): NodeShape {
  const lets = { ...(shape.let ?? {}) };
  if (formula === undefined) delete lets[name];
  else lets[name] = formula;
  const { let: _old, ...rest } = shape;
  void _old;
  return Object.keys(lets).length === 0
    ? (rest as NodeShape)
    : { ...rest, let: lets };
}

// Hit testing ---------------------------------------------------------------------------------

export interface PartBox {
  path: PartPath;
  part: Part;
  /** In shape pixels, from the top-left corner of the shape. */
  box: Box;
  /** False when a position or size is a formula; the box then falls back to the parent's. */
  exact: boolean;
}

/**
 * The box of every part at a shape size, in paint order with parents before their children. A
 * formula or an unreadable size cannot be resolved without values, so it falls back to what the
 * compiler uses when a size is missing: x and y to 0, width and height to the parent's.
 */
export function resolvePartBoxes(
  shape: NodeShape,
  w: number,
  h: number,
): PartBox[] {
  const out: PartBox[] = [];
  const walk = (parts: Part[], parent: Box, prefix: number[]) => {
    parts.forEach((p, i) => {
      const x = resolveDim(p.x === undefined ? 0 : p.x, parent.w);
      const y = resolveDim(p.y === undefined ? 0 : p.y, parent.h);
      const bw = resolveDim(
        p.width === undefined ? parent.w : p.width,
        parent.w,
      );
      const bh = resolveDim(
        p.height === undefined ? parent.h : p.height,
        parent.h,
      );
      const box: Box = {
        x: parent.x + (x ?? 0),
        y: parent.y + (y ?? 0),
        w: Math.max(0, bw ?? parent.w),
        h: Math.max(0, bh ?? parent.h),
      };
      const path = [...prefix, i];
      out.push({
        path,
        part: p,
        box,
        exact: x !== null && y !== null && bw !== null && bh !== null,
      });
      if (p.type === 'group') walk(p.parts, box, path);
    });
  };
  walk(shape.parts, { x: 0, y: 0, w, h }, []);
  return out;
}

/** The topmost part at a point, preferring parts inside groups; null when there is none. */
export function hitTestParts(
  boxes: readonly PartBox[],
  x: number,
  y: number,
): PartPath | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i]!;
    if (b.part.type === 'group') continue;
    if (
      x >= b.box.x &&
      x <= b.box.x + b.box.w &&
      y >= b.box.y &&
      y <= b.box.y + b.box.h
    )
      return b.path;
  }
  return null;
}

/** A short name for the layer list, such as `Text: Name` or `Rectangle`. */
export function describePart(part: Part): string {
  const quoted = (v: unknown) =>
    typeof v === 'string' ? v.replace(/^=\s*/, '') : '';
  switch (part.type) {
    case 'rect':
      return 'Rectangle';
    case 'ellipse':
      return 'Ellipse';
    case 'polygon':
      return 'Polygon';
    case 'path':
      return 'Path';
    case 'text':
      return `Text: ${quoted(part.text)}`.trim();
    case 'image':
      return 'Image';
    case 'group':
      return `Group (${part.parts.length})`;
    case 'use':
      return 'Embedded shape';
  }
}
