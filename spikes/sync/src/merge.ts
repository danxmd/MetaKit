/** A change line, exactly as stored in a change file. `f: "$del"` marks a tombstone. */
export interface Op {
  t: string;
  by: string;
  el: string;
  f: string;
  v?: unknown;
}

export const TOMBSTONE_FIELD = '$del';

export interface Cell {
  t: string;
  by: string;
  v: unknown;
}

/**
 * Merged state: the winning cell per element field, plus the winning tombstone per element.
 * Every entry is the maximum of a set, so the result does not depend on delivery order.
 */
export interface State {
  cells: Record<string, Record<string, Cell>>;
  tombstones: Record<string, Cell>;
}

export function emptyState(): State {
  return { cells: {}, tombstones: {} };
}

/** Highest timestamp wins; the instance ID breaks exact ties. */
export function compareCells(
  a: Pick<Cell, 't' | 'by'>,
  b: Pick<Cell, 't' | 'by'>,
): number {
  if (a.t !== b.t) return a.t < b.t ? -1 : 1;
  if (a.by !== b.by) return a.by < b.by ? -1 : 1;
  return 0;
}

function applyOp(state: State, op: Op): void {
  const cell: Cell = { t: op.t, by: op.by, v: op.v };
  if (op.f === TOMBSTONE_FIELD) {
    const current = state.tombstones[op.el];
    if (!current || compareCells(cell, current) > 0) {
      state.tombstones[op.el] = { t: op.t, by: op.by, v: null };
    }
    return;
  }
  const fields = (state.cells[op.el] ??= {});
  const current = fields[op.f];
  if (!current || compareCells(cell, current) > 0) fields[op.f] = cell;
}

/** Pure: returns a new state. Commutative, associative and idempotent in `ops`. */
export function applyOps(state: State, ops: readonly Op[]): State {
  const next = structuredClone(state);
  for (const op of ops) applyOp(next, op);
  return next;
}

/** A state expressed as ops, so snapshots merge by the same rule as change files. */
export function stateToOps(state: State): Op[] {
  const ops: Op[] = [];
  for (const [el, fields] of Object.entries(state.cells)) {
    for (const [f, cell] of Object.entries(fields)) {
      ops.push({ t: cell.t, by: cell.by, el, f, v: cell.v });
    }
  }
  for (const [el, cell] of Object.entries(state.tombstones)) {
    ops.push({ t: cell.t, by: cell.by, el, f: TOMBSTONE_FIELD });
  }
  return ops;
}

export function mergeStates(a: State, b: State): State {
  return applyOps(a, stateToOps(b));
}

/** Live elements and their field values. A tombstone hides an element whatever the clocks say. */
export function liveElements(
  state: State,
): Record<string, Record<string, unknown>> {
  const live: Record<string, Record<string, unknown>> = {};
  for (const [el, fields] of Object.entries(state.cells)) {
    if (state.tombstones[el]) continue;
    live[el] = Object.fromEntries(
      Object.entries(fields).map(([f, cell]) => [f, cell.v]),
    );
  }
  return live;
}
