import {
  effectiveAttributes,
  isFormula,
  newId,
  optionValue,
  type AttributeDef,
  type ClassDef,
  type ClassId,
  type Json,
  type LookBase,
  type LookColour,
  type MarkerType,
  type NodeLook,
  type NodeShape,
  type RelationDef,
  type RelationId,
  type RelationLook,
  type RelationShape,
  type ShapeDef,
  type ShapeId,
  type ToolCommandOrBatch,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  baseInfo,
  compileNode,
  starterFor,
  defaultNodeLook,
  defaultRelationLook,
  lookDrivers,
  makeScope,
  nodeShapeFromLook,
  relationShapeFromLook,
  sampleValuesFor,
  type Compiled,
} from '@metakit-app/shapes';

/**
 * The view-model of the simple Appearance editor (ADR 0009): what the controls offer, how the
 * preview tiles are made and which commands save a look. No DOM, so it is tested on its own.
 */

// Colours -------------------------------------------------------------------------------------

export const PALETTE: readonly { name: string; value: string }[] = [
  { name: 'White', value: '#ffffff' },
  { name: 'Light grey', value: '#e9ecef' },
  { name: 'Dark grey', value: '#495057' },
  { name: 'Black', value: '#1b1f27' },
  { name: 'Red', value: '#ffc9c9' },
  { name: 'Orange', value: '#ffd8a8' },
  { name: 'Yellow', value: '#ffec99' },
  { name: 'Green', value: '#b2f2bb' },
  { name: 'Teal', value: '#96f2d7' },
  { name: 'Blue', value: '#a5d8ff' },
  { name: 'Indigo', value: '#bac8ff' },
  { name: 'Purple', value: '#eebefa' },
];

/** Stronger colours, offered for borders, text and marks. */
export const STRONG_PALETTE: readonly { name: string; value: string }[] = [
  { name: 'White', value: '#ffffff' },
  { name: 'Light grey', value: '#adb5bd' },
  { name: 'Dark grey', value: '#495057' },
  { name: 'Black', value: '#1b1f27' },
  { name: 'Red', value: '#e03131' },
  { name: 'Orange', value: '#f08c00' },
  { name: 'Yellow', value: '#f2c200' },
  { name: 'Green', value: '#2f9e44' },
  { name: 'Teal', value: '#0c8599' },
  { name: 'Blue', value: '#1c7ed6' },
  { name: 'Indigo', value: '#4263eb' },
  { name: 'Purple', value: '#9c36b5' },
];

