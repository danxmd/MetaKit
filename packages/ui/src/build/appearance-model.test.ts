import { describe, expect, it } from 'vitest';
import {
  createToolStore,
  effectiveAttributes,
  validateToolLibrary,
  type AttributeDef,
  type ClassId,
  type NodeLook,
  type NodeShape,
  type RelationId,
  type RelationShape,
  type ShapeId,
  type ToolLibrary,
} from '@metakit-app/core';
import { SAMPLE, sampleTool } from '@metakit-app/core/testing';
import {
  defaultNodeLook,
  defaultRelationLook,
  nodeShapeFromLook,
  relationShapeFromLook,
} from '@metakit-app/shapes';
import {
  PALETTE,
  appearanceOfClass,
  appearanceOfRelation,
  baseFromShape,
  compileTile,
  dataColour,
  dependOn,
  lookReplacingDrawing,
  newNodeLookShape,
  normaliseHex,
  previewGroups,
  relationLookFromShape,
  saveNodeLook,
  saveRelationLook,
  valueOptions,
  withBase,
  withValueColour,
  withoutLook,
} from './appearance-model';

const attrs = (tool: ToolLibrary): AttributeDef[] =>
  effectiveAttributes(tool, SAMPLE.task as ClassId);
const priority = (tool: ToolLibrary) =>
  attrs(tool).find((a) => a.key === 'Priority')!;

/** The sample tool where Task draws with a look of its own. */
function withLook(look: NodeLook = defaultNodeLook('node')): ToolLibrary {
  const tool = sampleTool();
  const shape = nodeShapeFromLook(
    look,
    'shp_task_look' as ShapeId,
    'Task look',
  );
  return {
    ...tool,
    shapes: { ...tool.shapes, [shape.id]: shape },
    classes: {
      ...tool.classes,
      [SAMPLE.task]: { ...tool.classes[SAMPLE.task]!, shape: shape.id },
    },
  };
}

describe('colours', () => {
  it('reads three and six digit hex codes and nothing else', () => {
    expect(normaliseHex('#ABC')).toBe('#aabbcc');
    expect(normaliseHex('2f9e44')).toBe('#2f9e44');
    expect(normaliseHex('green')).toBeNull();
    expect(normaliseHex('#12345')).toBeNull();
  });

  it('offers twelve palette colours', () => {
    expect(PALETTE).toHaveLength(12);
    expect(new Set(PALETTE.map((c) => c.value)).size).toBe(12);
  });

  it('turns a colour into one by the options of a choice, keeping the old colour as the fallback', () => {
    const tool = sampleTool();
    const colour = dataColour(priority(tool), '#abcdef');
    expect(colour).toMatchObject({ by: 'Priority', fallback: '#abcdef' });
    expect(Object.keys((colour as { values: object }).values)).toEqual([
      'Low',
      'Medium',
      'High',
    ]);
    expect(withValueColour(colour, 'High', '#ff0000')).toMatchObject({
      values: { High: '#ff0000' },
    });
    expect(
      Object.keys(
        (withValueColour(colour, 'High', null) as { values: object }).values,
      ),
    ).toEqual(['Low', 'Medium']);
    // The same attribute again keeps what was chosen.
    expect(dependOn(colour, priority(tool))).toBe(colour);
  });

  it('lists Yes and No for a yes/no attribute', () => {
    expect(
      valueOptions({
        id: 'att_b',
        key: 'Done',
        type: 'boolean',
      } as AttributeDef),
    ).toEqual([
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ]);
    expect(valueOptions(undefined)).toEqual([]);
  });
});

