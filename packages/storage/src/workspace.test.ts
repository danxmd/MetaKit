import { createModelStore, type Model } from '@metakit-app/core';
import {
  SAMPLE,
  clone,
  emptySampleModel,
  sampleKit,
} from '@metakit-app/core/testing';
import { describe, expect, it } from 'vitest';
import { fromBytes, toBytes } from './adapter';
import {
  AlreadyExistsError,
  NewerFormatError,
  NotFoundError,
  NotOwnedError,
} from './errors';
import { MemoryAdapter } from './memory';
import { slugify, Workspace } from './workspace';

const kit = sampleKit();
const fixedNow = () => new Date('2026-10-07T09:00:00.000Z');
const text = async (a: MemoryAdapter, path: string) =>
  fromBytes(await a.read(path));

function aModel(): Model {
  const store = createModelStore(emptySampleModel(), { kit });
  store.execute({
    type: 'batch',
    commands: [
      {
        type: 'createElement',
        class: SAMPLE.start,
        x: 0,
        y: 0,
        id: 'el_start',
        attrs: { [SAMPLE.attName]: 'Start' },
      },
      {
        type: 'createElement',
        class: SAMPLE.task,
        x: 150,
        y: 0,
        id: 'el_task',
        attrs: { [SAMPLE.attName]: 'Review' },
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_start',
        to: 'el_task',
        id: 'cn_a',
      },
    ],
  });
  return store.state as Model;
}

async function fresh() {
  const adapter = new MemoryAdapter('aaaa0001');
  const ws = await Workspace.create(
    adapter,
    { name: 'Research group' },
    { now: fixedNow, read: { retries: 1, delayMs: 1 } },
  );
  return { adapter, ws };
}

describe('creating and opening', () => {
  it('writes workspace.json and opens it again', async () => {
    const { adapter } = await fresh();
    expect(await text(adapter, 'workspace.json')).toBe(
      '{\n  "created": "2026-10-07T09:00:00.000Z",\n  "formatVersion": 1,\n  "name": "Research group"\n}\n',
    );
    const ws = await Workspace.open(adapter.asInstance('bbbb0002'));
    expect(ws.info).toEqual({
      name: 'Research group',
      created: '2026-10-07T09:00:00.000Z',
    });
  });

  it('will not create over an existing workspace', async () => {
    const { adapter } = await fresh();
    await expect(Workspace.create(adapter, { name: 'Again' })).rejects.toThrow(
      AlreadyExistsError,
    );
    await expect(Workspace.create(adapter, { name: 'Again' })).rejects.toThrow(
      /already a MetaKit workspace/,
    );
  });

  it('explains that a folder is not a workspace', async () => {
    await expect(Workspace.open(new MemoryAdapter())).rejects.toThrow(
      NotFoundError,
    );
    await expect(Workspace.open(new MemoryAdapter())).rejects.toThrow(
      /no workspace\.json/,
    );
  });

  it('opens an older workspace file by migrating it in memory, without rewriting it', async () => {
    const adapter = new MemoryAdapter();
    adapter.plant(
      'workspace.json',
      '{\n  "formatVersion": 0,\n  "title": "Old name",\n  "created": "2025-01-01T00:00:00.000Z"\n}\n',
    );
    const ws = await Workspace.open(adapter);
    expect(ws.info.name).toBe('Old name');
    expect(await text(adapter, 'workspace.json')).toContain('"title"');
  });

  it('refuses a workspace from a newer MetaKit', async () => {
    const adapter = new MemoryAdapter();
    adapter.plant(
      'workspace.json',
      '{\n  "formatVersion": 7,\n  "name": "Future"\n}\n',
    );
    await expect(Workspace.open(adapter)).rejects.toThrow(NewerFormatError);
    expect(await text(adapter, 'workspace.json')).toContain('"Future"');
  });
});

