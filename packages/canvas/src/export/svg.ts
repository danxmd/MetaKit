import type { CompiledRelation, DrawOp, OpStyle } from '@metakit-app/shapes';
import type { Point } from '../geometry';
import { endpoint, pointAlong } from '../paint';
import type { Scene } from '../scene';
import { collectContent, type ExportSelection } from './content';

export interface SvgExportOptions {
  /** Export only these items. Connectors are drawn only when they are in the set. */
  selection?: ExportSelection;
  /** Space around the content, in world units. Default 16. */
  padding?: number;
  /** Background colour, or null for none. Default null. */
  background?: string | null;
  /** Shown by viewers as the document's title. */
  title?: string;
  /** Turns an `assets/` path into a data URI; images that cannot be resolved are left out. */
  resolveImage?: (src: string) => string | null;
}

export const DEFAULT_EXPORT_PADDING = 16;

/** Short, stable number text: three decimals at most, no trailing zeros, no "-0". */
function num(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Escapes text for XML content and for double-quoted attribute values. */
export function escapeXml(text: string): string {
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // Control characters other than tab and line breaks are not allowed in XML 1.0.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  );
}

class Defs {
  private n = 0;
  readonly out: string[] = [];
  id(prefix: string): string {
    return `${prefix}${++this.n}`;
  }
}

function gradientDef(
  defs: Defs,
  paint: Extract<NonNullable<OpStyle['fill']>, object>,
): string {
  const { box, angle, stops } = paint;
  const a = (angle * Math.PI) / 180;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const half =
    (Math.abs(Math.cos(a)) * box.w + Math.abs(Math.sin(a)) * box.h) / 2;
  const id = defs.id('g');
  const stopsXml = stops
    .map(
      (s) =>
        `<stop offset="${num(Math.min(1, Math.max(0, s.at)))}" stop-color="${escapeXml(s.color)}"/>`,
    )
    .join('');
  defs.out.push(
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(cx - Math.cos(a) * half)}" y1="${num(cy - Math.sin(a) * half)}" x2="${num(cx + Math.cos(a) * half)}" y2="${num(cy + Math.sin(a) * half)}">${stopsXml}</linearGradient>`,
  );
  return id;
}

function shadowDef(defs: Defs, shadow: NonNullable<OpStyle['shadow']>): string {
  const id = defs.id('s');
  // Canvas blur is twice the Gaussian's standard deviation.
  defs.out.push(
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${num(shadow.x ?? 0)}" dy="${num(shadow.y ?? 2)}" stdDeviation="${num((shadow.blur ?? 4) / 2)}" flood-color="${escapeXml(shadow.color ?? 'rgba(0,0,0,0.3)')}"/></filter>`,
  );
  return id;
}

/**
 * One drawn shape with its style. With a shadow the fill and the stroke are separate elements,
 * because a filter on one element would cast a shadow of the stroke too, which the screen does not.
 */
function styled(
  defs: Defs,
  tag: string,
  geometry: string,
  style: OpStyle,
): string {
  const fill =
    style.fill === null
      ? 'none'
      : typeof style.fill === 'string'
        ? escapeXml(style.fill)
        : `url(#${gradientDef(defs, style.fill)})`;
  const hasStroke = style.stroke !== null && style.strokeWidth > 0;
  const alpha = style.opacity === 1 ? '' : ` opacity="${num(style.opacity)}"`;
  const strokeAttrs = hasStroke
    ? ` stroke="${escapeXml(style.stroke!)}" stroke-width="${num(style.strokeWidth)}"${
        style.dash && style.dash.length > 0
          ? ` stroke-dasharray="${style.dash.map(num).join(' ')}"`
          : ''
      }`
    : '';
  if (style.shadow && style.fill !== null) {
    const filter = shadowDef(defs, style.shadow);
    let out = `<${tag} ${geometry} fill="${fill}" filter="url(#${filter})"${alpha}/>`;
    if (hasStroke)
      out += `<${tag} ${geometry} fill="none"${strokeAttrs}${alpha}/>`;
    return out;
  }
  const filter = style.shadow
    ? ` filter="url(#${shadowDef(defs, style.shadow)})"`
    : '';
  return `<${tag} ${geometry} fill="${fill}"${strokeAttrs}${filter}${alpha}/>`;
}

