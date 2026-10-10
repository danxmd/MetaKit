import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  type Json,
  type Model,
  type ModelStore,
} from '@metakit-app/core';
import { SAMPLE, emptySampleModel, sampleKit } from '@metakit-app/core/testing';
import { MemoryFolder, planted } from './memory-adapter';
import { formatSnapshot, snapshotPath } from './files';
import { loadDocument } from './scanner';
import {
  SyncSession,
  writeNewDocument,
  type Clash,
  type Timers,
} from './session';
import { materialize, stateFromDocument } from './state';
import { encode } from './adapter';

const kit = sampleKit();
const FOLDER = 'models/m1';

const makeStore = (doc: Record<string, Json>): ModelStore =>
  createModelStore(doc as unknown as Model, { kit });

/** A manual clock and timers, so that delays are exact. */
function fakeTime() {
  let now = Date.parse('2026-03-01T09:00:00Z');
  const timers = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  const api: Timers = {
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
  };
  return {
    now: () => now,
    timers: api,
    pending: () => timers.size,
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers])
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
    },
  };
}

async function setup(instances: string[], options: { flushMs?: number } = {}) {
  const folder = new MemoryFolder();
  const time = fakeTime();
  const doc = emptySampleModel() as unknown as Record<string, Json>;
  await writeNewDocument(
    folder.instance('creator'),
    FOLDER,
    'model',
    doc,
    time.now,
  );
  const clashes: Record<string, Clash[]> = {};
  const sessions = await Promise.all(
    instances.map(async (id) => {
      clashes[id] = [];
      const { session, store } = await SyncSession.open(
        {
          adapter: folder.instance(id),
          folder: FOLDER,
          kind: 'model',
          now: time.now,
          timers: time.timers,
          retries: 0,
          flushMs: options.flushMs ?? 2000,
          onClash: (c) => clashes[id]!.push(c),
        },
        makeStore,
      );
      return { id, session, store };
    }),
  );
  return { folder, time, sessions, clashes };
}

const add = (s: { store: ModelStore }, name: string, x = 0) =>
  (
    s.store.execute({
      type: 'createElement',
      class: SAMPLE.task,
      x,
      y: 0,
      attrs: { [SAMPLE.attName]: name },
    }) as unknown as { value: string }
  ).value;
const model = (s: { store: ModelStore }) => s.store.state as Model;

