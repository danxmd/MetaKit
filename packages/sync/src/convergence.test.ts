import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createModelStore,
  type Json,
  type Model,
  type ModelStore,
} from '@metakit-app/core';
import {
  SAMPLE,
  emptySampleModel,
  sampleTool,
} from '@metakit-app/core/testing';
import { MemoryFolder } from './memory-adapter';
import { loadDocument } from './scanner';
import { SyncSession, writeNewDocument } from './session';
import { materialize } from './state';

const FOLDER = 'models/m';
const IDS = ['aaaa0001', 'bbbb0002', 'cccc0003'];

type Step =
  | { who: number; k: 'create'; x: number }
  | { who: number; k: 'move'; pick: number; x: number }
  | { who: number; k: 'rename'; pick: number; n: number }
  | { who: number; k: 'delete'; pick: number }
  | { who: number; k: 'undo' }
  | { who: number; k: 'redo' }
  | { who: number; k: 'flush' }
  | { who: number; k: 'rescan' }
  | { who: number; k: 'snapshot' }
  | { who: number; k: 'restart' };

const who = fc.nat(IDS.length - 1);
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      who,
      k: fc.constant('create' as const),
      x: fc.nat(500),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      who,
      k: fc.constant('move' as const),
      pick: fc.nat(30),
      x: fc.nat(500),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      who,
      k: fc.constant('rename' as const),
      pick: fc.nat(30),
      n: fc.nat(9),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      who,
      k: fc.constant('delete' as const),
      pick: fc.nat(30),
    }),
  },
  { weight: 1, arbitrary: fc.record({ who, k: fc.constant('undo' as const) }) },
  { weight: 1, arbitrary: fc.record({ who, k: fc.constant('redo' as const) }) },
  {
    weight: 3,
    arbitrary: fc.record({ who, k: fc.constant('flush' as const) }),
  },
  {
    weight: 4,
    arbitrary: fc.record({ who, k: fc.constant('rescan' as const) }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ who, k: fc.constant('snapshot' as const) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ who, k: fc.constant('restart' as const) }),
  },
);

describe('sessions on one folder', () => {
  it("end in the same state whatever is flushed, scanned, folded or restarted, and never touch each other's files", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(stepArb, { minLength: 5, maxLength: 70 }),
        async (steps) => {
          const folder = new MemoryFolder();
          let wall = Date.parse('2026-05-01T09:00:00Z');
          const now = () => (wall += 7);
          const doc = emptySampleModel() as unknown as Record<string, Json>;
          await writeNewDocument(
            folder.instance('creator00'),
            FOLDER,
            'model',
            doc,
            now,
          );
          const open = async (id: string) =>
            SyncSession.open(
              {
                adapter: folder.instance(id),
                folder: FOLDER,
                kind: 'model',
                now,
                retries: 0,
                flushMs: 1_000_000,
                snapshotMs: 1_000_000,
              },
              (d) =>
                createModelStore(d as unknown as Model, { tool: sampleTool() }),
            );
          const live: { session: SyncSession; store: ModelStore }[] = [];
          for (const id of IDS) live.push(await open(id));

          for (const step of steps) {
            const s = live[step.who]!;
            const ids = Object.keys((s.store.state as Model).elements);
            const pick = (n: number) => ids[n % ids.length];
            switch (step.k) {
              case 'create':
                s.store.execute({
                  type: 'createElement',
                  class: SAMPLE.task,
                  x: step.x,
                  y: 0,
                  attrs: { [SAMPLE.attName]: 'N' },
                });
                break;
              case 'move':
                if (ids.length)
                  s.store.execute({
                    type: 'move',
                    id: pick(step.pick) as never,
                    x: step.x,
                    y: step.x,
                  });
                break;
              case 'rename':
                if (ids.length)
                  s.store.execute({
                    type: 'setAttribute',
                    target: pick(step.pick) as never,
                    attr: SAMPLE.attName,
                    value: `R${step.n}`,
                  });
                break;
              case 'delete':
                if (ids.length)
                  s.store.execute({
                    type: 'delete',
                    id: pick(step.pick) as never,
                  });
                break;
              case 'undo':
                s.store.undo();
                break;
              case 'redo':
                s.store.redo();
                break;
              case 'flush':
                await s.session.flush();
                break;
              case 'rescan':
                await s.session.rescan();
                break;
              case 'snapshot':
                await s.session.snapshot();
                break;
              case 'restart':
                await s.session.close();
                live[step.who] = await open(IDS[step.who]!);
                break;
            }
          }
          // Everyone writes what is pending, then everyone reads everything (twice, since a read
          // can bring a snapshot that changes what the next read finds).
          for (const s of live) await s.session.flush();
          for (let round = 0; round < 2; round++)
            for (const s of live) await s.session.rescan();

          const reference = live[0]!.session.hash;
          const docs = live.map((s) =>
            JSON.parse(JSON.stringify(s.store.state)),
          );
          for (const s of live) expect(s.session.hash).toBe(reference);
          for (const d of docs) expect(d).toEqual(docs[0]);

          // A fresh reader of the folder, with change files and snapshots as they are now, agrees.
          const fresh = await loadDocument(
            folder.instance('dddd0004'),
            FOLDER,
            'model',
          );
          expect(fresh.state.hash).toBe(reference);
          expect(JSON.parse(JSON.stringify(materialize(fresh.state)))).toEqual(
            docs[0],
          );

          // The rule that makes the folder safe to sync: nobody wrote or removed another's files.
          for (const l of folder.log)
            if (l.by !== 'creator00')
              expect(l.path).toContain(`/_state/${l.by}/`);
        },
      ),
      { numRuns: 120 },
    );
  }, 120_000);
});