interface FontLike {
  family: string;
  size: number;
  weight: string | number;
  style: string;
  color: string;
}

function textElement(
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  font: FontLike,
): string {
  const anchor =
    align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const weight =
    font.weight === 'normal' || font.weight === 400
      ? ''
      : ` font-weight="${escapeXml(String(font.weight))}"`;
  const style =
    font.style === 'normal' ? '' : ` font-style="${escapeXml(font.style)}"`;
  // The canvas centres a line on the middle of its em box; 0.35em below the baseline is that
  // middle for ordinary fonts, and unlike dominant-baseline it works in every viewer.
  return `<text x="${num(x)}" y="${num(y)}" dy="0.35em" text-anchor="${anchor}" font-family="${escapeXml(font.family)}" font-size="${num(font.size)}"${weight}${style} fill="${escapeXml(font.color)}">${escapeXml(text)}</text>`;
}

function opsToSvg(
  ops: readonly DrawOp[],
  defs: Defs,
  resolveImage: (src: string) => string | null,
): string {
  const out: string[] = [];
  // Canvas `transform` and `clip` last until the matching `restore`; each opens a group here, and
  // the frame on the stack counts how many to close.
  const frames: number[] = [0];
  const open = (tag: string) => {
    out.push(tag);
    frames[frames.length - 1]!++;
  };
  for (const op of ops) {
    switch (op.op) {
      case 'save':
        frames.push(0);
        break;
      case 'restore':
        if (frames.length > 1) {
          for (let i = frames.pop()!; i > 0; i--) out.push('</g>');
        }
        break;
      case 'transform':
        open(`<g transform="matrix(${op.matrix.map(num).join(' ')})">`);
        break;
      case 'clip': {
        const id = defs.id('c');
        const { box } = op;
        const shape =
          op.kind === 'ellipse'
            ? `<ellipse cx="${num(box.x + box.w / 2)}" cy="${num(box.y + box.h / 2)}" rx="${num(box.w / 2)}" ry="${num(box.h / 2)}"/>`
            : `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}"${op.radius > 0 ? ` rx="${num(Math.min(op.radius, box.w / 2, box.h / 2))}"` : ''}/>`;
        defs.out.push(`<clipPath id="${id}">${shape}</clipPath>`);
        open(`<g clip-path="url(#${id})">`);
        break;
      }
      case 'rect': {
        const r = Math.min(op.radius, op.box.w / 2, op.box.h / 2);
        out.push(
          styled(
            defs,
            'rect',
            `x="${num(op.box.x)}" y="${num(op.box.y)}" width="${num(op.box.w)}" height="${num(op.box.h)}"${op.radius > 0 ? ` rx="${num(r)}"` : ''}`,
            op.style,
          ),
        );
        break;
      }
      case 'ellipse':
        out.push(
          styled(
            defs,
            'ellipse',
            `cx="${num(op.box.x + op.box.w / 2)}" cy="${num(op.box.y + op.box.h / 2)}" rx="${num(op.box.w / 2)}" ry="${num(op.box.h / 2)}"`,
            op.style,
          ),
        );
        break;
      case 'polygon':
        out.push(
          styled(
            defs,
            'polygon',
            `points="${op.points.map(([x, y]) => `${num(x)},${num(y)}`).join(' ')}"`,
            op.style,
          ),
        );
        break;
      case 'path': {
        const vb = op.viewBox;
        if (vb) {
          const kx = op.box.w / vb[2];
          const ky = op.box.h / vb[3];
          const k = (kx + ky) / 2 || 1;
          out.push(
            `<g transform="translate(${num(op.box.x)} ${num(op.box.y)}) scale(${num(kx)} ${num(ky)}) translate(${num(-vb[0])} ${num(-vb[1])})">`,
            styled(defs, 'path', `d="${escapeXml(op.d)}"`, {
              ...op.style,
              strokeWidth: op.style.strokeWidth / k,
            }),
            '</g>',
          );
        } else
          out.push(
            `<g transform="translate(${num(op.box.x)} ${num(op.box.y)})">`,
            styled(defs, 'path', `d="${escapeXml(op.d)}"`, op.style),
            '</g>',
          );
        break;
      }
      case 'text':
        for (const line of op.lines)
          out.push(textElement(line.text, line.x, line.y, op.align, op.font));
        break;
      case 'image': {
        const href = op.src.startsWith('data:') ? op.src : resolveImage(op.src);
        if (!href) break;
        const fit =
          op.fit === 'stretch'
            ? 'none'
            : op.fit === 'cover'
              ? 'xMidYMid slice'
              : 'xMidYMid meet';
        out.push(
          `<image href="${escapeXml(href)}" x="${num(op.box.x)}" y="${num(op.box.y)}" width="${num(op.box.w)}" height="${num(op.box.h)}" preserveAspectRatio="${fit}"${op.opacity === 1 ? '' : ` opacity="${num(op.opacity)}"`}/>`,
        );
        break;
      }
    }
  }
  for (const count of frames) for (let i = 0; i < count; i++) out.push('</g>');
  return out.join('');
}

