import type {
  LabelDef,
  LookBase,
  LookBadge,
  LookColour,
  LookIconName,
  LookLineStyle,
  LookText,
  MarkerDef,
  NodeLook,
  NodeShape,
  Part,
  RelationLook,
  RelationShape,
  ShapeId,
} from '@metakit-app/core';
import { buildColourFormula, type MapValue } from './colour-map';

/**
 * Simple looks (ADR 0009): a few choices that become the drawing parts of a shape. The look is the
 * source of truth while it is present; `nodeShapeFromLook` writes the parts the compiler reads.
 */

export interface BaseInfo {
  id: LookBase;
  label: string;
  hint: string;
  /** The size a new concept of this form starts with. */
  size: { width: number; height: number };
}

export const LOOK_BASES: readonly BaseInfo[] = [
  {
    id: 'rounded',
    label: 'Rounded box',
    hint: 'A task, a step, most things.',
    size: { width: 150, height: 70 },
  },
  {
    id: 'box',
    label: 'Box',
    hint: 'Square corners.',
    size: { width: 150, height: 70 },
  },
  {
    id: 'pill',
    label: 'Pill',
    hint: 'A state, a tag, a status.',
    size: { width: 140, height: 44 },
  },
  {
    id: 'circle',
    label: 'Circle',
    hint: 'An event, a start or an end.',
    size: { width: 80, height: 80 },
  },
  {
    id: 'diamond',
    label: 'Diamond',
    hint: 'A decision or a gateway.',
    size: { width: 90, height: 90 },
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    hint: 'A checkpoint, a gate.',
    size: { width: 120, height: 70 },
  },
  {
    id: 'document',
    label: 'Document',
    hint: 'A document, a file, an artifact.',
    size: { width: 120, height: 90 },
  },
  {
    id: 'person',
    label: 'Person',
    hint: 'A person or a role.',
    size: { width: 90, height: 110 },
  },
  {
    id: 'header-box',
    label: 'Box with header',
    hint: 'An entity or class that lists attributes.',
    size: { width: 170, height: 110 },
  },
  {
    id: 'container',
    label: 'Container',
    hint: 'Holds other concepts, with a title.',
    size: { width: 400, height: 240 },
  },
  {
    id: 'swimlane',
    label: 'Swimlane',
    hint: 'A lane with its name on the left.',
    size: { width: 600, height: 160 },
  },
];

/** Small icons on a 24 by 24 grid. */
export const LOOK_ICONS: Readonly<
  Record<LookIconName, { label: string; path: string }>
> = {
  bot: {
    label: 'Robot',
    path: 'M12 2v3 M5 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M8.5 12.5h.01 M15.5 12.5h.01 M9 16h6',
  },
  person: {
    label: 'Person',
    path: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  },
  document: {
    label: 'Document',
    path: 'M6 2h8l5 5v15H6z M14 2v5h5 M9 13h7 M9 17h7',
  },
  gear: {
    label: 'Gear',
    path: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L7.5 19l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
  },
  check: { label: 'Check', path: 'M4 12.5l5 5L20 6.5' },
  warning: { label: 'Warning', path: 'M12 3L2 20h20z M12 10v5 M12 18h.01' },
  star: {
    label: 'Star',
    path: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  },
  database: {
    label: 'Database',
    path: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  },
  cloud: {
    label: 'Cloud',
    path: 'M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.5 4.5 0 0 1 17.5 18z',
  },
  lock: { label: 'Lock', path: 'M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3' },
  mail: { label: 'Mail', path: 'M3 5h18v14H3z M3 6l9 7 9-7' },
  flag: { label: 'Flag', path: 'M5 21V3 M5 4h12l-2 4 2 4H5' },
  clock: {
    label: 'Clock',
    path: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  },
  bolt: { label: 'Bolt', path: 'M13 2L4 14h7l-1 8 9-12h-7z' },
};

// Colours -------------------------------------------------------------------------------------

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#1b1f27';

