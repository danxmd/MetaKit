import { describe, expect, it, vi } from 'vitest';
import { createModelStore } from '../model/commands';
import { SAMPLE, emptySampleModel, sampleTool } from '../testing/sample-tool';
import type { ElementId } from '../ids';
import { MAX_NESTING } from './store';
import { CommandError } from './tx';

const tool = sampleTool();
const make = (user?: string) =>
  createModelStore(emptySampleModel(), { tool, ...(user ? { user } : {}) });
const add = (store: ReturnType<typeof make>, x = 0, user?: string) => {
  const r = store.execute(
    { type: 'createElement', class: SAMPLE.task, x, y: 0 },
    user ? { user } : {},
  );
  if (!r.ok) throw new Error(r.reason);
  return r.value as ElementId;
};

describe('history', () => {
  it('undoes and redoes steps in order', () => {
    const store = make();
    const a = add(store, 1);
    add(store, 2);
    expect(store.history()).toEqual(['createElement', 'createElement']);
    store.undo();
    expect(Object.keys(store.state.elements)).toEqual([a]);
    store.undo();
    expect(store.state.elements).toEqual({});
    expect(store.undo()).toBe(false);
    store.redo();
    store.redo();
    expect(Object.keys(store.state.elements)).toHaveLength(2);
    expect(store.redo()).toBe(false);
  });

  it('forgets redo after a new command', () => {
    const store = make();
    add(store);
    store.undo();
    expect(store.canRedo()).toBe(true);
    add(store);
    expect(store.canRedo()).toBe(false);
    expect(store.redo()).toBe(false);
  });

  it('records no step for a command that changes nothing', () => {
    const store = make();
    const a = add(store);
    store.execute({ type: 'move', id: a, x: 0, y: 0 });
    expect(store.history()).toEqual(['createElement']);
  });

  it('keeps a limited number of steps', () => {
    const store = createModelStore(emptySampleModel(), {
      tool,
      historyLimit: 3,
    });
    for (let i = 0; i < 10; i++) add(store, i);
    expect(store.history()).toHaveLength(3);
    for (let i = 0; i < 5; i++) store.undo();
    expect(Object.keys(store.state.elements)).toHaveLength(7);
  });
});

describe('undo per user', () => {
  it("only reverts the user's own steps", () => {
    const store = make('anna');
    const a = add(store, 0, 'anna');
    const b = add(store, 0, 'ben');
    store.execute({ type: 'move', id: a, x: 100, y: 0 }, { user: 'anna' });
    store.execute({ type: 'move', id: b, x: 200, y: 0 }, { user: 'ben' });
    expect(store.undo('anna')).toBe(true);
    expect(store.state.elements[a]!.x).toBe(0);
    expect(store.state.elements[b]!.x).toBe(200);
    expect(store.canUndo('ben')).toBe(true);
    expect(store.undo('ben')).toBe(true);
    expect(store.state.elements[b]!.x).toBe(0);
    expect(store.history('anna')).toEqual(['createElement']);
    expect(store.canRedo('anna')).toBe(true);
    expect(store.canRedo('carol')).toBe(false);
    expect(store.undo('carol')).toBe(false);
  });

  it('clears only the redo of the user who made a new step', () => {
    const store = make('anna');
    add(store, 1, 'anna');
    add(store, 2, 'ben');
    store.undo('anna');
    store.undo('ben');
    add(store, 3, 'anna');
    expect(store.canRedo('anna')).toBe(false);
    expect(store.canRedo('ben')).toBe(true);
  });
});

