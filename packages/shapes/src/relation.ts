import { type MarkerType, type RelationShape } from '@metakit-app/core';
import type { Scope } from '@metakit-app/formula';
import { CompileContext } from './compile';
import type { TextFont } from './ops';

export interface CompiledMarker {
  type: MarkerType;
  fill: string;
  size: number;
}

export interface CompiledLabel {
  at: 'start' | 'middle' | 'end';
  offset: { x: number; y: number };
  text: string;
  font: TextFont;
  background: string | null;
}

export interface CompiledRelation {
  line: {
    stroke: string;
    width: number;
    dash: number[];
    routing: 'straight' | 'orthogonal' | 'curved';
    corners: number;
  };
  start: CompiledMarker | null;
  end: CompiledMarker | null;
  labels: CompiledLabel[];
  reads: string[];
  messages: string[];
}

export const DEFAULT_LINE_COLOUR = '#6b7a90';
const MARKER_TYPES: readonly string[] = [
  'none',
  'arrow',
  'open-arrow',
  'triangle',
  'diamond',
  'circle',
  'cross',
  'bar',
];

/** Compiles a relation shape for one connector's values. Never throws. */
export function compileRelation(
  shape: RelationShape,
  scope: Scope,
): CompiledRelation {
  const c = new CompileContext(scope, () => undefined);
  const frame = c.push();
  for (const [name, raw] of Object.entries(shape.let ?? {}))
    frame.set(name, c.value(raw, `let ${name}`) ?? null);
  const label = shape.name ?? shape.id;
  const stroke = c.str(
    shape.line.stroke,
    `${label} stroke`,
    DEFAULT_LINE_COLOUR,
  );
  const dashRaw = c.value(shape.line.dash, `${label} dash`);
  const marker = (
    m: RelationShape['endMarker'],
    what: string,
  ): CompiledMarker | null => {
    if (!m) return null;
    const type = c.str(m.type, `${label} ${what} type`, 'none');
    if (!MARKER_TYPES.includes(type)) {
      c.message(`${label} ${what}: "${type}" is not a marker type.`);
      return null;
    }
    if (type === 'none') return null;
    return {
      type: type as MarkerType,
      fill: c.str(m.fill, `${label} ${what} fill`, stroke),
      size: m.size ?? 10,
    };
  };
  const labels: CompiledLabel[] = [];
  (shape.labels ?? []).forEach((l, i) => {
    if (!c.bool(l.visible, `${label} label ${i} visible`, true)) return;
    const text = c.str(l.text, `${label} label ${i} text`, '');
    if (text === '') return;
    labels.push({
      at: l.at,
      offset: { x: l.offset?.x ?? 0, y: l.offset?.y ?? 0 },
      text,
      font: {
        family: l.font?.family ?? 'system-ui, sans-serif',
        size: c.num(l.font?.size, `${label} label ${i} size`, 11),
        weight: (l.font?.weight as string | number | undefined) ?? 'normal',
        style: c.str(l.font?.style, `${label} label ${i} style`, 'normal'),
        color: c.str(l.font?.color, `${label} label ${i} colour`, '#212529'),
      },
      background:
        l.background === undefined
          ? null
          : c.str(l.background, `${label} label ${i} background`, '') || null,
    });
  });
  const result: CompiledRelation = {
    line: {
      stroke,
      width: c.num(shape.line.strokeWidth, `${label} strokeWidth`, 1.5),
      dash: Array.isArray(dashRaw)
        ? dashRaw.filter((n): n is number => typeof n === 'number')
        : [],
      routing: shape.line.routing ?? 'orthogonal',
      corners: shape.line.corners ?? 0,
    },
    start: marker(shape.startMarker, 'startMarker'),
    end: marker(shape.endMarker, 'endMarker'),
    labels,
    reads: c.reads,
    messages: c.messages,
  };
  c.pop();
  return result;
}

/** The look of a connector whose relation class has no shape: a grey arrow. */
export function defaultRelationShape(id: `shp_${string}`): RelationShape {
  return {
    id,
    kind: 'relation',
    line: {
      stroke: DEFAULT_LINE_COLOUR,
      strokeWidth: 1.5,
      routing: 'orthogonal',
    },
    endMarker: { type: 'arrow' },
  };
}
