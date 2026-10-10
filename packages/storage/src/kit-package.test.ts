import {
  createModelStore,
  validateModel,
  KIT_FORMAT_VERSION,
  type ClassId,
  type Model,
  type Kit,
} from '@metakit-app/core';
import {
  SAMPLE,
  clone,
  emptySampleModel,
  sampleKit,
} from '@metakit-app/core/testing';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { FormatError, NewerFormatError } from './errors';
import { newWorkspace, withoutPos } from './exchange-fixtures';
import { exportMkModel, importModelFile } from './mkmodel';
import {
  applyKitUpdate,
  exportKitPackage,
  exportKitPackageFrom,
  planKitUpdate,
  prepareKitImport,
  readKitPackage,
  modelUsage,
} from './kit-package';
import { unzipFiles } from './zip';

const kit = sampleKit();
const fixedNow = () => new Date('2026-10-07T09:00:00.000Z');

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

/** The sample Kit in a later version: Priority is gone, Owner is new, a class and a rule too. */
function updated(): Kit {
  const t = clone(kit);
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
    const { bytes, fileName } = exportKitPackage(kit, {
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
      tool: { id: SAMPLE.kit, name: 'Sample', version: '1.0.0' },
      created: '2026-10-07T09:00:00.000Z',
      contents: ['assets/icon.png', 'scripts/helper.ts', 'tool.json'],
    });
    const read = readKitPackage(bytes);
    expect(read.issues).toEqual([]);
    expect(read.kit).toEqual(kit);
    expect(read.scripts['helper.ts']).toBe('export const a = 1;\n');
    expect([...read.assets['icon.png']!]).toEqual([1, 2, 3]);
  });

  it('carries a scripts field of the Kit', () => {
    const withScripts = {
      ...kit,
      scripts: { s1: { source: 'x' } },
    } as unknown as Kit;
    const read = readKitPackage(exportKitPackage(withScripts).bytes);
    expect((read.kit as unknown as { scripts: unknown }).scripts).toEqual({
      s1: { source: 'x' },
    });
  });

  it('is reproducible', () => {
    const a = exportKitPackage(kit, { now: fixedNow }).bytes;
    const b = exportKitPackage(kit, { now: fixedNow }).bytes;
    expect([...a]).toEqual([...b]);
  });

  it('brings a package from an older release up to date', () => {
    const old = clone(kit) as unknown as Record<string, unknown>;
    old.formatVersion = 1;
    delete old.shapes;
    delete old.panels;
    delete old.rules;
    const bytes = zipSync({
      'package.json': strToU8(
        JSON.stringify({
          formatVersion: 1,
          kind: 'mktool',
          tool: { id: SAMPLE.kit, name: 'Sample', version: '1.0.0' },
          created: 'x',
          contents: [],
        }),
      ),
      'tool.json': strToU8(JSON.stringify(old)),
    });
    const read = readKitPackage(bytes);
    expect(read.issues).toEqual([]);
    expect(read.kit.formatVersion).toBe(KIT_FORMAT_VERSION);
    expect(read.kit.rules).toEqual({});
  });

  it('refuses a package from a newer release', () => {
    const bytes = zipSync({
      'package.json': strToU8(
        JSON.stringify({ formatVersion: 1, kind: 'mktool', tool: { id: 'x' } }),
      ),
      'tool.json': strToU8(JSON.stringify({ ...kit, formatVersion: 99 })),
    });
    expect(() => readKitPackage(bytes)).toThrow(NewerFormatError);
    expect(() => readKitPackage(bytes)).toThrow(/newer version of MetaKit/);
    const newerPackage = zipSync({
      'package.json': strToU8(
        JSON.stringify({ formatVersion: 9, kind: 'mktool' }),
      ),
      'tool.json': strToU8('{}'),
    });
    expect(() => readKitPackage(newerPackage)).toThrow(
      /newer version of MetaKit/,
    );
  });

  it('refuses a corrupt zip, a zip with a bad path and files that are not packages', () => {
    expect(() => readKitPackage(strToU8('this is not a zip'))).toThrow(
      /not a valid zip file/,
    );
    const evil = zipSync({
      '../tool.json': strToU8('{}'),
      'package.json': strToU8('{}'),
    });
    expect(() => readKitPackage(evil)).toThrow(/unsafe name/);
    expect(() => readKitPackage(zipSync({ 'a.txt': strToU8('x') }))).toThrow(
      /no package\.json/,
    );
    expect(() =>
      readKitPackage(
        zipSync({
          'package.json': strToU8(
            JSON.stringify({ formatVersion: 1, kind: 'mktool' }),
          ),
        }),
      ),
    ).toThrow(/no tool\.json/);
  });

  it('returns the problems of an invalid Kit, and the import refuses it', async () => {
    const broken = clone(kit) as unknown as Record<string, unknown>;
    broken.classes = 'nope';
    const bytes = zipSync({
      'package.json': strToU8(
        JSON.stringify({
          formatVersion: 1,
          kind: 'mktool',
          tool: { id: SAMPLE.kit },
        }),
      ),
      'tool.json': strToU8(JSON.stringify(broken)),
    });
    expect(readKitPackage(bytes).issues.length).toBeGreaterThan(0);
    const ws = await newWorkspace();
    await expect(prepareKitImport(ws, bytes)).rejects.toThrow(FormatError);
    await expect(prepareKitImport(ws, bytes)).rejects.toThrow(
      /has \d+ problems?, so it was not imported/,
    );
    expect(await ws.listKits()).toEqual([]);
  });
});