describe('subscribers', () => {
  it('hear about commands, undo and redo, once each', () => {
    const store = make();
    const heard = vi.fn();
    const off = store.subscribe(heard);
    add(store);
    store.undo();
    store.redo();
    expect(heard.mock.calls.map(([e]) => e.origin)).toEqual([
      'execute',
      'undo',
      'redo',
    ]);
    const first = heard.mock.calls[0]![0];
    expect(first.patches.length).toBeGreaterThan(0);
    expect(first.previous.elements).toEqual({});
    expect(first.state).toBe(heard.mock.calls[0]![0].state);
    off();
    add(store);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('are not called when nothing changed or the command failed', () => {
    const store = make();
    const heard = vi.fn();
    store.subscribe(heard);
    expect(() =>
      store.execute({ type: 'move', id: 'el_ghost', x: 0, y: 0 }),
    ).toThrow();
    expect(heard).not.toHaveBeenCalled();
  });

  it('share unchanged parts of the state', () => {
    const store = make();
    const a = add(store);
    const b = add(store, 50);
    const before = store.state;
    store.execute({ type: 'move', id: a, x: 7, y: 0 });
    expect(store.state.elements[b]).toBe(before.elements[b]);
    expect(store.state.manifest).toBe(before.manifest);
    expect(store.state.elements[a]).not.toBe(before.elements[a]);
  });
});

describe('before hooks', () => {
  it('can cancel a command with a reason, leaving no trace', () => {
    const store = make();
    const a = add(store);
    store.before('delete', ({ state, command }) => {
      if (
        command.type === 'delete' &&
        state.elements[command.id as ElementId]?.attrs[SAMPLE.attName] ===
          'Locked'
      )
        return { cancel: 'Locked elements cannot be deleted.' };
    });
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: SAMPLE.attName,
      value: 'Locked',
    });
    const before = store.state;
    const stepsBefore = store.history().length;
    const r = store.execute({ type: 'delete', id: a });
    expect(r).toEqual({
      ok: false,
      cancelled: true,
      reason: 'Locked elements cannot be deleted.',
    });
    expect(store.state).toBe(before);
    expect(store.history()).toHaveLength(stepsBefore);
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: SAMPLE.attName,
      value: 'Free',
    });
    expect(store.execute({ type: 'delete', id: a }).ok).toBe(true);
  });

  it('see the state as earlier commands of a batch left it, and a cancel undoes the whole batch', () => {
    const store = make();
    const seen: number[] = [];
    store.before('move', ({ state }) => {
      seen.push(Object.keys(state.elements).length);
      return { cancel: 'No moving today.' };
    });
    const before = store.state;
    const r = store.execute({
      type: 'batch',
      commands: [
        { type: 'createElement', class: SAMPLE.task, x: 0, y: 0, id: 'el_a' },
        { type: 'move', id: 'el_a', x: 5, y: 5 },
      ],
    });
    expect(r).toMatchObject({ ok: false, reason: 'No moving today.' });
    expect(seen).toEqual([1]);
    expect(store.state).toBe(before);
    expect(store.history()).toEqual([]);
  });

  it('can listen to everything and to batches as a whole', () => {
    const store = make();
    const types: string[] = [];
    store.before('*', ({ command }) => void types.push(command.type));
    store.execute({
      type: 'batch',
      commands: [
        { type: 'createElement', class: SAMPLE.task, x: 0, y: 0 },
        { type: 'createElement', class: SAMPLE.task, x: 1, y: 0 },
      ],
    });
    expect(types).toEqual(['batch', 'createElement', 'createElement']);
  });

  it('cannot run commands', () => {
    const store = make();
    store.before('createElement', () => {
      store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 });
    });
    expect(() => add(store)).toThrow(/before handler cannot run commands/);
    expect(store.state.elements).toEqual({});
    // The store still works afterwards.
    const other = make();
    expect(add(other)).toMatch(/^el_/);
  });

  it('can be removed', () => {
    const store = make();
    const off = store.before('createElement', () => ({ cancel: 'no' }));
    expect(
      store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 })
        .ok,
    ).toBe(false);
    off();
    expect(
      store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 })
        .ok,
    ).toBe(true);
  });
});

