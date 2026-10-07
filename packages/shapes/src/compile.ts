import {
  formulaSource,
  isFormula,
  type FontDef,
  type GroupPart,
  type NodeShape,
  type Part,
  type RepeatDef,
  type RepeatLayout,
  type ShapeDef,
  type ShapeId,
} from '@metakit-app/core';
import {
  evaluate,
  parse,
  toText,
  truthy,
  type Expr,
  type Scope,
  type Value,
} from '@metakit-app/formula';
import { FONT_PX, LINE_HEIGHT, resolveDim, wrapText } from './dim';
import type {
  Box,
  Compiled,
  DrawOp,
  Hotspot,
  OpStyle,
  OutlineKind,
  PaintValue,
  TextFont,
} from './ops';

export interface CompileInput {
  /** The element's size in pixels. */
  w: number;
  h: number;
  /** Attribute values by key, plus the `$` names; unknown names evaluate with an error. */
  scope: Scope;
  /** Looks up shapes for `use`. */
  shapes?: (id: ShapeId) => ShapeDef | undefined;
}

const MAX_REPEAT = 200;
const MAX_DEPTH = 8;
const DEFAULT_TEXT_COLOUR = '#212529';

const parsed = new Map<string, Expr | string>();

/** Parses a formula once; a syntax error is kept as its message. */
function parseCached(source: string): Expr | string {
  let hit = parsed.get(source);
  if (hit === undefined) {
    const p = parse(source);
    hit = p.ok ? p.expr : `${p.error} (at ${p.at})`;
    if (parsed.size > 5000) parsed.clear();
    parsed.set(source, hit);
  }
  return hit;
}

class Context {
  readonly reads: string[] = [];
  private readonly readSet = new Set<string>();
  readonly messages: string[] = [];
  readonly ops: DrawOp[] = [];
  readonly hotspots: Hotspot[] = [];
  private readonly frames: Map<string, Value>[] = [];
  readonly using: string[] = [];
  /** Shapes embedded with `use`, so that the cache notices when one of them is edited. */
  readonly used = new Map<ShapeId, ShapeDef>();
  readonly scope: Scope;

  constructor(
    private readonly base: Scope,
    readonly shapes: (id: ShapeId) => ShapeDef | undefined,
  ) {
    this.scope = {
      get: (name) => {
        for (let i = this.frames.length - 1; i >= 0; i--) {
          const v = this.frames[i]!.get(name);
          if (v !== undefined) return v;
        }
        if (!this.readSet.has(name)) {
          this.readSet.add(name);
          this.reads.push(name);
        }
        return this.base.get(name);
      },
      ...(this.base.member
        ? { member: (v, k) => this.base.member!(v, k) }
        : {}),
    };
  }

  push(frame: Map<string, Value> = new Map()): Map<string, Value> {
    this.frames.push(frame);
    return frame;
  }

  pop(): void {
    this.frames.pop();
  }

  message(text: string): void {
    if (!this.messages.includes(text)) this.messages.push(text);
  }

  /** The value of a property: fixed values pass through, `=` text is evaluated. */
  value(raw: unknown, label: string): Value | undefined {
    if (raw === undefined) return undefined;
    if (!isFormula(raw)) return raw as Value;
    const expr = parseCached(formulaSource(raw));
    if (typeof expr === 'string') {
      this.message(`${label}: ${expr}`);
      return null;
    }
    const result = evaluate(expr, this.scope);
    if (result.error) this.message(`${label}: ${result.error}`);
    return result.value;
  }

  num(raw: unknown, label: string, fallback: number): number {
    const v = this.value(raw, label);
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }

  str(raw: unknown, label: string, fallback: string): string {
    const v = this.value(raw, label);
    if (v === undefined || v === null) return fallback;
    return toText(v);
  }

  bool(raw: unknown, label: string, fallback: boolean): boolean {
    const v = this.value(raw, label);
    return v === undefined ? fallback : truthy(v);
  }

  dim(raw: unknown, label: string, parent: number, fallback: number): number {
    const v = this.value(raw, label);
    if (v === undefined || v === null) return fallback;
    const r = resolveDim(v, parent);
    if (r === null) {
      this.message(`${label}: "${toText(v)}" is not a size.`);
      return fallback;
    }
    return r;
  }
}

function paintOf(
  c: Context,
  raw: unknown,
  label: string,
  box: Box,
): PaintValue {
  if (raw === undefined) return null;
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const g = raw as {
      angle?: number;
      stops?: { at: number; color: string }[];
    };
    return {
      type: 'linear',
      angle: g.angle ?? 90,
      stops: [...(g.stops ?? [])],
      box,
    };
  }
  const v = c.value(raw, label);
  return typeof v === 'string' && v !== '' ? v : null;
}

