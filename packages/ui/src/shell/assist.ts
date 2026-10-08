/**
 * Help while modelling: interaction hints and smart modelling. These are preferences of the person
 * in this browser, not part of the model, so switching them on changes nothing for colleagues and
 * nothing in the model file. Both are off until switched on.
 */

export interface ModelingAssist {
  /** A hint line on the canvas: what the person is doing and what a relation connects. */
  hints: boolean;
  /** Hovering a concept shows what it can be connected to. */
  smart: boolean;
}

export const ASSIST_KEY = 'metakit.assist';
export const NO_ASSIST: ModelingAssist = { hints: false, smart: false };

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export function readAssist(storage: Storage | undefined): ModelingAssist {
  try {
    const raw = storage?.getItem(ASSIST_KEY);
    if (!raw) return NO_ASSIST;
    const parsed = JSON.parse(raw) as Partial<ModelingAssist>;
    return { hints: parsed.hints === true, smart: parsed.smart === true };
  } catch {
    // Blocked storage or damaged text: the safe answer is "off".
    return NO_ASSIST;
  }
}

export function createAssistStore(storage?: Storage) {
  let value = readAssist(storage);
  const listeners = new Set<(v: ModelingAssist) => void>();
  return {
    get value(): ModelingAssist {
      return value;
    },
    set(patch: Partial<ModelingAssist>): void {
      value = { ...value, ...patch };
      try {
        storage?.setItem(ASSIST_KEY, JSON.stringify(value));
      } catch {
        // Not remembered; it still applies to this page.
      }
      for (const l of listeners) l(value);
    },
    subscribe(listener: (v: ModelingAssist) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type AssistStore = ReturnType<typeof createAssistStore>;

let shared: AssistStore | undefined;
/** The store of the page, created on first use so that Node and tests need no DOM. */
export function pageAssist(): AssistStore {
  if (shared) return shared;
  let storage: Storage | undefined;
  try {
    storage = typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    storage = undefined;
  }
  shared = createAssistStore(storage);
  return shared;
}
