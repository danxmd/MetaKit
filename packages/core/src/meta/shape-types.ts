import type { ClassId, RelationId, ShapeId } from '../ids';
import type { Labels } from './types';

/**
 * A property that is a fixed value or, as text starting with `=`, a formula over the element's
 * attribute values. Formulas are text in the file and are read by `packages/formula`.
 */
export type Prop<T> = T | string;

/** A size or position: pixels, or text such as `"50%"` or `"100% - 22"`; a formula is also text. */
export type Dim = number | string;

export interface GradientStop {
  /** Position along the gradient, 0 to 1. */
  at: number;
  color: string;
}

export interface Gradient {
  type: 'linear';
  /** Degrees; 0 runs left to right, 90 top to bottom. */
  angle?: number;
  stops: GradientStop[];
}

export type Paint = Prop<string | Gradient>;

export interface ShadowDef {
  color?: string;
  blur?: number;
  x?: number;
  y?: number;
}

export interface FontDef {
  family?: string;
  size?: Prop<number>;
  weight?: Prop<number | 'normal' | 'bold'>;
  style?: Prop<'normal' | 'italic'>;
  color?: Prop<string>;
}

export interface TransformDef {
  /** Degrees, around the centre of the part. */
  rotate?: Prop<number>;
  scaleX?: Prop<number>;
  scaleY?: Prop<number>;
  translateX?: Dim;
  translateY?: Dim;
}

export interface StackLayout {
  kind: 'stack';
  direction?: 'column' | 'row';
  gap?: number;
}
export interface GridLayout {
  kind: 'grid';
  columns: number;
  gap?: number;
}
export type RepeatLayout = StackLayout | GridLayout;

export interface RepeatDef {
  /** A formula giving a list or a table; each item is `item` (or the name in `as`) in the part. */
  over: string;
  as?: string;
  layout?: RepeatLayout;
  /** Size of one cell; the part's own width and height when absent. */
  cellWidth?: Dim;
  cellHeight?: Dim;
}

interface PartBase {
  x?: Dim;
  y?: Dim;
  width?: Dim;
  height?: Dim;
  visible?: Prop<boolean>;
  tooltip?: Prop<string>;
  /** A formula such as `= open(Owner)`; evaluated when the part is clicked. */
  onClick?: string;
  fill?: Paint;
  stroke?: Prop<string>;
  strokeWidth?: Prop<number>;
  /** Dash lengths, for example `[6, 4]`; a formula may give the list. */
  dash?: Prop<number[]>;
  shadow?: ShadowDef;
  font?: FontDef;
  clip?: boolean;
  transform?: TransformDef;
  repeat?: RepeatDef;
  /** Opacity from 0 to 1. */
  opacity?: Prop<number>;
}

export type RectPart = PartBase & { type: 'rect'; radius?: Prop<number> };
export type EllipsePart = PartBase & { type: 'ellipse' };
export type PolygonPart = PartBase & {
  type: 'polygon';
  /** Corners as `[x, y]` pairs of dimensions. */
  points: [Dim, Dim][];
};
export type PathPart = PartBase & {
  type: 'path';
  /** SVG path syntax, in the units of `viewBox` when given and pixels otherwise. */
  d: string;
  viewBox?: [number, number, number, number];
};
export type TextPart = PartBase & {
  type: 'text';
  text: Prop<string>;
  wrap?: boolean;
  fit?: 'none' | 'shrink' | 'clip';
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
};
export type ImagePart = PartBase & {
  type: 'image';
  /** A `data:` URI or a path under the tool library's `assets/` folder. */
  src: Prop<string>;
  fit?: 'contain' | 'cover' | 'stretch';
};
export type GroupPart = PartBase & {
  type: 'group';
  parts: Part[];
  layout?: RepeatLayout;
};
export type UsePart = PartBase & { type: 'use'; shape: ShapeId };

export type Part =
  | RectPart
  | EllipsePart
  | PolygonPart
  | PathPart
  | TextPart
  | ImagePart
  | GroupPart
  | UsePart;

export type PartType = Part['type'];
export const PART_TYPES: readonly PartType[] = [
  'rect',
  'ellipse',
  'polygon',
  'path',
  'text',
  'image',
  'group',
  'use',
];

export type Outline =
  'rect' | 'ellipse' | 'auto' | { type: 'polygon'; points: [Dim, Dim][] };

export interface ShapeSize {
  width: number;
  height: number;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
}

export interface ShapeVariant {
  /** A formula; the first variant whose `when` is true (or that has none) is used. */
  when?: string;
  parts: Part[];
}

export interface NodeShape {
  id: ShapeId;
  /** Shown in the shape list of Build mode. */
  name?: string;
  kind: 'node';
  size: ShapeSize;
  outline?: Outline;
  /** Values named once per element; each may read the ones before it. */
  let?: Record<string, string>;
  parts: Part[];
  variants?: ShapeVariant[];
  /** The simple look the parts were generated from; absent for a hand-drawn shape (ADR 0009). */
  look?: NodeLook;
}

export type MarkerType =
  | 'none'
  | 'arrow'
  | 'open-arrow'
  | 'triangle'
  | 'diamond'
  | 'circle'
  | 'cross'
  | 'bar';

// Simple looks (ADR 0009) ---------------------------------------------------------------------