function styleOf(c: Context, p: Part, label: string, box: Box): OpStyle {
  const dashRaw = c.value(p.dash, `${label} dash`);
  return {
    fill: paintOf(c, p.fill, `${label} fill`, box),
    stroke:
      p.stroke === undefined
        ? null
        : c.str(p.stroke, `${label} stroke`, '') || null,
    strokeWidth: c.num(p.strokeWidth, `${label} strokeWidth`, 1),
    dash:
      Array.isArray(dashRaw) && dashRaw.every((n) => typeof n === 'number')
        ? (dashRaw as number[])
        : null,
    shadow: p.shadow ? { ...p.shadow } : null,
    opacity: Math.min(1, Math.max(0, c.num(p.opacity, `${label} opacity`, 1))),
  };
}

function fontOf(
  c: Context,
  font: FontDef | undefined,
  label: string,
): TextFont {
  return {
    family: font?.family ?? 'system-ui, sans-serif',
    size: c.num(font?.size, `${label} font size`, FONT_PX),
    weight:
      (c.value(font?.weight, `${label} font weight`) as
        string | number | undefined) ?? 'normal',
    style: c.str(font?.style, `${label} font style`, 'normal'),
    color: c.str(font?.color, `${label} font colour`, ''),
  };
}

function rotateAbout(
  box: Box,
  degrees: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // translate(tx, ty) · translate(c) · rotate · scale · translate(-c)
  const m: [number, number, number, number, number, number] = [
    cos * sx,
    sin * sx,
    -sin * sy,
    cos * sy,
    0,
    0,
  ];
  m[4] = cx + tx - (m[0] * cx + m[2] * cy);
  m[5] = cy + ty - (m[1] * cx + m[3] * cy);
  return m;
}

interface Placement {
  box: Box;
}

function placeIn(
  c: Context,
  p: Part,
  parent: Box,
  label: string,
  size?: { w?: number; h?: number },
  at?: { dx: number; dy: number },
): Placement {
  const x = c.dim(p.x, `${label} x`, parent.w, 0);
  const y = c.dim(p.y, `${label} y`, parent.h, 0);
  const w = c.dim(p.width, `${label} width`, parent.w, size?.w ?? parent.w);
  const h = c.dim(p.height, `${label} height`, parent.h, size?.h ?? parent.h);
  return {
    box: {
      x: parent.x + x + (at?.dx ?? 0),
      y: parent.y + y + (at?.dy ?? 0),
      w: Math.max(0, w),
      h: Math.max(0, h),
    },
  };
}

function textOp(
  c: Context,
  p: Part & { type: 'text' },
  box: Box,
  style: OpStyle,
  label: string,
): DrawOp | null {
  const text = c.str(p.text, `${label} text`, '');
  if (text === '') return null;
  const font = fontOf(c, p.font, label);
  if (font.color === '')
    font.color =
      typeof style.fill === 'string' ? style.fill : DEFAULT_TEXT_COLOUR;
  const wrap = p.wrap !== false;
  const fit = p.fit ?? 'none';
  const align = p.align ?? 'left';
  const valign = p.valign ?? 'top';
  let size = font.size;
  const layout = (s: number): string[] => {
    const maxLines = Math.max(1, Math.floor(box.h / (s * LINE_HEIGHT)));
    return wrap
      ? wrapText(text, box.w, s, fit === 'clip' ? Infinity : maxLines)
      : [text.replace(/\n.*/s, '')];
  };
  let lines = layout(size);
  if (fit === 'shrink')
    while (
      size > 6 &&
      (wrap ? wrapText(text, box.w, size, Infinity) : lines).length *
        size *
        LINE_HEIGHT >
        box.h + 0.5
    ) {
      size -= 1;
      lines = layout(size);
    }
  font.size = size;
  const lh = size * LINE_HEIGHT;
  const total = lines.length * lh;
  const top =
    valign === 'top'
      ? box.y
      : valign === 'bottom'
        ? box.y + box.h - total
        : box.y + (box.h - total) / 2;
  const ax =
    align === 'left'
      ? box.x
      : align === 'right'
        ? box.x + box.w
        : box.x + box.w / 2;
  return {
    op: 'text',
    box,
    lines: lines.map((t, i) => ({ text: t, x: ax, y: top + i * lh + lh / 2 })),
    font,
    align,
    lineHeight: lh,
  };
}

function layoutSlots(
  layout: RepeatLayout,
  n: number,
  box: Box,
  cell: { w: number; h: number },
): { dx: number; dy: number }[] {
  const gap = layout.gap ?? 0;
  const out: { dx: number; dy: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (layout.kind === 'grid') {
      const cols = Math.max(1, layout.columns);
      out.push({
        dx: (i % cols) * (cell.w + gap),
        dy: Math.floor(i / cols) * (cell.h + gap),
      });
    } else if (layout.direction === 'row')
      out.push({ dx: i * (cell.w + gap), dy: 0 });
    else out.push({ dx: 0, dy: i * (cell.h + gap) });
  }
  void box;
  return out;
}