describe('SyncSession', () => {
  it('writes a change file within two seconds and not before', async () => {
    const { folder, time, sessions } = await setup(['aaaa0001']);
    const [a] = sessions;
    add(a!, 'One');
    expect(folder.paths().filter((p) => p.endsWith('.jsonl'))).toEqual([]);
    time.advance(1999);
    expect(folder.paths().filter((p) => p.endsWith('.jsonl'))).toEqual([]);
    time.advance(1);
    await a!.session.flush();
    expect(folder.paths().filter((p) => p.endsWith('.jsonl'))).toEqual([
      `${FOLDER}/_state/aaaa0001/000001.jsonl`,
    ]);
    expect(
      folder.text(`${FOLDER}/_state/aaaa0001/000001.jsonl`).endsWith('\n'),
    ).toBe(true);
  });

  it('two instances converge through the folder', async () => {
    const { sessions } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    const id = add(a!, 'From A', 10);
    await a!.session.flush();
    expect(await b!.session.rescan()).toBeGreaterThan(0);
    expect(model(b!).elements[id as never]!.attrs[SAMPLE.attName]).toBe(
      'From A',
    );
    b!.store.execute({ type: 'move', id: id as never, x: 77, y: 5 });
    await b!.session.flush();
    await a!.session.rescan();
    expect(model(a!).elements[id as never]).toMatchObject({ x: 77, y: 5 });
    expect(a!.session.hash).toBe(b!.session.hash);
    expect(JSON.parse(JSON.stringify(model(a!)))).toEqual(
      JSON.parse(JSON.stringify(model(b!))),
    );
  });

  it('keeps both of two concurrent edits to different fields, and the later one on the same field', async () => {
    const { time, sessions } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    const id = add(a!, 'Shared');
    await a!.session.flush();
    await b!.session.rescan();
    time.advance(10);
    a!.store.execute({ type: 'move', id: id as never, x: 1, y: 1 });
    time.advance(10);
    b!.store.execute({
      type: 'setAttribute',
      target: id as never,
      attr: SAMPLE.attName,
      value: 'Renamed',
    });
    time.advance(10);
    b!.store.execute({ type: 'move', id: id as never, x: 2, y: 2 }); // later than A's move
    await Promise.all([a!.session.flush(), b!.session.flush()]);
    await Promise.all([a!.session.rescan(), b!.session.rescan()]);
    for (const s of [a!, b!]) {
      expect(model(s).elements[id as never]).toMatchObject({ x: 2, y: 2 });
      expect(model(s).elements[id as never]!.attrs[SAMPLE.attName]).toBe(
        'Renamed',
      );
    }
  });

  it('remote changes are not undo steps and the own undo still works', async () => {
    const { time, sessions } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    const id = add(a!, 'T');
    a!.store.execute({ type: 'move', id: id as never, x: 5, y: 0 });
    await a!.session.flush();
    await b!.session.rescan();
    time.advance(10);
    b!.store.execute({ type: 'move', id: id as never, x: 9, y: 9 });
    await b!.session.flush();
    await a!.session.rescan();
    expect(a!.store.history()).toEqual(['createElement', 'move']);
    // B moved the element after A did: A's undo leaves B's position alone.
    a!.store.undo();
    expect(model(a!).elements[id as never]).toMatchObject({ x: 9, y: 9 });
  });

  it('a delete beats a concurrent edit, and undoing the delete brings the element back everywhere', async () => {
    const { time, sessions } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    const id = add(a!, 'Doomed');
    await a!.session.flush();
    await b!.session.rescan();
    time.advance(10);
    a!.store.execute({ type: 'delete', id: id as never });
    time.advance(10);
    b!.store.execute({ type: 'move', id: id as never, x: 300, y: 300 });
    await Promise.all([a!.session.flush(), b!.session.flush()]);
    await Promise.all([a!.session.rescan(), b!.session.rescan()]);
    expect(model(a!).elements[id as never]).toBeUndefined();
    expect(model(b!).elements[id as never]).toBeUndefined();
    time.advance(10);
    a!.store.undo();
    await a!.session.flush();
    await b!.session.rescan();
    expect(model(b!).elements[id as never]).toBeDefined();
    expect(model(b!).elements[id as never]!.attrs[SAMPLE.attName]).toBe(
      'Doomed',
    );
  });

  it('reports a clash only when an edit was made without having read the other', async () => {
    const { time, sessions, clashes } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    const id = add(a!, 'Start');
    await a!.session.flush();
    await b!.session.rescan();
    // Sequential: B reads A's edit, then edits. No clash for A.
    time.advance(10);
    a!.store.execute({
      type: 'setAttribute',
      target: id as never,
      attr: SAMPLE.attName,
      value: 'A1',
    });
    await a!.session.flush();
    await b!.session.rescan();
    time.advance(10);
    b!.store.execute({
      type: 'setAttribute',
      target: id as never,
      attr: SAMPLE.attName,
      value: 'B1',
    });
    await b!.session.flush();
    await a!.session.rescan();
    expect(clashes['aaaa0001']).toEqual([]);
    // Concurrent: each edits before reading the other's file.
    time.advance(10);
    a!.store.execute({
      type: 'setAttribute',
      target: id as never,
      attr: SAMPLE.attName,
      value: 'A2',
    });
    time.advance(10);
    b!.store.execute({
      type: 'setAttribute',
      target: id as never,
      attr: SAMPLE.attName,
      value: 'B2',
    });
    await Promise.all([a!.session.flush(), b!.session.flush()]);
    await Promise.all([a!.session.rescan(), b!.session.rescan()]);
    expect(model(a!).elements[id as never]!.attrs[SAMPLE.attName]).toBe('B2');
    expect(clashes['aaaa0001']).toHaveLength(1);
    expect(clashes['aaaa0001']![0]).toMatchObject({
      mine: 'A2',
      theirs: 'B2',
      by: 'bbbb0002',
    });
    expect(clashes['bbbb0002']).toEqual([]); // B's value won: nothing to tell
  });

  it('never writes or removes a file of another instance', async () => {
    const { folder, time, sessions } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    for (let i = 0; i < 5; i++) {
      add(a!, `A${i}`, i);
      add(b!, `B${i}`, i);
      time.advance(2500);
      await Promise.all([a!.session.flush(), b!.session.flush()]);
      await Promise.all([a!.session.rescan(), b!.session.rescan()]);
    }
    await a!.session.close();
    await b!.session.close();
    const writes = folder.log.filter((l) => l.by !== 'creator');
    expect(writes.length).toBeGreaterThan(10);
    for (const w of writes) expect(w.path).toContain(`/_state/${w.by}/`);
  });

  it('snapshot folds the own change files in and removes them, and a new reader gets the same state', async () => {
    const { folder, time, sessions } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    for (let i = 0; i < 4; i++) {
      add(a!, `A${i}`);
      time.advance(2100);
      await a!.session.flush();
    }
    await b!.session.rescan();
    add(b!, 'B');
    await b!.session.flush();
    await a!.session.rescan();
    expect(
      folder
        .paths()
        .filter((p) => p.includes('/aaaa0001/') && p.endsWith('.jsonl')),
    ).toHaveLength(4);
    await a!.session.snapshot();
    expect(
      folder
        .paths()
        .filter((p) => p.includes('/aaaa0001/') && p.endsWith('.jsonl')),
    ).toEqual([]);
    expect(folder.files.has(snapshotPath(FOLDER, 'aaaa0001'))).toBe(true);
    // B's file is still there: A does not touch it.
    expect(
      folder
        .paths()
        .filter((p) => p.includes('/bbbb0002/') && p.endsWith('.jsonl')),
    ).toHaveLength(1);

    const fresh = await loadDocument(
      folder.instance('cccc0003'),
      FOLDER,
      'model',
    );
    expect(fresh.state.canonical()).toBe(
      (
        await loadDocument(folder.instance('dddd0004'), FOLDER, 'model')
      ).state.canonical(),
    );
    expect(materialize(fresh.state)).toEqual(
      JSON.parse(JSON.stringify(model(a!))),
    );
  });

  it('a reader that missed folded files still reaches the same state (snapshot of the author, files of others)', async () => {
    const { folder, time, sessions } = await setup(['aaaa0001', 'bbbb0002']);
    const [a, b] = sessions;
    add(a!, 'A');
    await a!.session.flush();
    await b!.session.rescan();
    add(b!, 'B');
    time.advance(5);
    await b!.session.flush();
    await a!.session.close(); // folds and removes A's files
    await b!.session.close();
    const reader = await loadDocument(
      folder.instance('cccc0003'),
      FOLDER,
      'model',
    );
    expect(
      Object.keys(materialize(reader.state)['elements'] as object),
    ).toHaveLength(2);
    expect(reader.state.canonical()).toBe(b!.session['state'].canonical());
  });

  it('continues the sequence after a restart with the same instance id', async () => {
    const { folder, time, sessions } = await setup(['aaaa0001']);
    const [a] = sessions;
    add(a!, 'One');
    time.advance(2100);
    await a!.session.flush();
    add(a!, 'Two');
    await a!.session.flush();
    const again = await SyncSession.open(
      {
        adapter: folder.instance('aaaa0001'),
        folder: FOLDER,
        kind: 'model',
        now: time.now,
        timers: time.timers,
        retries: 0,
      },
      makeStore,
    );
    add(again, 'Three');
    again.store.execute({
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 0,
    });
    await again.session.flush();
    const names = folder.paths().filter((p) => p.endsWith('.jsonl'));
    expect(names).toEqual([
      `${FOLDER}/_state/aaaa0001/000001.jsonl`,
      `${FOLDER}/_state/aaaa0001/000002.jsonl`,
      `${FOLDER}/_state/aaaa0001/000003.jsonl`,
    ]);
    expect(Object.keys(model(again).elements)).toHaveLength(4);
  });

  it('does not apply a change file that is not complete yet, and applies it once it is', async () => {
    const { folder, sessions } = await setup(['aaaa0001']);
    const [a] = sessions;
    const header = '{"format":1,"by":"zzzz0009","seen":{}}\n';
    const line =
      '{"t":"2026-03-01T09:00:05.000Z/000001","p":["manifest","name"],"v":"Remote name"}';
    planted(folder, `${FOLDER}/_state/zzzz0009/000001.jsonl`, header + line);
    expect(await a!.session.rescan()).toBe(0);
    expect(model(a!).manifest.name).not.toBe('Remote name');
    planted(
      folder,
      `${FOLDER}/_state/zzzz0009/000001.jsonl`,
      `${header}${line}\n`,
    );
    expect(await a!.session.rescan()).toBe(1);
    expect(model(a!).manifest.name).toBe('Remote name');
  });

  it('skips a damaged file with a warning and carries on', async () => {
    const { folder, sessions } = await setup(['aaaa0001']);
    const [a] = sessions;
    planted(
      folder,
      `${FOLDER}/_state/zzzz0009/000001.jsonl`,
      'not json at all\n',
    );
    planted(
      folder,
      `${FOLDER}/_state/zzzz0009/000002.jsonl`,
      '{"format":1,"by":"zzzz0009","seen":{}}\n{"t":"2026-03-01T09:00:05.000Z/000001","p":["manifest","name"],"v":"After damage"}\n',
    );
    await a!.session.rescan();
    expect(model(a!).manifest.name).toBe('After damage');
  });

  it('refuses a file from a newer version instead of reading it wrongly', async () => {
    const { folder, sessions } = await setup(['aaaa0001']);
    const [a] = sessions;
    planted(
      folder,
      `${FOLDER}/_state/zzzz0009/000001.jsonl`,
      '{"format":9,"by":"zzzz0009","seen":{}}\n',
    );
    await expect(a!.session.rescan()).rejects.toThrow(/newer/);
  });

  it('keeps timers tidy: a flush timer exists only while there is something to write', async () => {
    const { time, sessions } = await setup(['aaaa0001']);
    const [a] = sessions;
    expect(time.pending()).toBe(0);
    add(a!, 'x');
    expect(time.pending()).toBe(1);
    await a!.session.flush();
    expect(time.pending()).toBe(0);
  });
});

