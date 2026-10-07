import type { Part } from '@metakit-app/core';
import { toBase64 } from './base64';
import {
  parseXml,
  serializeXml,
  textOf,
  XmlError,
  type XmlElement,
  type XmlNode,
} from './xml';

export type SvgImportMode = 'parts' | 'image';

export interface SvgImportResult {
  parts: Part[];
  /** The size the imported drawing should give the shape. */
  size: { width: number; height: number };
  /** What was left out, in plain English; empty when everything was converted. */
  skipped: string[];
}

const DEFAULT_SIZE = { width: 100, height: 100 };
const MAX_PARTS = 2000;

/** Elements that run code or load things; they are never imported or kept in an image. */
const DANGEROUS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'animate',
  'animatetransform',
  'animatemotion',
  'set',
]);
/** Elements that carry no drawing and are left out without a message. */
const QUIET = new Set(['title', 'desc', 'metadata', 'defs']);
const GROUPS = new Set(['g', 'a']);

const round2 = (n: number) => Math.round(n * 100) / 100;

// Lengths ------------------------------------------------------------------------------------

const UNIT_PX: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  em: 16,
};

/** A length in user units; a percentage is taken of `ref`. Null when it is not a length. */
function length(value: string | undefined, ref: number): number | null {
  if (value === undefined) return null;
  const m =
    /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|%)?\s*$/.exec(
      value,
    );
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? '';
  if (unit === '%') return (n / 100) * ref;
  return n * (UNIT_PX[unit] ?? 1);
}

function numbers(value: string | undefined): number[] {
  if (!value) return [];
  return (value.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(
    Number,
  );
}

// Transforms ---------------------------------------------------------------------------------

/** `[a, b, c, d, e, f]` as in the SVG `matrix()` function. */
type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function parseTransform(text: string | undefined): Matrix | null {
  if (!text || text.trim() === '') return IDENTITY;
  let m = IDENTITY;
  const re = /([A-Za-z]+)\s*\(([^)]*)\)/g;
  let rest = text;
  for (let hit = re.exec(text); hit; hit = re.exec(text)) {
    rest = rest.replace(hit[0], '');
    const a = numbers(hit[2]);
    let t: Matrix;
    switch (hit[1]) {
      case 'translate':
        t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
        break;
      case 'scale':
        t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const r = ((a[0] ?? 0) * Math.PI) / 180;
        const rot: Matrix = [
          Math.cos(r),
          Math.sin(r),
          -Math.sin(r),
          Math.cos(r),
          0,
          0,
        ];
        t =
          a.length >= 3
            ? multiply(multiply([1, 0, 0, 1, a[1]!, a[2]!], rot), [
                1,
                0,
                0,
                1,
                -a[1]!,
                -a[2]!,
              ])
            : rot;
        break;
      }
      case 'skewX':
        t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
      case 'matrix':
        if (a.length < 6) return null;
        t = [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!];
        break;
      default:
        return null;
    }
    m = multiply(m, t);
  }
  return rest.replace(/[\s,]/g, '') === '' ? m : null;
}

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

interface Placed {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees; the compiler turns a part around its own centre. */
  rotate: number;
  scale: number;
}

/**
 * Where a box ends up under a matrix made of moves, turns and scales, as a box plus a rotation.
 * Null for a matrix with skew or a mirror, which a part cannot express.
 */
function place(
  m: Matrix,
  box: { x: number; y: number; w: number; h: number },
): Placed | null {
  const sx = Math.hypot(m[0], m[1]);
  const sy = Math.hypot(m[2], m[3]);
  const det = m[0] * m[3] - m[1] * m[2];
  if (sx === 0 || sy === 0 || det <= 0) return null;
  if (Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-6 * sx * sy) return null;
  const [cx, cy] = apply(m, box.x + box.w / 2, box.y + box.h / 2);
  const w = box.w * sx;
  const h = box.h * sy;
  const rotate = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  return {
    x: round2(cx - w / 2),
    y: round2(cy - h / 2),
    w: round2(w),
    h: round2(h),
    rotate: Math.abs(rotate) < 1e-6 ? 0 : round2(rotate),
    scale: (sx + sy) / 2,
  };
}

// Styles -------------------------------------------------------------------------------------

interface Style {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string | undefined;
  fontWeight: string | undefined;
  fontStyle: string | undefined;
  anchor: 'start' | 'middle' | 'end';
  color: string;
}