/** The forms a concept can take in the simple editor. */
export type LookBase =
  | 'box'
  | 'rounded'
  | 'pill'
  | 'circle'
  | 'diamond'
  | 'hexagon'
  | 'document'
  | 'person'
  | 'header-box'
  | 'container'
  | 'swimlane';

export const LOOK_BASE_IDS: readonly LookBase[] = [
  'box',
  'rounded',
  'pill',
  'circle',
  'diamond',
  'hexagon',
  'document',
  'person',
  'header-box',
  'container',
  'swimlane',
];

/** A fixed colour, or one that depends on the value of one attribute. */
export type LookColour =
  | string
  | {
      /** The attribute key. */
      by: string;
      /** A colour for each value, written as text (`true` and `false` for yes/no attributes). */
      values: Record<string, string>;
      fallback: string;
    };

export type LookLineStyle = 'solid' | 'dashed' | 'dotted';

export type LookIconName =
  | 'bot'
  | 'person'
  | 'document'
  | 'gear'
  | 'check'
  | 'warning'
  | 'star'
  | 'database'
  | 'cloud'
  | 'lock'
  | 'mail'
  | 'flag'
  | 'clock'
  | 'bolt';

export const LOOK_ICON_NAMES: readonly LookIconName[] = [
  'bot',
  'person',
  'document',
  'gear',
  'check',
  'warning',
  'star',
  'database',
  'cloud',
  'lock',
  'mail',
  'flag',
  'clock',
  'bolt',
];

/** A line of text on a concept: an attribute, the label, or fixed text. */
export interface LookText {
  /** The attribute key; null shows the label of the concept. */
  attribute?: string | null;
  /** Fixed text, used when there is no attribute. */
  text?: string;
  colour?: LookColour;
  bold?: boolean;
  size?: number;
}

export interface LookBadge {
  /** The mark shows when this attribute has this value. */
  attribute: string;
  equals: string;
  text: string;
  colour: string;
}

export interface NodeLook {
  base: LookBase;
  fill: LookColour;
  border: LookColour;
  borderWidth: number;
  borderStyle: LookLineStyle;
  /** Corner radius of box-like forms. */
  corner?: number;
  title: LookText;
  subtitle?: LookText;
  icon?: { name: LookIconName; colour?: string };
  badge?: LookBadge;
  /** Attribute keys listed inside a header box, one line each. */
  fields?: string[];
  size: { width: number; height: number; resizable?: boolean };
}

export interface RelationLook {
  colour: LookColour;
  width: number;
  style: LookLineStyle;
  routing: 'straight' | 'orthogonal' | 'curved';
  start: MarkerType;
  end: MarkerType;
  /** The text on the line: an attribute, or none. */
  label: { attribute: string } | null;
}

export interface MarkerDef {
  type: Prop<MarkerType>;
  fill?: Prop<string>;
  size?: number;
}

export interface LineDef {
  stroke?: Prop<string>;
  strokeWidth?: Prop<number>;
  dash?: Prop<number[]>;
  routing?: 'straight' | 'orthogonal' | 'curved';
  corners?: number;
}

export interface LabelDef {
  at: 'start' | 'middle' | 'end';
  offset?: { x?: number; y?: number };
  text: Prop<string>;
  font?: FontDef;
  background?: Prop<string>;
  visible?: Prop<boolean>;
}

export interface RelationShape {
  id: ShapeId;
  name?: string;
  kind: 'relation';
  let?: Record<string, string>;
  line: LineDef;
  startMarker?: MarkerDef;
  endMarker?: MarkerDef;
  labels?: LabelDef[];
  /** The simple look the line was generated from; absent for a hand-drawn shape (ADR 0009). */
  look?: RelationLook;
}

export type ShapeDef = NodeShape | RelationShape;

// Panel layouts -------------------------------------------------------------------------------

export type PanelControl =
  | 'text'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'checkbox'
  | 'date'
  | 'duration'
  | 'select'
  | 'segmented'
  | 'chips'
  | 'table'
  | 'reference'
  | 'link';

export interface PanelAttributeItem {
  attribute: string;
  control?: PanelControl;
  visible?: boolean | string;
  readOnly?: boolean | string;
  required?: boolean | string;
  height?: number;
}

export interface PanelGroupItem {
  group: string;
  labels?: Labels;
  visible?: boolean | string;
  items: PanelItem[];
}

export type PanelItem = PanelAttributeItem | PanelGroupItem;

export interface PanelTab {
  label: string;
  labels?: Labels;
  visible?: boolean | string;
  items: PanelItem[];
}

export interface PanelLayout {
  /** The class or relation class this layout belongs to. */
  class: ClassId | RelationId;
  tabs: PanelTab[];
  showRelations?: boolean;
}

export const PANEL_CONTROLS: readonly PanelControl[] = [
  'text',
  'textarea',
  'number',
  'switch',
  'checkbox',
  'date',
  'duration',
  'select',
  'segmented',
  'chips',
  'table',
  'reference',
  'link',
];

export function isFormula(value: unknown): value is string {
  return typeof value === 'string' && value.trimStart().startsWith('=');
}

/** The text of a formula property without its leading `=`. */
export function formulaSource(value: string): string {
  return value.trimStart().slice(1).trim();
}
