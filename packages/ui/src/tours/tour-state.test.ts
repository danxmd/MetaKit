import { describe, expect, it } from 'vitest';
import { TourState, TOURS_KEY, type TourStorage } from './tour-state';
import type { Tour } from './tours';

const tour: Tour = {
  id: 'demo',
  title: 'Demo',
  summary: 'A tour for the tests.',
  page: 'any',
  steps: [
    { anchor: 'a', title: 'A', text: 'First.' },
    { anchor: 'b', title: 'B', text: 'Second.' },
    { anchor: 'c', title: 'C', text: 'Third.' },
  ],
};

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: TourStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
  return { data, storage };
}

describe('TourState', () => {
  it('walks a tour forwards and back, and finishes after the last step', () => {
    const { data, storage } = memory();
    const state = new TourState(storage);
    const seen: (number | null)[] = [];
    state.subscribe((s) => seen.push(s.run?.index ?? null));

    state.start(tour);
    state.next();
    state.back();
    state.back(); // already at the first step
    state.next();
    state.next();
    expect(state.get().run?.index).toBe(2);
    state.next();

    expect(state.get().run).toBeNull();
    expect(state.isDone('demo')).toBe(true);
    expect(seen).toEqual([null, 0, 1, 0, 1, 2, null]);
    expect(JSON.parse(data.get(TOURS_KEY)!)).toEqual({
      done: ['demo'],
      offered: false,
    });
  });

  it('does not count a tour that was ended early', () => {
    const state = new TourState(memory().storage);
    state.start(tour);
    state.next();
    state.end();
    expect(state.get().run).toBeNull();
    expect(state.isDone('demo')).toBe(false);
  });

  it('starts again from the first step', () => {
    const state = new TourState(memory().storage);
    state.start(tour);
    state.next();
    state.next();
    state.start(tour);
    expect(state.get().run?.index).toBe(0);
  });

  it('skips a missing step in the direction the person was going', () => {
    const state = new TourState(memory().storage);
    state.start(tour);
    state.skip();
    expect(state.get().run?.index).toBe(1);
    state.next();
    state.back();
    state.skip();
    expect(state.get().run?.index).toBe(0);
    // Going back from the first step is not possible, so a skip there goes forward.
    state.skip();
    expect(state.get().run?.index).toBe(1);
  });

  it('remembers finished tours and the answered offer across instances', () => {
    const { storage } = memory();
    const first = new TourState(storage);
    first.start(tour);
    first.next();
    first.next();
    first.next();
    first.markOffered();
    const second = new TourState(storage);
    expect(second.get().done).toEqual(['demo']);
    expect(second.get().offered).toBe(true);
  });

  it('works without storage, and with storage that throws or holds rubbish', () => {
    const throwing: TourStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const state = new TourState(throwing);
    state.start(tour);
    state.next();
    state.next();
    state.next();
    state.markOffered();
    expect(state.isDone('demo')).toBe(true);
    expect(new TourState().get().done).toEqual([]);
    const junk = new TourState(memory({ [TOURS_KEY]: '{not json' }).storage);
    expect(junk.get()).toMatchObject({ done: [], offered: false });
    const odd = new TourState(
      memory({
        [TOURS_KEY]: JSON.stringify({ done: [1, 'x'], offered: 'yes' }),
      }).storage,
    );
    expect(odd.get()).toMatchObject({ done: ['x'], offered: false });
  });
});