const ROOT_STYLE: Style = {
  fill: '#000000',
  stroke: null,
  strokeWidth: 1,
  opacity: 1,
  fontSize: 16,
  fontFamily: undefined,
  fontWeight: undefined,
  fontStyle: undefined,
  anchor: 'start',
  color: '#000000',
};

function declarations(el: XmlElement): Record<string, string> {
  const out: Record<string, string> = { ...el.attrs };
  for (const part of (el.attrs['style'] ?? '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

class Importer {
  readonly skipped: string[] = [];
  parts = 0;

  constructor(readonly view: { x: number; y: number; w: number; h: number }) {}

  note(message: string): void {
    if (!this.skipped.includes(message)) this.skipped.push(message);
  }

  /** A paint as a colour, or null for none; gradients and patterns are noted and dropped. */
  paint(
    value: string,
    inherited: string | null,
    el: string,
    color: string,
  ): string | null {
    const v = value.trim();
    if (v === '' || v === 'inherit') return inherited;
    if (v === 'none' || v === 'transparent') return null;
    if (v === 'currentColor') return color;
    if (/url\(/i.test(v)) {
      this.note(
        `A gradient or pattern fill or stroke on <${el}> was not imported; it has no colour there.`,
      );
      return null;
    }
    return v;
  }

  style(el: XmlElement, parent: Style): Style {
    const d = declarations(el);
    const color = d['color'] ?? parent.color;
    const s: Style = { ...parent, color };
    if (d['fill'] !== undefined)
      s.fill = this.paint(d['fill'], parent.fill, el.name, color);
    if (d['stroke'] !== undefined)
      s.stroke = this.paint(d['stroke'], parent.stroke, el.name, color);
    const sw = length(d['stroke-width'], this.view.w);
    if (sw !== null) s.strokeWidth = sw;
    const op = Number(d['opacity']);
    if (d['opacity'] !== undefined && Number.isFinite(op))
      s.opacity = parent.opacity * Math.min(1, Math.max(0, op));
    const fs = length(d['font-size'], parent.fontSize);
    if (fs !== null && fs > 0) s.fontSize = fs;
    if (d['font-family']) s.fontFamily = d['font-family'].replace(/['"]/g, '');
    if (d['font-weight']) s.fontWeight = d['font-weight'];
    if (d['font-style']) s.fontStyle = d['font-style'];
    const anchor = d['text-anchor'];
    if (anchor === 'start' || anchor === 'middle' || anchor === 'end')
      s.anchor = anchor;
    return s;
  }

  /** Style properties shared by every part, as part fields. */
  common(
    s: Style,
    scale: number,
    rotate: number,
    hidden: boolean,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (s.fill !== null) out['fill'] = s.fill;
    if (s.stroke !== null) {
      out['stroke'] = s.stroke;
      out['strokeWidth'] = round2(s.strokeWidth * scale);
    }
    if (s.opacity < 1) out['opacity'] = round2(s.opacity);
    if (rotate !== 0) out['transform'] = { rotate };
    if (hidden) out['visible'] = false;
    return out;
  }

  /** Reports and drops attributes that run code or point outside the file. */
  checkAttributes(el: XmlElement): void {
    for (const [k, v] of Object.entries(el.attrs)) {
      if (/^on/i.test(k))
        this.note(`The event handler ${k} on <${el.name}> was ignored.`);
      else if (
        /(^|:)href$/.test(k) &&
        !isLocalRef(v) &&
        !/^data:image\//i.test(v)
      )
        this.note(
          `An external reference (${shorten(v)}) on <${el.name}> was ignored.`,
        );
    }
  }

  walk(el: XmlElement, m: Matrix, parent: Style, out: Part[]): void {
    const lower = el.name.toLowerCase();
    if (DANGEROUS.has(lower)) {
      this.note(
        lower === 'script'
          ? 'A script in the file was ignored.'
          : `The <${el.name}> element can run code or load things and was not imported.`,
      );
      return;
    }
    if (QUIET.has(lower) || el.name.includes(':')) {
      if (lower === 'defs') this.noteDefs(el);
      return;
    }
    if (this.parts >= MAX_PARTS) {
      this.note(
        'The drawing has too many elements; the rest was not imported.',
      );
      return;
    }
    this.checkAttributes(el);
    const t = parseTransform(el.attrs['transform']);
    if (t === null) {
      this.note(
        `The transform on <${el.name}> could not be read; the element was not imported.`,
      );
      return;
    }
    const mm = multiply(m, t);
    const style = this.style(el, parent);
    const d = declarations(el);
    const hidden = d['display'] === 'none' || d['visibility'] === 'hidden';
    if (GROUPS.has(lower)) {
      const kids: Part[] = [];
      for (const c of el.children)
        if (typeof c !== 'string') this.walk(c, mm, style, kids);
      if (kids.length > 0)
        out.push({
          type: 'group',
          x: 0,
          y: 0,
          width: '100%',
          height: '100%',
          ...(hidden ? { visible: false } : {}),
          parts: kids,
        });
      return;
    }
    const part = this.convert(el, lower, mm, style, d, hidden);
    if (part) {
      this.parts++;
      out.push(part);
    }
  }

  noteDefs(defs: XmlElement): void {
    for (const c of defs.children) {
      if (typeof c === 'string') continue;
      const n = c.name.toLowerCase();
      if (n === 'script') this.note('A script in the file was ignored.');
      else if (DANGEROUS.has(n))
        this.note(
          `The <${c.name}> element can run code or load things and was not imported.`,
        );
      else if (/gradient|pattern|filter|mask|clippath|marker|symbol/.test(n))
        this.note(
          `The <${c.name}> definition is not supported and was not imported.`,
        );
      else if (n === 'style')
        this.note(
          'Style sheets (CSS classes) are not supported; use plain attributes.',
        );
    }
  }

  convert(
    el: XmlElement,
    kind: string,
    m: Matrix,
    s: Style,
    d: Record<string, string>,
    hidden: boolean,
  ): Part | null {
    const { w: vw, h: vh } = this.view;
    const num = (name: string, ref: number) => length(d[name], ref) ?? 0;
    const unsupported = (why: string) => {
      this.note(`<${el.name}> ${why}; it was not imported.`);
      return null;
    };
    switch (kind) {
      case 'rect': {
        const w = num('width', vw);
        const h = num('height', vh);
        const p = place(m, { x: num('x', vw), y: num('y', vh), w, h });
        if (!p)
          return unsupported('uses a skew or a mirror that parts cannot show');
        const rx = length(d['rx'], vw);
        const ry = length(d['ry'], vh);
        const radius = rx ?? ry ?? 0;
        return {
          type: 'rect',
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          ...(radius > 0
            ? { radius: round2(Math.min(radius * p.scale, p.w / 2, p.h / 2)) }
            : {}),
          ...this.common(s, p.scale, p.rotate, hidden),
        } as Part;
      }
      case 'circle':
      case 'ellipse': {
        const r = Math.sqrt((vw * vw + vh * vh) / 2);
        const rx = kind === 'circle' ? num('r', r) : num('rx', vw);
        const ry = kind === 'circle' ? rx : num('ry', vh);
        const cx = num('cx', vw);
        const cy = num('cy', vh);
        const p = place(m, { x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry });
        if (!p)
          return unsupported('uses a skew or a mirror that parts cannot show');
        return {
          type: 'ellipse',
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          ...this.common(s, p.scale, p.rotate, hidden),
        } as Part;
      }
      case 'line': {
        const pts = [
          [num('x1', vw), num('y1', vh)],
          [num('x2', vw), num('y2', vh)],
        ] as [number, number][];
        return this.polygon(pts, m, { ...s, fill: null }, hidden);
      }
      case 'polygon':
      case 'polyline': {
        const n = numbers(d['points']);
        const pts: [number, number][] = [];
        for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i]!, n[i + 1]!]);
        if (pts.length < 2) return unsupported('has no points');
        if (kind === 'polygon') return this.polygon(pts, m, s, hidden);
        return this.polyline(pts, m, s, hidden);
      }
      case 'path': {
        if (!d['d']) return unsupported('has no path data');
        const p = place(m, this.view);
        if (!p)
          return unsupported('uses a skew or a mirror that parts cannot show');
        return {
          type: 'path',
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          d: d['d'],
          viewBox: [this.view.x, this.view.y, this.view.w, this.view.h],
          ...this.common(s, p.scale, p.rotate, hidden),
        } as Part;
      }
      case 'text':
        return this.text(el, m, s, d, hidden);
      case 'image': {
        const href = el.attrs['href'] ?? el.attrs['xlink:href'] ?? '';
        if (!/^data:image\//i.test(href))
          return unsupported('points to a file outside the drawing');
        const p = place(m, {
          x: num('x', vw),
          y: num('y', vh),
          w: num('width', vw),
          h: num('height', vh),
        });
        if (!p)
          return unsupported('uses a skew or a mirror that parts cannot show');
        return {
          type: 'image',
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          src: href,
          fit: 'contain',
          ...(p.rotate === 0 ? {} : { transform: { rotate: p.rotate } }),
          ...(s.opacity < 1 ? { opacity: round2(s.opacity) } : {}),
          ...(hidden ? { visible: false } : {}),
        } as Part;
      }
      default:
        return unsupported('is not supported');
    }
  }

  polygon(pts: [number, number][], m: Matrix, s: Style, hidden: boolean): Part {
    const moved = pts.map(([x, y]) => apply(m, x, y));
    const xs = moved.map((p) => p[0]);
    const ys = moved.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    return {
      type: 'polygon',
      x: round2(x),
      y: round2(y),
      width: round2(Math.max(...xs) - x),
      height: round2(Math.max(...ys) - y),
      points: moved.map(([px, py]) => [round2(px - x), round2(py - y)]),
      ...this.common(s, scale, 0, hidden),
    } as Part;
  }

  /** An open line is a path, because polygons are always closed. */
  polyline(
    pts: [number, number][],
    m: Matrix,
    s: Style,
    hidden: boolean,
  ): Part {
    const moved = pts.map(([x, y]) => apply(m, x, y));
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    const { width, height } = this.shape;
    return {
      type: 'path',
      x: 0,
      y: 0,
      width,
      height,
      d: moved
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${round2(x)} ${round2(y)}`)
        .join(' '),
      viewBox: [0, 0, width, height],
      ...this.common(s, scale, 0, hidden),
    } as Part;
  }

  shape = { width: 100, height: 100 };

  text(
    el: XmlElement,
    m: Matrix,
    s: Style,
    d: Record<string, string>,
    hidden: boolean,
  ): Part | null {
    const first = textOf(el)
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .find((l) => l !== '');
    if (!first) return null;
    const x = numbers(d['x'])[0] ?? 0;
    const y = numbers(d['y'])[0] ?? 0;
    const fs = s.fontSize;
    const width = Math.max(fs, first.length * fs * 0.55 + 2);
    const left =
      s.anchor === 'start'
        ? x
        : s.anchor === 'middle'
          ? x - width / 2
          : x - width;
    // The baseline sits about one em below the top of a line box.
    const p = place(m, { x: left, y: y - fs, w: width, h: fs * 1.25 });
    if (!p) {
      this.note(
        'A text uses a skew or a mirror that parts cannot show; it was not imported.',
      );
      return null;
    }
    const size = round2(fs * (p.h / (fs * 1.25)));
    return {
      type: 'text',
      x: p.x,
      y: p.y,
      width: p.w,
      height: p.h,
      text: first,
      wrap: false,
      align:
        s.anchor === 'start'
          ? 'left'
          : s.anchor === 'middle'
            ? 'center'
            : 'right',
      valign: 'middle',
      font: {
        size,
        color: s.fill ?? '#000000',
        ...(s.fontFamily ? { family: s.fontFamily } : {}),
        ...(s.fontWeight
          ? {
              weight: /^\d+$/.test(s.fontWeight)
                ? Number(s.fontWeight)
                : s.fontWeight,
            }
          : {}),
        ...(s.fontStyle === 'italic' ? { style: 'italic' } : {}),
      },
      ...(s.opacity < 1 ? { opacity: round2(s.opacity) } : {}),
      ...(p.rotate === 0 ? {} : { transform: { rotate: p.rotate } }),
      ...(hidden ? { visible: false } : {}),
    } as Part;
  }
}

const isLocalRef = (v: string) => v.trim().startsWith('#');
const shorten = (v: string) => (v.length > 40 ? `${v.slice(0, 37)}...` : v);

function viewOf(root: XmlElement): {
  view: { x: number; y: number; w: number; h: number };
  size: { width: number; height: number };
} {
  const vb = numbers(root.attrs['viewBox']);
  const w = length(root.attrs['width'], 0);
  const h = length(root.attrs['height'], 0);
  const hasW = w !== null && !root.attrs['width']!.includes('%') && w > 0;
  const hasH = h !== null && !root.attrs['height']!.includes('%') && h > 0;
  let view: { x: number; y: number; w: number; h: number };
  if (vb.length === 4 && vb[2]! > 0 && vb[3]! > 0)
    view = { x: vb[0]!, y: vb[1]!, w: vb[2]!, h: vb[3]! };
  else
    view = {
      x: 0,
      y: 0,
      w: hasW ? w : DEFAULT_SIZE.width,
      h: hasH ? h : DEFAULT_SIZE.height,
    };
  const size = {
    width: round2(hasW ? w : view.w),
    height: round2(hasH ? h : view.h),
  };
  return { view, size };
}

// Image mode ---------------------------------------------------------------------------------

/** Removes everything that could run or load something; reports what it removed. */
function sanitize(node: XmlNode, note: (m: string) => void): XmlNode | null {
  if (typeof node === 'string') return node;
  const lower = node.name.toLowerCase();
  if (DANGEROUS.has(lower)) {
    note(
      lower === 'script'
        ? 'A script in the file was removed.'
        : `The <${node.name}> element can run code or load things and was removed.`,
    );
    return null;
  }
  if (lower === 'style' && /@import|url\(\s*['"]?(?!#)/i.test(textOf(node))) {
    note('A style sheet that loads other files was removed.');
    return null;
  }
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.attrs)) {
    if (/^on/i.test(k)) {
      note(`The event handler ${k} on <${node.name}> was removed.`);
    } else if (
      /(^|:)href$/.test(k) &&
      !isLocalRef(v) &&
      !/^data:image\//i.test(v)
    ) {
      note(
        `An external reference (${shorten(v)}) on <${node.name}> was removed.`,
      );
    } else if (/javascript:/i.test(v) || /url\(\s*['"]?(?!#)/i.test(v)) {
      note(`An external reference in ${k} on <${node.name}> was removed.`);
    } else attrs[k] = v;
  }
  const children: XmlNode[] = [];
  for (const c of node.children) {
    const s = sanitize(c, note);
    if (s !== null) children.push(s);
  }
  return { ...node, attrs, children };
}

// Entry --------------------------------------------------------------------------------------

/**
 * Turns SVG text into shape parts. `parts` converts rectangles, circles, ellipses, lines,
 * polylines, polygons, paths and texts with plain colours and simple transforms (move, scale and
 * turn are folded into the numbers). `image` keeps the drawing as one image part after removing
 * scripts and references to other files. Whatever cannot be converted is named in `skipped`;
 * scripts, event handlers and references to other files are never imported.
 */
export function importSvg(text: string, mode: SvgImportMode): SvgImportResult {
  let root: XmlElement;
  try {
    root = parseXml(text);
  } catch (e) {
    const why = e instanceof XmlError ? e.message : 'It could not be read.';
    return {
      parts: [],
      size: { ...DEFAULT_SIZE },
      skipped: [`The file is not a valid SVG drawing. ${why}`],
    };
  }
  if (root.name.toLowerCase() !== 'svg')
    return {
      parts: [],
      size: { ...DEFAULT_SIZE },
      skipped: ['The file is not an SVG drawing.'],
    };
  const { view, size } = viewOf(root);
  const skipped: string[] = [];
  const note = (m: string) => {
    if (!skipped.includes(m)) skipped.push(m);
  };

  if (mode === 'image') {
    const clean = sanitize(root, note) as XmlElement;
    if (!clean.attrs['xmlns'])
      clean.attrs['xmlns'] = 'http://www.w3.org/2000/svg';
    const src = `data:image/svg+xml;base64,${toBase64(serializeXml(clean))}`;
    return {
      parts: [
        {
          type: 'image',
          x: 0,
          y: 0,
          width: '100%',
          height: '100%',
          src,
          fit: 'contain',
        },
      ],
      size,
      skipped,
    };
  }

  const importer = new Importer(view);
  importer.shape = size;
  const initial = multiply(
    [size.width / view.w, 0, 0, size.height / view.h, 0, 0],
    [1, 0, 0, 1, -view.x, -view.y],
  );
  importer.checkAttributes(root);
  const rootStyle = importer.style(root, ROOT_STYLE);
  const parts: Part[] = [];
  const rootT = parseTransform(root.attrs['transform']) ?? IDENTITY;
  for (const c of root.children)
    if (typeof c !== 'string')
      importer.walk(c, multiply(initial, rootT), rootStyle, parts);
  for (const m of importer.skipped) note(m);
  return { parts, size, skipped };
}