/** `#abc` and `#aabbcc` are accepted, anything else is not a colour here. */
export function normaliseHex(text: string): string | null {
  const t = text.trim().toLowerCase();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (!m) return null;
  const h = m[1]!;
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`;
}

export const isDataColour = (c: LookColour): c is Exclude<LookColour, string> =>
  typeof c !== 'string';

/** The one colour a colour stands for when it does not depend on data: itself, or its fallback. */
export const fixedColour = (c: LookColour): string =>
  typeof c === 'string' ? c : c.fallback;

// Attributes ----------------------------------------------------------------------------------

export interface ValueOption {
  /** The text stored in the look (`true` and `false` for yes/no). */
  value: string;
  label: string;
}

/** The values a colour or a mark can be set for: the options of a choice, Yes and No, else none. */
export function valueOptions(attr: AttributeDef | undefined): ValueOption[] {
  if (!attr) return [];
  if (attr.type === 'choice')
    return attr.options.map((o) => ({
      value: optionValue(o),
      label: optionValue(o),
    }));
  if (attr.type === 'boolean')
    return [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ];
  return [];
}

/** Attributes that make sense to colour by or to show a mark for. */
export const isDrivable = (a: AttributeDef): boolean =>
  a.type === 'choice' ||
  a.type === 'boolean' ||
  a.type === 'text' ||
  a.type === 'integer' ||
  a.type === 'number';

/** Attributes whose value can be shown as text. */
export const isShowable = (a: AttributeDef): boolean =>
  a.type !== 'table' && a.type !== 'action';

export const attributeLabel = (a: AttributeDef, language = 'en'): string => {
  const label = a.labels?.[language];
  return label && label !== a.key ? `${label} (${a.key})` : a.key;
};

const byKey = (attrs: readonly AttributeDef[], key: string | undefined) =>
  key === undefined ? undefined : attrs.find((a) => a.key === key);

/** Colours for each option, spread over the palette, so a new data colour looks useful at once. */
const DEFAULT_VALUE_COLOURS = [
  '#b2f2bb',
  '#ffc9c9',
  '#ffec99',
  '#a5d8ff',
  '#eebefa',
  '#ffd8a8',
  '#96f2d7',
  '#bac8ff',
];

/** Turns a fixed colour into one that depends on an attribute, starting with a colour per option. */
export function dataColour(
  attr: AttributeDef,
  current: LookColour,
  palette: readonly string[] = DEFAULT_VALUE_COLOURS,
): LookColour {
  const fallback = fixedColour(current);
  const values: Record<string, string> = {};
  valueOptions(attr).forEach((o, i) => {
    values[o.value] = palette[i % palette.length]!;
  });
  return { by: attr.key, values, fallback };
}

/** Sets the colour for one value; an empty colour removes the value. */
export function withValueColour(
  colour: LookColour,
  value: string,
  to: string | null,
): LookColour {
  if (typeof colour === 'string') return colour;
  const values = { ...colour.values };
  if (to === null) delete values[value];
  else values[value] = to;
  return { ...colour, values };
}

/** Changes the attribute a colour depends on, giving the new attribute's options a colour each. */
export function dependOn(
  colour: LookColour,
  attr: AttributeDef,
  palette?: readonly string[],
): LookColour {
  if (isDataColour(colour) && colour.by === attr.key) return colour;
  return dataColour(attr, colour, palette);
}

// Looks ---------------------------------------------------------------------------------------

export const BOX_LIKE: readonly LookBase[] = [
  'box',
  'rounded',
  'header-box',
  'container',
  'swimlane',
];

/** The form changes; colours, text, icon and mark stay. The size follows only if it was not resized. */
export function withBase(look: NodeLook, base: LookBase): NodeLook {
  const from = baseInfo(look.base).size;
  const to = baseInfo(base).size;
  const untouched =
    look.size.width === from.width && look.size.height === from.height;
  const next: NodeLook = {
    ...look,
    base,
    size: untouched
      ? { ...look.size, width: to.width, height: to.height }
      : look.size,
  };
  // A header box lists fields; the other forms have no room for them.
  if (base !== 'header-box') delete next.fields;
  return next;
}

/** The base a hand-drawn shape resembles, for "Replace with a simple look". */
export function baseFromShape(
  shape: NodeShape,
  cls: { kind: ClassDef['kind']; key: string },
): LookBase {
  const outline = shape.outline;
  if (outline === 'ellipse')
    return shape.size.width === shape.size.height ? 'circle' : 'pill';
  if (typeof outline === 'object' && outline.points.length === 4)
    return 'diamond';
  if (typeof outline === 'object' && outline.points.length === 6)
    return 'hexagon';
  if (cls.kind === 'container') return 'container';
  if (cls.kind === 'swimlane') return 'swimlane';
  const first = shape.parts[0];
  if (first && first.type === 'rect') {
    const radius = (first as { radius?: unknown }).radius;
    if (radius === 0) return 'box';
  }
  return 'rounded';
}

/** The look a new class starts with: containers and swimlanes get their own form. */
export function startLookFor(
  kind: ClassDef['kind'],
  base?: LookBase,
): NodeLook {
  return defaultNodeLook(kind, base);
}

export function shapeNameFor(key: string): string {
  return `${key} look`;
}

/** A new node shape with the default look for a class kind. */
export function newNodeLookShape(
  key: string,
  kind: ClassDef['kind'],
  id: ShapeId = newId('shape'),
): NodeShape {
  return nodeShapeFromLook(defaultNodeLook(kind), id, shapeNameFor(key));
}

export function newRelationLookShape(
  key: string,
  id: ShapeId = newId('shape'),
): RelationShape {
  return relationShapeFromLook(defaultRelationLook(), id, shapeNameFor(key));
}

/** What a class draws with, for the Appearance card. */
export type AppearanceState =
  | { kind: 'none' }
  | { kind: 'look'; shape: NodeShape; look: NodeLook; shared: string[] }
  | { kind: 'drawn'; shape: NodeShape; shared: string[] };

/** The classes and relation classes that draw with a shape. */
export function shapeUsers(tool: ToolLibrary, shapeId: string): string[] {
  return [
    ...Object.values(tool.classes)
      .filter((c) => c.shape === shapeId)
      .map((c) => c.key),
    ...Object.values(tool.relations)
      .filter((r) => r.shape === shapeId)
      .map((r) => r.key),
  ];
}

export function appearanceOfClass(
  tool: ToolLibrary,
  classId: ClassId,
): AppearanceState {
  const cls = tool.classes[classId];
  const shape = cls?.shape ? tool.shapes[cls.shape] : undefined;
  if (!cls || !shape || shape.kind !== 'node') return { kind: 'none' };
  const shared = shapeUsers(tool, shape.id).filter((k) => k !== cls.key);
  return shape.look
    ? { kind: 'look', shape, look: shape.look, shared }
    : { kind: 'drawn', shape, shared };
}

export type RelationAppearanceState =
  | { kind: 'none' }
  | {
      kind: 'look';
      shape: RelationShape;
      look: RelationLook;
      shared: string[];
    }
  | { kind: 'drawn'; shape: RelationShape; shared: string[] };

export function appearanceOfRelation(
  tool: ToolLibrary,
  id: RelationId,
): RelationAppearanceState {
  const rel = tool.relations[id];
  const shape = rel?.shape ? tool.shapes[rel.shape] : undefined;
  if (!rel || !shape || shape.kind !== 'relation') return { kind: 'none' };
  const shared = shapeUsers(tool, shape.id).filter((k) => k !== rel.key);
  return shape.look
    ? { kind: 'look', shape, look: shape.look, shared }
    : { kind: 'drawn', shape, shared };
}

/**
 * The commands that store a look for a class: the class's own shape is rewritten in place; a
 * shape that other classes share, or no shape at all, gives the class a new shape of its own.
 */
export function saveNodeLook(
  tool: ToolLibrary,
  classId: ClassId,
  look: NodeLook,
): ToolCommandOrBatch {
  const cls = tool.classes[classId]!;
  const current = cls.shape ? tool.shapes[cls.shape] : undefined;
  if (
    current &&
    current.kind === 'node' &&
    shapeUsers(tool, current.id).length <= 1
  )
    return {
      type: 'putShape',
      def: nodeShapeFromLook(look, current.id, current.name),
    };
  const id = newId('shape');
  return {
    type: 'batch',
    commands: [
      {
        type: 'putShape',
        def: nodeShapeFromLook(look, id, shapeNameFor(cls.key)),
      },
      { type: 'putClass', def: { ...cls, shape: id } },
    ],
  };
}

export function saveRelationLook(
  tool: ToolLibrary,
  id: RelationId,
  look: RelationLook,
): ToolCommandOrBatch {
  const rel = tool.relations[id]!;
  const current = rel.shape ? tool.shapes[rel.shape] : undefined;
  if (
    current &&
    current.kind === 'relation' &&
    shapeUsers(tool, current.id).length <= 1
  )
    return {
      type: 'putShape',
      def: relationShapeFromLook(look, current.id, current.name),
    };
  const sid = newId('shape');
  return {
    type: 'batch',
    commands: [
      {
        type: 'putShape',
        def: relationShapeFromLook(look, sid, shapeNameFor(rel.key)),
      },
      { type: 'putRelation', def: { ...rel, shape: sid } as RelationDef },
    ],
  };
}

/** The look "Replace with a simple look" starts from: the form of the old drawing, if it can be guessed. */
export function lookReplacingDrawing(
  cls: { kind: ClassDef['kind']; key: string },
  old?: NodeShape,
): NodeLook {
  const base = old ? baseFromShape(old, cls) : undefined;
  const look = defaultNodeLook(cls.kind, base);
  if (old && old.size.width > 0 && old.size.height > 0)
    look.size = {
      width: old.size.width,
      height: old.size.height,
      resizable: old.size.resizable ?? true,
    };
  return look;
}

const plainColour = (v: unknown, fallback: string): string =>
  typeof v === 'string' && !isFormula(v) ? v : fallback;

/** A relation look read off a hand-drawn line, using the plain values and the defaults otherwise. */
export function relationLookFromShape(shape: RelationShape): RelationLook {
  const base = defaultRelationLook();
  const dash = shape.line.dash;
  const marker = (m: RelationShape['endMarker']): MarkerType =>
    m && typeof m.type === 'string' && MARKER_TYPES.includes(m.type as never)
      ? (m.type as MarkerType)
      : 'none';
  return {
    colour: plainColour(shape.line.stroke, fixedColour(base.colour)),
    width:
      typeof shape.line.strokeWidth === 'number'
        ? shape.line.strokeWidth
        : base.width,
    style: Array.isArray(dash)
      ? (dash[0] ?? 6) <= 3
        ? 'dotted'
        : 'dashed'
      : 'solid',
    routing: shape.line.routing ?? base.routing,
    start: marker(shape.startMarker),
    end: marker(shape.endMarker),
    label: null,
  };
}

/** The shape without its look: what the advanced drawing editor saves. */
export function withoutLook<T extends ShapeDef>(shape: T): T {
  const copy = { ...shape } as T & { look?: unknown };
  delete copy.look;
  return copy;
}

// Relations -----------------------------------------------------------------------------------

export const MARKER_TYPES: readonly MarkerType[] = [
  'none',
  'arrow',
  'open-arrow',
  'triangle',
  'diamond',
  'circle',
  'cross',
  'bar',
];

export const MARKER_LABELS: Record<MarkerType, string> = {
  none: 'Nothing',
  arrow: 'Arrow',
  'open-arrow': 'Open arrow',
  triangle: 'Triangle',
  diamond: 'Diamond',
  circle: 'Circle',
  cross: 'Cross',
  bar: 'Bar',
};

/**
 * The end marks as paths with the tip at the origin and the line coming from the left, so a
 * picker and a preview can draw them at any angle.
 */
export const MARKER_SHAPES: Record<
  MarkerType,
  { d: string; fill: 'solid' | 'hollow' | 'none' }
> = {
  none: { d: '', fill: 'none' },
  arrow: { d: 'M0,0 L-10,-5 L-7,0 L-10,5 Z', fill: 'solid' },
  'open-arrow': { d: 'M-10,-5 L0,0 L-10,5', fill: 'none' },
  triangle: { d: 'M0,0 L-10,-5 L-10,5 Z', fill: 'hollow' },
  diamond: { d: 'M0,0 L-6,-4 L-12,0 L-6,4 Z', fill: 'hollow' },
  circle: { d: 'M-8,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0', fill: 'hollow' },
  cross: { d: 'M-8,-4 L0,4 M-8,4 L0,-4', fill: 'none' },
  bar: { d: 'M-1,-5 L-1,5', fill: 'none' },
};

// Preview tiles -------------------------------------------------------------------------------

export interface PreviewTile {
  /** The attribute this group of tiles varies (its key), or null for the single sample tile. */
  attribute: string | null;
  /** What the author sees under the tile. */
  label: string;
  /** Attribute values by key for this tile, over the sample values. */
  values: Record<string, Json>;
}

export interface PreviewGroup {
  title: string;
  tiles: PreviewTile[];
}

/**
 * One tile per value of every attribute that drives the look, so the author sees each state; a
 * look that does not change with data gets one tile with sample values.
 */
export function previewGroups(
  look: NodeLook,
  attrs: readonly AttributeDef[],
  language = 'en',
): PreviewGroup[] {
  const drivers = lookDrivers(look).slice(0, 3);
  if (drivers.length === 0)
    return [
      {
        title: 'Preview',
        tiles: [{ attribute: null, label: 'Sample', values: {} }],
      },
    ];
  return drivers.map((d) => {
    const attr = byKey(attrs, d.attribute);
    const options = valueOptions(attr);
    const typed = d.values.filter((v) => !options.some((o) => o.value === v));
    const tiles: PreviewTile[] = [
      ...options.map((o) => ({
        attribute: d.attribute,
        label: o.label,
        values: { [d.attribute]: asValue(attr, o.value) },
      })),
      ...typed.map((v) => ({
        attribute: d.attribute,
        label: v,
        values: { [d.attribute]: asValue(attr, v) },
      })),
    ];
    if (options.length === 0 || attr?.type !== 'boolean')
      tiles.push({
        attribute: d.attribute,
        label: 'Anything else',
        values: { [d.attribute]: null },
      });
    return {
      title: attr ? attributeLabel(attr, language) : d.attribute,
      tiles,
    };
  });
}

/** The stored form of a typed value: yes/no and numbers are not text. */
function asValue(attr: AttributeDef | undefined, text: string): Json {
  if (attr?.type === 'boolean') return text === 'true';
  if ((attr?.type === 'number' || attr?.type === 'integer') && text !== '') {
    const n = Number(text);
    if (Number.isFinite(n)) return n;
  }
  return text;
}

export interface TilePicture {
  compiled: Compiled;
  width: number;
  height: number;
}

/** Draws a shape the way the canvas would, for one tile. Never throws. */
export function compileShape(
  shape: NodeShape,
  attrs: readonly AttributeDef[],
  tile: PreviewTile,
  className: string,
): TilePicture {
  const { width, height } = shape.size;
  const samples = sampleValuesFor(attrs);
  const values: Record<string, Json> = { ...samples };
  for (const [key, v] of Object.entries(tile.values)) {
    const attr = byKey(attrs, key);
    if (attr) values[attr.id] = v;
  }
  const scope = makeScope(attrs, values, {
    label: className,
    className,
    w: width,
    h: height,
    fill: '#E7F5FF',
  });
  return {
    compiled: compileNode(shape, { w: width, h: height, scope }),
    width,
    height,
  };
}

/** Draws a look for one tile. */
export function compileTile(
  look: NodeLook,
  attrs: readonly AttributeDef[],
  tile: PreviewTile,
  className: string,
): TilePicture {
  return compileShape(
    nodeShapeFromLook(look, 'shp_preview' as ShapeId),
    attrs,
    tile,
    className,
  );
}

const SAMPLE_TILE: PreviewTile = { attribute: null, label: '', values: {} };

/** What a class draws with now, small, for the Appearance card. */
export function classThumbnail(
  tool: ToolLibrary,
  classId: ClassId,
): TilePicture | null {
  const cls = tool.classes[classId];
  if (!cls) return null;
  const own = cls.shape ? tool.shapes[cls.shape] : undefined;
  const shape = own?.kind === 'node' ? own : starterFor(cls);
  return compileShape(
    shape,
    effectiveAttributes(tool, classId),
    SAMPLE_TILE,
    cls.key,
  );
}

// Sizes ---------------------------------------------------------------------------------------

export function clampSize(n: number, min = 20, max = 1200): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
}

/** The object without one of its optional keys (the stored JSON has no `undefined`). */
export function omit<T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}