/** Reads `#rgb` or `#rrggbb`; anything else gives null. */
function rgbOf(colour: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Dark or light text, whichever reads better on this colour (for a colour that depends on data, the fallback). */
export function readableOn(colour: LookColour): string {
  const base = typeof colour === 'string' ? colour : colour.fallback;
  const rgb = rgbOf(base);
  if (!rgb) return DARK_TEXT;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? DARK_TEXT : LIGHT_TEXT;
}

const mapValue = (key: string): MapValue =>
  key === 'true' ? true : key === 'false' ? false : key;

/** A colour as a shape property: the colour text, or the formula that picks it from the data. */
export function colourProp(colour: LookColour): string {
  if (typeof colour === 'string') return colour;
  const mapping = Object.entries(colour.values).map(([value, c]) => ({
    value: mapValue(value),
    colour: c,
  }));
  if (mapping.length === 0) return colour.fallback;
  return buildColourFormula(colour.by, mapping, colour.fallback);
}

const dashOf = (style: LookLineStyle): number[] | undefined =>
  style === 'dashed' ? [7, 4] : style === 'dotted' ? [2, 4] : undefined;

// Text -----------------------------------------------------------------------------------------

function textSource(
  t: LookText | undefined,
  fallback: string | null,
): string | null {
  if (!t) return fallback;
  if (t.attribute === undefined && t.text === undefined) return fallback;
  if (t.attribute) return `= ${t.attribute}`;
  if (t.attribute === null) return '= $label';
  return t.text ?? fallback;
}

// Nodes ----------------------------------------------------------------------------------------

/** A size as a percentage of the shape plus pixels, written the way shape dimensions are. */
interface D {
  p: number;
  px: number;
}
const d = (p: number, px = 0): D => ({ p, px });
function dim(v: D): number | string {
  if (v.p === 0) return v.px;
  if (v.px === 0) return `${v.p}%`;
  return `${v.p}% ${v.px < 0 ? '-' : '+'} ${Math.abs(v.px)}`;
}
const plus = (v: D, px: number): D => ({ p: v.p, px: v.px + px });

interface Region {
  x: D;
  y: D;
  w: D;
  h: D;
  align: 'left' | 'center';
}

interface Layout {
  parts: Part[];
  outline: NodeShape['outline'];
  /** Where the title (and subtitle) go. */
  region: Region;
  /** Where an icon goes, and whether the text makes room for it on the left. */
  icon: {
    x: D;
    y: D;
    makeRoom: boolean;
    /** Pixels the text moves down to make room for an icon above it. */ pushDown?: number;
  };
  /** The colour the title sits on, to choose readable text. */
  titleOn: LookColour;
  /** Forms that have no room for a second line of text. */
  noSubtitle?: boolean;
}

const FULL = { x: 0, y: 0, width: '100%', height: '100%' } as const;
type Pt = [string | number, string | number];

function body(look: NodeLook): Layout {
  const stroke = colourProp(look.border);
  const dash = dashOf(look.borderStyle);
  const style = {
    fill: colourProp(look.fill),
    stroke,
    strokeWidth: look.borderWidth,
    ...(dash ? { dash } : {}),
  };
  const rectRegion: Region = {
    x: d(0, 8),
    y: d(0, 4),
    w: d(100, -16),
    h: d(100, -8),
    align: 'center',
  };
  switch (look.base) {
    case 'box':
    case 'rounded':
    case 'pill': {
      const radius =
        look.base === 'pill'
          ? 999
          : (look.corner ?? (look.base === 'rounded' ? 10 : 0));
      return {
        parts: [{ type: 'rect', ...FULL, radius, ...style }],
        outline: 'rect',
        region:
          look.base === 'pill'
            ? { ...rectRegion, x: d(0, 16), w: d(100, -32) }
            : rectRegion,
        icon: {
          x: d(0, look.base === 'pill' ? 14 : 8),
          y: d(50, -10),
          makeRoom: true,
        },
        titleOn: look.fill,
      };
    }
    case 'circle':
      return {
        parts: [{ type: 'ellipse', ...FULL, ...style }],
        outline: 'ellipse',
        region: { x: d(15), y: d(15), w: d(70), h: d(70), align: 'center' },
        icon: { x: d(50, -10), y: d(8), makeRoom: false, pushDown: 20 },
        titleOn: look.fill,
      };
    case 'diamond': {
      const points: Pt[] = [
        ['50%', 0],
        ['100%', '50%'],
        ['50%', '100%'],
        [0, '50%'],
      ];
      return {
        parts: [{ type: 'polygon', points, ...style }],
        outline: { type: 'polygon', points },
        region: { x: d(24), y: d(24), w: d(52), h: d(52), align: 'center' },
        icon: { x: d(50, -10), y: d(14), makeRoom: false, pushDown: 18 },
        titleOn: look.fill,
      };
    }
    case 'hexagon': {
      const points: Pt[] = [
        ['15%', 0],
        ['85%', 0],
        ['100%', '50%'],
        ['85%', '100%'],
        ['15%', '100%'],
        [0, '50%'],
      ];
      return {
        parts: [{ type: 'polygon', points, ...style }],
        outline: { type: 'polygon', points },
        region: {
          x: d(18),
          y: d(0, 4),
          w: d(64),
          h: d(100, -8),
          align: 'center',
        },
        icon: { x: d(18, 4), y: d(50, -10), makeRoom: true },
        titleOn: look.fill,
      };
    }
    case 'document': {
      const points: Pt[] = [
        [0, 0],
        ['100% - 18', 0],
        ['100%', 18],
        ['100%', '100%'],
        [0, '100%'],
      ];
      return {
        parts: [
          { type: 'polygon', points, ...style },
          {
            type: 'polygon',
            points: [
              ['100% - 18', 0],
              ['100% - 18', 18],
              ['100%', 18],
            ],
            fill: '#00000022',
            stroke,
            strokeWidth: Math.max(1, look.borderWidth - 0.5),
          },
        ],
        outline: { type: 'polygon', points },
        region: {
          x: d(0, 8),
          y: d(0, 20),
          w: d(100, -16),
          h: d(100, -26),
          align: 'center',
        },
        icon: { x: d(0, 8), y: d(0, 4), makeRoom: false },
        titleOn: look.fill,
      };
    }
    case 'person':
      return {
        parts: [
          {
            type: 'ellipse',
            x: '50% - 16',
            y: 4,
            width: 32,
            height: 32,
            ...style,
          },
          {
            type: 'rect',
            x: 6,
            y: 42,
            width: '100% - 12',
            height: '100% - 46',
            radius: 18,
            ...style,
          },
        ],
        outline: 'rect',
        region: {
          x: d(0, 10),
          y: d(0, 46),
          w: d(100, -20),
          h: d(100, -52),
          align: 'center',
        },
        icon: { x: d(50, -10), y: d(0, 10), makeRoom: false },
        titleOn: look.fill,
      };
    case 'header-box':
      return {
        parts: [
          {
            type: 'rect',
            ...FULL,
            radius: look.corner ?? 4,
            ...style,
            fill: '#ffffff',
          },
          {
            type: 'rect',
            x: 0,
            y: 0,
            width: '100%',
            height: 28,
            radius: look.corner ?? 4,
            fill: colourProp(look.fill),
            stroke,
          },
        ],
        outline: 'rect',
        region: {
          x: d(0, 8),
          y: d(0, 2),
          w: d(100, -36),
          h: d(0, 24),
          align: 'center',
        },
        icon: { x: d(100, -26), y: d(0, 4), makeRoom: false },
        titleOn: look.fill,
        noSubtitle: true,
      };
    case 'container':
      return {
        parts: [{ type: 'rect', ...FULL, radius: look.corner ?? 6, ...style }],
        outline: 'rect',
        region: {
          x: d(0, 12),
          y: d(0, 4),
          w: d(100, -48),
          h: d(0, 24),
          align: 'left',
        },
        icon: { x: d(100, -30), y: d(0, 6), makeRoom: false },
        titleOn: '#ffffff',
        noSubtitle: true,
      };
    case 'swimlane':
      return {
        parts: [
          {
            type: 'rect',
            ...FULL,
            fill: '#ffffff00',
            stroke,
            strokeWidth: look.borderWidth,
            ...(dash ? { dash } : {}),
          },
          {
            type: 'rect',
            x: 0,
            y: 0,
            width: 28,
            height: '100%',
            fill: colourProp(look.fill),
            stroke,
            strokeWidth: look.borderWidth,
          },
        ],
        outline: 'rect',
        region: rectRegion,
        icon: { x: d(0, 4), y: d(0, 4), makeRoom: false },
        titleOn: look.fill,
        noSubtitle: true,
      };
  }
}

function textPart(
  source: string,
  box: {
    x: number | string;
    y: number | string;
    width: number | string;
    height: number | string;
  },
  colour: string,
  options: {
    size?: number;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
  } = {},
): Part {
  return {
    type: 'text',
    ...box,
    text: source,
    wrap: true,
    fit: 'shrink',
    align: options.align ?? 'center',
    valign: 'middle',
    fill: colour,
    font: {
      ...(options.size ? { size: options.size } : {}),
      ...(options.bold ? { weight: 600 } : {}),
    },
  };
}

const quoted = (text: string) =>
  `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const SUBTITLE_HEIGHT = 18;

/** The node shape a look draws; the look is kept in `look`. */
export function nodeShapeFromLook(
  look: NodeLook,
  id: ShapeId,
  name?: string,
): NodeShape {
  const layout = body(look);
  const parts: Part[] = [...layout.parts];
  const titleColour = colourPropOr(
    look.title.colour,
    readableOn(layout.titleOn),
  );
  const titleSource = textSource(look.title, '= $label')!;

  if (look.base === 'swimlane') {
    // A box already centred on the strip: it turns around its own centre.
    const label = textPart(
      titleSource,
      { x: -66, y: '50% - 14', width: 160, height: 28 },
      titleColour,
      {
        size: look.title.size,
        bold: look.title.bold ?? true,
      },
    ) as Part & { transform?: unknown };
    label.transform = { rotate: -90 };
    parts.push(label);
  } else {
    const subtitle = layout.noSubtitle ? null : textSource(look.subtitle, null);
    const room = look.icon && layout.icon.makeRoom ? 26 : 0;
    const r = layout.region;
    const down = look.icon ? (layout.icon.pushDown ?? 0) : 0;
    const x = plus(r.x, room);
    const w = plus(r.w, -room);
    const region = { y: plus(r.y, down), h: plus(r.h, -down) };
    parts.push(
      textPart(
        titleSource,
        {
          x: dim(x),
          y: dim(region.y),
          width: dim(w),
          height: dim(
            subtitle ? plus(region.h, -SUBTITLE_HEIGHT - 2) : region.h,
          ),
        },
        titleColour,
        {
          size: look.title.size,
          bold: look.title.bold ?? look.base === 'container',
          align: r.align,
        },
      ),
    );
    if (subtitle)
      parts.push(
        textPart(
          subtitle,
          {
            x: dim(x),
            y: dim(
              plus({ p: r.y.p + r.h.p, px: r.y.px + r.h.px }, -SUBTITLE_HEIGHT),
            ),
            width: dim(w),
            height: SUBTITLE_HEIGHT,
          },
          colourPropOr(look.subtitle?.colour, DARK_TEXT_MUTED),
          { size: look.subtitle?.size ?? 11, align: r.align },
        ),
      );
    // Attributes listed inside a header box, one line each.
    if (look.base === 'header-box' && look.fields)
      look.fields.forEach((key, i) =>
        parts.push(
          textPart(
            `= ${quoted(`${key}: `)} + ${key}`,
            { x: 8, y: 34 + i * 16, width: '100% - 16', height: 16 },
            DARK_TEXT_MUTED,
            { size: 11, align: 'left' },
          ),
        ),
      );
  }

  if (look.icon) {
    const at = layout.icon;
    parts.push({
      type: 'path',
      d: LOOK_ICONS[look.icon.name].path,
      viewBox: [0, 0, 24, 24],
      x: dim(at.x),
      y: dim(at.y),
      width: 20,
      height: 20,
      fill: '#00000000',
      stroke: look.icon.colour ?? readableOn(layout.titleOn),
      strokeWidth: 1.8,
    });
  }

  if (look.badge) parts.push(...badgeParts(look.badge));

  return {
    id,
    ...(name ? { name } : {}),
    kind: 'node',
    size: {
      ...look.size,
      resizable: look.size.resizable ?? true,
      minWidth: 40,
      minHeight: 28,
    },
    outline: layout.outline,
    parts,
    look,
  };
}

const DARK_TEXT_MUTED = '#5a6373';

const colourPropOr = (
  colour: LookColour | undefined,
  fallback: string,
): string => (colour === undefined ? fallback : colourProp(colour));

function badgeParts(badge: LookBadge): Part[] {
  const when = `= ${badge.attribute} == ${quoted(badge.equals)}`;
  return [
    {
      type: 'rect',
      x: '100% - 34',
      y: -6,
      width: 30,
      height: 16,
      radius: 8,
      fill: badge.colour,
      visible: when,
    },
    {
      ...textPart(
        badge.text,
        { x: '100% - 34', y: -6, width: 30, height: 16 },
        readableOn(badge.colour),
        { size: 10, bold: true },
      ),
      fit: 'shrink',
      visible: when,
    } as Part,
  ];
}

// Relations ------------------------------------------------------------------------------------

const marker = (type: RelationLook['end']): MarkerDef | undefined =>
  type === 'none' ? undefined : { type };

export function relationShapeFromLook(
  look: RelationLook,
  id: ShapeId,
  name?: string,
): RelationShape {
  const dash = dashOf(look.style);
  const start = marker(look.start);
  const end = marker(look.end);
  const labels: LabelDef[] | undefined = look.label
    ? [
        {
          at: 'middle',
          text: `= ${look.label.attribute}`,
          font: { size: 11 },
          background: '#ffffff',
          visible: `= ${look.label.attribute} != null`,
        },
      ]
    : undefined;
  return {
    id,
    ...(name ? { name } : {}),
    kind: 'relation',
    line: {
      stroke: colourProp(look.colour),
      strokeWidth: look.width,
      routing: look.routing,
      ...(dash ? { dash } : {}),
    },
    ...(start ? { startMarker: start } : {}),
    ...(end ? { endMarker: end } : {}),
    ...(labels ? { labels } : {}),
    look,
  };
}

// Defaults and helpers ---------------------------------------------------------------------------

export function baseInfo(base: LookBase): BaseInfo {
  return LOOK_BASES.find((b) => b.id === base)!;
}

/** A sensible look for a new class: containers and swimlanes get their own forms. */
export function defaultNodeLook(
  kind: 'node' | 'container' | 'swimlane' = 'node',
  base?: LookBase,
): NodeLook {
  const chosen: LookBase =
    base ??
    (kind === 'container'
      ? 'container'
      : kind === 'swimlane'
        ? 'swimlane'
        : 'rounded');
  const info = baseInfo(chosen);
  const light = chosen === 'container' || chosen === 'swimlane';
  return {
    base: chosen,
    fill: light ? '#e9ecef' : '#dbe4ff',
    border: light ? '#868e96' : '#4263eb',
    borderWidth: 1.5,
    borderStyle: chosen === 'container' ? 'dashed' : 'solid',
    title: { attribute: null },
    size: { width: info.size.width, height: info.size.height, resizable: true },
  };
}

export function defaultRelationLook(): RelationLook {
  return {
    colour: '#6b7a90',
    width: 1.5,
    style: 'solid',
    routing: 'orthogonal',
    start: 'none',
    end: 'arrow',
    label: null,
  };
}

/** The attribute keys a look reads. */
export function lookAttributeKeys(look: NodeLook | RelationLook): string[] {
  const keys = new Set<string>();
  const colour = (c: LookColour | undefined) => {
    if (c && typeof c !== 'string') keys.add(c.by);
  };
  if ('base' in look) {
    colour(look.fill);
    colour(look.border);
    for (const t of [look.title, look.subtitle]) {
      if (t?.attribute) keys.add(t.attribute);
      colour(t?.colour);
    }
    if (look.badge) keys.add(look.badge.attribute);
    for (const f of look.fields ?? []) keys.add(f);
  } else {
    colour(look.colour);
    if (look.label) keys.add(look.label.attribute);
  }
  return [...keys];
}

/** The attributes whose values change the look, for the preview strip: one tile per value. */
export function lookDrivers(
  look: NodeLook | RelationLook,
): { attribute: string; values: string[] }[] {
  const out = new Map<string, Set<string>>();
  const add = (attribute: string, values: string[]) => {
    const set = out.get(attribute) ?? new Set<string>();
    for (const v of values) set.add(v);
    out.set(attribute, set);
  };
  const colour = (c: LookColour | undefined) => {
    if (c && typeof c !== 'string') add(c.by, Object.keys(c.values));
  };
  if ('base' in look) {
    colour(look.fill);
    colour(look.border);
    colour(look.title.colour);
    if (look.badge) add(look.badge.attribute, [look.badge.equals]);
  } else colour(look.colour);
  return [...out].map(([attribute, values]) => ({
    attribute,
    values: [...values],
  }));
}

/** Renames an attribute key everywhere the look uses it. */
export function renameLookKey<T extends NodeLook | RelationLook>(
  look: T,
  from: string,
  to: string,
): T {
  const key = (k: string) => (k === from ? to : k);
  const colour = (c: LookColour): LookColour =>
    typeof c === 'string' ? c : { ...c, by: key(c.by) };
  const text = (t: LookText): LookText => ({
    ...t,
    ...(t.attribute ? { attribute: key(t.attribute) } : {}),
    ...(t.colour !== undefined ? { colour: colour(t.colour) } : {}),
  });
  if ('base' in look) {
    const n = look as NodeLook;
    const next: NodeLook = {
      ...n,
      fill: colour(n.fill),
      border: colour(n.border),
      title: text(n.title),
      ...(n.subtitle ? { subtitle: text(n.subtitle) } : {}),
      ...(n.badge
        ? { badge: { ...n.badge, attribute: key(n.badge.attribute) } }
        : {}),
      ...(n.fields ? { fields: n.fields.map(key) } : {}),
    };
    return next as T;
  }
  const r = look as RelationLook;
  return {
    ...r,
    colour: colour(r.colour),
    label: r.label ? { attribute: key(r.label.attribute) } : null,
  } as T;
}