describe('the layout', () => {
  it("matches the plan: identity files written once, content in the instance's own state folder", async () => {
    const { adapter, ws } = await fresh();
    const kitSlug = await ws.createKit(kit);
    const modelSlug = await ws.createModel(aModel(), {
      slug: 'order-to-cash-9xk2',
    });
    expect(kitSlug).toBe('sample');
    expect(adapter.paths()).toEqual([
      'models/order-to-cash-9xk2/_state/aaaa0001/snapshot.json',
      'models/order-to-cash-9xk2/model.json',
      'tools/sample/_state/aaaa0001/snapshot.json',
      'tools/sample/tool.json',
      'workspace.json',
    ]);
    expect(modelSlug).toBe('order-to-cash-9xk2');
    const identity = JSON.parse(
      await text(adapter, 'models/order-to-cash-9xk2/model.json'),
    );
    expect(identity).toEqual({
      created: '2026-10-07T09:00:00.000Z',
      formatVersion: 1,
      id: 'mdl_sample',
      kind: 'model',
      modelType: SAMPLE.process,
      name: 'Order process',
      tool: SAMPLE.kit,
    });
  });

  it('gives each model a readable folder with a random tail', async () => {
    const { ws } = await fresh();
    await ws.createKit(kit);
    const slug = await ws.createModel(aModel());
    expect(slug).toMatch(/^order-process-[a-z0-9]{4}$/);
  });

  it('numbers a Kit folder when the name is taken', async () => {
    const { ws } = await fresh();
    expect(await ws.createKit(kit)).toBe('sample');
    expect(await ws.createKit(kit)).toBe('sample-2');
  });

  it('refuses unsafe folder names', async () => {
    const { ws } = await fresh();
    await expect(ws.createKit(kit, { slug: '../evil' })).rejects.toThrow(
      /not a valid folder name/,
    );
    await expect(ws.createKit(kit, { slug: '.hidden' })).rejects.toThrow(
      /not a valid folder name/,
    );
    await expect(ws.loadModel('A B')).rejects.toThrow(
      /not a valid folder name/,
    );
  });

  it('slugifies names', () => {
    expect(slugify('Order-to-Cash (2026)!')).toBe('order-to-cash-2026');
    expect(slugify('Übersicht')).toBe('ubersicht');
    expect(slugify('日本語')).toBe('untitled');
    expect(slugify('x'.repeat(100)).length).toBe(48);
  });
});

describe('saving and reading back', () => {
  it('reads back exactly what was saved', async () => {
    const { adapter, ws } = await fresh();
    const kitSlug = await ws.createKit(kit);
    const model = aModel();
    const modelSlug = await ws.createModel(model);
    const other = await Workspace.open(adapter.asInstance('bbbb0002'));
    const loadedKit = await other.loadKit(kitSlug);
    const loadedModel = await other.loadModel(modelSlug);
    expect(loadedKit.document).toEqual(kit);
    expect(loadedModel.document).toEqual(model);
    expect(loadedKit.warnings).toEqual([]);
    expect(loadedKit.issues).toEqual([]);
    expect(loadedModel.issues).toEqual([]);
  });

  it('writes the same bytes when the same document is saved again', async () => {
    const { adapter, ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'm' });
    const path = 'models/m/_state/aaaa0001/snapshot.json';
    const first = await text(adapter, path);
    const loaded = await ws.loadModel('m');
    await ws.saveModel('m', loaded.document);
    expect(await text(adapter, path)).toBe(first);
  });

  it('writes the first snapshot in format 2, one entity per line, ending with a newline', async () => {
    const { adapter, ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'm' });
    const raw = await text(adapter, 'models/m/_state/aaaa0001/snapshot.json');
    expect(raw.endsWith('}\n')).toBe(true);
    const parsed = JSON.parse(raw);
    expect(parsed.formatVersion).toBe(2);
    expect(parsed.kind).toBe('model');
    expect(
      raw.split('\n').filter((l) => l.startsWith('    "elements/el_')),
    ).toHaveLength(2);
  });

  it('keeps the folder when a model is renamed', async () => {
    const { adapter, ws } = await fresh();
    await ws.createKit(kit);
    const slug = await ws.createModel(aModel());
    const store = createModelStore((await ws.loadModel(slug)).document, {
      kit,
    });
    store.execute({
      type: 'updateManifest',
      name: 'Order to cash',
      folder: 'Sales/2026',
    });
    await ws.saveModel(slug, store.state as Model);
    expect(
      (await ws.listModels()).map((m) => [m.slug, m.name, m.folder]),
    ).toEqual([[slug, 'Order to cash', 'Sales/2026']]);
    expect(adapter.paths().filter((p) => p.startsWith('models/'))).toHaveLength(
      2,
    );
    expect(
      JSON.parse(await text(adapter, `models/${slug}/model.json`)).name,
    ).toBe('Order process');
  });

  it('lists Kits and models', async () => {
    const { ws } = await fresh();
    await ws.createKit(kit);
    await ws.createModel(aModel(), { slug: 'one' });
    expect(await ws.listKits()).toEqual([
      { slug: 'sample', id: SAMPLE.kit, name: 'Sample', version: '1.0.0' },
    ]);
    expect(await ws.listModels()).toEqual([
      {
        slug: 'one',
        id: 'mdl_sample',
        name: 'Order process',
        kit: SAMPLE.kit,
        modelType: SAMPLE.process,
      },
    ]);
    expect(await ws.findKitSlug(SAMPLE.kit)).toBe('sample');
    expect(await ws.findKitSlug('tool_nope')).toBeNull();
  });

  it('reports problems in a definition but still returns it', async () => {
    const { ws } = await fresh();
    const broken = clone(kit);
    broken.classes[SAMPLE.task]!.extends = 'cls_missing';
    const slug = await ws.createKit(broken);
    const loaded = await ws.loadKit(slug);
    expect(loaded.document).toEqual(broken);
    expect(loaded.issues.map((i) => i.path)).toEqual([
      `classes.${SAMPLE.task}.extends`,
    ]);
  });

  it('will not save to a document that was never created', async () => {
    const { ws } = await fresh();
    await expect(ws.saveModel('ghost', aModel())).rejects.toThrow(
      /Use createModel first/,
    );
    await expect(ws.saveKit('ghost', kit)).rejects.toThrow(
      /Use createKit first/,
    );
    await expect(ws.loadModel('ghost')).rejects.toThrow(/no model "ghost"/);
  });

  it('will not create the same folder twice', async () => {
    const { ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'same' });
    await expect(ws.createModel(aModel(), { slug: 'same' })).rejects.toThrow(
      AlreadyExistsError,
    );
  });
});