describe('after hooks', () => {
  it('receive the command, the patches and the new state', () => {
    const store = make();
    const seen: {
      type: string;
      patches: number;
      elements: number;
      user: string;
    }[] = [];
    store.after(
      'createElement',
      ({ command, patches, state, user }) =>
        void seen.push({
          type: command.type,
          patches: patches.length,
          elements: Object.keys(state.elements).length,
          user,
        }),
    );
    add(store);
    expect(seen).toEqual([
      { type: 'createElement', patches: 1, elements: 1, user: 'local' },
    ]);
  });

  it('join the step when they run commands, so one undo reverts both', () => {
    const store = make();
    store.after('createElement', ({ command, state }) => {
      if (command.type === 'createElement' && command.id === undefined) {
        const id = Object.keys(state.elements)[0] as ElementId;
        store.execute({
          type: 'setAttribute',
          target: id,
          attr: SAMPLE.attName,
          value: 'Auto named',
        });
      }
    });
    const a = add(store);
    expect(store.state.elements[a]!.attrs[SAMPLE.attName]).toBe('Auto named');
    expect(store.history()).toEqual(['createElement']);
    store.undo();
    expect(store.state.elements).toEqual({});
    store.redo();
    expect(store.state.elements[a]!.attrs[SAMPLE.attName]).toBe('Auto named');
  });

  it('stop at a fixed depth and revert the step', () => {
    const store = make();
    let calls = 0;
    store.after('createElement', () => {
      calls += 1;
      store.execute({
        type: 'createElement',
        class: SAMPLE.task,
        x: calls,
        y: 0,
      });
    });
    expect(() => add(store)).toThrow(CommandError);
    expect(() => add(store)).toThrow(
      new RegExp(`more than ${MAX_NESTING} levels deep`),
    );
    expect(store.state.elements).toEqual({});
    expect(store.history()).toEqual([]);
    expect(calls).toBeGreaterThanOrEqual(MAX_NESTING);
  });

  it('revert the step when a handler throws', () => {
    const store = make();
    store.after('createElement', () => {
      throw new Error('rule failed');
    });
    expect(() => add(store)).toThrow('rule failed');
    expect(store.state.elements).toEqual({});
    expect(store.canUndo()).toBe(false);
  });

  it('are not called by undo or redo', () => {
    const store = make();
    const after = vi.fn();
    add(store);
    store.after('*', after);
    store.undo();
    store.redo();
    expect(after).not.toHaveBeenCalled();
  });
});

describe('working state and transactions', () => {
  it('shows an after handler the state with its own change, not the old one', () => {
    const store = make();
    let seen = -1;
    store.after('createElement', () => {
      seen = Object.keys(store.working.elements).length;
    });
    add(store);
    expect(seen).toBe(1);
    expect(Object.keys(store.working.elements)).toHaveLength(1);
  });

  it('groups several commands into one undo step and reads its own writes', () => {
    const store = make();
    const outcome = store.transact({ type: 'batch', commands: [] }, () => {
      const a = add(store, 1);
      add(store, 2);
      store.execute({ type: 'move', id: a, x: 50, y: 0 });
      return Object.keys(store.working.elements).length;
    });
    expect(outcome).toEqual({ ok: true, value: 2 });
    expect(store.history()).toHaveLength(1);
    store.undo();
    expect(store.state.elements).toEqual({});
  });

  it('commits nothing when the function throws', () => {
    const store = make();
    expect(() =>
      store.transact({ type: 'batch', commands: [] }, () => {
        add(store);
        throw new Error('script failed');
      }),
    ).toThrow('script failed');
    expect(store.state.elements).toEqual({});
    expect(store.canUndo()).toBe(false);
    expect(add(store)).toBeTruthy();
  });

  it('joins the step in progress when called from a handler, and records no step when nothing changed', () => {
    const store = make();
    store.transact({ type: 'batch', commands: [] }, () => undefined);
    expect(store.canUndo()).toBe(false);
    store.after('createElement', () => {
      store.transact({ type: 'batch', commands: [] }, () => {
        store.execute({ type: 'updateManifest', name: 'Changed' });
      });
    });
    add(store);
    expect(store.history()).toHaveLength(1);
    expect(store.state.manifest.name).toBe('Changed');
  });
});
