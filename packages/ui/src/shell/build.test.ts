import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateToolLibrary,
  type ToolCommand,
  type ToolLibrary,
} from '@metakit-app/core';
import { MemoryAdapter, Workspace } from '@metakit-app/storage';
import { AppController } from './controller';

const load = (name: string) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../../tools/${name}/tool.json`, import.meta.url),
      ),
      'utf8',
    ),
  ) as ToolLibrary;

/**
 * The commands that build a tool library from nothing, one class, relation class and model type at
 * a time, the way the Build mode editors issue them.
 */
export function commandsToBuild(tool: ToolLibrary): ToolCommand[] {
  const out: ToolCommand[] = [
    {
      type: 'updateManifest',
      name: tool.manifest.name,
      version: tool.manifest.version,
      languages: tool.manifest.languages,
    },
    {
      type: 'updateSettings',
      grid: tool.settings.grid,
      layers: tool.settings.layers,
      numbering: tool.settings.numbering,
    },
  ];
  for (const shape of Object.values(tool.shapes))
    out.push({ type: 'putShape', def: shape });
  for (const cls of Object.values(tool.classes)) {
    out.push({ type: 'putClass', def: { ...cls, attributes: [] } });
    for (const attr of cls.attributes)
      out.push({
        type: 'putAttribute',
        owner: { kind: 'class', id: cls.id },
        def: attr,
      });
  }
  for (const rel of Object.values(tool.relations)) {
    out.push({ type: 'putRelation', def: { ...rel, attributes: [] } });
    for (const attr of rel.attributes)
      out.push({
        type: 'putAttribute',
        owner: { kind: 'relation', id: rel.id },
        def: attr,
      });
  }
  for (const mt of Object.values(tool.modelTypes)) {
    out.push({ type: 'putModelType', def: { ...mt, attributes: [] } });
    for (const attr of mt.attributes)
      out.push({
        type: 'putAttribute',
        owner: { kind: 'modelType', id: mt.id },
        def: attr,
      });
  }
  for (const panel of Object.values(tool.panels))
    out.push({ type: 'putPanel', layout: panel });
  return out;
}

async function openBlank() {
  const adapter = new MemoryAdapter('aaaa0001');
  await Workspace.create(adapter, { name: 'Team' });
  const app = new AppController({ flushMs: 5, presence: false, health: false });
  await app.openWorkspace(adapter);
  return { adapter, app };
}

describe('Build mode controller', () => {
  it('makes a tool library, edits it, and keeps the edits after closing and reopening', async () => {
    const { app } = await openBlank();
    const slug = (await app.createToolLibrary('Research'))!;
    expect(app.state.tools.map((t) => t.name)).toEqual(['Research']);
    expect(await app.openBuild(slug)).toBe(true);
    expect(app.state.phase).toBe('build');
    const put = app.runBuild({
      type: 'putClass',
      def: {
        id: 'cls_note',
        key: 'Note',
        kind: 'node',
        labels: { en: 'Note' },
        attributes: [],
      },
    });
    expect(put).toEqual({ ok: true, value: 'cls_note' });
    expect(app.state.build!.revision).toBeGreaterThan(0);
    expect(app.state.build!.canUndo).toBe(true);
    await app.closeBuild();
    expect(app.state.phase).toBe('workspace');
    await app.openBuild(slug);
    expect(app.state.build!.store.state.classes.cls_note!.key).toBe('Note');
    expect(app.state.build!.issues).toEqual([]);
  });

  it('says why a command was refused and leaves the tool alone', async () => {
    const { app } = await openBlank();
    const slug = (await app.createToolLibrary('T'))!;
    await app.openBuild(slug);
    app.runBuild({
      type: 'putClass',
      def: {
        id: 'cls_a',
        key: 'A',
        kind: 'node',
        labels: { en: 'A' },
        attributes: [],
      },
    });
    const refused = app.runBuild({
      type: 'renameKey',
      scope: { kind: 'class', id: 'cls_a' },
      newKey: '9',
    });
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error).toMatch(/letter/);
    expect(app.state.build!.store.state.classes.cls_a!.key).toBe('A');
    expect(await app.createToolLibrary('   ')).toBeUndefined();
    expect(app.state.error).toMatch(/name/);
  });

  it.each(['bpmn-lite', 'er-lite'])(
    "rebuilds the sample tool %s with the editors' commands alone",
    async (name) => {
      const sample = load(name);
      const { app } = await openBlank();
      const slug = (await app.createToolLibrary('Blank'))!;
      await app.openBuild(slug);
      const base = app.state.build!.store.state;
      for (const command of commandsToBuild(sample)) {
        const r = app.runBuild(command);
        expect(r, JSON.stringify(command).slice(0, 120)).toMatchObject({
          ok: true,
        });
      }
      const built = app.state.build!.store.state;
      expect(validateToolLibrary(built)).toEqual([]);
      // Same content; the id of the library itself is the new one.
      expect({
        ...built,
        manifest: { ...built.manifest, id: sample.manifest.id },
      }).toEqual(sample);
      expect(base.manifest.id).not.toBe(sample.manifest.id);
    },
  );

  it('shows a model its tool library changes, which arrive from another instance', async () => {
    const a = new MemoryAdapter('aaaa0001');
    const b = a.asInstance('bbbb0002');
    const ws = await Workspace.create(a, { name: 'Team' });
    const sample = load('bpmn-lite');
    const toolSlug = await ws.createTool(sample);
    const opts = { flushMs: 5, presence: false, health: false };
    const anna = new AppController(opts);
    const ben = new AppController(opts);
    await anna.openWorkspace(a);
    await ben.openWorkspace(b);
    const modelType = Object.values(sample.modelTypes)[0]!.id;
    const slug = (await ben.createModel({ toolSlug, modelType, name: 'M' }))!;
    expect(ben.state.open!.slug).toBe(slug);
    await anna.openBuild(toolSlug);
    const result = anna.runBuild({
      type: 'putClass',
      def: { ...sample.classes.cls_task!, labels: { en: 'Job' } },
    });
    expect(result.ok).toBe(true);
    await anna.flushBuild();
    await ben.state.open!.toolSession.rescan();
    expect(ben.state.open!.tool.classes.cls_task!.labels.en).toBe('Job');
  });
});