describe('changing the form', () => {
  it('keeps colours and text, and follows the default size only until it was resized', () => {
    const look: NodeLook = {
      ...defaultNodeLook('node'),
      fill: '#112233',
      title: { attribute: 'Name', bold: true },
    };
    const circle = withBase(look, 'circle');
    expect(circle.fill).toBe('#112233');
    expect(circle.title).toEqual({ attribute: 'Name', bold: true });
    expect(circle.size).toMatchObject({ width: 80, height: 80 });
    const resized = { ...look, size: { ...look.size, width: 222 } };
    expect(withBase(resized, 'circle').size.width).toBe(222);
  });

  it('drops the field list when the form is not a box with a header', () => {
    const look: NodeLook = {
      ...defaultNodeLook('node', 'header-box'),
      fields: ['Name'],
    };
    expect(withBase(look, 'rounded').fields).toBeUndefined();
    expect(withBase(look, 'header-box').fields).toEqual(['Name']);
  });
});

describe('saving a look', () => {
  it('rewrites the own shape of the class in place and keeps its id and name', () => {
    const tool = withLook();
    const store = createToolStore(tool);
    const next = { ...defaultNodeLook('node'), fill: '#00ff00' };
    expect(
      store.execute(saveNodeLook(tool, SAMPLE.task as ClassId, next)).ok,
    ).toBe(true);
    const shape = store.state.shapes['shp_task_look' as ShapeId] as NodeShape;
    expect(shape.name).toBe('Task look');
    expect(shape.look?.fill).toBe('#00ff00');
    expect(Object.keys(store.state.shapes)).toEqual(Object.keys(tool.shapes));
    expect(validateToolLibrary(store.state)).toEqual([]);
  });

  it('gives a class without a shape one of its own, as one undo step', () => {
    const tool = sampleTool();
    const before = Object.keys(tool.shapes).length;
    const store = createToolStore(tool);
    const command = saveNodeLook(
      tool,
      SAMPLE.task as ClassId,
      defaultNodeLook(),
    );
    expect(store.execute(command).ok).toBe(true);
    const cls = store.state.classes[SAMPLE.task]!;
    expect(cls.shape).toBeDefined();
    expect((store.state.shapes[cls.shape!] as NodeShape).look).toBeDefined();
    expect(Object.keys(store.state.shapes)).toHaveLength(before + 1);
    store.undo();
    expect(store.state).toEqual(tool);
  });

  it('copies a shape other classes share instead of changing it for all', () => {
    const tool = withLook();
    const shared: ToolLibrary = {
      ...tool,
      classes: {
        ...tool.classes,
        [SAMPLE.gateway]: {
          ...tool.classes[SAMPLE.gateway]!,
          shape: 'shp_task_look' as ShapeId,
        },
      },
    };
    const store = createToolStore(shared);
    const next = { ...defaultNodeLook('node'), fill: '#00ff00' };
    store.execute(saveNodeLook(shared, SAMPLE.task as ClassId, next));
    const own = store.state.classes[SAMPLE.task]!.shape!;
    expect(own).not.toBe('shp_task_look');
    expect(store.state.classes[SAMPLE.gateway]!.shape).toBe('shp_task_look');
    expect(
      (store.state.shapes['shp_task_look' as ShapeId] as NodeShape).look?.fill,
    ).toBe(defaultNodeLook('node').fill);
    const state = appearanceOfClass(store.state, SAMPLE.task as ClassId);
    expect(state.kind === 'look' && state.shared).toEqual([]);
  });

  it('saves a relation look the same way', () => {
    const tool = sampleTool();
    const store = createToolStore(tool);
    const look = {
      ...defaultRelationLook(),
      style: 'dashed' as const,
      end: 'triangle' as const,
    };
    store.execute(saveRelationLook(tool, SAMPLE.flow as RelationId, look));
    const state = appearanceOfRelation(store.state, SAMPLE.flow as RelationId);
    expect(state.kind).toBe('look');
    const shape = (state as { shape: RelationShape }).shape;
    expect(shape.line.dash).toEqual([7, 4]);
    expect(shape.endMarker).toEqual({ type: 'triangle' });
    expect(validateToolLibrary(store.state)).toEqual([]);
  });

  it('starts new classes with a look that suits their kind', () => {
    expect(newNodeLookShape('Lane', 'swimlane').look?.base).toBe('swimlane');
    expect(newNodeLookShape('Group', 'container').look?.base).toBe('container');
    expect(newNodeLookShape('Task', 'node').look?.base).toBe('rounded');
  });
});

