import { describe, expect, it } from 'vitest';
import { ASSIST_KEY, NO_ASSIST, createAssistStore, readAssist } from './assist';

const memory = (initial?: string) => {
  const data: Record<string, string> =
    initial === undefined ? {} : { [ASSIST_KEY]: initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
};

describe('assist preferences', () => {
  it('are off until switched on and remembered', () => {
    const storage = memory();
    const store = createAssistStore(storage);
    expect(store.value).toEqual(NO_ASSIST);
    const seen: boolean[] = [];
    store.subscribe((v) => seen.push(v.smart));
    store.set({ smart: true });
    expect(seen).toEqual([true]);
    expect(createAssistStore(storage).value).toEqual({
      hints: false,
      smart: true,
    });
    store.set({ hints: true });
    expect(readAssist(storage)).toEqual({ hints: true, smart: true });
  });

  it('fall back to off for damaged or blocked storage', () => {
    expect(readAssist(memory('{not json'))).toEqual(NO_ASSIST);
    expect(readAssist(memory('{"hints":"yes"}'))).toEqual(NO_ASSIST);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createAssistStore(blocked);
    expect(() => store.set({ hints: true })).not.toThrow();
    expect(store.value.hints).toBe(true);
  });
});