const pt = (p: Point) => `${num(p.x)} ${num(p.y)}`;

/**
 * A polyline as SVG path data, with the same rounded corners or smoothed curves the canvas draws
 * (see `tracePolyline`).
 */
export function polylineData(
  route: readonly Point[],
  look: Pick<CompiledRelation['line'], 'routing' | 'corners'>,
): string {
  const first = route[0]!;
  let d = `M${pt(first)}`;
  if (route.length < 3 || (look.routing !== 'curved' && look.corners <= 0)) {
    for (let i = 1; i < route.length; i++) d += `L${pt(route[i]!)}`;
    return d;
  }
  const last = route[route.length - 1]!;
  if (look.routing === 'curved') {
    for (let i = 1; i < route.length - 1; i++) {
      const p = route[i]!;
      const n = route[i + 1]!;
      d += `Q${pt(p)} ${num((p.x + n.x) / 2)} ${num((p.y + n.y) / 2)}`;
    }
    return `${d}L${pt(last)}`;
  }
  // Rounded corners: what canvas `arcTo` does, written out as a line and an arc per corner.
  let current = first;
  for (let i = 1; i < route.length - 1; i++) {
    const p = route[i]!;
    const n = route[i + 1]!;
    const v1 = { x: current.x - p.x, y: current.y - p.y };
    const v2 = { x: n.x - p.x, y: n.y - p.y };
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    const cross = v1.x * v2.y - v1.y * v2.x;
    if (l1 === 0 || l2 === 0 || Math.abs(cross) < 1e-9 * l1 * l2) {
      d += `L${pt(p)}`;
      current = p;
      continue;
    }
    const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
    const t =
      look.corners / Math.tan(Math.acos(Math.max(-1, Math.min(1, cos))) / 2);
    const a = { x: p.x + (v1.x / l1) * t, y: p.y + (v1.y / l1) * t };
    const b = { x: p.x + (v2.x / l2) * t, y: p.y + (v2.y / l2) * t };
    // Travelling from `current` through the corner to `n`: a positive cross product of the two
    // travel directions is a clockwise turn on a y-down screen, which is sweep flag 1.
    const sweep = -cross > 0 ? 1 : 0;
    const r = num(look.corners);
    d += `L${pt(a)}A${r} ${r} 0 0 ${sweep} ${pt(b)}`;
    current = b;
  }
  return `${d}L${pt(last)}`;
}

