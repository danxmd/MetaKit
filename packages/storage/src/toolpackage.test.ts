import {
  createModelStore,
  validateModel,
  type ClassId,
  type Model,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  SAMPLE,
  clone,
  emptySampleModel,
  sampleTool,
} from '@metakit-app/core/testing';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { FormatError, NewerFormatError } from './errors';
import { newWorkspace, withoutPos } from './exchange-fixtures';
import { exportMkModel, importModelFile } from './mkmodel';
import {
  applyToolUpdate,
  exportToolPackage,
  exportToolPackageFrom,
  planToolUpdate,
  prepareToolImport,
  readToolPackage,
  modelUsage,
} from './toolpackage';
import { unzipFiles } from './zip';

const tool = sampleTool();
const fixedNow = () => new Date('2026-10-07T09:00:00.000Z');

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
        attrs: { [SAMPLE.attName]: 'Review', [SAMPLE.attPriority]: 'High' },
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

/** The sample tool in a later version: Priority is gone, Owner is new, a class and a rule too. */
function updated(): ToolLibrary {
  const t = clone(tool);
  t.manifest.version = '1.1.0';
  const task = t.classes[SAMPLE.task as ClassId]!;
  task.attributes = [
    ...task.attributes.filter((a) => a.id !== SAMPLE.attPriority),
    { id: 'att_owner', key: 'Owner', type: 'text' },
  ];
  t.classes['cls_note' as ClassId] = {
    id: 'cls_note' as ClassId,
    key: 'Note',
    kind: 'node',
    labels: { en: 'Note' },
    attributes: [],
  };
  return t;
}

describe('the package', () => {
  it('holds package.json, tool.json and the reserved folders', () => {
    const { bytes, fileName } = exportToolPackage(tool, {
      scripts: { 'helper.ts': 'export const a = 1;\n' },
      assets: { 'icon.png': new Uint8Array([1, 2, 3]) },
      now: fixedNow,
    });
    expect(fileName).toBe('sample-1.0.0.mktool');
    const files = unzipFiles(bytes);
    expect(Object.keys(files)).toEqual([
      'assets/icon.png',
      'package.json',
      'scripts/helper.ts',
      'tool.json',
    ]);
    const info = JSON.parse(new TextDecoder().decode(files['package.json']));
    expect(info).toEqual({
      formatVersion: 1,
      kind: 'mktool',
      tool: { id: SAMPLE.tool, name: 'Sample', version: '1.0.0' },
      created: '2026-10-07T09:00:00.000Z',
      contents: ['assets/icon.png', 'scripts/helper.ts', 'tool.json'],
    });
    const read = readToolPackage(bytes);
    expect(read.issues).toEqual([]);
    expect(read.tool).toEqual(tool);
    expect(read.scripts['helper.ts']).toBe('export const a = 1;\n');
    expect([...read.assets['icon.png']!]).toEqual([1, 2, 3]);
  });

  it('carries a scripts field of the tool library', () => {
    const withScripts = {
      ...tool,
      scripts: { s1: { source: 'x' } },
    } as unknown as ToolLibrary;
    const read = readToolPackage(exportToolPackage(withScripts).bytes);
    expect((read.tool as unknown as { scripts: unknown }).scripts).toEqual({
      s1: { source: 'x' },
    });
  });

  it('is reproducible', () => {
    const a = exportToolPackage(tool, { now: fixedNow }).bytes;
    const b = exportToolPackage(tool, { now: fixedNow }).bytes;
    expect([...a]).toEqual([...b]);
  });

  it('brings a package from an older release up to date', () => {
    const old = clone(tool) as unknown as Record<string, unknown>;
    old.formatVersion = 1;
    delete old.shapes;
    delete old.panels;
    delete old.rules;
    const bytes = zipSync({
      'package.json': strToU8(
        JSON.stringify({
          formatVersion: 1,
          kind: 'mktool',
          tool: { id: SAMPLE.tool, name: 'Sample', version: '1.0.0' },
          created: 'x',
          contents: [],
        }),
      ),
      'tool.json': strToU8(JSON.stringify(old)),
    });
    const read = readToolPackage(bytes);
    expect(read.issues).toEqual([]);
    expect(read.tool.formatVersion).toBe(3);
    expect(read.tool.rules).toEqual({});
  });

  it('refuses a package from a newer release', () => {
    const bytes = zipSync({
      'package.json': strToU8(
        JSON.stringify({ formatVersion: 1, kind: 'mktool', tool: { id: 'x' } }),
      ),
      'tool.json': strToU8(JSON.stringify({ ...tool, formatVersion: 99 })),
    });
    expect(() => readToolPackage(bytes)).toThrow(NewerFormatError);
    expect(() => readToolPackage(bytes)).toThrow(/newer version of MetaKit/);
    const newerPackage = zipSync({
      'package.json': strToU8(
        JSON.stringify({ formatVersion: 9, kind: 'mktool' }),
      ),
      'tool.json': strToU8('{}'),
    });
    expect(() => readToolPackage(newerPackage)).toThrow(
      /newer version of MetaKit/,
    );
  });

  it('refuses a corrupt zip, a zip with a bad path and files that are not packages', () => {
    expect(() => readToolPackage(strToU8('this is not a zip'))).toThrow(
      /not a valid zip file/,
    );
    const evil = zipSync({
      '../tool.json': strToU8('{}'),
      'package.json': strToU8('{}'),
    });
    expect(() => readToolPackage(evil)).toThrow(/unsafe name/);
    expect(() => readToolPackage(zipSync({ 'a.txt': strToU8('x') }))).toThrow(
      /no package\.json/,
    );
    expect(() =>
      readToolPackage(
        zipSync({
          'package.json': strToU8(
            JSON.stringify({ formatVersion: 1, kind: 'mktool' }),
          ),
        }),
      ),
    ).toThrow(/no tool\.json/);
  });

  it('returns the problems of an invalid tool library, and the import refuses it', async () => {
    const broken = clone(tool) as unknown as Record<string, unknown>;
    broken.classes = 'nope';
    const bytes = zipSync({
      'package.json': strToU8(
        JSON.stringify({
          formatVersion: 1,
          kind: 'mktool',
          tool: { id: SAMPLE.tool },
        }),
      ),
      'tool.json': strToU8(JSON.stringify(broken)),
    });
    expect(readToolPackage(bytes).issues.length).toBeGreaterThan(0);
    const ws = await newWorkspace();
    await expect(prepareToolImport(ws, bytes)).rejects.toThrow(FormatError);
    await expect(prepareToolImport(ws, bytes)).rejects.toThrow(
      /has \d+ problems?, so it was not imported/,
    );
    expect(await ws.listTools()).toEqual([]);
  });
});