function emitPart(
  c: Context,
  p: Part,
  parent: Box,
  path: string,
  depth: number,
  slot?: { dx: number; dy: number; w?: number; h?: number },
): void {
  if (!p || typeof p !== 'object') return;
  if (p.repeat && !slot) {
    emitRepeat(c, p, p.repeat, parent, path, depth);
    return;
  }
  const label = `${path} (${p.type})`;
  if (!c.bool(p.visible, `${label} visible`, true)) return;
  const { box } = placeIn(
    c,
    p,
    parent,
    label,
    {
      ...(slot?.w === undefined ? {} : { w: slot.w }),
      ...(slot?.h === undefined ? {} : { h: slot.h }),
    },
    slot,
  );
  let wrapped = 0;
  const t = p.transform;
  if (t) {
    const m = rotateAbout(
      box,
      c.num(t.rotate, `${label} rotate`, 0),
      c.num(t.scaleX, `${label} scaleX`, 1),
      c.num(t.scaleY, `${label} scaleY`, 1),
      c.dim(t.translateX, `${label} translateX`, parent.w, 0),
      c.dim(t.translateY, `${label} translateY`, parent.h, 0),
    );
    c.ops.push({ op: 'save' }, { op: 'transform', matrix: m });
    wrapped++;
  }
  if (p.clip) {
    c.ops.push({ op: 'save' }, { op: 'clip', kind: 'rect', box, radius: 0 });
    wrapped++;
  }
  const style = styleOf(c, p, label, box);
  switch (p.type) {
    case 'rect':
      c.ops.push({
        op: 'rect',
        box,
        radius: c.num(p.radius, `${label} radius`, 0),
        style,
      });
      break;
    case 'ellipse':
      c.ops.push({ op: 'ellipse', box, style });
      break;
    case 'polygon':
      c.ops.push({
        op: 'polygon',
        points: p.points.map(([px, py]) => [
          box.x + c.dim(px, `${label} point`, box.w, 0),
          box.y + c.dim(py, `${label} point`, box.h, 0),
        ]),
        style,
      });
      break;
    case 'path':
      c.ops.push({
        op: 'path',
        d: p.d,
        box,
        viewBox: p.viewBox ?? null,
        style,
      });
      break;
    case 'text': {
      const op = textOp(c, p, box, style, label);
      if (op) c.ops.push(op);
      break;
    }
    case 'image': {
      const src = c.str(p.src, `${label} src`, '');
      if (src !== '')
        c.ops.push({
          op: 'image',
          src,
          box,
          fit: p.fit ?? 'contain',
          opacity: style.opacity,
        });
      break;
    }
    case 'group':
      emitGroup(c, p, box, label, depth);
      break;
    case 'use':
      emitUse(c, p.shape, box, label, depth);
      break;
  }
  if (p.tooltip !== undefined || p.onClick !== undefined) {
    const tooltip =
      p.tooltip === undefined
        ? null
        : c.str(p.tooltip, `${label} tooltip`, '') || null;
    const click = isFormula(p.onClick)
      ? (c.value(p.onClick, `${label} onClick`) ?? null)
      : null;
    if (tooltip !== null || click !== null)
      c.hotspots.push({ box, tooltip, click });
  }
  for (let i = 0; i < wrapped; i++) c.ops.push({ op: 'restore' });
}

function emitGroup(
  c: Context,
  g: GroupPart,
  box: Box,
  label: string,
  depth: number,
): void {
  if (depth > MAX_DEPTH) {
    c.message(`${label}: groups are nested too deeply.`);
    return;
  }
  const kids = g.parts ?? [];
  if (!g.layout) {
    kids.forEach((k, i) => emitPart(c, k, box, `${label}.${i}`, depth + 1));
    return;
  }
  const layout = g.layout;
  const n = kids.length;
  const gap = layout.gap ?? 0;
  const cols = layout.kind === 'grid' ? Math.max(1, layout.columns) : n;
  const rows = layout.kind === 'grid' ? Math.ceil(n / cols) : n;
  const cell =
    layout.kind === 'grid'
      ? {
          w: (box.w - gap * (cols - 1)) / cols,
          h: (box.h - gap * (rows - 1)) / Math.max(1, rows),
        }
      : layout.direction === 'row'
        ? { w: (box.w - gap * (n - 1)) / Math.max(1, n), h: box.h }
        : { w: box.w, h: (box.h - gap * (n - 1)) / Math.max(1, n) };
  const slots = layoutSlots(layout, n, box, cell);
  kids.forEach((k, i) =>
    emitPart(
      c,
      { ...k, x: 0, y: 0, width: cell.w, height: cell.h },
      box,
      `${label}.${i}`,
      depth + 1,
      { ...slots[i]!, w: cell.w, h: cell.h },
    ),
  );
}

