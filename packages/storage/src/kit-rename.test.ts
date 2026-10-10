import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createKitStore,
  validateModelDocument,
  type Kit,
  type Model,
} from '@metakit-app/core';
import { materialize, parseSnapshot } from '@metakit-app/sync';
import { fromBytes, toBytes } from './adapter';
import { importBundle } from './bundle';
import { sampleKitFromDisk } from './exchange-fixtures';
import { fromLayout, toLayout } from './git/layout';
import { MemoryRemote } from './git/memory-remote';
import {
  commitPending,
  linkFromSnapshot,
  pendingChanges,
  pull,
} from './git/sync';
import { applyKitUpdate, prepareKitImport } from './kit-package';
import { MemoryAdapter } from './memory';
import { migrate } from './migrate';
import { importMkModel, importModelFile } from './mkmodel';
import { Workspace } from './workspace';
import { zipFiles } from './zip';

// Files written by releases before the Kit rename (ADR 0011), kept byte for byte in
// packages/storage/fixtures/before-kit-rename. Each is read, migrated and compared with what
// this release expects; nothing in them is ever rewritten.

const FIXTURES = fileURLToPath(
  new URL('../fixtures/before-kit-rename/', import.meta.url),
);

/** Every file below a fixture folder, by its path relative to it. */
function fixture(folder: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, rel);
      else out[rel] = readFileSync(full, 'utf8');
    }
  };
  walk(join(FIXTURES, folder), '');
  return out;
}

const json = (folder: string, path: string): Record<string, unknown> =>
  JSON.parse(fixture(folder)[path]!) as Record<string, unknown>;

const NOW = () => new Date('2026-10-07T09:00:00.000Z');

async function oldWorkspace(instance = 'new00001') {
  const adapter = new MemoryAdapter(instance);
  for (const [path, text] of Object.entries(fixture('workspace')))
    adapter.plant(path, text);
  const ws = await Workspace.open(adapter, {
    now: NOW,
    read: { retries: 1, delayMs: 1 },
  });
  return { adapter, ws };
}

