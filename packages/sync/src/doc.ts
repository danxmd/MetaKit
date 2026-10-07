import {
  deepEqual,
  freezeCopy,
  freezeDraft,
  getAt,
  setAt,
  type Draft,
  type Json,
  type Patch,
} from '@metakit-app/core';
import { entityObject, hasEnds, type SyncState, type Touch } from './state';

type Doc = Record<string, Json>;

/** Writes at a path, making the objects on the way if an op arrived before the one that makes them. */
function setMaking(
  root: Doc,
  path: readonly string[],
  value: Json | undefined,
  draft: Draft,
): Doc {
  let next = root;
  for (let i = 1; i < path.length; i++) {
    const parent = path.slice(0, i);
    if (getAt(next, parent) === undefined) {
      if (value === undefined) return next;
      next = setAt(next, parent, {}, draft);
    }
  }
  return setAt(next, path, value, draft);
}

export interface DocumentUpdate {
  doc: Doc;
  /** Entity-level patches for the entities that changed, and field-level ones for plain registers. */
  patches: Patch[];
}

/**
 * Brings a document up to date with a state after some ops were applied: only the entities and
 * registers in `touches` are rebuilt, and each change is reported as a patch so that listeners
 * such as the canvas can follow it. Connectors whose end is missing are left out of a model.
 */
export function updateDocument(
  state: SyncState,
  current: Doc,
  touches: readonly Touch[],
): DocumentUpdate {
  const draft: Draft = new Set();
  const patches: Patch[] = [];
  let doc = current;
  let elementsChanged = false;

  const write = (path: string[], after: Json | undefined) => {
    const before = getAt(doc, path);
    if (
      before === undefined
        ? after === undefined
        : after !== undefined && deepEqual(before, after)
    )
      return false;
    doc = setMaking(doc, path, after, draft);
    patches.push({
      path,
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
    });
    return true;
  };

  const visible = (
    collection: string,
    value: Json | undefined,
  ): Json | undefined => {
    if (value === undefined) return undefined;
    if (state.kind === 'model' && collection === 'connectors') {
      const elements = (doc['elements'] ?? {}) as Record<string, Json>;
      return hasEnds(value, elements) ? value : undefined;
    }
    return value;
  };

  for (const touch of touches) {
    if (touch.plain !== undefined) {
      const r = state.plain.get(touch.plain);
      if (r) write([...r.p], r.v === undefined ? undefined : freezeCopy(r.v));
      continue;
    }
    const e = state.entities.get(touch.entity!);
    if (!e) continue;
    const built = entityObject(state, touch.entity!);
    const after = visible(
      e.collection,
      built === undefined ? undefined : freezeCopy(built),
    );
    const existed = getAt(doc, [e.collection, e.id]) !== undefined;
    write([e.collection, e.id], after);
    // An element that appeared or went changes which connectors can be shown.
    if (
      e.collection === 'elements' &&
      state.kind === 'model' &&
      existed !== (after !== undefined)
    )
      elementsChanged = true;
  }

  if (elementsChanged) {
    for (const [key, e] of state.entities) {
      if (e.collection !== 'connectors') continue;
      const built = entityObject(state, key);
      write(
        [e.collection, e.id],
        visible(
          e.collection,
          built === undefined ? undefined : freezeCopy(built),
        ),
      );
    }
  }

  freezeDraft(draft);
  return { doc, patches };
}
