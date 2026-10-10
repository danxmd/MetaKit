import type {
  ClassKind,
  NodeShape,
  Part,
  ShapeDef,
  ShapeId,
} from '@metakit-app/core';

const INK = '#364fc7';

const label = (extra: Partial<Part> = {}): Part =>
  ({
    type: 'text',
    x: 8,
    y: 4,
    width: '100% - 16',
    height: '100% - 8',
    text: '= $label',
    wrap: true,
    fit: 'shrink',
    align: 'center',
    valign: 'middle',
    ...extra,
  }) as Part;

const fieldLines = (top: number): Part => ({
  type: 'text',
  x: 8,
  y: top,
  width: '100% - 16',
  height: 16,
  text: '= item',
  wrap: false,
  font: { size: 11 },
  fill: '#495057',
  repeat: {
    over: '$fields',
    as: 'item',
    layout: { kind: 'stack', gap: 0 },
    cellHeight: 16,
  },
});

export const STARTER_IDS = {
  task: 'shp_starter_task',
  event: 'shp_starter_event',
  gateway: 'shp_starter_gateway',
  umlClass: 'shp_starter_uml_class',
  erEntity: 'shp_starter_er_entity',
  container: 'shp_starter_container',
  swimlane: 'shp_starter_swimlane',
  flow: 'shp_starter_flow',
  association: 'shp_starter_association',
  dashed: 'shp_starter_dashed_flow',
} as const satisfies Record<string, ShapeId>;

const STARTERS: ShapeDef[] = [
  {
    id: STARTER_IDS.task,
    name: 'Task (rounded box)',
    kind: 'node',
    size: {
      width: 140,
      height: 70,
      resizable: true,
      minWidth: 60,
      minHeight: 36,
    },
    outline: 'rect',
    parts: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        radius: 10,
        fill: '= $fill',
        stroke: INK,
        strokeWidth: 1.5,
      },
      label(),
    ],
  },
  {
    id: STARTER_IDS.event,
    name: 'Event (circle)',
    kind: 'node',
    size: {
      width: 60,
      height: 60,
      resizable: true,
      minWidth: 30,
      minHeight: 30,
    },
    outline: 'ellipse',
    parts: [
      {
        type: 'ellipse',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        fill: '= $fill',
        stroke: INK,
        strokeWidth: 1.5,
      },
      label({ x: '15%', y: '15%', width: '70%', height: '70%' }),
    ],
  },
  {
    id: STARTER_IDS.gateway,
    name: 'Gateway (diamond)',
    kind: 'node',
    size: {
      width: 70,
      height: 70,
      resizable: true,
      minWidth: 40,
      minHeight: 40,
    },
    outline: {
      type: 'polygon',
      points: [
        ['50%', 0],
        ['100%', '50%'],
        ['50%', '100%'],
        [0, '50%'],
      ],
    },
    parts: [
      {
        type: 'polygon',
        points: [
          ['50%', 0],
          ['100%', '50%'],
          ['50%', '100%'],
          [0, '50%'],
        ],
        fill: '= $fill',
        stroke: INK,
        strokeWidth: 1.5,
      },
      label({ x: '22%', y: '22%', width: '56%', height: '56%' }),
    ],
  },
  {
    id: STARTER_IDS.umlClass,
    name: 'UML class',
    kind: 'node',
    size: {
      width: 160,
      height: 110,
      resizable: true,
      minWidth: 80,
      minHeight: 50,
    },
    outline: 'rect',
    parts: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        fill: '#ffffff',
        stroke: INK,
        strokeWidth: 1.5,
      },
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: '100%',
        height: 28,
        fill: '= $fill',
        stroke: INK,
        strokeWidth: 1.5,
      },
      label({ y: 2, height: 24, font: { weight: 600 } }),
      fieldLines(34),
    ],
  },
  {
    id: STARTER_IDS.erEntity,
    name: 'ER entity',
    kind: 'node',
    size: {
      width: 150,
      height: 100,
      resizable: true,
      minWidth: 80,
      minHeight: 50,
    },
    outline: 'rect',
    parts: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        fill: '#ffffff',
        stroke: INK,
        strokeWidth: 2,
      },
      { type: 'rect', x: 0, y: 0, width: '100%', height: 26, fill: INK },
      label({ y: 1, height: 24, fill: '#ffffff', font: { weight: 600 } }),
      fieldLines(32),
    ],
  },
  {
    id: STARTER_IDS.container,
    name: 'Container',
    kind: 'node',
    size: {
      width: 300,
      height: 200,
      resizable: true,
      minWidth: 100,
      minHeight: 80,
    },
    outline: 'rect',
    parts: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        fill: '#f8f9fa',
        stroke: INK,
        strokeWidth: 1.5,
        dash: [6, 4],
      },
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: '100%',
        height: 26,
        fill: '= $fill',
        stroke: INK,
        strokeWidth: 1.5,
      },
      label({ y: 1, height: 24, align: 'left', font: { weight: 600 } }),
    ],
  },
  {
    id: STARTER_IDS.swimlane,
    name: 'Swimlane (horizontal)',
    kind: 'node',
    size: {
      width: 600,
      height: 160,
      resizable: true,
      minWidth: 200,
      minHeight: 80,
    },
    outline: 'rect',
    parts: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        fill: '#ffffff',
        stroke: INK,
        strokeWidth: 1.5,
      },
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 28,
        height: '100%',
        fill: '= $fill',
        stroke: INK,
        strokeWidth: 1.5,
      },
      {
        type: 'text',
        // A box 160 wide whose centre is the middle of the strip: it turns around its own centre,
        // so it must already be there before it is rotated.
        x: -66,
        y: '50% - 14',
        width: 160,
        height: 28,
        text: '= $label',
        align: 'center',
        valign: 'middle',
        wrap: false,
        font: { weight: 600 },
        // Rotated so the lane name reads along the strip at the left edge.
        transform: { rotate: -90 },
      } as Part,
    ],
  },
  {
    id: STARTER_IDS.flow,
    name: 'Flow (arrow)',
    kind: 'relation',
    line: { stroke: '#6b7a90', strokeWidth: 1.5, routing: 'orthogonal' },
    endMarker: { type: 'arrow' },
  },
  {
    id: STARTER_IDS.association,
    name: 'Association (plain line)',
    kind: 'relation',
    line: { stroke: '#6b7a90', strokeWidth: 1.5, routing: 'straight' },
  },
  {
    id: STARTER_IDS.dashed,
    name: 'Dashed flow',
    kind: 'relation',
    line: {
      stroke: '#6b7a90',
      strokeWidth: 1.5,
      dash: [6, 4],
      routing: 'orthogonal',
    },
    endMarker: { type: 'arrow' },
  },
] as ShapeDef[];