describe('several instances', () => {
  it('each instance writes only its own files, and a reader merges them without a warning', async () => {
    let clock = Date.parse('2026-10-07T09:00:00.000Z');
    const now = () => new Date((clock += 60_000));
    const a = new MemoryAdapter('aaaa0001');
    const b = a.asInstance('bbbb0002');
    const wsA = await Workspace.create(a, { name: 'W' }, { now });
    const slug = await wsA.createModel(aModel(), { slug: 'm' });
    const wsB = await Workspace.open(b, { now });
    const edited = createModelStore((await wsB.loadModel(slug)).document, {
      kit,
    });
    edited.execute({ type: 'updateManifest', name: 'Edited by B' });
    await wsB.saveModel(slug, edited.state as Model);
    const own = a.paths().filter((p) => p.includes('/_state/bbbb0002/'));
    expect(own.length).toBeGreaterThan(0);
    expect(
      a.paths().filter((p) => p.endsWith('/aaaa0001/snapshot.json')),
    ).toHaveLength(1);
    const loaded = await wsA.loadModel(slug);
    expect(loaded.document.manifest.name).toBe('Edited by B');
    expect(loaded.warnings).toEqual([]);
    // The first instance's snapshot is untouched.
    expect(
      (await text(a, 'models/m/_state/aaaa0001/snapshot.json')).includes(
        'Edited by B',
      ),
    ).toBe(false);
  });

  it("cannot be made to write into another instance's area", async () => {
    const a = new MemoryAdapter('aaaa0001');
    await expect(
      a.overwrite('models/m/_state/bbbb0002/snapshot.json', toBytes('x\n')),
    ).rejects.toThrow(NotOwnedError);
  });

  it('skips a snapshot that cannot be read and says so', async () => {
    const { adapter, ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'm' });
    adapter.plant('models/m/_state/cccc0003/snapshot.json', '{ broken json\n');
    const loaded = await ws.loadModel('m');
    expect(loaded.document.manifest.id).toBe('mdl_sample');
    expect(loaded.warnings[0]).toMatch(
      /snapshot of instance cccc0003 could not be read/,
    );
  });

  it('refuses a snapshot that holds the wrong kind of document', async () => {
    const { adapter, ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'm' });
    adapter.plant(
      'models/m/_state/cccc0003/snapshot.json',
      '{\n  "document": {},\n  "formatVersion": 1,\n  "instance": "cccc0003",\n  "kind": "tool",\n  "savedAt": "2099-01-01T00:00:00.000Z"\n}\n',
    );
    const loaded = await ws.loadModel('m');
    expect(loaded.document.manifest.id).toBe('mdl_sample');
    expect(loaded.warnings[0]).toMatch(/holds a tool, not a model/);
  });

  it('stops with a clear message when a snapshot is from a newer MetaKit, and does not change it', async () => {
    const { adapter, ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'm' });
    const newer =
      '{\n  "document": {},\n  "formatVersion": 5,\n  "instance": "cccc0003",\n  "kind": "model",\n  "savedAt": "2099-01-01T00:00:00.000Z"\n}\n';
    adapter.plant('models/m/_state/cccc0003/snapshot.json', newer);
    await expect(ws.loadModel('m')).rejects.toThrow(NewerFormatError);
    expect(await text(adapter, 'models/m/_state/cccc0003/snapshot.json')).toBe(
      newer,
    );
  });

  it('retries a snapshot that is still arriving', async () => {
    const { adapter, ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'm' });
    const full = await text(adapter, 'models/m/_state/aaaa0001/snapshot.json');
    adapter.plant('models/m/_state/aaaa0001/snapshot.json', full.slice(0, 40));
    const slow = await Workspace.open(adapter.asInstance('bbbb0002'), {
      read: { retries: 20, delayMs: 5 },
    });
    setTimeout(
      () => adapter.plant('models/m/_state/aaaa0001/snapshot.json', full),
      30,
    );
    expect((await slow.loadModel('m')).document.manifest.id).toBe('mdl_sample');
  });
});

