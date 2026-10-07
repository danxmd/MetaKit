import type { ClassDef } from '@metakit-app/core';

export type ShapeName = 'rectangle' | 'rounded' | 'ellipse' | 'diamond';

/** What a draw list needs from a path, which `Path2D` and a recording both provide. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  closePath(): void;
}

export const CORNER_RADIUS = 10;

/** Adds the outline of a shape in local coordinates (0,0 to w,h) to a path. */
export function traceShape(
  path: PathSink,
  shape: ShapeName,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  switch (shape) {
    case 'rectangle':
      path.rect(x, y, w, h);
      break;
    case 'rounded':
      path.roundRect(x, y, w, h, Math.min(CORNER_RADIUS, w / 2, h / 2));
      break;
    case 'ellipse':
      path.moveTo(x + w, y + h / 2);
      path.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'diamond':
      path.moveTo(x + w / 2, y);
      path.lineTo(x + w, y + h / 2);
      path.lineTo(x + w / 2, y + h);
      path.lineTo(x, y + h / 2);
      path.closePath();
      break;
  }
}

/** Replaceable choice of shape per class; until phase 4 the shapes are not part of the tool library. */
export type ShapeChooser = (cls: ClassDef) => ShapeName;

/** Temporary rule: containers and swimlanes are rectangles; events are ellipses; gateways diamonds. */
export const builtinShape: ShapeChooser = (cls) => {
  if (cls.kind === 'container' || cls.kind === 'swimlane') return 'rectangle';
  const key = cls.key.toLowerCase();
  if (/(event|start|end|terminator|state)/.test(key)) return 'ellipse';
  if (/(gateway|decision|condition)/.test(key)) return 'diamond';
  if (/(entity|table|document|data)/.test(key)) return 'rectangle';
  return 'rounded';
};

const FILLS = [
  '#eef4ff',
  '#fff4e6',
  '#ebfbee',
  '#f3f0ff',
  '#fff0f6',
  '#e3fafc',
] as const;

/** A stable pastel fill per class, so classes can be told apart without any shape setup. */
export function fillFor(cls: ClassDef): string {
  let h = 0;
  for (let i = 0; i < cls.key.length; i++)
    h = (h * 31 + cls.key.charCodeAt(i)) >>> 0;
  return FILLS[h % FILLS.length]!;
}

export const STROKE = '#364fc7';
export const CONNECTOR_COLOR = '#6b7a90';
export const SELECT_COLOR = '#e8590c';
export const TEXT_COLOR = '#212529';
export const FONT_WORLD_PX = 12;
export const LINE_HEIGHT = 1.25;

/**
 * Splits text into lines that fit `maxWidth`, with a rough width of 0.55 em per character (the
 * draw list is built without a canvas so it can be tested and cached; the estimate is only used to
 * choose line breaks). At most `maxLines` lines are returned; the last gets an ellipsis if cut.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontPx: number,
  maxLines: number,
): string[] {
  const perLine = Math.max(1, Math.floor(maxWidth / (fontPx * 0.55)));
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter((w) => w !== '')) {
      let rest = word;
      while (rest.length > perLine) {
        if (line !== '') {
          lines.push(line);
          line = '';
        }
        lines.push(rest.slice(0, perLine));
        rest = rest.slice(perLine);
      }
      const candidate = line === '' ? rest : `${line} ${rest}`;
      if (candidate.length <= perLine) line = candidate;
      else {
        lines.push(line);
        line = rest;
      }
    }
    lines.push(line);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1]!;
  kept[maxLines - 1] = `${last.slice(0, Math.max(0, perLine - 1))}…`;
  return kept;
}