export const STARTER_SHAPES: Readonly<Record<string, ShapeDef>> = Object.freeze(
  Object.fromEntries(STARTERS.map((s) => [s.id, s])),
);

export function starterShape(id: string): ShapeDef | undefined {
  return STARTER_SHAPES[id];
}

/**
 * The starter shape for a class that has none, by its kind and key: containers and swimlanes
 * get their own, events circles, gateways diamonds, entities the ER box, the rest a rounded box.
 */
export function starterFor(cls: { kind: ClassKind; key: string }): NodeShape {
  const id =
    cls.kind === 'container'
      ? STARTER_IDS.container
      : cls.kind === 'swimlane'
        ? STARTER_IDS.swimlane
        : /(event|start|end|terminator|state)/i.test(cls.key)
          ? STARTER_IDS.event
          : /(gateway|decision|condition)/i.test(cls.key)
            ? STARTER_IDS.gateway
            : /(entity|table|document|data)/i.test(cls.key)
              ? STARTER_IDS.erEntity
              : STARTER_IDS.task;
  return STARTER_SHAPES[id] as NodeShape;
}

/** A copy of a starter shape with a new id, as the Build mode gallery adds it. */
export function copyStarter(id: string, newId: ShapeId): ShapeDef | undefined {
  const s = STARTER_SHAPES[id];
  return s
    ? ({
        ...(JSON.parse(JSON.stringify(s)) as ShapeDef),
        id: newId,
      } as ShapeDef)
    : undefined;
}

/** What an element of a class that the Kit no longer has looks like: a grey, dashed box (phase 4). */
export const PLACEHOLDER_SHAPE: NodeShape = {
  id: 'shp_starter_placeholder',
  name: 'Missing class',
  kind: 'node',
  size: { width: 120, height: 60 },
  outline: 'rect',
  parts: [
    {
      type: 'rect',
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: '#e9ecef',
      stroke: '#868e96',
      strokeWidth: 1.5,
      dash: [5, 3],
    },
    label({ fill: '#495057' }),
  ],
};