function markerSvg(
  type: string,
  fill: string,
  size: number,
  tip: Point,
  angle: number,
  lineWidth: number,
): string {
  const c = escapeXml(fill);
  const w = num(lineWidth);
  const open = `fill="none" stroke="${c}" stroke-width="${w}"`;
  const hollow = `fill="#ffffff" stroke="${c}" stroke-width="${w}"`;
  const n = (v: number) => num(v);
  let body: string;
  switch (type) {
    case 'arrow':
      body = `<polygon points="0,0 ${n(-size)},${n(-size / 2)} ${n(-size)},${n(size / 2)}" fill="${c}"/>`;
      break;
    case 'open-arrow':
      body = `<polyline points="${n(-size)},${n(-size / 2)} 0,0 ${n(-size)},${n(size / 2)}" ${open}/>`;
      break;
    case 'triangle':
      body = `<polygon points="0,0 ${n(-size)},${n(-size / 2)} ${n(-size)},${n(size / 2)}" ${hollow}/>`;
      break;
    case 'diamond':
      body = `<polygon points="0,0 ${n(-size / 2)},${n(-size / 3)} ${n(-size)},0 ${n(-size / 2)},${n(size / 3)}" fill="${c}"/>`;
      break;
    case 'circle':
      body = `<circle cx="${n(-size / 2)}" cy="0" r="${n(size / 2)}" ${hollow}/>`;
      break;
    case 'cross':
      body = `<path d="M${n(-size)} ${n(-size / 2)}L0 ${n(size / 2)}M${n(-size)} ${n(size / 2)}L0 ${n(-size / 2)}" ${open}/>`;
      break;
    case 'bar':
      body = `<path d="M${n(-size / 3)} ${n(-size / 2)}L${n(-size / 3)} ${n(size / 2)}" ${open}/>`;
      break;
    default:
      return '';
  }
  return `<g transform="translate(${pt(tip)}) rotate(${n((angle * 180) / Math.PI)})">${body}</g>`;
}

function connectorSvg(route: readonly Point[], look: CompiledRelation): string {
  if (route.length < 2) return '';
  const line = look.line;
  const dash =
    line.dash.length > 0
      ? ` stroke-dasharray="${line.dash.map(num).join(' ')}"`
      : '';
  let out = `<path d="${polylineData(route, line)}" fill="none" stroke="${escapeXml(line.stroke)}" stroke-width="${num(line.width)}"${dash}/>`;
  for (const [marker, which] of [
    [look.start, 'start'],
    [look.end, 'end'],
  ] as const) {
    if (!marker) continue;
    const e = endpoint(route, which);
    if (e)
      out += markerSvg(
        marker.type,
        marker.fill,
        marker.size,
        e,
        e.angle,
        line.width,
      );
  }
  for (const label of look.labels) {
    const share = label.at === 'start' ? 0.08 : label.at === 'end' ? 0.92 : 0.5;
    const p = pointAlong(route, share);
    const x = p.x + label.offset.x;
    const y = p.y + label.offset.y;
    if (label.background) {
      // Text cannot be measured without a DOM, so the box is sized from an average glyph width.
      const w = label.text.length * label.font.size * 0.55 + 6;
      out += `<rect x="${num(x - w / 2)}" y="${num(y - label.font.size * 0.7)}" width="${num(w)}" height="${num(label.font.size * 1.4)}" fill="${escapeXml(label.background)}"/>`;
    }
    out += textElement(label.text, x, y, 'center', label.font);
  }
  return out;
}

/**
 * A standalone SVG of the model (or a selection) from the same draw lists as the screen. Text
 * stays text. Pure string building, so it runs in Node, and the same input gives the same string.
 */
export function exportSvg(
  scene: Scene,
  options: SvgExportOptions = {},
): string {
  const padding = options.padding ?? DEFAULT_EXPORT_PADDING;
  const content = collectContent(scene, options.selection, padding);
  const { bounds } = content;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const defs = new Defs();
  const resolve = options.resolveImage ?? (() => null);

  const body: string[] = [];
  for (const c of content.connectors) body.push(connectorSvg(c.route, c.look));
  for (const e of content.elements) {
    const inner = opsToSvg(e.compiled.compiled.ops, defs, resolve);
    if (inner === '') continue;
    body.push(`<g transform="translate(${num(e.x)} ${num(e.y)})">${inner}</g>`);
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}" height="${num(h)}" viewBox="${num(bounds.minX)} ${num(bounds.minY)} ${num(w)} ${num(h)}">`,
  ];
  if (options.title) lines.push(`<title>${escapeXml(options.title)}</title>`);
  if (defs.out.length > 0) lines.push(`<defs>${defs.out.join('')}</defs>`);
  if (options.background != null)
    lines.push(
      `<rect x="${num(bounds.minX)}" y="${num(bounds.minY)}" width="${num(w)}" height="${num(h)}" fill="${escapeXml(options.background)}"/>`,
    );
  lines.push(...body, '</svg>', '');
  return lines.join('\n');
}
