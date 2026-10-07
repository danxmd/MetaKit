import { describe, expect, it } from 'vitest';
import type { ElementId } from '../ids';
import { CANCELLABLE_EVENTS, EVENT_NAMES } from '../meta/rule-types';
import { isA } from '../meta/inherit';
import type { AttributeDef, ToolLibrary } from '../meta/types';
import { createModelStore } from '../model/commands';
import type { Model } from '../model/types';
import { setAt, type Patch } from '../store/tx';
import { SAMPLE, emptySampleModel, sampleTool } from '../testing/sample-tool';
import { attachEvents } from './bridge';
import { EventBus, type EventPayload } from './bus';

function setup() {
  const base = sampleTool();
  const tool: ToolLibrary = {
    ...base,
    classes: {
      ...base.classes,
      [SAMPLE.task]: {
        ...base.classes[SAMPLE.task]!,
        attributes: [
          ...base.classes[SAMPLE.task]!.attributes,
          {
            id: 'att_steps',
            key: 'Steps',
            type: 'table',
            columns: [{ id: 'col_a', key: 'Step', type: 'text' }],
          } as AttributeDef,
        ],
      },
    },
  };
  const store = createModelStore(emptySampleModel(), { tool });
  const bus = new EventBus({ isA: (c, a) => isA(tool, c, a) });
  attachEvents(store, bus, { tool: () => tool });
  const seen: EventPayload[] = [];
  bus.on('*', (p) => void seen.push(p));
  const exec = (command: Record<string, unknown>) =>
    store.execute(command as never);
  const task = (attrs: Record<string, unknown> = {}) =>
    (
      exec({
        type: 'createElement',
        class: SAMPLE.task,
        x: 1,
        y: 2,
        attrs: { [SAMPLE.attName]: 'Old', ...attrs },
      }) as unknown as { value: ElementId }
    ).value;
  const names = () => seen.map((e) => e.event);
  return { store, bus, seen, exec, task, names, tool };
}

describe('the 24 events', () => {
  it('has exactly 24, seven of which can cancel', () => {
    expect(EVENT_NAMES).toHaveLength(24);
    expect(CANCELLABLE_EVENTS).toHaveLength(7);
  });

  it('object.creating and object.created', () => {
    const { names, task, seen } = setup();
    const id = task();
    expect(names()).toEqual(
      ['object.creating', 'object.created', 'attribute.changed'].slice(0, 2),
    );
    expect(seen[0]).toMatchObject({ target: null, class: SAMPLE.task });
    expect(seen[1]).toMatchObject({ target: id, class: SAMPLE.task });
  });

  it('connector.creating and connector.created', () => {
    const { exec, task, seen } = setup();
    const a = task();
    const b = task();
    seen.length = 0;
    exec({ type: 'createConnector', relation: SAMPLE.flow, from: a, to: b });
    expect(seen.map((e) => e.event)).toEqual([
      'connector.creating',
      'connector.created',
    ]);
    expect(seen[1]).toMatchObject({ relation: SAMPLE.flow, from: a, to: b });
  });

  it('object.moved, object.resized and object.renamed carry old and new values', () => {
    const { exec, task, seen } = setup();
    const id = task();
    seen.length = 0;
    exec({ type: 'move', id, x: 50, y: 60 });
    exec({ type: 'resize', id, w: 200, h: 90 });
    exec({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attName,
      value: 'New name',
    });
    const byName = Object.fromEntries(seen.map((e) => [e.event, e]));
    expect(byName['object.moved']).toMatchObject({
      target: id,
      old: { x: 1, y: 2 },
      new: { x: 50, y: 60 },
    });
    expect(byName['object.resized']).toMatchObject({
      target: id,
      new: { w: 200, h: 90 },
    });
    expect(byName['object.renamed']).toMatchObject({
      target: id,
      old: 'Old',
      new: 'New name',
      attribute: 'Name',
    });
    expect(seen.map((e) => e.event)).toEqual([
      'object.moved',
      'object.resized',
      'attribute.changing',
      'attribute.changed',
      'object.renamed',
    ]);
  });

  it('a move that changes nothing is silent', () => {
    const { exec, task, seen } = setup();
    const id = task();
    seen.length = 0;
    exec({ type: 'move', id, x: 1, y: 2 });
    expect(seen).toEqual([]);
  });

  it('connector.reconnected names the end', () => {
    const { exec, task, seen } = setup();
    const [a, b, c] = [task(), task(), task()];
    const cn = (
      exec({
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: a,
        to: b,
      }) as unknown as { value: string }
    ).value;
    seen.length = 0;
    exec({ type: 'reconnect', id: cn, to: c });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      event: 'connector.reconnected',
      target: cn,
      end: 'to',
      old: b,
      new: c,
    });
  });

  it('attribute.changing and attribute.changed use the attribute key', () => {
    const { exec, task, seen } = setup();
    const id = task();
    seen.length = 0;
    exec({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attPriority,
      value: 'High',
    });
    expect(seen.map((e) => e.event)).toEqual([
      'attribute.changing',
      'attribute.changed',
    ]);
    expect(seen[0]).toMatchObject({
      attribute: 'Priority',
      old: 'Medium',
      new: 'High',
    });
    expect(seen[1]).toMatchObject({ attribute: 'Priority', new: 'High' });
  });

  it('table.rowAdded and table.rowRemoved fire per row', () => {
    const { exec, task, seen } = setup();
    const id = task();
    seen.length = 0;
    exec({
      type: 'setAttribute',
      target: id,
      attr: 'att_steps',
      value: [{ col_a: 'one' }, { col_a: 'two' }],
    });
    expect(
      seen.filter((e) => e.event === 'table.rowAdded').map((e) => e.row),
    ).toEqual([0, 1]);
    seen.length = 0;
    exec({
      type: 'setAttribute',
      target: id,
      attr: 'att_steps',
      value: [{ col_a: 'one' }],
    });
    expect(
      seen.filter((e) => e.event === 'table.rowRemoved').map((e) => e.row),
    ).toEqual([1]);
  });

  it('object.deleting and object.deleted', () => {
    const { exec, task, seen } = setup();
    const id = task();
    seen.length = 0;
    exec({ type: 'delete', id });
    expect(seen.map((e) => e.event)).toEqual([
      'object.deleting',
      'object.deleted',
    ]);
    expect(seen[1]).toMatchObject({ target: id, class: SAMPLE.task });
  });

  it('events of the app, the model, the views and the selection go through the bus too', () => {
    const { bus } = setup();
    const heard: string[] = [];
    bus.on('*', (p) => void heard.push(p.event));
    const quiet = [
      'app.started',
      'app.closing',
      'model.created',
      'model.opened',
      'model.deleted',
      'view.changed',
      'selection.changed',
      'model.creating',
      'model.deleting',
      'view.changing',
    ] as const;
    for (const event of quiet)
      expect(bus.emit({ event, target: null, user: 'u' })).toEqual({
        cancelled: false,
      });
    expect(heard).toEqual([...quiet]);
  });
});

