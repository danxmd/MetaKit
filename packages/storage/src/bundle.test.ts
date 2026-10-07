import { describe, expect, it } from 'vitest';
import { exportBundle, importBundle } from './bundle';
import { FormatError } from './errors';
import {
  newWorkspace,
  sampleModelFromDisk,
  sampleToolFromDisk,
  withoutPos,
} from './exchange-fixtures';
import { exportMkModel } from './mkmodel';
import { unzipFiles, zipFiles } from './zip';

const dir = 'bpmn-lite';
const tool = sampleToolFromDisk(dir);
const original = sampleModelFromDisk(dir, 'order-process.mkmodel.json');

async function source() {
  const ws = await newWorkspace('Source');
  await ws.createTool(tool);
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
  it('holds bundle.json, the tool and one model file per model', async () => {
    const { ws, a, b } = await source();
    const { bytes, fileName } = await exportBundle(ws, {
      models: [a, b],
      includeTool: true,
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
      tool: { id: tool.manifest.id, version: tool.manifest.version },
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
      includeTool: true,
      now: () => new Date('2026-10-07T09:00:00.000Z'),
    };
    const one = await exportBundle(ws, options);
    const two = await exportBundle(ws, options);
    expect([...one.bytes]).toEqual([...two.bytes]);
  });

  it('imports into a fresh workspace with the tool, new model ids and the same folders', async () => {
    const { ws, a, b } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a, b],
      includeTool: true,
    });
    const target = await newWorkspace('Target', 'bbbb0002');
    const report = await importBundle(target, bytes);
    expect(report.toolAdded).toBe(true);
    expect(report.skipped).toEqual([]);
    expect(report.added.map((m) => m.name)).toEqual([
      'Order process',
      'Second process',
    ]);
    expect(report.added.map((m) => m.folder)).toEqual([
      'Samples',
      'Samples/More',
    ]);

    const toolBack = (await target.loadTool(report.toolSlug)).document;
    expect(toolBack).toEqual(tool);
    for (const [i, slug] of [a, b].entries()) {
      const before = (await ws.loadModel(slug)).document;
      const after = (await target.loadModel(report.added[i]!.slug)).document;
      expect(after.manifest.id).not.toBe(before.manifest.id);
      expect(
        exportMkModel(toolBack, { ...after, manifest: before.manifest }),
      ).toBe(exportMkModel(tool, before));
      expect(withoutPos({ ...after, manifest: before.manifest })).toEqual(
        withoutPos(before),
      );
    }
  });

  it('uses the tool already in the workspace and reports another version', async () => {
    const { ws, a } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a],
      includeTool: true,
    });
    const target = await newWorkspace('Target', 'bbbb0002');
    const slug = await target.createTool({
      ...tool,
      manifest: { ...tool.manifest, version: '1.1.0' },
    });
    const report = await importBundle(target, bytes);
    expect(report.toolAdded).toBe(false);
    expect(report.toolSlug).toBe(slug);
    expect(report.toolVersionDiffers).toBe(true);
    expect(report.messages.join(' ')).toContain('version 1.1.0');
    expect(await target.listTools()).toHaveLength(1);
    expect(report.added).toHaveLength(1);
  });

  it('skips a model it cannot read and still adds the others', async () => {
    const { ws, a, b } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a, b],
      includeTool: true,
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

  it('needs the tool when the bundle has none and the workspace lacks it', async () => {
    const { ws, a } = await source();
    const { bytes } = await exportBundle(ws, {
      models: [a],
      includeTool: false,
    });
    expect(Object.keys(unzipFiles(bytes))).not.toContain('tool/tool.json');
    const target = await newWorkspace('Target', 'bbbb0002');
    await expect(importBundle(target, bytes)).rejects.toThrow(
      /does not include its tool library/,
    );
    await target.createTool(tool);
    expect((await importBundle(target, bytes)).added).toHaveLength(1);
  });

  it('refuses models of two tools in one bundle, no models, and files that are not bundles', async () => {
    const { ws, a } = await source();
    const otherTool = sampleToolFromDisk('er-lite');
    await ws.createTool(otherTool);
    const er = await ws.createModel(
      sampleModelFromDisk('er-lite', 'library.mkmodel.json'),
    );
    await expect(
      exportBundle(ws, { models: [a, er], includeTool: true }),
    ).rejects.toThrow(/different ones/);
    await expect(
      exportBundle(ws, { models: [], includeTool: true }),
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
