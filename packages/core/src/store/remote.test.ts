import { describe, expect, it } from 'vitest';
import { createModelStore } from '../model/commands';
import type { Model } from '../model/types';
import { SAMPLE, emptySampleModel, sampleTool } from '../testing/sample-tool';
import { setAt, type Patch } from './tx';
import type { ChangeEvent } from './store';

const tool = sampleTool();

function setup() {
  const store = createModelStore(emptySampleModel(), { tool });
  const id = (
    store.execute({
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 0,
    }) as unknown as {
      value: never;
    }
  ).value as string;
  return { store, id };
}

/** What another instance does: writes a value at a path of the current state. */
function remoteSet(
  store: ReturnType<typeof setup>['store'],
  path: string[],
  value: number,
) {
  const before = path.reduce<unknown>(
    (o, k) => (o as Record<string, unknown>)[k],
    store.state,
  );
  const next = setAt(store.state as Model, path, value);
  const patches: Patch[] = [{ path, before: before as number, after: value }];
  store.applyRemote(next, patches);
}

describe('applyRemote', () => {
  it('replaces the state, tells listeners with origin remote, and adds no undo step', () => {
    const { store, id } = setup();
    const seen: ChangeEvent<Model, never>[] = [];
    store.subscribe((e) => seen.push(e as never));
    const steps = store.history().length;
    remoteSet(store, ['elements', id, 'x'], 99);
    expect((store.state as Model).elements[id as never]!.x).toBe(99);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ origin: 'remote' });
    expect(seen[0]!.patches[0]!.path).toEqual(['elements', id, 'x']);
    expect(store.history()).toHaveLength(steps);
  });

  it('does not run before or after handlers', () => {
    const { store, id } = setup();
    let ran = 0;
    store.before('*', () => void (ran += 1));
    store.after('*', () => void (ran += 1));
    remoteSet(store, ['elements', id, 'y'], 5);
    expect(ran).toBe(0);
  });

  it('keeps the local undo history: undo reverts the own step, not the remote one', () => {
    const { store, id } = setup();
    store.execute({ type: 'move', id: id as never, x: 10, y: 0 });
    remoteSet(store, ['elements', id, 'y'], 77);
    expect(store.undo()).toBe(true);
    const e = (store.state as Model).elements[id as never]!;
    expect(e.x).toBe(0);
    expect(e.y).toBe(77);
  });
});

describe('undo among people', () => {
  it('leaves a value alone that someone else changed since, and reports it', () => {
    const { store, id } = setup();
    const events: ChangeEvent<Model, never>[] = [];
    store.execute({ type: 'move', id: id as never, x: 10, y: 20 });
    remoteSet(store, ['elements', id, 'x'], 500);
    store.subscribe((e) => events.push(e as never));
    store.undo();
    const e = (store.state as Model).elements[id as never]!;
    expect(e.x).toBe(500); // changed by someone else: kept
    expect(e.y).toBe(0); // only the user's own change: undone
    expect(events[0]).toMatchObject({ origin: 'undo', skipped: 1 });
    expect(events[0]!.patches).toHaveLength(1);
  });

  it('redoes only what undo undid', () => {
    const { store, id } = setup();
    store.execute({ type: 'move', id: id as never, x: 10, y: 20 });
    remoteSet(store, ['elements', id, 'x'], 500);
    store.undo();
    store.redo();
    const e = (store.state as Model).elements[id as never]!;
    expect(e.x).toBe(500);
    expect(e.y).toBe(20);
  });

  it('does not bring back an element that someone else edited after the user created it', () => {
    const store = createModelStore(emptySampleModel(), { tool });
    const id = (
      store.execute({
        type: 'createElement',
        class: SAMPLE.task,
        x: 0,
        y: 0,
      }) as unknown as {
        value: never;
      }
    ).value as string;
    remoteSet(store, ['elements', id, 'x'], 40);
    store.undo();
    // The creation cannot be undone as it was: the element holds someone else's work now.
    expect((store.state as Model).elements[id as never]).toBeDefined();
    expect(store.canUndo()).toBe(false);
  });

  it('is a plain undo and redo when nobody else touched anything', () => {
    const { store, id } = setup();
    store.execute({ type: 'move', id: id as never, x: 10, y: 20 });
    const moved = store.state;
    store.undo();
    store.redo();
    expect(store.state).toEqual(moved);
  });
});
