import { describe, expect, it } from 'vitest';
import { SAMPLE, sampleKit } from '../testing/sample-kit';
import { createKitStore } from './commands';
import { validateKit } from './guards';
import type { NodeShape, PanelLayout, RelationShape } from './shape-types';
import type { Kit } from './types';

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

function withShapes(extra: Partial<Kit> = {}): Kit {
  const kit = sampleKit();
  // Copies, so that a test that edits a shape does not change the next test's shapes.
  const shapes = JSON.parse(
    JSON.stringify({ shp_task: taskShape, shp_flow: flowShape }),
  );
  return { ...kit, shapes, ...extra } as Kit;
}

const paths = (kit: unknown) => validateKit(kit).map((i) => i.path);

describe('Kit format 2 validation', () => {
  it('accepts shapes and panels', () => {
    const kit = withShapes();
    kit.classes[SAMPLE.task]!.shape = 'shp_task';
    kit.relations[SAMPLE.flow]!.shape = 'shp_flow';
    expect(validateKit(kit)).toEqual([]);
  });

  it('asks for both tables', () => {
    const kit = sampleKit() as unknown as Record<string, unknown>;
    delete kit.shapes;
    delete kit.panels;
    expect(paths(kit)).toEqual(['shapes', 'panels']);
  });

  it('reports a bad part with its path', () => {
    const kit = withShapes();
    (kit.shapes.shp_task as NodeShape).parts.push({ type: 'blob' } as never);
    expect(paths(kit)).toContain('shapes.shp_task.parts[2].type');
  });

  it('reports unknown fields, missing text and an id that does not match', () => {
    const kit = withShapes();
    (kit.shapes.shp_task as NodeShape).parts[1] = {
      type: 'text',
      colour: 'red',
    } as never;
    (kit.shapes as Record<string, unknown>).shp_other = {
      ...taskShape,
      id: 'shp_wrong',
    };
    const p = paths(kit);
    expect(p).toContain('shapes.shp_task.parts[1].colour');
    expect(p).toContain('shapes.shp_task.parts[1].text');
    expect(p).toContain('shapes.shp_other.id');
  });

  it('checks references to shapes', () => {
    const kit = withShapes();
    kit.classes[SAMPLE.task]!.shape = 'shp_missing';
    kit.modelTypes[SAMPLE.process]!.background = 'shp_gone';
    (kit.shapes.shp_task as NodeShape).parts.push({
      type: 'use',
      shape: 'shp_nowhere',
    });
    const p = paths(kit);
    expect(p).toContain(`classes.${SAMPLE.task}.shape`);
    expect(p).toContain(`modelTypes.${SAMPLE.process}.background`);
    expect(p).toContain('shapes.shp_task');
  });

  it('checks panel layouts against the attributes of the class', () => {
    const kit = withShapes();
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
    (kit.panels as Record<string, PanelLayout>)[SAMPLE.task] = layout;
    expect(
      validateKit(kit)
        .map((i) => i.message)
        .join('\n'),
    ).toMatch(/"Nope"/);
  });

  it('checks container rules', () => {
    const kit = withShapes();
    kit.modelTypes[SAMPLE.process]!.containers = {
      [SAMPLE.lane]: [SAMPLE.task],
    };
    expect(validateKit(kit)).toEqual([]);
    kit.modelTypes[SAMPLE.process]!.containers = {
      [SAMPLE.lane]: ['cls_none'],
    } as never;
    expect(
      paths(kit).some((p) =>
        p.startsWith(`modelTypes.${SAMPLE.process}.containers.${SAMPLE.lane}`),
      ),
    ).toBe(true);
  });
});

describe('shape and panel commands', () => {
  it('puts and removes shapes, refusing one that is in use', () => {
    const store = createKitStore(sampleKit());
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
    const store = createKitStore(sampleKit());
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
    const store = createKitStore(sampleKit());
    store.execute({ type: 'putShape', def: taskShape });
    store.undo();
    expect(store.state.shapes.shp_task).toBeUndefined();
  });
});
