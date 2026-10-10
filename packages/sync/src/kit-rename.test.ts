import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  type Json,
  type Model,
  type ModelStore,
} from '@metakit-app/core';
import { emptySampleModel, sampleKit, SAMPLE } from '@metakit-app/core/testing';
import { MemoryFolder, planted } from './memory-adapter';
import {
  changeFilePath,
  formatChangeFile,
  formatSnapshot,
  parseChangeFile,
  parseSnapshot,
  parseSnapshotHeader,
  snapshotPath,
  snapshotV2ToV3,
  SNAPSHOT_FORMAT,
} from './files';
import { currentPath } from './path';
import { formatPresence, parsePresence } from './presence';
import { loadDocument } from './scanner';
import { SyncSession } from './session';
import { materialize, stateFromDocument } from './state';

// Releases before the Kit rename (ADR 0011) wrote `kind: "tool"` for a Kit and the model
// registers `manifest/tool` and `manifest/toolVersion`, in snapshot format 2.

const FOLDER = 'models/m1';
const kit = sampleKit();

/** A model snapshot as a release before the rename wrote it. */
function oldModelSnapshot(
  instance: string,
  savedAt: string,
  manifest: { tool: string; toolVersion: string },
): string {
  const doc = emptySampleModel() as unknown as Record<string, Json>;
  const state = stateFromDocument('model', doc, {
    t: `${savedAt}/000000`,
    by: instance,
  });
  return formatSnapshot(state, { instance, savedAt, seen: {} })
    .replace(`"formatVersion": ${SNAPSHOT_FORMAT}`, '"formatVersion": 2')
    .replace(
      '"manifest/kit": [0,"tool_sample"]',
      `"manifest/tool": [0,${JSON.stringify(manifest.tool)}]`,
    )
    .replace(
      '"manifest/kitVersion": [0,"1.0.0"]',
      `"manifest/toolVersion": [0,${JSON.stringify(manifest.toolVersion)}]`,
    );
}

function changeFile(
  by: string,
  ops: { t: string; p: string[]; v: Json }[],
): string {
  return formatChangeFile({ format: 1, by, seen: {} }, ops);
}

