import { deepEqual, freezeCopy, whyNotJson, type Json } from '../json';

/** A path into a document's state, e.g. `['elements', 'el_a1', 'x']`. Never contains array indexes. */
export type Path = readonly string[];

/**
 * One recorded write. `before` and `after` are absent when the value did not exist, which keeps
 * "set to undefined" and "delete" apart and lets undo remove what a command created.
 */
export interface Patch {
  path: Path;
  before?: Json;
  after?: Json;
}

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandError';
  }
}

/** Rejects anything that would not survive being saved as JSON, as a command error. */
export function requireJson(
  value: unknown,
  what: string,
): asserts value is Json {
  const reason = whyNotJson(value);
  if (reason)
    throw new CommandError(`${what} must be plain JSON data: ${reason}.`);
}

function isRecord(value: unknown): value is Record<string, Json> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getAt(root: unknown, path: Path): Json | undefined {
  let current: unknown = root;
  for (const key of path) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) return undefined;
    current = current[key];
  }
  return current as Json | undefined;
}

/**
 * Objects copied during one run of writes. Copying a big record for every write makes a batch of
 * many writes slow (a 5,000-element model copied per write), so a copy made by this run is changed
 * in place by its later writes and frozen once the run is over.
 */
export type Draft = Set<object>;

/** Returns a new root with `value` at `path` (or the entry removed when `value` is undefined). Unchanged branches are shared. */
export function setAt<T>(
  root: T,
  path: Path,
  value: Json | undefined,
  draft?: Draft,
): T {
  if (path.length === 0) {
    if (value === undefined)
      throw new Error('The whole document cannot be removed');
    return value as unknown as T;
  }
  const [head, ...rest] = path as [string, ...string[]];
  if (!isRecord(root))
    throw new CommandError(
      `Cannot write ${path.join('.')}: ${head} is not inside an object`,
    );
  const child = Object.hasOwn(root, head) ? root[head] : undefined;
  if (rest.length > 0 && child === undefined)
    throw new CommandError(
      `Cannot write ${path.join('.')}: "${head}" does not exist`,
    );
  const next = rest.length === 0 ? value : setAt(child, rest, value, draft);
  if (next === child) return root;
  if (draft?.has(root)) {
    const own = root as Record<string, Json>;
    if (next === undefined) delete own[head];
    else own[head] = next;
    return root;
  }
  const copy: Record<string, Json> = { ...root };
  if (next === undefined) delete copy[head];
  else copy[head] = next;
  if (draft) {
    draft.add(copy);
    return copy as unknown as T;
  }
  return Object.freeze(copy) as unknown as T;
}

/**
 * The only way a command touches state. Every write is recorded as a patch, so undo is the
 * recorded writes run backwards.
 */
export class Tx<S> {
  private current: S;
  private readonly draft: Draft = new Set();
  readonly patches: Patch[] = [];

  constructor(initial: S) {
    this.current = initial;
  }

  /** The state with everything frozen; use it for anything that leaves the command (handlers, the store). */
  get state(): S {
    freezeDraft(this.draft);
    return this.current;
  }

  /**
   * The state as the command reads it. Parts of it may still be changed by later writes of the same
   * run, so a command reads from it and does not keep it.
   */
  get view(): S {
    return this.current;
  }

  get(path: Path): Json | undefined {
    return getAt(this.current, path);
  }

  has(path: Path): boolean {
    return this.get(path) !== undefined;
  }

  /** Writes a copy of `value`; the caller's object is never held or frozen. */
  set(path: Path, value: unknown): void {
    requireJson(value, `The value at ${path.join('.')}`);
    const before = this.frozenAt(path);
    // Writing what is already there changes nothing, so it leaves no patch and no undo step.
    if (before !== undefined && deepEqual(before, value)) return;
    const frozen = freezeCopy(value);
    this.current = setAt(this.current, path, frozen, this.draft);
    this.patches.push({
      path,
      ...(before === undefined ? {} : { before }),
      after: frozen,
    });
  }

  /** The value at a path, as a frozen value that later writes cannot change (patches keep it). */
  private frozenAt(path: Path): Json | undefined {
    const value = this.get(path);
    return value !== null && typeof value === 'object' && this.draft.has(value)
      ? freezeCopy(value)
      : value;
  }

  remove(path: Path): void {
    const before = this.frozenAt(path);
    if (before === undefined) return;
    this.current = setAt(this.current, path, undefined, this.draft);
    this.patches.push({ path, before });
  }
}

function freezeDraft(draft: Draft): void {
  for (const object of draft) Object.freeze(object);
  draft.clear();
}

/** Applies patches forwards (redo) to a state. */
export function applyPatches<S>(state: S, patches: readonly Patch[]): S {
  const draft: Draft = new Set();
  let next = state;
  for (const p of patches) next = setAt(next, p.path, p.after, draft);
  freezeDraft(draft);
  return next;
}

/** Applies patches backwards (undo): last write first, each restoring what was there before. */
export function revertPatches<S>(state: S, patches: readonly Patch[]): S {
  const draft: Draft = new Set();
  let next = state;
  for (let i = patches.length - 1; i >= 0; i--) {
    const p = patches[i]!;
    next = setAt(next, p.path, p.before, draft);
  }
  freezeDraft(draft);
  return next;
}