describe('hand-drawn shapes', () => {
  it('takes the form of an old drawing when it can be guessed', () => {
    const circle = {
      ...nodeShapeFromLook(
        defaultNodeLook('node', 'circle'),
        'shp_a' as ShapeId,
      ),
    };
    delete (circle as { look?: unknown }).look;
    expect(baseFromShape(circle, { kind: 'node', key: 'Event' })).toBe(
      'circle',
    );
    const diamond = nodeShapeFromLook(
      defaultNodeLook('node', 'diamond'),
      'shp_b' as ShapeId,
    );
    expect(baseFromShape(diamond, { kind: 'node', key: 'Gate' })).toBe(
      'diamond',
    );
    const look = lookReplacingDrawing({ kind: 'swimlane', key: 'Lane' });
    expect(look.base).toBe('swimlane');
    expect(
      lookReplacingDrawing({ kind: 'node', key: 'Task' }, circle).base,
    ).toBe('circle');
  });

  it('removes the look from a shape', () => {
    const shape = nodeShapeFromLook(defaultNodeLook(), 'shp_c' as ShapeId);
    expect(shape.look).toBeDefined();
    expect('look' in withoutLook(shape)).toBe(false);
  });

  it('reads a relation look off a plain line', () => {
    const shape = relationShapeFromLook(
      {
        ...defaultRelationLook(),
        style: 'dotted',
        colour: '#112233',
        end: 'diamond',
      },
      'shp_r' as ShapeId,
    );
    const drawn = withoutLook(shape);
    expect(relationLookFromShape(drawn)).toMatchObject({
      style: 'dotted',
      colour: '#112233',
      end: 'diamond',
      start: 'none',
    });
  });
});

describe('preview tiles', () => {
  it('has one tile for a look that does not change with data', () => {
    const tool = sampleTool();
    const groups = previewGroups(defaultNodeLook(), attrs(tool));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tiles).toHaveLength(1);
  });

  it('has a tile per option for the attribute that drives the fill, and a mark group', () => {
    const tool = sampleTool();
    const look: NodeLook = {
      ...defaultNodeLook(),
      fill: dataColour(priority(tool), '#cccccc'),
      badge: {
        attribute: 'GatewayKind',
        equals: 'XOR',
        text: 'X',
        colour: '#f00',
      },
    };
    const groups = previewGroups(look, [
      ...attrs(tool),
      ...effectiveAttributes(tool, SAMPLE.gateway as ClassId),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['Priority', 'GatewayKind']);
    expect(groups[0]!.tiles.map((t) => t.label)).toEqual([
      'Low',
      'Medium',
      'High',
      'Anything else',
    ]);
  });

  it('draws each value with its own colour', () => {
    const tool = sampleTool();
    const look: NodeLook = {
      ...defaultNodeLook('node', 'box'),
      fill: {
        by: 'Priority',
        values: { High: '#ff0000', Low: '#00ff00' },
        fallback: '#cccccc',
      },
    };
    const fillOf = (value: string | null) => {
      const pic = compileTile(
        look,
        attrs(tool),
        {
          attribute: 'Priority',
          label: String(value),
          values: { Priority: value },
        },
        'Task',
      );
      expect(pic.compiled.messages).toEqual([]);
      return JSON.stringify(pic.compiled.ops);
    };
    expect(fillOf('High')).toContain('#ff0000');
    expect(fillOf('Low')).toContain('#00ff00');
    expect(fillOf('Medium')).toContain('#cccccc');
    expect(fillOf(null)).toContain('#cccccc');
    expect(fillOf('High')).not.toContain('#00ff00');
  });
});