describe('assets', () => {
  it('names a file by its content and stores it once', async () => {
    const { adapter, ws } = await fresh();
    const slug = await ws.createKit(kit);
    const bytes = toBytes('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const first = await ws.addKitAsset(slug, 'Gear Icon.SVG', bytes);
    const again = await ws.addKitAsset(slug, 'Gear Icon.SVG', bytes);
    expect(first).toMatch(/^gear-icon\.[0-9a-f]{8}\.svg$/);
    expect(again).toBe(first);
    expect(adapter.paths().filter((p) => p.includes('/assets/'))).toEqual([
      `tools/sample/assets/${first}`,
    ]);
    expect(await ws.readKitAsset(slug, first)).toEqual(bytes);
  });

  it('gives different content a different name', async () => {
    const { ws } = await fresh();
    const slug = await ws.createKit(kit);
    const a = await ws.addKitAsset(slug, 'icon.png', new Uint8Array([1, 2, 3]));
    const b = await ws.addKitAsset(slug, 'icon.png', new Uint8Array([1, 2, 4]));
    expect(a).not.toBe(b);
    expect(a.split('.')[0]).toBe(b.split('.')[0]);
  });

  it('refuses names that are not usable and assets that are missing', async () => {
    const { ws } = await fresh();
    const slug = await ws.createKit(kit);
    await expect(
      ws.addKitAsset(slug, '.svg', new Uint8Array([1])),
    ).rejects.toThrow(/no usable name/);
    await expect(ws.readKitAsset(slug, 'nope.svg')).rejects.toThrow(/no asset/);
    await expect(ws.readKitAsset(slug, '../tool.json')).rejects.toThrow(
      /not an asset name/,
    );
  });
});

describe('the editable model file through the workspace', () => {
  it('exports a stored model and imports it as a new one', async () => {
    const { ws } = await fresh();
    const kitSlug = await ws.createKit(kit);
    const modelSlug = await ws.createModel(aModel(), { slug: 'one' });
    const text1 = await ws.exportModel(modelSlug);
    expect(text1).toContain('"class": "Task"');
    const copySlug = await ws.importModel(
      text1.replace('"id": "mdl_sample"', '"id": "mdl_copy"'),
      { kitSlug, slug: 'copy' },
    );
    const copy = (await ws.loadModel(copySlug)).document;
    expect(copy.manifest.id).toBe('mdl_copy');
    expect(Object.keys(copy.elements)).toEqual(
      Object.keys((await ws.loadModel('one')).document.elements),
    );
  });

  it('says when the Kit of a model is not in the workspace', async () => {
    const { ws } = await fresh();
    await ws.createKit(kit);
    const other = clone(aModel());
    (other.manifest as { tool: string }).tool = 'tool_elsewhere';
    const slug = await ws.createModel(other, { slug: 'x' });
    await expect(ws.exportModel(slug)).rejects.toThrow(
      /tool_elsewhere.*is not in this workspace/,
    );
  });
});

describe('watching', () => {
  it('reports a document saved by another instance', async () => {
    const a = new MemoryAdapter('aaaa0001', { pollIntervalMs: 20 });
    const wsA = await Workspace.create(a, { name: 'W' });
    const slug = await wsA.createModel(aModel(), { slug: 'm' });
    const b = a.asInstance('bbbb0002');
    const wsB = await Workspace.open(b);
    const seen: string[] = [];
    const stop = wsA.watch((changed) => seen.push(...changed));
    await new Promise((r) => setTimeout(r, 80));
    await wsB.saveModel(slug, aModel());
    await new Promise((r) => setTimeout(r, 150));
    stop();
    expect(seen).toContain('models/m/_state/bbbb0002/snapshot.json');
  });
});

describe('trashing models', () => {
  async function withModel() {
    const { adapter, ws } = await fresh();
    const slug = await ws.createModel(aModel());
    return { adapter, ws, slug };
  }

  it('hides a trashed model, lists it when asked, and brings it back on restore', async () => {
    const { ws, slug } = await withModel();
    expect(await ws.listModels()).toHaveLength(1);
    await ws.trashModel(slug);
    expect(await ws.listModels()).toHaveLength(0);
    const all = await ws.listModels({ includeTrashed: true });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ slug, trashed: true });
    await ws.restoreModel(slug);
    expect(await ws.listModels()).toHaveLength(1);
    expect((await ws.listModels({ includeTrashed: true }))[0]!.trashed).toBe(
      false,
    );
  });

  it('removes nothing and writes only in its own state folder', async () => {
    const { adapter, ws, slug } = await withModel();
    const before = adapter.paths();
    await ws.trashModel(slug);
    const added = adapter.paths().filter((p) => !before.includes(p));
    expect(added).toEqual([`models/${slug}/_state/aaaa0001/trash.json`]);
    for (const p of before) expect(adapter.paths()).toContain(p);
    expect(await text(adapter, added[0]!)).toContain('"trashed": true');
  });

  it('lets the newest marker of any instance decide, without touching the other instance files', async () => {
    const { adapter, ws, slug } = await withModel();
    let clock = new Date('2026-10-07T10:00:00.000Z');
    const b = await Workspace.open(adapter.asInstance('bbbb0002'), {
      now: () => clock,
    });
    await ws.trashModel(slug); // 09:00 by the fixed clock of the first instance
    expect(await b.listModels()).toHaveLength(0);
    const marker = await text(
      adapter,
      `models/${slug}/_state/aaaa0001/trash.json`,
    );
    await b.restoreModel(slug); // 10:00
    expect(await ws.listModels()).toHaveLength(1);
    expect(
      await text(adapter, `models/${slug}/_state/aaaa0001/trash.json`),
    ).toBe(marker);
    clock = new Date('2026-10-07T11:00:00.000Z');
    await b.trashModel(slug);
    expect(await ws.listModels()).toHaveLength(0);
  });

  it('ignores a marker from a newer release with a warning, and keeps the model listed', async () => {
    const { adapter, ws, slug } = await withModel();
    const other = adapter.asInstance('bbbb0002');
    other.plant(
      `models/${slug}/_state/bbbb0002/trash.json`,
      '{\n  "at": "2026-10-08T00:00:00.000Z",\n  "formatVersion": 99,\n  "trashed": true\n}\n',
    );
    expect(await ws.listModels()).toHaveLength(1);
    expect(ws.warnings.join(' ')).toMatch(/newer version/);
  });

  it('refuses to trash a model that is not there', async () => {
    const { ws } = await fresh();
    await expect(ws.trashModel('nope')).rejects.toThrow(NotFoundError);
  });
});