function emitRepeat(
  c: Context,
  p: Part,
  r: RepeatDef,
  parent: Box,
  path: string,
  depth: number,
): void {
  const label = `${path} repeat`;
  const over = c.value(r.over.startsWith('=') ? r.over : `= ${r.over}`, label);
  const items = Array.isArray(over) ? over : [];
  if (items.length > MAX_REPEAT)
    c.message(`${label}: only the first ${MAX_REPEAT} items are drawn.`);
  const list = items.slice(0, MAX_REPEAT);
  const first = placeIn(c, p, parent, label);
  const cell = {
    w: c.dim(r.cellWidth, `${label} cellWidth`, parent.w, first.box.w),
    h: c.dim(r.cellHeight, `${label} cellHeight`, parent.h, first.box.h),
  };
  const slots = layoutSlots(
    r.layout ?? { kind: 'stack', direction: 'column' },
    list.length,
    parent,
    cell,
  );
  const name = r.as ?? 'item';
  list.forEach((item, i) => {
    const frame = c.push();
    frame.set(name, item);
    frame.set('index', i);
    emitPart(c, p, parent, `${path}[${i}]`, depth, {
      ...slots[i]!,
      w: cell.w,
      h: cell.h,
    });
    c.pop();
  });
}

function evaluateLets(
  c: Context,
  shape: { let?: Record<string, string>; id: string },
): void {
  const frame = c.push();
  for (const [name, raw] of Object.entries(shape.let ?? {})) {
    const v = c.value(raw, `let ${name}`);
    frame.set(name, v === undefined ? null : v);
  }
}

function emitUse(
  c: Context,
  id: ShapeId,
  box: Box,
  label: string,
  depth: number,
): void {
  const used = c.shapes(id);
  if (!used || used.kind !== 'node') {
    c.message(`${label}: the shape ${id} does not exist.`);
    return;
  }
  if (c.using.includes(id) || depth > MAX_DEPTH) {
    c.message(`${label}: the shape ${id} uses itself.`);
    return;
  }
  c.using.push(id);
  c.used.set(id, used);
  evaluateLets(c, used);
  emitShapeBody(c, used, box, label, depth + 1);
  c.pop();
  c.using.pop();
}

function emitShapeBody(
  c: Context,
  shape: NodeShape,
  box: Box,
  label: string,
  depth: number,
): void {
  shape.parts.forEach((p, i) =>
    emitPart(c, p, box, `${label}.parts[${i}]`, depth),
  );
  for (const [vi, v] of (shape.variants ?? []).entries()) {
    const ok =
      v.when === undefined ||
      c.bool(
        v.when.startsWith('=') ? v.when : `= ${v.when}`,
        `${label}.variants[${vi}] when`,
        false,
      );
    if (!ok) continue;
    v.parts.forEach((p, i) =>
      emitPart(c, p, box, `${label}.variants[${vi}].parts[${i}]`, depth),
    );
    break;
  }
}

function outlineOf(
  c: Context,
  shape: NodeShape,
  w: number,
  h: number,
): OutlineKind {
  const o = shape.outline ?? 'auto';
  if (o === 'rect') return { kind: 'rect' };
  if (o === 'ellipse') return { kind: 'ellipse' };
  if (typeof o === 'object')
    return {
      kind: 'polygon',
      points: o.points.map(
        ([x, y]) =>
          [c.dim(x, 'outline', w, 0), c.dim(y, 'outline', h, 0)] as [
            number,
            number,
          ],
      ),
    };
  const first = c.ops.find(
    (op) => op.op === 'rect' || op.op === 'ellipse' || op.op === 'polygon',
  );
  if (first?.op === 'ellipse') return { kind: 'ellipse' };
  if (first?.op === 'polygon') return { kind: 'polygon', points: first.points };
  return { kind: 'rect' };
}

/** Compiles a node shape at a size for one element's values. Never throws; problems become messages. */
export function compileNode(shape: NodeShape, input: CompileInput): Compiled {
  const c = new Context(input.scope, input.shapes ?? (() => undefined));
  const box: Box = { x: 0, y: 0, w: input.w, h: input.h };
  c.using.push(shape.id);
  evaluateLets(c, shape);
  emitShapeBody(c, shape, box, shape.name ?? shape.id, 0);
  c.pop();
  return {
    w: input.w,
    h: input.h,
    ops: c.ops,
    hotspots: c.hotspots,
    outline: outlineOf(c, shape, input.w, input.h),
    reads: c.reads,
    messages: c.messages,
    uses: [...c.used],
  };
}

export { Context as CompileContext };