describe('every older format is read and brought up to date', () => {
  it('the identity file of a Kit folder: tool.json with kind "tool" (format 1)', () => {
    const before = json('workspace', 'tools/bpmn-lite/tool.json');
    expect(before).toMatchObject({ formatVersion: 1, kind: 'tool' });
    expect(migrate('kit', before)).toEqual({
      from: 1,
      to: 2,
      value: {
        created: '2026-06-01T09:00:00.000Z',
        formatVersion: 2,
        id: 'tool_bpmnlite',
        kind: 'kit',
        name: 'BPMN lite',
      },
    });
  });

  it('the identity file of a model folder: "tool" (format 1)', () => {
    const before = json('workspace', 'models/order-process-old1/model.json');
    expect(migrate('model', before).value).toEqual({
      created: '2026-06-01T09:00:00.000Z',
      formatVersion: 2,
      id: 'mdl_beforerename',
      kind: 'model',
      kit: 'tool_bpmnlite',
      modelType: 'mt_process',
      name: 'Order process',
    });
  });

  it('a Kit snapshot with kind "tool" (format 2)', () => {
    const before = json(
      'workspace',
      'tools/bpmn-lite/_state/old00001/snapshot.json',
    );
    expect(before).toMatchObject({ formatVersion: 2, kind: 'tool' });
    const { value, from, to } = migrate('snapshot', before);
    expect([from, to]).toEqual([2, 3]);
    expect(value).toMatchObject({
      formatVersion: 3,
      kind: 'kit',
      instance: 'old00001',
      hash: before['hash'],
    });
    const kit = materialize(
      parseSnapshot(`${JSON.stringify(value)}\n`, 'kit').state,
    );
    expect(migrate('kit-document', kit).value).toEqual(
      migrate('kit-document', sampleKitFromDisk('bpmn-lite')).value,
    );
  });

  it('a model snapshot with the registers manifest/tool and manifest/toolVersion (format 2)', () => {
    const before = json(
      'workspace',
      'models/order-process-old1/_state/old00001/snapshot.json',
    );
    expect(Object.keys(before['plain'] as object)).toContain('manifest/tool');
    const { value } = migrate('snapshot', before);
    const plain = Object.keys(value['plain'] as object);
    expect(plain).toEqual(
      expect.arrayContaining(['manifest/kit', 'manifest/kitVersion']),
    );
    expect(plain).not.toContain('manifest/tool');
    expect(plain).not.toContain('manifest/toolVersion');
    // The hash is taken over the new names.
    expect(value['hash']).not.toBe(before['hash']);
    const model = materialize(
      parseSnapshot(`${JSON.stringify(value)}\n`, 'model').state,
    );
    expect((model as unknown as Model).manifest).toMatchObject({
      kit: 'tool_bpmnlite',
      kitVersion: '1.0.0',
    });
  });

  it('a model document with manifest.tool and manifest.toolVersion (format 1)', () => {
    const before = {
      formatVersion: 1,
      manifest: {
        id: 'mdl_old',
        name: 'Old',
        tool: 'tool_bpmnlite',
        toolVersion: '1.0.0',
        modelType: 'mt_process',
      },
      attrs: {},
      elements: {},
      connectors: {},
    };
    const { value } = migrate('model-document', before);
    expect(value).toEqual({
      ...before,
      formatVersion: 2,
      manifest: {
        id: 'mdl_old',
        name: 'Old',
        kit: 'tool_bpmnlite',
        kitVersion: '1.0.0',
        modelType: 'mt_process',
      },
    });
    expect(validateModelDocument(value)).toEqual([]);
    expect(validateModelDocument(before).map((i) => i.path)).toContain(
      'manifest.kit',
    );
  });

  it('a .mkmodel.json with "tool" (format 1)', () => {
    const before = json('bundle-v1', 'models/library.mkmodel.json');
    const { value } = migrate('mkmodel', before);
    const { tool, ...rest } = before;
    expect(value).toEqual({ ...rest, formatVersion: 2, kit: tool });
    const model = importMkModel(
      sampleKitFromDisk('er-lite'),
      fixture('bundle-v1')['models/library.mkmodel.json'],
    );
    expect(model.manifest).toMatchObject({
      kit: 'tool_erlite',
      kitVersion: '1.0.0',
    });
  });

  it('a Kit document of format 6, whose tool_ id stays', () => {
    const before = json('package-v1', 'tool.json');
    const { value, from, to } = migrate('kit-document', before);
    expect([from, to]).toEqual([6, 7]);
    expect(value).toEqual({ ...before, formatVersion: 7 });
    expect((value as unknown as Kit).manifest.id).toBe('tool_erlite');
  });

  it('bundle.json with "tool" and "includesTool" (format 1)', () => {
    const before = json('bundle-v1', 'bundle.json');
    const { tool, includesTool, ...rest } = before;
    expect(migrate('bundle', before).value).toEqual({
      ...rest,
      formatVersion: 2,
      kit: tool,
      includesKit: includesTool,
    });
  });

  it('package.json of a .mktool (format 1)', () => {
    const before = json('package-v1', 'package.json');
    const { tool, ...rest } = before;
    expect(migrate('kit-package', before).value).toEqual({
      ...rest,
      formatVersion: 2,
      kind: 'mkkit',
      kit: tool,
    });
  });
});