describe('editing together', () => {
  it('two instances see each other through the folder, and the folder keeps no old change files after closing', async () => {
    const a = new MemoryAdapter('aaaa0001');
    const b = a.asInstance('bbbb0002');
    const wsA = await Workspace.create(a, { name: 'W' }, { now: fixedNow });
    await wsA.createKit(kit);
    const slug = await wsA.createModel(aModel(), { slug: 'm' });
    const wsB = await Workspace.open(b, { now: fixedNow });
    const openA = await wsA.openModel(slug, kit, { retries: 0 });
    const openB = await wsB.openModel(slug, kit, { retries: 0 });
    const id = (
      openA.store.execute({
        type: 'createElement',
        class: SAMPLE.task,
        x: 5,
        y: 6,
        attrs: { [SAMPLE.attName]: 'Together' },
      }) as unknown as { value: never }
    ).value as string;
    await openA.session.flush();
    await openB.session.rescan();
    expect((openB.store.state as Model).elements[id as never]).toMatchObject({
      x: 5,
      y: 6,
    });
    openB.store.execute({ type: 'move', id: id as never, x: 50, y: 60 });
    await openB.session.close();
    await openA.session.rescan();
    expect((openA.store.state as Model).elements[id as never]).toMatchObject({
      x: 50,
      y: 60,
    });
    await openA.session.close();
    expect(a.paths().filter((p) => p.endsWith('.jsonl'))).toEqual([]);
    const again = await wsA.loadModel(slug);
    expect(again.document.elements[id as never]).toMatchObject({
      x: 50,
      y: 60,
    });
    expect(again.warnings).toEqual([]);
  });

  it('edits a Kit live and leaves its assets alone', async () => {
    const { ws } = await fresh();
    const slug = await ws.createKit(kit);
    const opened = await ws.openKit(slug, { retries: 0 });
    opened.store.execute({ type: 'updateManifest', name: 'Renamed tool' });
    await opened.session.close();
    expect((await ws.loadKit(slug)).document.manifest.name).toBe(
      'Renamed tool',
    );
  });

  it('refuses to open something that is not in the workspace', async () => {
    const { ws } = await fresh();
    await expect(ws.openModel('ghost', kit)).rejects.toThrow(NotFoundError);
  });
});

