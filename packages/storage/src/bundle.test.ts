import { describe, expect, it } from 'vitest';
import { exportBundle, importBundle } from './bundle';
import { FormatError } from './errors';
import {
  newWorkspace,
  sampleModelFromDisk,
  sampleKitFromDisk,
  withoutPos,
} from './exchange-fixtures';
import { exportMkModel } from './mkmodel';
import { unzipFiles, zipFiles } from './zip';

const dir = 'bpmn-lite';
const kit = sampleKitFromDisk(dir);
const original = sampleModelFromDisk(dir, 'order-process.mkmodel.json');

async function source() {
  const ws = await newWorkspace('Source');
  await ws.createKit(kit);
  const a = await ws.createModel(original);
  const second = {
    ...original,
    manifest: {
      ...original.manifest,
      id: 'mdl_second0001' as typeof original.manifest.id,
      name: 'Second process',
      folder: 'Samples/More',
    },
  };
  const b = await ws.createModel(second);
  return { ws, a, b, second };
}

describe('bundles', () => {
  it('holds bundle.json, the Kit and one model file per model', async () => {
    const { ws, a, b } = await source();
    const { bytes, fileName } = await exportBundle(ws, {
      models: [a, b],
      includeKit: true,
      name: 'Case study',
      now: () => new Date('2026-10-07T09:00:00.000Z'),
    });
    expect(fileName).toBe('case-study.mkbundle');
    const files = unzipFiles(bytes);
    expect(Object.keys(files)).toEqual([
      'bundle.json',
      'models/order-process.mkmodel.json',
      'models/second-process.mkmodel.json',
      'tool/tool.json',
    ]);
    const manifest = JSON.parse(new TextDecoder().decode(files['bundle.json']));
    expect(manifest).toMatchObject({
      formatVersion: 1,
      kind: 'mkbundle',
      name: 'Case study',
      created: '2026-10-07T09:00:00.000Z',
      tool: { id: kit.manifest.id, version: kit.manifest.version },
      models: [
        { name: 'Order process', folder: 'Samples' },
        { name: 'Second process', folder: 'Samples/More' },
      ],
    });
  });

  it('is reproducible', async () => {
    const { ws, a } = await source();
    const options = {
      models: [a],
      includeKit: true,
      now: () => new Date('2026-10-07T09:00:00.000Z'),
    };
    const one = await exportBundle(ws, options);
    const two = await exportBundle(ws, options);
    expect([...one.bytes]).toEqual([...two.bytes]);
  });

  it('imports into a fresh workspace with the Kit, new model ids and the same folders', async () => {
    const { ws, a, b } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a, b],
      includeKit: true,
    });
    const target = await newWorkspace('Target', 'bbbb0002');
    const report = await importBundle(target, bytes);
    expect(report.kitAdded).toBe(true);
    expect(report.skipped).toEqual([]);
    expect(report.added.map((m) => m.name)).toEqual([
      'Order process',
      'Second process',
    ]);
    expect(report.added.map((m) => m.folder)).toEqual([
      'Samples',
      'Samples/More',
    ]);

    const kitBack = (await target.loadKit(report.kitSlug)).document;
    expect(kitBack).toEqual(kit);
    for (const [i, slug] of [a, b].entries()) {
      const before = (await ws.loadModel(slug)).document;
      const after = (await target.loadModel(report.added[i]!.slug)).document;
      expect(after.manifest.id).not.toBe(before.manifest.id);
      expect(
        exportMkModel(kitBack, { ...after, manifest: before.manifest }),
      ).toBe(exportMkModel(kit, before));
      expect(withoutPos({ ...after, manifest: before.manifest })).toEqual(
        withoutPos(before),
      );
    }
  });

  it('uses the Kit already in the workspace and reports another version', async () => {
    const { ws, a } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a],
      includeKit: true,
    });
    const target = await newWorkspace('Target', 'bbbb0002');
    const slug = await target.createKit({
      ...kit,
      manifest: { ...kit.manifest, version: '1.1.0' },
    });
    const report = await importBundle(target, bytes);
    expect(report.kitAdded).toBe(false);
    expect(report.kitSlug).toBe(slug);
    expect(report.kitVersionDiffers).toBe(true);
    expect(report.messages.join(' ')).toContain('version 1.1.0');
    expect(await target.listKits()).toHaveLength(1);
    expect(report.added).toHaveLength(1);
  });

  it('skips a model it cannot read and still adds the others', async () => {
    const { ws, a, b } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a, b],
      includeKit: true,
    });
    const files = unzipFiles(bytes);
    const broken = JSON.parse(
      new TextDecoder().decode(files['models/second-process.mkmodel.json']),
    );
    broken.elements[0].class = 'Nonsense';
    const repacked = zipFiles({
      ...files,
      'models/second-process.mkmodel.json': JSON.stringify(broken),
    });
    const target = await newWorkspace('Target', 'bbbb0002');
    const report = await importBundle(target, repacked);
    expect(report.added.map((m) => m.name)).toEqual(['Order process']);
    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0]!.name).toBe('Second process');
    expect(report.skipped[0]!.reason).toContain('Nonsense');
    expect(await target.listModels()).toHaveLength(1);
  });

  it('needs the Kit when the bundle has none and the workspace lacks it', async () => {
    const { ws, a } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a],
      includeKit: false,
    });
    expect(Object.keys(unzipFiles(bytes))).not.toContain('tool/tool.json');
    const target = await newWorkspace('Target', 'bbbb0002');
    await expect(importBundle(target, bytes)).rejects.toThrow(
      /does not include its Kit/,
    );
    await target.createKit(kit);
    expect((await importBundle(target, bytes)).added).toHaveLength(1);
  });

  it('refuses models of two Kits in one bundle, no models, and files that are not bundles', async () => {
    const { ws, a } = await source();
    const otherKit = sampleKitFromDisk('er-lite');
    await ws.createKit(otherKit);
    const er = await ws.createModel(
      sampleModelFromDisk('er-lite', 'library.mkmodel.json'),
    );
    await expect(
      exportBundle(ws, { models: [a, er], includeKit: true }),
    ).rejects.toThrow(/different ones/);
    await expect(
      exportBundle(ws, { models: [], includeKit: true }),
    ).rejects.toThrow(FormatError);
    const target = await newWorkspace('Target', 'bbbb0002');
    await expect(
      importBundle(target, zipFiles({ 'readme.txt': 'hello' })),
    ).rejects.toThrow(/no bundle\.json/);
    await expect(
      importBundle(target, new TextEncoder().encode('not a zip')),
    ).rejects.toThrow(/not a valid zip/);
  });
});