describe('a workspace from before the Kit rename', () => {
  it('lists its Kit and model and opens the model with its Kit', async () => {
    const { ws } = await oldWorkspace();
    expect(await ws.listKits()).toEqual([
      {
        slug: 'bpmn-lite',
        id: 'tool_bpmnlite',
        name: 'BPMN lite',
        version: '1.0.0',
      },
    ]);
    expect(await ws.kitFolder('bpmn-lite')).toBe('tools/bpmn-lite');
    const [entry] = await ws.listModels();
    expect(entry).toMatchObject({
      slug: 'order-process-old1',
      kit: 'tool_bpmnlite',
    });
    const loaded = await ws.loadModel('order-process-old1');
    expect(loaded.issues).toEqual([]);
    expect(loaded.document.formatVersion).toBe(2);
    expect(loaded.document.manifest).toMatchObject({
      kit: 'tool_bpmnlite',
      kitVersion: '1.0.0',
    });
    expect('tool' in loaded.document.manifest).toBe(false);
    expect(Object.keys(loaded.document.elements).length).toBeGreaterThan(0);
    const kit = (await ws.loadKit('bpmn-lite')).document;
    expect(kit.manifest.id).toBe('tool_bpmnlite');
    expect(kit.formatVersion).toBe(7);
  });

  it('edits the old Kit and model in place and never touches the files of the old instance', async () => {
    const { adapter, ws } = await oldWorkspace();
    const old = Object.entries(fixture('workspace'));
    const kit = (await ws.loadKit('bpmn-lite')).document;

    const model = await ws.openModel('order-process-old1', kit, {
      flushMs: 1,
    });
    const first = Object.values(model.store.state.elements)[0]!;
    expect(
      model.store.execute({
        type: 'move',
        id: first.id,
        x: first.x + 10,
        y: first.y,
      }).ok,
    ).toBe(true);
    model.store.execute({ type: 'updateManifest', kitVersion: '1.1.0' });
    await model.session.close();

    const opened = await ws.openKit('bpmn-lite', { flushMs: 1 });
    opened.store.execute({ type: 'updateManifest', name: 'BPMN lite, edited' });
    await opened.session.close();
    await ws.addKitAsset('bpmn-lite', 'icon.svg', toBytes('<svg/>'));
    await ws.trashKit('bpmn-lite');
    await ws.restoreKit('bpmn-lite');

    // Nothing written by the old instance changed, and nothing moved to kits/.
    for (const [path, text] of old)
      expect(fromBytes(await adapter.read(path))).toBe(text);
    const written = adapter.paths().filter((p) => !old.some(([o]) => o === p));
    expect(
      written.every(
        (p) => p.includes('/_state/new00001/') || p.includes('/assets/'),
      ),
    ).toBe(true);
    expect(
      written.some((p) => p.startsWith('tools/bpmn-lite/_state/new00001/')),
    ).toBe(true);
    expect(written.some((p) => p.startsWith('tools/bpmn-lite/assets/'))).toBe(
      true,
    );
    expect(adapter.paths().some((p) => p.startsWith('kits/'))).toBe(false);

    const again = await Workspace.open(adapter, { now: NOW });
    expect((await again.loadKit('bpmn-lite')).document.manifest.name).toBe(
      'BPMN lite, edited',
    );
    const model2 = (await again.loadModel('order-process-old1')).document;
    expect(model2.manifest.kitVersion).toBe('1.1.0');
    expect(model2.elements[first.id]!.x).toBe(first.x + 10);
    // The new snapshot says manifest/kitVersion; the old one still says toolVersion.
    const mine = fromBytes(
      await adapter.read(
        'models/order-process-old1/_state/new00001/snapshot.json',
      ),
    );
    expect(mine).toContain('"manifest/kitVersion"');
    expect(mine).not.toContain('"manifest/toolVersion"');
  });

  it('makes a new Kit in kits/ with a kit_ id, and keeps slugs unique over both folders', async () => {
    const { adapter, ws } = await oldWorkspace();
    const kit = sampleKitFromDisk('bpmn-lite');
    const copy = {
      ...kit,
      manifest: { ...kit.manifest, id: 'kit_copy000001' },
    } as Kit;
    const slug = await ws.createKit(copy);
    expect(slug).toBe('bpmn-lite-2');
    expect(await ws.kitFolder(slug)).toBe('kits/bpmn-lite-2');
    expect(
      JSON.parse(fromBytes(await adapter.read('kits/bpmn-lite-2/kit.json'))),
    ).toMatchObject({
      formatVersion: 2,
      kind: 'kit',
      id: 'kit_copy000001',
    });
    const snapshot = JSON.parse(
      fromBytes(
        await adapter.read('kits/bpmn-lite-2/_state/new00001/snapshot.json'),
      ),
    ) as { formatVersion: number; kind: string };
    expect(snapshot).toMatchObject({ formatVersion: 3, kind: 'kit' });
    await expect(ws.createKit(copy, { slug: 'bpmn-lite' })).rejects.toThrow(
      /already a Kit "bpmn-lite"/,
    );
    expect((await ws.listKits()).map((k) => [k.slug, k.id])).toEqual([
      ['bpmn-lite-2', 'kit_copy000001'],
      ['bpmn-lite', 'tool_bpmnlite'],
    ]);
  });

  it('gives a Kit in tools/ that has the name of one in kits/ its own slug', async () => {
    const { adapter } = await oldWorkspace();
    // A Kit in kits/ with the same folder name, as when an older release made tools/bpmn-lite
    // without looking in kits/.
    for (const [path, text] of Object.entries(fixture('workspace')))
      if (path.startsWith('tools/bpmn-lite/'))
        adapter.plant(
          path.replace('tools/', 'kits/').replace('tool.json', 'kit.json'),
          text,
        );
    const ws = await Workspace.open(adapter, { now: NOW });
    expect(await ws.kitFolder('bpmn-lite')).toBe('kits/bpmn-lite');
    expect(await ws.kitFolder('bpmn-lite-tools')).toBe('tools/bpmn-lite');
    expect((await ws.listKits()).map((k) => k.slug)).toEqual([
      'bpmn-lite',
      'bpmn-lite-tools',
    ]);
  });

  it('exports the old model as a .mkmodel.json of the current format', async () => {
    const { ws } = await oldWorkspace();
    const file = JSON.parse(await ws.exportModel('order-process-old1')) as {
      formatVersion: number;
      kit: { id: string };
      tool?: unknown;
    };
    expect(file.formatVersion).toBe(2);
    expect(file.kit.id).toBe('tool_bpmnlite');
    expect(file.tool).toBeUndefined();
  });
});