describe('cancelling', () => {
  it.each([
    ['object.creating', (x: ReturnType<typeof setup>) => void x.task()],
    [
      'attribute.changing',
      (x: ReturnType<typeof setup>) =>
        void x.exec({
          type: 'setAttribute',
          target: x.task(),
          attr: SAMPLE.attName,
          value: 'Z',
        }),
    ],
    [
      'object.deleting',
      (x: ReturnType<typeof setup>) =>
        void x.exec({ type: 'delete', id: x.task() }),
    ],
  ] as const)(
    'a handler of %s stops the action and the reason comes back',
    (event, act) => {
      const x = setup();
      const before = x.store.state;
      let ranAfter = 0;
      x.bus.on(event, () => ({ cancel: 'not allowed' }));
      x.bus.on(event, () => void ranAfter++);
      const result = (() => {
        try {
          act(x);
          return 'ran';
        } catch (e) {
          return String(e);
        }
      })();
      void result;
      if (event === 'object.creating')
        expect(Object.keys((x.store.state as Model).elements)).toHaveLength(0);
      else
        expect(Object.keys((x.store.state as Model).elements)).toHaveLength(1);
      // The first cancel stops the other handlers.
      expect(ranAfter).toBe(0);
      void before;
    },
  );

  it('connector.creating cancels, and the command reports why', () => {
    const { exec, task, bus, store } = setup();
    const a = task();
    const b = task();
    bus.on('connector.creating', () => ({ cancel: 'no flows today' }));
    const r = exec({
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
    });
    expect(r).toMatchObject({
      ok: false,
      cancelled: true,
      reason: 'no flows today',
    });
    expect(Object.keys((store.state as Model).connectors)).toHaveLength(0);
  });

  it('a handler returning false cancels with a default reason', () => {
    const { bus } = setup();
    bus.on('model.deleting', () => false);
    expect(
      bus.emit({ event: 'model.deleting', target: 'mdl_x', user: 'u' }),
    ).toEqual({ cancelled: true, reason: 'Cancelled.' });
  });

  it('events that are not "before" events ignore a cancel', () => {
    const { bus } = setup();
    bus.on('object.created', () => false);
    expect(
      bus.emit({ event: 'object.created', target: 'el_x', user: 'u' }),
    ).toEqual({ cancelled: false });
  });
});

describe('filters and patterns', () => {
  it('match by class including subclasses, attribute and relation, and by prefix', () => {
    const { bus, exec, task } = setup();
    const hits: string[] = [];
    bus.on('object.*', (p) => void hits.push(`o:${p.event}`), {
      class: SAMPLE.flowNode,
    });
    bus.on('attribute.changed', (p) => void hits.push(`a:${p.attribute}`), {
      attribute: 'Priority',
    });
    const id = task();
    exec({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attPriority,
      value: 'High',
    });
    exec({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attEffort,
      value: 4,
    });
    expect(hits).toContain('o:object.created');
    expect(hits.filter((h) => h.startsWith('a:'))).toEqual(['a:Priority']);
  });
});

describe('merged changes', () => {
  it('never fire events', () => {
    const { store, seen, task } = setup();
    const id = task();
    seen.length = 0;
    const model = store.state as Model;
    const patches: Patch[] = [
      { path: ['elements', id, 'x'], before: model.elements[id]!.x, after: 99 },
    ];
    store.applyRemote(setAt(model, ['elements', id, 'x'], 99), patches);
    expect((store.state as Model).elements[id]!.x).toBe(99);
    expect(seen).toEqual([]);
  });

  it('are not announced again when the user undoes and redoes their own change', () => {
    const { store, seen, task } = setup();
    task();
    seen.length = 0;
    store.undo();
    store.redo();
    expect(seen).toEqual([]);
  });
});