describe('the 30-day trash', () => {
  const day = 24 * 3600 * 1000;

  async function atTime() {
    let now = Date.parse('2026-10-07T09:00:00.000Z');
    const adapter = new MemoryAdapter('aaaa0001');
    const ws = await Workspace.create(
      adapter,
      { name: 'W' },
      { now: () => new Date(now) },
    );
    return {
      ws,
      adapter,
      later: (ms: number) => {
        now += ms;
      },
    };
  }

  it('trashes and restores a Kit like a model', async () => {
    const { ws } = await atTime();
    const slug = await ws.createKit(kit);
    await ws.trashKit(slug);
    expect(await ws.listKits()).toEqual([]);
    const all = await ws.listKits({ includeTrashed: true });
    expect(all[0]).toMatchObject({ slug, trashed: true, expired: false });
    expect(await ws.findKitSlug(SAMPLE.kit)).toBe(slug);
    await ws.restoreKit(slug);
    expect((await ws.listKits()).map((t) => t.slug)).toEqual([slug]);
  });

  it('lists a model deleted more than 30 days ago as expired, and 29 days ago as restorable', async () => {
    const { ws, later } = await atTime();
    const slug = await ws.createModel(aModel(), { slug: 'm' });
    await ws.trashModel(slug);
    later(29 * day);
    expect((await ws.listModels({ includeTrashed: true }))[0]).toMatchObject({
      trashed: true,
      expired: false,
    });
    later(2 * day);
    const [entry] = await ws.listModels({ includeTrashed: true });
    expect(entry).toMatchObject({ trashed: true, expired: true });
    expect(entry!.trashedAt).toBe('2026-10-07T09:00:00.000Z');
  });

  it('removes no file when something is trashed, expired or restored', async () => {
    const { ws, adapter, later } = await atTime();
    const slug = await ws.createKit(kit);
    const before = adapter.paths();
    await ws.trashKit(slug);
    later(40 * day);
    await ws.listKits({ includeTrashed: true });
    await ws.restoreKit(slug);
    for (const p of before) expect(adapter.paths()).toContain(p);
  });
});