describe('exchange files from before the Kit rename', () => {
  const zipOf = (folder: string) =>
    zipFiles(
      Object.fromEntries(
        Object.entries(fixture(folder)).map(([p, t]) => [p, t] as const),
      ),
    );

  it('imports a .mktool package', async () => {
    const ws = await Workspace.create(new MemoryAdapter('new00001'), {
      name: 'W',
    });
    const prepared = await prepareKitImport(ws, zipOf('package-v1'));
    expect(prepared.incoming.manifest.id).toBe('tool_erlite');
    const { slug, created } = await applyKitUpdate(ws, prepared);
    expect(created).toBe(true);
    expect(await ws.kitFolder(slug)).toBe('kits/er-lite');
  });

  it('imports a bundle of format 1 with its Kit and model', async () => {
    const ws = await Workspace.create(new MemoryAdapter('new00001'), {
      name: 'W',
    });
    const report = await importBundle(ws, zipOf('bundle-v1'));
    expect(report.kitAdded).toBe(true);
    expect(report.kit.id).toBe('tool_erlite');
    expect(report.added).toHaveLength(1);
    expect(report.added[0]!.report.fileKit).toMatchObject({
      id: 'tool_erlite',
      version: '1.0.0',
    });
    expect(report.skipped).toEqual([]);
    const model = (await ws.loadModel(report.added[0]!.slug)).document;
    expect(model.manifest.kit).toBe('tool_erlite');
  });

  it('imports a .mkmodel.json of format 1 and finds its Kit by the old field', async () => {
    const ws = await Workspace.create(new MemoryAdapter('new00001'), {
      name: 'W',
    });
    await ws.createKit(sampleKitFromDisk('er-lite'));
    const result = await importModelFile(
      ws,
      fixture('bundle-v1')['models/library.mkmodel.json']!,
    );
    expect(result.model.manifest.kit).toBe('tool_erlite');
    expect(result.report.fileKit.id).toBe('tool_erlite');
  });
});

describe('a Git repository from before the Kit rename', () => {
  const where = {
    kitSlug: 'er-lite',
    service: 'github' as const,
    host: 'github.com',
    repo: 'me/kits',
    folder: '',
    branch: 'main',
  };
  /** The layout as an older release wrote it: tool.json instead of kit.json. */
  const olderLayout = (kit: Kit) =>
    toLayout(kit).map((f) =>
      f.path === 'kit.json' ? { ...f, path: 'tool.json' } : f,
    );

  it('pulls from a repository with tool.json, then commits kit.json in place of it', async () => {
    const kit = sampleKitFromDisk('er-lite');
    const remote = new MemoryRemote(olderLayout(kit));
    const snapshot = await remote.read('main');
    const opened = fromLayout(snapshot.files);
    expect(opened.issues).toEqual([]);
    let link = linkFromSnapshot(where, snapshot);

    // Someone on an older release changes the Kit settings in tool.json.
    const head = await remote.head('main');
    const theirs = toLayout({
      ...kit,
      manifest: { ...kit.manifest, version: '1.1.0' },
    }).find((f) => f.path === 'kit.json')!;
    await remote.commit({
      branch: 'main',
      parent: head,
      message: 'Older release',
      changes: [{ path: 'tool.json', content: theirs.content }],
    });
    const store = createKitStore(opened.kit!);
    store.execute({ type: 'updateManifest', name: 'ER lite, edited' });
    const pulled = await pull({ remote, link, kit: store.state });
    if (pulled.status !== 'merged') throw new Error('expected a merge');
    expect(pulled.conflicts).toEqual([]);
    expect(pulled.kit.manifest).toMatchObject({
      name: 'ER lite, edited',
      version: '1.1.0',
    });
    link = pulled.link;

    const pending = pendingChanges(link, pulled.kit);
    expect(pending.find((c) => c.part === 'Kit settings')?.text).toMatch(
      /^Kit settings changed \(renamed from tool\.json/,
    );
    const done = await commitPending({
      remote,
      link,
      kit: pulled.kit,
      message: 'Rename the Kit',
    });
    const after = (await remote.read('main')).files.map((f) => f.path);
    expect(after).toContain('kit.json');
    expect(after).not.toContain('tool.json');
    expect(pendingChanges(done.link, pulled.kit)).toEqual([]);
    expect(fromLayout((await remote.read('main')).files).kit).toEqual(
      pulled.kit,
    );
  });
});