describe('snapshot format', () => {
  it('reads a phase 1 snapshot (a plain document) and writes the next one as format 2', async () => {
    const folder = new MemoryFolder();
    const time = fakeTime();
    const doc = emptySampleModel();
    planted(
      folder,
      `${FOLDER}/_state/oldold01/snapshot.json`,
      `${JSON.stringify({ document: doc, formatVersion: 1, instance: 'oldold01', kind: 'model', savedAt: '2026-02-01T10:00:00.000Z' }, null, 2)}\n`,
    );
    const { session, store } = await SyncSession.open(
      {
        adapter: folder.instance('aaaa0001'),
        folder: FOLDER,
        kind: 'model',
        now: time.now,
        timers: time.timers,
        retries: 0,
      },
      makeStore,
    );
    expect(JSON.parse(JSON.stringify(store.state))).toEqual(
      JSON.parse(JSON.stringify(doc)),
    );
    store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 });
    await session.snapshot();
    expect(
      JSON.parse(folder.text(snapshotPath(FOLDER, 'aaaa0001'))).formatVersion,
    ).toBe(2);
  });

  it('writes one entity per line and ends with a newline', () => {
    const state = stateFromDocument(
      'model',
      emptySampleModel() as unknown as Record<string, Json>,
      { t: '2026-01-01T00:00:00.000Z/000000', by: 'x' },
    );
    const text = formatSnapshot(state, {
      instance: 'x',
      savedAt: '2026-01-01T00:00:00.000Z',
      seen: { x: 3 },
    });
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text).seen).toEqual({ x: 3 });
    expect(encode(text).length).toBeGreaterThan(10);
  });
});