describe('names from before the Kit rename', () => {
  it('reads the old model registers under their new names', () => {
    const text = oldModelSnapshot('old00001', '2026-02-01T10:00:00.000Z', {
      tool: 'tool_sample',
      toolVersion: '1.0.0',
    });
    expect(text).toContain('"manifest/toolVersion"');
    const parsed = parseSnapshot(text, 'model');
    expect(parsed.from).toBe(2);
    const doc = materialize(parsed.state) as unknown as Model;
    expect(doc.manifest).toMatchObject({
      kit: 'tool_sample',
      kitVersion: '1.0.0',
    });
    expect('tool' in doc.manifest).toBe(false);
    expect('toolVersion' in doc.manifest).toBe(false);
    // The hash is taken again over the new names, so it matches a state built with them.
    const fresh = stateFromDocument(
      'model',
      emptySampleModel() as unknown as Record<string, Json>,
      { t: '2026-02-01T10:00:00.000Z/000000', by: 'old00001' },
    );
    expect(parsed.state.hash).toBe(fresh.hash);
    expect(parsed.state.canonical()).toBe(fresh.canonical());
  });

  it('merges an old snapshot with new change files into one field: the later write wins', async () => {
    const folder = new MemoryFolder();
    planted(
      folder,
      snapshotPath(FOLDER, 'old00001'),
      oldModelSnapshot('old00001', '2026-02-01T10:00:00.000Z', {
        tool: 'tool_sample',
        toolVersion: '1.0.0',
      }),
    );
    // A teammate still on the old release changed the version later on...
    planted(
      folder,
      changeFilePath(FOLDER, 'old00002', 1),
      changeFile('old00002', [
        {
          t: '2026-02-15T10:00:00.000Z/000000',
          p: ['manifest', 'toolVersion'],
          v: '1.5.0',
        },
      ]),
    );
    // ...and someone on this release after that.
    planted(
      folder,
      changeFilePath(FOLDER, 'new00001', 1),
      changeFile('new00001', [
        {
          t: '2026-03-01T10:00:00.000Z/000000',
          p: ['manifest', 'kitVersion'],
          v: '2.0.0',
        },
      ]),
    );
    const { state } = await loadDocument(
      folder.instance('reader01'),
      FOLDER,
      'model',
    );
    const doc = materialize(state) as unknown as Model;
    expect(doc.manifest.kitVersion).toBe('2.0.0');
    expect(doc.manifest.kit).toBe('tool_sample');
    expect(Object.keys(doc.manifest).sort()).toEqual([
      'id',
      'kit',
      'kitVersion',
      'modelType',
      'name',
    ]);

    // An old write that is later than the new one wins just the same.
    planted(
      folder,
      changeFilePath(FOLDER, 'old00002', 2),
      changeFile('old00002', [
        {
          t: '2026-04-01T10:00:00.000Z/000000',
          p: ['manifest', 'toolVersion'],
          v: '1.6.0',
        },
      ]),
    );
    const again = await loadDocument(
      folder.instance('reader01'),
      FOLDER,
      'model',
    );
    expect(
      (materialize(again.state) as unknown as Model).manifest,
    ).toMatchObject({ kitVersion: '1.6.0' });
    const rehashed = again.state.clone();
    rehashed.rehash();
    expect(again.state.hash).toBe(rehashed.hash);
  });

  it('opens a mixed folder for editing and writes only the new names', async () => {
    const folder = new MemoryFolder();
    planted(
      folder,
      snapshotPath(FOLDER, 'old00001'),
      oldModelSnapshot('old00001', '2026-02-01T10:00:00.000Z', {
        tool: 'tool_sample',
        toolVersion: '1.0.0',
      }),
    );
    const { session, store } = await SyncSession.open(
      {
        adapter: folder.instance('new00001'),
        folder: FOLDER,
        kind: 'model',
        now: () => Date.parse('2026-03-01T10:00:00Z'),
        retries: 0,
      },
      (doc): ModelStore => createModelStore(doc as unknown as Model, { kit }),
    );
    expect(store.state.manifest.kit).toBe(SAMPLE.kit);
    store.execute({ type: 'updateManifest', kitVersion: '1.1.0' });
    await session.flush();
    const change = folder.text(changeFilePath(FOLDER, 'new00001', 1));
    expect(change).toContain('["manifest","kitVersion"]');
    expect(change).not.toContain('toolVersion');
    await session.close();
    const snapshot = folder.text(snapshotPath(FOLDER, 'new00001'));
    const parsed = JSON.parse(snapshot) as {
      formatVersion: number;
      kind: string;
      plain: Record<string, unknown>;
    };
    expect(parsed.formatVersion).toBe(SNAPSHOT_FORMAT);
    expect(parsed.kind).toBe('model');
    expect(Object.keys(parsed.plain)).toContain('manifest/kitVersion');
    expect(Object.keys(parsed.plain)).not.toContain('manifest/toolVersion');
    expect(Object.keys(parsed.plain)).not.toContain('manifest/tool');
  });

  it('reads a Kit snapshot that says kind "tool", and migrates it to format 3', () => {
    const state = stateFromDocument(
      'kit',
      kit as unknown as Record<string, Json>,
      { t: '2026-02-01T10:00:00.000Z/000000', by: 'old00001' },
    );
    const old = formatSnapshot(state, {
      instance: 'old00001',
      savedAt: '2026-02-01T10:00:00.000Z',
      seen: { old00001: 2 },
    })
      .replace(`"formatVersion": ${SNAPSHOT_FORMAT}`, '"formatVersion": 2')
      .replace('"kind": "kit"', '"kind": "tool"');
    expect(parseSnapshotHeader(old, 'kit')?.kind).toBe('kit');
    const parsed = parseSnapshot(old, 'kit');
    expect(parsed.state.kind).toBe('kit');
    expect(materialize(parsed.state)).toEqual(materialize(state));
    const migrated = snapshotV2ToV3(JSON.parse(old) as Record<string, unknown>);
    expect(migrated).toMatchObject({
      formatVersion: 3,
      kind: 'kit',
      instance: 'old00001',
      seen: { old00001: 2 },
    });
    expect(() => parseSnapshot(old, 'model')).toThrow(/holds a tool/);
  });

  it('gives old paths in change files their new name', () => {
    expect(currentPath('model', ['manifest', 'tool'])).toEqual([
      'manifest',
      'kit',
    ]);
    expect(currentPath('model', ['manifest', 'name'])).toEqual([
      'manifest',
      'name',
    ]);
    expect(currentPath('kit', ['manifest', 'tool'])).toEqual([
      'manifest',
      'tool',
    ]);
    expect(currentPath('model', ['constructor', 'name'])).toEqual([
      'constructor',
      'name',
    ]);
    const text = changeFile('old00002', [
      {
        t: '2026-02-15T10:00:00.000Z/000000',
        p: ['manifest', 'tool'],
        v: 'tool_sample',
      },
    ]);
    expect(parseChangeFile(text, 'old00002', 'model').ops[0]!.p).toEqual([
      'manifest',
      'kit',
    ]);
    expect(parseChangeFile(text, 'old00002').ops[0]!.p).toEqual([
      'manifest',
      'tool',
    ]);
  });

  it('reads presence of an older release that names a Kit "tool"', () => {
    const base = {
      formatVersion: 1,
      instance: 'old00001',
      name: 'Old',
      colour: '#1971c2',
      at: '2026-03-01T10:00:00.000Z',
      selection: [],
      editing: null,
      hash: '',
      seen: {},
    };
    const old = parsePresence(
      formatPresence({
        ...base,
        document: { kind: 'tool' as never, slug: 'bpmn-lite' },
      }),
    );
    expect(old.document).toEqual({ kind: 'kit', slug: 'bpmn-lite' });
    const now = parsePresence(
      formatPresence({ ...base, document: { kind: 'kit', slug: 'x' } }),
    );
    expect(now.document).toEqual({ kind: 'kit', slug: 'x' });
  });
});