describe('moving a Kit between workspaces', () => {
  it('gives an equal Kit and a model that opens identically', async () => {
    const from = await newWorkspace('A');
    const kitSlug = await from.createKit(kit);
    const original = aModel();
    const modelSlug = await from.createModel(original);
    await from.addKitAsset(kitSlug, 'icon.png', new Uint8Array([9, 8, 7]));

    const { bytes } = await exportKitPackageFrom(from, kitSlug, {
      now: fixedNow,
    });

    const to = await newWorkspace('B', 'bbbb0002');
    const prepared = await prepareKitImport(to, bytes);
    expect(prepared.plan.isNew).toBe(true);
    expect(prepared.plan.lines[0]).toContain('will be added as a new Kit');
    const applied = await applyKitUpdate(to, prepared);
    expect(applied.created).toBe(true);
    const kitBack = (await to.loadKit(applied.slug)).document;
    expect(kitBack).toEqual(kit);
    const assetNames = (
      await to.adapter.list(`tools/${applied.slug}/assets`)
    ).map((e) => e.name);
    expect(assetNames).toHaveLength(1);
    expect([...(await to.readKitAsset(applied.slug, assetNames[0]!))]).toEqual([
      9, 8, 7,
    ]);

    // The same model made in the first workspace opens the same in the second.
    const text = await from.exportModel(modelSlug);
    const imported = await importModelFile(to, text);
    const opened = (await to.loadModel(imported.slug)).document;
    expect(withoutPos(opened)).toEqual(withoutPos(original));
    expect(exportMkModel(kitBack, opened)).toBe(exportMkModel(kit, original));
    expect(validateModel(kitBack, opened)).toEqual(
      validateModel(kit, original),
    );
  });

  it('plans, then updates a Kit in place and existing models keep working', async () => {
    const ws = await newWorkspace();
    const kitSlug = await ws.createKit(kit);
    const original = aModel();
    const modelSlug = await ws.createModel(original);

    const newer = updated();
    const bytes = exportKitPackage(newer).bytes;
    const prepared = await prepareKitImport(ws, bytes);
    expect(prepared.existingSlug).toBe(kitSlug);

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

    const applied = await applyKitUpdate(ws, prepared);
    expect(applied).toEqual({ slug: kitSlug, created: false });
    expect(await ws.listKits()).toHaveLength(1);
    const now = (await ws.loadKit(kitSlug)).document;
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
    const smaller = clone(kit);
    delete smaller.classes[SAMPLE.gateway as ClassId];
    const model = clone(aModel());
    model.elements['el_gw' as keyof typeof model.elements] = {
      ...model.elements['el_task' as keyof typeof model.elements]!,
      id: 'el_gw',
      class: SAMPLE.gateway,
    } as never;
    const plan = planKitUpdate(kit, smaller, [modelUsage('order', model)]);
    expect(plan.changes).toEqual([
      { area: 'class', change: 'removed', name: 'Gateway' },
    ]);
    expect(plan.warnings[0]).toContain('grey placeholders');
    expect(plan.affectedModels[0]!.effects).toEqual([
      'Objects of the class Gateway are drawn as grey placeholders.',
    ]);
  });

  it('reports renames, type changes, older versions and changes to shapes, panels and rules', () => {
    const t = clone(kit);
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
    const plan = planKitUpdate(kit, t);
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
    const plan = planKitUpdate(kit, clone(kit));
    expect(plan.changes).toEqual([]);
    expect(plan.version.direction).toBe('same');
    expect(plan.lines).toContain('Nothing in the Kit changes.');
  });

  it('will not update a different Kit', async () => {
    const ws = await newWorkspace();
    const slug = await ws.createKit(kit);
    const other = clone(kit);
    other.manifest.id = 'tool_other' as never;
    await expect(
      applyKitUpdate(ws, { incoming: other, existingSlug: slug, assets: {} }),
    ).rejects.toThrow(/different Kit/);
  });
});
