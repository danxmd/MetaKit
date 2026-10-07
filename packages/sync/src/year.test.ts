import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  freezeCopy,
  type Json,
  type Model,
  type Patch,
} from '@metakit-app/core';
import {
  sampleTool,
  SAMPLE,
  emptySampleModel,
} from '@metakit-app/core/testing';
import { encode } from './adapter';
import { HybridClock } from './clock';
import {
  CHANGE_FORMAT,
  changeFilePath,
  formatChangeFile,
  formatSnapshot,
  snapshotPath,
} from './files';
import { MemoryFolder } from './memory-adapter';
import { patchesToOps, toLine, type StampedOp } from './ops';
import { SyncSession, writeNewDocument } from './session';
import { loadDocument } from './scanner';
import { materialize, SyncState } from './state';

const FOLDER = 'models/year';
const PEOPLE = ['aaaa0001', 'bbbb0002', 'cccc0003', 'dddd0004', 'eeee0005'];
const DAY = 24 * 3600 * 1000;

/** A small seeded generator, so that every run simulates the same year. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ELEMENTS = 5000;
const CONNECTORS = 7000;

function bigModel(): Record<string, Json> {
  const base = emptySampleModel() as unknown as Record<string, Json>;
  const elements: Record<string, Json> = {};
  const id = (i: number) => `el_${String(i).padStart(10, '0')}`;
  for (let i = 0; i < ELEMENTS; i++)
    elements[id(i)] = {
      id: id(i),
      class: SAMPLE.task,
      x: (i % 100) * 200,
      y: Math.floor(i / 100) * 120,
      w: 120,
      h: 60,
      attrs: { [SAMPLE.attName]: `Node ${i}` },
      pos: String(i).padStart(6, '0'),
    };
  const connectors: Record<string, Json> = {};
  for (let i = 0; i < CONNECTORS; i++) {
    const cid = `cn_${String(i).padStart(10, '0')}`;
    connectors[cid] = {
      id: cid,
      relation: SAMPLE.flow,
      from: id(i % ELEMENTS),
      to: id((i * 7 + 1) % ELEMENTS),
      bends: [],
      attrs: {},
      pos: String(i).padStart(6, '0'),
    };
  }
  return { ...base, elements, connectors };
}

describe('a simulated year', () => {
  it('opens the folder of five people and a year of edits within the budget', async () => {
    const rand = random(2026);
    const folder = new MemoryFolder();
    let wall = Date.parse('2026-01-05T08:00:00Z');
    const now = () => wall;

    // The model exists since January. Everyone has read everything that happened before them.
    await writeNewDocument(
      folder.instance(PEOPLE[0]!),
      FOLDER,
      'model',
      bigModel(),
      now,
    );
    const truth = new SyncState('model');
    {
      const { loadDocument } = await import('./scanner');
      truth.mergeFrom(
        (await loadDocument(folder.instance('reader000'), FOLDER, 'model'))
          .state,
      );
    }
    const seq: Record<string, number> = Object.fromEntries(
      PEOPLE.map((p) => [p, 0]),
    );
    const clocks = new Map(
      PEOPLE.map((p) => [p, new HybridClock(now)] as const),
    );
    const live = new Set(
      Object.keys(truth.entities)
        .filter((k) => k.startsWith('elements/'))
        .map((k) => k.slice(9)),
    );
    let nextNew = ELEMENTS;
    let edits = 0;

    const writeFile = async (person: string, ops: StampedOp[]) => {
      seq[person]! += 1;
      const lines = ops.map(toLine);
      await folder
        .instance(person)
        .writeNew(
          changeFilePath(FOLDER, person, seq[person]!),
          encode(
            formatChangeFile(
              { format: CHANGE_FORMAT, by: person, seen: { ...seq } },
              lines as never,
            ),
          ),
        );
    };

    const snapshot = async (person: string) => {
      const copy = truth.clone();
      copy.compact(wall, 30 * DAY);
      const adapter = folder.instance(person);
      await adapter.overwrite(
        snapshotPath(FOLDER, person),
        encode(
          formatSnapshot(copy, {
            instance: person,
            savedAt: new Date(wall).toISOString(),
            seen: { ...seq },
          }),
        ),
      );
      for (const entry of await adapter.list(`${FOLDER}/_state/${person}`))
        if (entry.name.endsWith('.jsonl'))
          await adapter.remove(`${FOLDER}/_state/${person}/${entry.name}`);
    };

    for (let day = 0; day < 365; day++) {
      wall += DAY;
      const weekday = new Date(wall).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      for (const person of PEOPLE) {
        if (rand() < 0.35) continue; // not everyone works on the model every day
        const clock = clocks.get(person)!;
        const ids = [...live];
        const patches: Patch[] = [];
        const count = 10 + Math.floor(rand() * 30);
        for (let i = 0; i < count; i++) {
          const r = rand();
          const pick = ids[Math.floor(rand() * ids.length)]!;
          if (r < 0.6 && live.has(pick)) {
            const x = Math.floor(rand() * 20000);
            patches.push({
              path: ['elements', pick, 'x'],
              before: 0,
              after: x,
            });
            patches.push({
              path: ['elements', pick, 'y'],
              before: 0,
              after: Math.floor(rand() * 6000),
            });
          } else if (r < 0.85 && live.has(pick)) {
            patches.push({
              path: ['elements', pick, 'attrs', SAMPLE.attName],
              before: 'x',
              after: `Edit ${day} ${i}`,
            });
          } else if (r < 0.93) {
            const nid = `el_${String(nextNew++).padStart(10, '0')}`;
            live.add(nid);
            patches.push({
              path: ['elements', nid],
              after: {
                id: nid,
                class: SAMPLE.task,
                x: 1,
                y: 2,
                w: 120,
                h: 60,
                attrs: { [SAMPLE.attName]: 'New' },
                pos: `n${nextNew}`,
              },
            });
          } else if (live.has(pick)) {
            live.delete(pick);
            patches.push({ path: ['elements', pick], before: { id: pick } });
          }
          edits += 1;
        }
        const ops = patchesToOps('model', patches, () => clock.tick()).map(
          (o) => ({ ...o, by: person }) as StampedOp,
        );
        truth.applyAll(ops);
        await writeFile(person, ops);
      }
      // About every two weeks someone's browser folds its files into a snapshot.
      if (day % 14 === 3)
        await snapshot(PEOPLE[((day / 14) % PEOPLE.length) | 0]!);
    }
    for (const p of PEOPLE) await snapshot(p); // a snapshot at the end of the year, as closing the app does
    // Then one more week of edits that nobody has folded yet.
    for (let d = 0; d < 5; d++) {
      wall += DAY;
      for (const person of PEOPLE) {
        const clock = clocks.get(person)!;
        const pick = [...live][Math.floor(rand() * live.size)]!;
        const ops = patchesToOps(
          'model',
          [{ path: ['elements', pick, 'x'], before: 0, after: d }],
          () => clock.tick(),
        ).map((o) => ({ ...o, by: person }) as StampedOp);
        truth.applyAll(ops);
        await writeFile(person, ops);
      }
    }

    const files = folder.paths();
    const snapshots = files.filter((p) => p.endsWith('snapshot.json'));
    const changeFiles = files.filter((p) => p.endsWith('.jsonl'));
    const bytes = [...folder.files.values()].reduce(
      (n, f) => n + f.data.length,
      0,
    );

    const started = performance.now();
    const { store } = await SyncSession.open(
      {
        adapter: folder.instance('ffff0006'),
        folder: FOLDER,
        kind: 'model',
        now,
      },
      (doc) =>
        createModelStore(doc as unknown as Model, { tool: sampleTool() }),
    );
    const openMs = performance.now() - started;
    console.log(
      `Year of edits: ${edits} edits, ${snapshots.length} snapshots, ${changeFiles.length} change files, ${(bytes / 1e6).toFixed(1)} MB, ${truth.size} registers; open ${openMs.toFixed(0)} ms`,
    );

    expect(JSON.parse(JSON.stringify(store.state))).toEqual(
      JSON.parse(JSON.stringify(freezeCopy(materialize(truth)))),
    );
    expect(snapshots).toHaveLength(PEOPLE.length);
    // The performance budget: a model of this size opens in under a second.
    expect(openMs).toBeLessThan(1000);
    // Clean-up works: the folder holds a handful of files, not a year's worth.
    expect(changeFiles.length).toBeLessThan(40);
  }, 120_000);
});
