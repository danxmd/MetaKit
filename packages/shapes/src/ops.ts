import type {
  GradientStop,
  ShadowDef,
  ShapeDef,
  ShapeId,
} from '@metakit-app/core';
import type { Value } from '@metakit-app/formula';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LinearPaint {
  type: 'linear';
  angle: number;
  stops: GradientStop[];
  /** The box the gradient spans, in the same coordinates as the operation. */
  box: Box;
}

export type PaintValue = string | LinearPaint | null;

export interface OpStyle {
  fill: PaintValue;
  stroke: string | null;
  strokeWidth: number;
  dash: number[] | null;
  shadow: ShadowDef | null;
  opacity: number;
}

export interface TextFont {
  family: string;
  size: number;
  weight: string | number;
  style: string;
  color: string;
}

export interface TextLine {
  text: string;
  /** Anchor x and the vertical middle of the line, in element-local pixels. */
  x: number;
  y: number;
}

/**
 * One step of drawing an element, in element-local pixels (origin top-left). A list of these is
 * what the canvas replays; it holds no references to the model, so it can be cached and compared.
 */
export type DrawOp =
  | { op: 'save' }
  | { op: 'restore' }
  | {
      op: 'transform';
      matrix: [number, number, number, number, number, number];
    }
  | { op: 'clip'; kind: 'rect' | 'ellipse'; box: Box; radius: number }
  | { op: 'rect'; box: Box; radius: number; style: OpStyle }
  | { op: 'ellipse'; box: Box; style: OpStyle }
  | { op: 'polygon'; points: [number, number][]; style: OpStyle }
  | {
      op: 'path';
      d: string;
      box: Box;
      viewBox: [number, number, number, number] | null;
      style: OpStyle;
    }
  | {
      op: 'text';
      box: Box;
      lines: TextLine[];
      font: TextFont;
      align: 'left' | 'center' | 'right';
      lineHeight: number;
    }
  | {
      op: 'image';
      src: string;
      box: Box;
      fit: 'contain' | 'cover' | 'stretch';
      opacity: number;
    };

export interface Hotspot {
  box: Box;
  tooltip: string | null;
  /** What a click does, as evaluated: for example `{ action: 'open', target }`. */
  click: Value;
}

export type OutlineKind =
  | { kind: 'rect' }
  | { kind: 'ellipse' }
  | { kind: 'polygon'; points: [number, number][] };

export interface Compiled {
  w: number;
  h: number;
  ops: DrawOp[];
  hotspots: Hotspot[];
  outline: OutlineKind;
  /** Names read from the attribute scope; the cache compares their values. */
  reads: string[];
  /** Problems met while compiling (a formula that failed, a missing shape), in plain English. */
  messages: string[];
  /** Shapes embedded with `use`; the cache compares them by identity. */
  uses: [ShapeId, ShapeDef][];
}
