import { describe, expect, it } from 'vitest';
import { SAMPLE, sampleTool } from '../testing/sample-tool';
import { createToolStore } from './commands';
import { validateToolLibrary } from './guards';
import type { NodeShape, PanelLayout, RelationShape } from './shape-types';
import type { ToolLibrary } from './types';

const taskShape: NodeShape = {
  id: 'shp_task',
  kind: 'node',
  size: { width: 140, height: 70 },
  parts: [
    {
      type: 'rect',
      width: '100%',
      height: '100%',
      fill: '= Priority == "High" ? "#f00" : "#fff"',
    },
    { type: 'text', text: '= Title', x: 4, y: 4 },
  ],
};
const flowShape: RelationShape = {
  id: 'shp_flow',
  kind: 'relation',
  line: { stroke: '#000' },
  endMarker: { type: 'arrow' },
};

function withShapes(extra: Partial<ToolLibrary> = {}): ToolLibrary {
  const tool = sampleTool();
  // Copies, so that a test that edits a shape does not change the next test's shapes.
  const shapes = JSON.parse(
    JSON.stringify({ shp_task: taskShape, shp_flow: flowShape }),
  );
  return { ...tool, shapes, ...extra } as ToolLibrary;
}

const paths = (tool: unknown) => validateToolLibrary(tool).map((i) => i.path);

describe('tool format 2 validation', () => {
  it('accepts shapes and panels', () => {
    const tool = withShapes();
    tool.classes[SAMPLE.task]!.shape = 'shp_task';
    tool.relations[SAMPLE.flow]!.shape = 'shp_flow';
    expect(validateToolLibrary(tool)).toEqual([]);
  });

  it('asks for both tables', () => {
    const tool = sampleTool() as unknown as Record<string, unknown>;
    delete tool.shapes;
    delete tool.panels;
    expect(paths(tool)).toEqual(['shapes', 'panels']);
  });

  it('reports a bad part with its path', () => {
    const tool = withShapes();
    (tool.shapes.shp_task as NodeShape).parts.push({ type: 'blob' } as never);
    expect(paths(tool)).toContain('shapes.shp_task.parts[2].type');
  });

  it('reports unknown fields, missing text and an id that does not match', () => {
    const tool = withShapes();
    (tool.shapes.shp_task as NodeShape).parts[1] = {
      type: 'text',
      colour: 'red',
    } as never;
    (tool.shapes as Record<string, unknown>).shp_other = {
      ...taskShape,
      id: 'shp_wrong',
    };
    const p = paths(tool);
    expect(p).toContain('shapes.shp_task.parts[1].colour');
    expect(p).toContain('shapes.shp_task.parts[1].text');
    expect(p).toContain('shapes.shp_other.id');
  });

  it('checks references to shapes', () => {
    const tool = withShapes();
    tool.classes[SAMPLE.task]!.shape = 'shp_missing';
    tool.modelTypes[SAMPLE.process]!.background = 'shp_gone';
    (tool.shapes.shp_task as NodeShape).parts.push({
      type: 'use',
      shape: 'shp_nowhere',
    });
    const p = paths(tool);
    expect(p).toContain(`classes.${SAMPLE.task}.shape`);
    expect(p).toContain(`modelTypes.${SAMPLE.process}.background`);
    expect(p).toContain('shapes.shp_task');
  });

  it('checks panel layouts against the attributes of the class', () => {
    const tool = withShapes();
    const layout: PanelLayout = {
      class: SAMPLE.task,
      tabs: [
        {
          label: 'General',
          items: [
            { attribute: 'Name' },
            { group: 'G', items: [{ attribute: 'Nope', control: 'text' }] },
          ],
        },
      ],
    };
    (tool.panels as Record<string, PanelLayout>)[SAMPLE.task] = layout;
    expect(
      validateToolLibrary(tool)
        .map((i) => i.message)
        .join('\n'),
    ).toMatch(/"Nope"/);
  });

  it('checks container rules', () => {
    const tool = withShapes();
    tool.modelTypes[SAMPLE.process]!.containers = {
      [SAMPLE.lane]: [SAMPLE.task],
    };
    expect(validateToolLibrary(tool)).toEqual([]);
    tool.modelTypes[SAMPLE.process]!.containers = {
      [SAMPLE.lane]: ['cls_none'],
    } as never;
    expect(
      paths(tool).some((p) =>
        p.startsWith(`modelTypes.${SAMPLE.process}.containers.${SAMPLE.lane}`),
      ),
    ).toBe(true);
  });
});

describe('shape and panel commands', () => {
  it('puts and removes shapes, refusing one that is in use', () => {
    const store = createToolStore(sampleTool());
    store.execute({ type: 'putShape', def: taskShape });
    store.execute({
      type: 'putPanel',
      layout: {
        class: SAMPLE.task,
        tabs: [{ label: 'A', items: [{ attribute: 'Name' }] }],
      },
    });
    expect(store.state.shapes.shp_task).toBeDefined();
    const cls = store.state.classes[SAMPLE.task]!;
    store.execute({ type: 'putClass', def: { ...cls, shape: 'shp_task' } });
    expect(() =>
      store.execute({ type: 'removeShape', id: 'shp_task' }),
    ).toThrow(/still in use/);
    {
      const withoutShape: Record<string, unknown> = {
        ...store.state.classes[SAMPLE.task]!,
      };
      delete withoutShape.shape;
      store.execute({ type: 'putClass', def: withoutShape as never });
    }
    store.execute({ type: 'removeShape', id: 'shp_task' });
    expect(store.state.shapes.shp_task).toBeUndefined();
    store.execute({ type: 'removePanel', id: SAMPLE.task });
    expect(store.state.panels[SAMPLE.task]).toBeUndefined();
  });

  it('refuses a panel for an unknown class and a shape with a wrong id', () => {
    const store = createToolStore(sampleTool());
    expect(() =>
      store.execute({ type: 'putPanel', layout: { class: 'cls_x', tabs: [] } }),
    ).toThrow();
    expect(() =>
      store.execute({
        type: 'putShape',
        def: { ...taskShape, id: 'oops' as never },
      }),
    ).toThrow(/id of the right kind/);
  });

  it('undoes a shape change', () => {
    const store = createToolStore(sampleTool());
    store.execute({ type: 'putShape', def: taskShape });
    store.undo();
    expect(store.state.shapes.shp_task).toBeUndefined();
  });
});
