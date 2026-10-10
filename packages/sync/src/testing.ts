// Test helpers; not exported from the package.
import {
  createModelStore,
  freezeCopy,
  type Json,
  type Model,
  type ModelCommand,
  type ModelStore,
  type Patch,
} from '@metakit-app/core';
import { emptySampleModel, sampleKit } from '@metakit-app/core/testing';
import { HybridClock } from './clock';
import { updateDocument } from './doc';
import { patchesToOps, type StampedOp } from './ops';
import { materialize, stateFromDocument, SyncState } from './state';

export const GENESIS = { t: '2000-01-01T00:00:00.000Z/000000', by: 'genesis' };

/** The state every test peer starts from: an empty sample model. */
export function genesisState(): SyncState {
  return stateFromDocument(
    'model',
    emptySampleModel() as unknown as Record<string, Json>,
    GENESIS,
  );
}

export function invertForUndo(patches: readonly Patch[]): Patch[] {
  return [...patches].reverse().map((p) => ({
    path: p.path,
    ...(p.after === undefined ? {} : { before: p.after }),
    ...(p.before === undefined ? {} : { after: p.before }),
  }));
}

/** One simulated instance: a model store, a sync state, a clock and an outbox. */
export class Peer {
  readonly clock: HybridClock;
  readonly state = genesisState();
  readonly store: ModelStore;
  readonly outbox: StampedOp[][] = [];
  /** Which batches of other peers were received, as `<peer>:<index>`. */
  readonly received = new Set<string>();

  constructor(
    readonly id: string,
    wall: () => number,
  ) {
    this.clock = new HybridClock(wall);
    const doc = freezeCopy(materialize(this.state)) as unknown as Model;
    this.store = createModelStore(doc, { kit: sampleKit() });
    this.store.subscribe((e) => {
      if (e.origin === 'remote') return;
      const patches =
        e.origin === 'undo' ? invertForUndo(e.patches) : e.patches;
      const ops = patchesToOps('model', patches, () => this.clock.tick()).map(
        (op) => ({ ...op, by: this.id }) as StampedOp,
      );
      if (ops.length === 0) return;
      this.state.applyAll(ops);
      this.outbox.push(ops);
    });
  }

  run(command: ModelCommand): unknown {
    try {
      const r = this.store.execute(command);
      return r.ok ? r.value : undefined;
    } catch {
      return undefined; // an invalid random command is simply not done
    }
  }

  /** Takes in a batch written by another peer, as the session would. */
  receive(batch: StampedOp[]): void {
    for (const op of batch) this.clock.observe(op.t);
    const touches = this.state.applyAll(batch);
    if (touches.length === 0) return;
    const { doc, patches } = updateDocument(
      this.state,
      this.store.state as unknown as Record<string, Json>,
      touches,
    );
    if (patches.length > 0)
      this.store.applyRemote(doc as unknown as Model, patches);
  }
}
