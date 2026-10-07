import { createModelStore, type Model } from '@metakit-app/core';
import {
  SAMPLE,
  clone,
  emptySampleModel,
  sampleTool,
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

const tool = sampleTool();
const fixedNow = () => new Date('2026-10-07T09:00:00.000Z');
const text = async (a: MemoryAdapter, path: string) =>
  fromBytes(await a.read(path));

function aModel(): Model {
  const store = createModelStore(emptySampleModel(), { tool });
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
    const toolSlug = await ws.createTool(tool);
    const modelSlug = await ws.createModel(aModel(), {
      slug: 'order-to-cash-9xk2',
    });
    expect(toolSlug).toBe('sample');
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
      tool: SAMPLE.tool,
    });
  });

  it('gives each model a readable folder with a random tail', async () => {
    const { ws } = await fresh();
    await ws.createTool(tool);
    const slug = await ws.createModel(aModel());
    expect(slug).toMatch(/^order-process-[a-z0-9]{4}$/);
  });

  it('numbers a tool folder when the name is taken', async () => {
    const { ws } = await fresh();
    expect(await ws.createTool(tool)).toBe('sample');
    expect(await ws.createTool(tool)).toBe('sample-2');
  });

  it('refuses unsafe folder names', async () => {
    const { ws } = await fresh();
    await expect(ws.createTool(tool, { slug: '../evil' })).rejects.toThrow(
      /not a valid folder name/,
    );
    await expect(ws.createTool(tool, { slug: '.hidden' })).rejects.toThrow(
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
    const toolSlug = await ws.createTool(tool);
    const model = aModel();
    const modelSlug = await ws.createModel(model);
    const other = await Workspace.open(adapter.asInstance('bbbb0002'));
    const loadedTool = await other.loadTool(toolSlug);
    const loadedModel = await other.loadModel(modelSlug);
    expect(loadedTool.document).toEqual(tool);
    expect(loadedModel.document).toEqual(model);
    expect(loadedTool.warnings).toEqual([]);
    expect(loadedTool.issues).toEqual([]);
    expect(loadedModel.issues).toEqual([]);
    expect(loadedModel).toMatchObject({ instance: 'aaaa0001' });
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

  it('writes keys in sorted order and ends the file with a newline', async () => {
    const { adapter, ws } = await fresh();
    await ws.createModel(aModel(), { slug: 'm' });
    const raw = await text(adapter, 'models/m/_state/aaaa0001/snapshot.json');
    expect(raw.endsWith('}\n')).toBe(true);
    const keys = (obj: object) => Object.keys(obj);
    const parsed = JSON.parse(raw);
    expect(keys(parsed)).toEqual([...keys(parsed)].sort());
    expect(raw.split('\n').slice(0, 3)).toEqual([
      '{',
      '  "document": {',
      '    "attrs": {},',
    ]);
  });

  it('keeps the folder when a model is renamed', async () => {
    const { adapter, ws } = await fresh();
    await ws.createTool(tool);
    const slug = await ws.createModel(aModel());
    const store = createModelStore((await ws.loadModel(slug)).document, {
      tool,
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

  it('lists tools and models', async () => {
    const { ws } = await fresh();
    await ws.createTool(tool);
    await ws.createModel(aModel(), { slug: 'one' });
    expect(await ws.listTools()).toEqual([
      { slug: 'sample', id: SAMPLE.tool, name: 'Sample', version: '1.0.0' },
    ]);
    expect(await ws.listModels()).toEqual([
      {
        slug: 'one',
        id: 'mdl_sample',
        name: 'Order process',
        tool: SAMPLE.tool,
        modelType: SAMPLE.process,
      },
    ]);
    expect(await ws.findToolSlug(SAMPLE.tool)).toBe('sample');
    expect(await ws.findToolSlug('tool_nope')).toBeNull();
  });

  it('reports problems in a definition but still returns it', async () => {
    const { ws } = await fresh();
    const broken = clone(tool);
    broken.classes[SAMPLE.task]!.extends = 'cls_missing';
    const slug = await ws.createTool(broken);
    const loaded = await ws.loadTool(slug);
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
    await expect(ws.saveTool('ghost', tool)).rejects.toThrow(
      /Use createTool first/,
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
  it('each write only their own snapshot, and the newest one is loaded with a warning', async () => {
    let clock = Date.parse('2026-10-07T09:00:00.000Z');
    const now = () => new Date((clock += 60_000));
    const a = new MemoryAdapter('aaaa0001');
    const b = a.asInstance('bbbb0002');
    const wsA = await Workspace.create(a, { name: 'W' }, { now });
    const slug = await wsA.createModel(aModel(), { slug: 'm' });
    const wsB = await Workspace.open(b, { now });
    const edited = createModelStore((await wsB.loadModel(slug)).document, {
      tool,
    });
    edited.execute({ type: 'updateManifest', name: 'Edited by B' });
    await wsB.saveModel(slug, edited.state as Model);
    expect(a.paths().filter((p) => p.endsWith('snapshot.json'))).toEqual([
      'models/m/_state/aaaa0001/snapshot.json',
      'models/m/_state/bbbb0002/snapshot.json',
    ]);
    const loaded = await wsA.loadModel(slug);
    expect(loaded.document.manifest.name).toBe('Edited by B');
    expect(loaded.instance).toBe('bbbb0002');
    expect(loaded.warnings).toHaveLength(1);
    expect(loaded.warnings[0]).toMatch(
      /Instance aaaa0001 also saved this model.*newest snapshot, from instance bbbb0002/,
    );
    // The older snapshot is untouched.
    expect(
      JSON.parse(await text(a, 'models/m/_state/aaaa0001/snapshot.json'))
        .document.manifest.name,
    ).toBe('Order process');
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
    expect(loaded.instance).toBe('aaaa0001');
    expect(loaded.warnings[0]).toMatch(
      /snapshot of instance cccc0003 could not be read and was skipped/,
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
    expect(loaded.instance).toBe('aaaa0001');
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
    const slug = await ws.createTool(tool);
    const bytes = toBytes('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const first = await ws.addToolAsset(slug, 'Gear Icon.SVG', bytes);
    const again = await ws.addToolAsset(slug, 'Gear Icon.SVG', bytes);
    expect(first).toMatch(/^gear-icon\.[0-9a-f]{8}\.svg$/);
    expect(again).toBe(first);
    expect(adapter.paths().filter((p) => p.includes('/assets/'))).toEqual([
      `tools/sample/assets/${first}`,
    ]);
    expect(await ws.readToolAsset(slug, first)).toEqual(bytes);
  });

  it('gives different content a different name', async () => {
    const { ws } = await fresh();
    const slug = await ws.createTool(tool);
    const a = await ws.addToolAsset(
      slug,
      'icon.png',
      new Uint8Array([1, 2, 3]),
    );
    const b = await ws.addToolAsset(
      slug,
      'icon.png',
      new Uint8Array([1, 2, 4]),
    );
    expect(a).not.toBe(b);
    expect(a.split('.')[0]).toBe(b.split('.')[0]);
  });

  it('refuses names that are not usable and assets that are missing', async () => {
    const { ws } = await fresh();
    const slug = await ws.createTool(tool);
    await expect(
      ws.addToolAsset(slug, '.svg', new Uint8Array([1])),
    ).rejects.toThrow(/no usable name/);
    await expect(ws.readToolAsset(slug, 'nope.svg')).rejects.toThrow(
      /no asset/,
    );
    await expect(ws.readToolAsset(slug, '../tool.json')).rejects.toThrow(
      /not an asset name/,
    );
  });
});

describe('the editable model file through the workspace', () => {
  it('exports a stored model and imports it as a new one', async () => {
    const { ws } = await fresh();
    const toolSlug = await ws.createTool(tool);
    const modelSlug = await ws.createModel(aModel(), { slug: 'one' });
    const text1 = await ws.exportModel(modelSlug);
    expect(text1).toContain('"class": "Task"');
    const copySlug = await ws.importModel(
      text1.replace('"id": "mdl_sample"', '"id": "mdl_copy"'),
      { toolSlug, slug: 'copy' },
    );
    const copy = (await ws.loadModel(copySlug)).document;
    expect(copy.manifest.id).toBe('mdl_copy');
    expect(Object.keys(copy.elements)).toEqual(
      Object.keys((await ws.loadModel('one')).document.elements),
    );
  });

  it('says when the tool of a model is not in the workspace', async () => {
    const { ws } = await fresh();
    await ws.createTool(tool);
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