describe('moving a tool between workspaces', () => {
  it('gives an equal tool and a model that opens identically', async () => {
    const from = await newWorkspace('A');
    const toolSlug = await from.createTool(tool);
    const original = aModel();
    const modelSlug = await from.createModel(original);
    await from.addToolAsset(toolSlug, 'icon.png', new Uint8Array([9, 8, 7]));

    const { bytes } = await exportToolPackageFrom(from, toolSlug, {
      now: fixedNow,
    });

    const to = await newWorkspace('B', 'bbbb0002');
    const prepared = await prepareToolImport(to, bytes);
    expect(prepared.plan.isNew).toBe(true);
    expect(prepared.plan.lines[0]).toContain(
      'will be added as a new tool library',
    );
    const applied = await applyToolUpdate(to, prepared);
    expect(applied.created).toBe(true);
    const toolBack = (await to.loadTool(applied.slug)).document;
    expect(toolBack).toEqual(tool);
    const assetNames = (
      await to.adapter.list(`tools/${applied.slug}/assets`)
    ).map((e) => e.name);
    expect(assetNames).toHaveLength(1);
    expect([...(await to.readToolAsset(applied.slug, assetNames[0]!))]).toEqual(
      [9, 8, 7],
    );

    // The same model made in the first workspace opens the same in the second.
    const text = await from.exportModel(modelSlug);
    const imported = await importModelFile(to, text);
    const opened = (await to.loadModel(imported.slug)).document;
    expect(withoutPos(opened)).toEqual(withoutPos(original));
    expect(exportMkModel(toolBack, opened)).toBe(exportMkModel(tool, original));
    expect(validateModel(toolBack, opened)).toEqual(
      validateModel(tool, original),
    );
  });

  it('plans, then updates a tool in place and existing models keep working', async () => {
    const ws = await newWorkspace();
    const toolSlug = await ws.createTool(tool);
    const original = aModel();
    const modelSlug = await ws.createModel(original);

    const newer = updated();
    const bytes = exportToolPackage(newer).bytes;
    const prepared = await prepareToolImport(ws, bytes);
    expect(prepared.existingSlug).toBe(toolSlug);

    const { plan } = prepared;
    expect(plan.isNew).toBe(false);
    expect(plan.version).toEqual({
      from: '1.0.0',
      to: '1.1.0',
      direction: 'newer',
    });
    expect(plan.changes).toEqual(
      expect.arrayContaining([
        { area: 'class', change: 'added', name: 'Note' },
        { area: 'attribute', change: 'added', name: 'Task.Owner' },
        { area: 'attribute', change: 'removed', name: 'Task.Priority' },
      ]),
    );
    expect(plan.changes).toHaveLength(3);
    expect(plan.lines).toContain('Added class Note.');
    expect(plan.lines).toContain('Removed attribute Task.Priority.');
    expect(plan.lines[0]).toBe(
      '"Sample" will be updated from version 1.0.0 to version 1.1.0.',
    );
    expect(plan.warnings.join(' ')).toContain(
      'Values already stored in existing models are kept as unknown attributes',
    );
    expect(plan.affectedModels).toEqual([
      {
        slug: modelSlug,
        name: 'Order process',
        effects: ['Values of Task.Priority are kept as unknown attributes.'],
      },
    ]);

    const applied = await applyToolUpdate(ws, prepared);
    expect(applied).toEqual({ slug: toolSlug, created: false });
    expect(await ws.listTools()).toHaveLength(1);
    const now = (await ws.loadTool(toolSlug)).document;
    expect(now).toEqual(newer);

    // The model is untouched and still valid; the removed attribute's value is still stored.
    const model = (await ws.loadModel(modelSlug)).document;
    expect(model).toEqual(original);
    expect(
      model.elements['el_task' as keyof typeof model.elements]!.attrs,
    ).toHaveProperty(SAMPLE.attPriority, 'High');
    const problems = validateModel(now, model).filter(
      (i) => i.severity === 'error',
    );
    expect(problems).toEqual([]);
    // and the stored value survives an export and import as an unknown attribute
    expect(exportMkModel(now, model)).toContain(SAMPLE.attPriority);
  });

  it('says what happens to models that use a removed class', () => {
    const smaller = clone(tool);
    delete smaller.classes[SAMPLE.gateway as ClassId];
    const model = clone(aModel());
    model.elements['el_gw' as keyof typeof model.elements] = {
      ...model.elements['el_task' as keyof typeof model.elements]!,
      id: 'el_gw',
      class: SAMPLE.gateway,
    } as never;
    const plan = planToolUpdate(tool, smaller, [modelUsage('order', model)]);
    expect(plan.changes).toEqual([
      { area: 'class', change: 'removed', name: 'Gateway' },
    ]);
    expect(plan.warnings[0]).toContain('grey placeholders');
    expect(plan.affectedModels[0]!.effects).toEqual([
      'Objects of the class Gateway are drawn as grey placeholders.',
    ]);
  });

  it('reports renames, type changes, older versions and changes to shapes, panels and rules', () => {
    const t = clone(tool);
    t.manifest.version = '0.9.0';
    const task = t.classes[SAMPLE.task as ClassId]!;
    task.key = 'Job';
    task.attributes = task.attributes.map((a) =>
      a.id === SAMPLE.attEffort
        ? ({ ...a, key: 'Hours', type: 'text' } as never)
        : a,
    );
    t.settings.grid.size = 20;
    (t.rules as Record<string, unknown>)['rule_one'] = {
      id: 'rule_one',
      label: 'Say hello',
      when: { event: 'created' },
      then: [],
    };
    const plan = planToolUpdate(tool, t);
    expect(plan.version.direction).toBe('older');
    expect(plan.changes).toEqual(
      expect.arrayContaining([
        {
          area: 'class',
          change: 'changed',
          name: 'Job',
          detail: 'renamed from Task',
        },
        {
          area: 'attribute',
          change: 'changed',
          name: 'Job.Hours',
          detail: 'renamed from Job.Effort; changed: type',
        },
        { area: 'rule', change: 'added', name: 'Say hello' },
        { area: 'settings', change: 'changed', name: 'Settings' },
      ]),
    );
    expect(plan.warnings.join(' ')).toContain('older than the version 1.0.0');
    expect(plan.warnings.join(' ')).toContain(
      'changes type from number to text',
    );
  });

  it('plans no changes for an identical library', () => {
    const plan = planToolUpdate(tool, clone(tool));
    expect(plan.changes).toEqual([]);
    expect(plan.version.direction).toBe('same');
    expect(plan.lines).toContain('Nothing in the library changes.');
  });

  it('will not update a different tool library', async () => {
    const ws = await newWorkspace();
    const slug = await ws.createTool(tool);
    const other = clone(tool);
    other.manifest.id = 'tool_other' as never;
    await expect(
      applyToolUpdate(ws, { incoming: other, existingSlug: slug, assets: {} }),
    ).rejects.toThrow(/different tool library/);
  });
});
