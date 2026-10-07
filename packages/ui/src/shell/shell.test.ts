import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createEmptyModel,
  createModelStore,
  type Model,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  MemoryAdapter,
  Workspace,
  type ModelEntry,
} from '@metakit-app/storage';
import { AppController } from './controller';
import { buildExplorerTree, folderPaths, normalizeFolder } from './explorer';
import { findInModel } from './find';
import { paletteFor } from './palette';

const load = (name: string) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../../tools/${name}/tool.json`, import.meta.url),
      ),
      'utf8',
    ),
  ) as ToolLibrary;
const bpmn = load('bpmn-lite');
const er = load('er-lite');
const process = () => Object.values(bpmn.modelTypes)[0]!;

const entry = (name: string, folder?: string): ModelEntry => ({
  slug: name.toLowerCase(),
  id: `mdl_${name.toLowerCase().padEnd(10, '0')}`,
  name,
  tool: 'tool_bpmnlite',
  modelType: 'mt_process',
  ...(folder === undefined ? {} : { folder }),
});

describe('explorer', () => {
  it('cleans folder paths', () => {
    expect(normalizeFolder(' Sales /2026/ ')).toBe('Sales/2026');
    expect(normalizeFolder('a//b\\c')).toBe('a/b/c');
    expect(normalizeFolder('../..')).toBeNull();
    expect(normalizeFolder('')).toBeNull();
    expect(normalizeFolder(undefined)).toBeNull();
  });

  it('groups models by folder and sorts by name', () => {
    const tree = buildExplorerTree([
      entry('Zeta'),
      entry('Beta', 'Sales/2026'),
      entry('alpha', 'Sales'),
      entry('Gamma', 'Sales/2026'),
      entry('Delta', 'HR'),
    ]);
    expect(tree.models.map((m) => m.name)).toEqual(['Zeta']);
    expect(tree.folders.map((f) => f.path)).toEqual(['HR', 'Sales']);
    const sales = tree.folders[1]!;
    expect(sales.models.map((m) => m.name)).toEqual(['alpha']);
    expect(sales.folders[0]!.path).toBe('Sales/2026');
    expect(sales.folders[0]!.models.map((m) => m.name)).toEqual([
      'Beta',
      'Gamma',
    ]);
  });

  it('lists every folder path in use, including parents', () => {
    expect(
      folderPaths([entry('A', 'x/y/z'), entry('B', 'x/w'), entry('C')]),
    ).toEqual(['x', 'x/w', 'x/y', 'x/y/z']);
  });
});

describe('palette', () => {
  it('offers concrete classes and relations of the model type, and filters by view', () => {
    const all = paletteFor(bpmn, process(), null);
    const keys = all.classes.map((c) => c.key);
    expect(keys).toContain('Task');
    expect(keys).not.toContain('FlowNode');
    expect(all.relations.map((r) => r.key)).toEqual(['SequenceFlow']);
    expect(all.views.length).toBeGreaterThan(0);
    const view = process().views[0]!;
    const filtered = paletteFor(bpmn, process(), view.id);
    expect(filtered.classes.length).toBeLessThanOrEqual(all.classes.length);
    // A view that lists the abstract FlowNode brings in its concrete subclasses.
    const viaAbstract = paletteFor(
      bpmn,
      {
        ...process(),
        views: [{ ...view, classes: ['cls_flownode'], relations: [] }],
      },
      view.id,
    );
    expect(viaAbstract.classes.map((c) => c.key).sort()).toEqual([
      'EndEvent',
      'Gateway',
      'StartEvent',
      'Task',
    ]);
    expect(viaAbstract.relations).toEqual([]);
    expect(viaAbstract.relationIds.size).toBe(0);
  });

  it('works for a model type without views', () => {
    const type = Object.values(er.modelTypes)[0]!;
    const palette = paletteFor(er, type, null);
    expect(palette.classes.map((c) => c.key).sort()).toEqual([
      'Attribute',
      'Entity',
      'Relationship',
    ]);
    expect(palette.relations.length).toBe(2);
  });
});

describe('find', () => {
  function model(): Model {
    const m = createEmptyModel(bpmn, process().id, { name: 'M' });
    const store = createModelStore(m, { tool: bpmn });
    const names: [string, string, string?][] = [
      ['Check order', 'cls_task', 'Verify the customer address'],
      ['Ship goods', 'cls_task', 'Use the red carrier'],
      ['Château', 'cls_gateway'],
    ];
    for (const [i, [name, cls, description]] of names.entries())
      store.execute({
        type: 'createElement',
        class: cls as never,
        x: i * 150,
        y: 0,
        attrs: {
          att_name: name,
          ...(description ? { att_description: description } : {}),
        },
      });
    return store.state as Model;
  }

  it('finds by name first, then by attribute value, ignoring case and accents', () => {
    const m = model();
    const hits = findInModel(bpmn, m, 'CHECK');
    expect(hits.map((h) => h.title)).toEqual(['Check order']);
    expect(hits[0]).toMatchObject({ field: 'name', kind: 'element' });
    const byValue = findInModel(bpmn, m, 'red carrier');
    expect(byValue).toHaveLength(1);
    expect(byValue[0]).toMatchObject({
      title: 'Ship goods',
      field: 'Description',
    });
    expect(findInModel(bpmn, m, 'chateau').map((h) => h.title)).toEqual([
      'Château',
    ]);
    expect(findInModel(bpmn, m, 'e', 'en', 2)).toHaveLength(2);
  });

  it('puts name hits before value hits and returns nothing for an empty query', () => {
    const m = model();
    const hits = findInModel(bpmn, m, 'ship');
    expect(hits[0]!.field).toBe('name');
    expect(findInModel(bpmn, m, '  ')).toEqual([]);
    expect(findInModel(bpmn, m, 'zzzz')).toEqual([]);
  });

  it('does not match on class names, only on names and values', () => {
    const m = model();
    expect(findInModel(bpmn, m, 'gateway')).toEqual([]);
    expect(findInModel(bpmn, m, 'task')).toEqual([]);
  });
});

async function workspaceWithTool() {
  const adapter = new MemoryAdapter('aaaa0001');
  const ws = await Workspace.create(adapter, { name: 'Team' });
  const toolSlug = await ws.createTool(bpmn);
  return { adapter, ws, toolSlug };
}

describe('AppController', () => {
  it('opens a workspace and lists tools and models', async () => {
    const { adapter, toolSlug } = await workspaceWithTool();
    const app = new AppController({ saveDelayMs: 5 });
    expect(app.state.phase).toBe('start');
    expect(await app.openWorkspace(adapter)).toBe('opened');
    expect(app.state).toMatchObject({
      phase: 'workspace',
      workspaceName: 'Team',
    });
    expect(app.state.tools.map((t) => t.slug)).toEqual([toolSlug]);
    expect(app.state.models).toEqual([]);
  });

  it('says plainly when a folder is not a workspace', async () => {
    const app = new AppController();
    expect(await app.openWorkspace(new MemoryAdapter())).toBe(
      'not-a-workspace',
    );
    expect(app.state.error).toBeNull();
    expect(app.state.phase).toBe('start');
  });

  it('creates a workspace in an empty folder when asked to', async () => {
    const app = new AppController();
    expect(
      await app.openWorkspace(new MemoryAdapter(), { create: { name: 'New' } }),
    ).toBe('opened');
    expect(app.state.workspaceName).toBe('New');
  });

  it('creates a model, opens it, saves edits after the delay and on close', async () => {
    const { adapter, toolSlug } = await workspaceWithTool();
    const app = new AppController({ saveDelayMs: 10 });
    await app.openWorkspace(adapter);
    const slug = await app.createModel({
      toolSlug,
      modelType: process().id,
      name: 'Order process',
      folder: ' Sales ',
    });
    expect(slug).toBeDefined();
    expect(app.state.phase).toBe('model');
    expect(app.state.models[0]).toMatchObject({
      name: 'Order process',
      folder: 'Sales',
    });
    const open = app.state.open!;
    expect(open.tool.manifest.id).toBe(bpmn.manifest.id);

    open.store.execute({
      type: 'createElement',
      class: 'cls_task',
      x: 5,
      y: 6,
      attrs: { att_name: 'First' },
    });
    expect(app.state.save).toBe('saving');
    await new Promise((r) => setTimeout(r, 60));
    expect(app.state.save).toBe('saved');
    const ws = await Workspace.open(adapter.asInstance('bbbb0002'));
    expect(
      Object.keys((await ws.loadModel(slug!)).document.elements),
    ).toHaveLength(1);

    // A change right before closing is still written.
    open.store.execute({
      type: 'createElement',
      class: 'cls_task',
      x: 50,
      y: 6,
    });
    await app.closeModel();
    expect(app.state.phase).toBe('workspace');
    expect(
      Object.keys((await ws.loadModel(slug!)).document.elements),
    ).toHaveLength(2);

    // Reopening gives the saved content and the same tool library.
    await app.openModel(slug!);
    expect(
      Object.keys((app.state.open!.store.state as Model).elements),
    ).toHaveLength(2);
  });

  it('renames and moves the open model and models that are not open', async () => {
    const { adapter, toolSlug } = await workspaceWithTool();
    const app = new AppController({ saveDelayMs: 5 });
    await app.openWorkspace(adapter);
    const a = (await app.createModel({
      toolSlug,
      modelType: process().id,
      name: 'A',
    }))!;
    await app.closeModel();
    const b = (await app.createModel({
      toolSlug,
      modelType: process().id,
      name: 'B',
    }))!;

    await app.renameModel(b, 'B renamed');
    await app.moveModel(b, 'Sales/2026');
    expect(app.state.models.find((m) => m.slug === b)).toMatchObject({
      name: 'B renamed',
      folder: 'Sales/2026',
    });
    // The model that is open keeps working and the change can be undone.
    expect(app.state.open!.store.canUndo()).toBe(true);

    await app.renameModel(a, 'A renamed');
    await app.moveModel(a, null);
    expect(app.state.models.find((m) => m.slug === a)).toMatchObject({
      name: 'A renamed',
    });
    expect(app.state.models.find((m) => m.slug === a)!.folder).toBeUndefined();

    await app.renameModel(a, '   ');
    expect(app.state.error).toMatch(/cannot be empty/);
  });

  it('trashes and restores a model without deleting its files', async () => {
    const { adapter, toolSlug } = await workspaceWithTool();
    const app = new AppController({ saveDelayMs: 5 });
    await app.openWorkspace(adapter);
    const slug = (await app.createModel({
      toolSlug,
      modelType: process().id,
      name: 'Gone',
    }))!;
    const before = adapter.paths();
    await app.trashModel(slug);
    expect(app.state.phase).toBe('workspace');
    expect(app.state.models).toEqual([]);
    expect(app.state.trashed.map((m) => m.slug)).toEqual([slug]);
    for (const p of before) expect(adapter.paths()).toContain(p);
    await app.restoreModel(slug);
    expect(app.state.models.map((m) => m.slug)).toEqual([slug]);
    expect(app.state.trashed).toEqual([]);
  });

  it('reports a model whose tool library is missing', async () => {
    const adapter = new MemoryAdapter('aaaa0001');
    const ws = await Workspace.create(adapter, { name: 'X' });
    await ws.createModel(
      createEmptyModel(bpmn, process().id, { name: 'Orphan' }),
    );
    const app = new AppController();
    await app.openWorkspace(adapter);
    const slug = app.state.models[0]!.slug;
    expect(await app.openModel(slug)).toBe(false);
    expect(app.state.error).toMatch(/not in this workspace/);
  });

  it('shows a failed save and keeps the model open', async () => {
    const { adapter, toolSlug } = await workspaceWithTool();
    const app = new AppController({ saveDelayMs: 5 });
    await app.openWorkspace(adapter);
    await app.createModel({ toolSlug, modelType: process().id, name: 'M' });
    adapter.overwrite = () => Promise.reject(new Error('disk full'));
    app.state.open!.store.execute({
      type: 'createElement',
      class: 'cls_task',
      x: 0,
      y: 0,
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(app.state.save).toBe('error');
    expect(app.state.error).toMatch(/Saving failed: disk full/);
    expect(app.state.open).not.toBeNull();
  });

  it('notifies listeners and lets them stop listening', async () => {
    const { adapter } = await workspaceWithTool();
    const app = new AppController();
    const seen: string[] = [];
    const stop = app.subscribe((s) => seen.push(s.phase));
    await app.openWorkspace(adapter);
    stop();
    const count = seen.length;
    await app.closeWorkspace();
    expect(seen).toHaveLength(count);
    expect(seen).toContain('workspace');
    expect(app.state.phase).toBe('start');
  });
});

describe('AppController.addToolLibrary', () => {
  async function opened() {
    const adapter = new MemoryAdapter('aaaa0001');
    await Workspace.create(adapter, { name: 'Team' });
    const app = new AppController();
    await app.openWorkspace(adapter);
    return app;
  }

  it('adds a valid tool library once and lists it', async () => {
    const app = await opened();
    const slug = await app.addToolLibrary(JSON.stringify(bpmn));
    expect(slug).toBeDefined();
    expect(app.state.tools.map((t) => t.name)).toEqual([bpmn.manifest.name]);
    expect(await app.modelTypesOf(slug!)).toHaveLength(1);
    expect(await app.addToolLibrary(JSON.stringify(bpmn))).toBeUndefined();
    expect(app.state.error).toMatch(/already in this workspace/);
    expect(app.state.tools).toHaveLength(1);
  });

  it('says what is wrong with a file that is not a tool library', async () => {
    const app = await opened();
    expect(await app.addToolLibrary('not json')).toBeUndefined();
    expect(app.state.error).toMatch(/not valid JSON/);
    const broken = JSON.parse(JSON.stringify(bpmn)) as ToolLibrary;
    broken.classes['cls_task']!.extends = 'cls_missing00';
    expect(await app.addToolLibrary(JSON.stringify(broken))).toBeUndefined();
    expect(app.state.error).toMatch(
      /not a valid tool library[\s\S]*cls_missing00/,
    );
    expect(app.state.tools).toEqual([]);
  });
});
