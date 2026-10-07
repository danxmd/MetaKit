import { describe, expect, it } from 'vitest';
import { FormatError } from './errors';
import {
  exportMkModel,
  exportModelFile,
  importModelFile,
  MkModelError,
} from './mkmodel';
import {
  newWorkspace,
  sampleModelFromDisk,
  sampleModelText,
  SAMPLE_MODELS,
  sampleToolFromDisk,
  withoutPos,
} from './exchange-fixtures';

describe.each(SAMPLE_MODELS)(
  'model file of $tool/$file',
  ({ tool: dir, file }) => {
    it('exports and imports again as an identical model', async () => {
      const tool = sampleToolFromDisk(dir);
      const original = sampleModelFromDisk(dir, file);
      const from = await newWorkspace('A');
      await from.createTool(tool);
      const fromSlug = await from.createModel(original);

      const { fileName, text } = await exportModelFile(from, fromSlug);
      expect(fileName).toMatch(/\.mkmodel\.json$/);

      const to = await newWorkspace('B', 'bbbb0002');
      await to.createTool(tool);
      const result = await importModelFile(to, text);
      const loaded = (await to.loadModel(result.slug)).document;

      // Drawing order keys are made new on import; the order they give is what counts.
      expect(exportMkModel(tool, loaded)).toBe(exportMkModel(tool, original));
      expect(withoutPos(loaded)).toEqual(withoutPos(original));
      expect(result.report.toolVersionDiffers).toBe(false);
      expect(result.report.unknownAttributes).toBe(0);
      expect(result.report.idChanged).toBe(false);
    });
  },
);

describe('importModelFile', () => {
  const dir = 'bpmn-lite';
  const file = 'order-process.mkmodel.json';

  it('keeps values of attributes the tool does not define and says so', async () => {
    const tool = sampleToolFromDisk(dir);
    const original = sampleModelFromDisk(dir, file);
    const someId = Object.keys(
      original.elements,
    )[0] as keyof typeof original.elements;
    const element = original.elements[someId]!;
    // A value for an attribute id that the tool library does not have.
    const withExtra = {
      ...original,
      elements: {
        ...original.elements,
        [someId]: {
          ...element,
          attrs: { ...element.attrs, att_gone0001: 'kept' },
        },
      },
    };
    const text = exportMkModel(tool, withExtra);
    const ws = await newWorkspace();
    await ws.createTool(tool);
    const first = await importModelFile(ws, text);
    expect(first.report.unknownAttributes).toBe(1);
    expect(first.report.messages.join(' ')).toContain('Unknown attributes');
    const stored = (await ws.loadModel(first.slug)).document;
    expect(stored.elements[someId]!.attrs).toHaveProperty(
      'att_gone0001',
      'kept',
    );
    // the value survives the next export too
    expect(exportMkModel(tool, stored)).toBe(text);
  });

  it('says when the tool version differs', async () => {
    const tool = sampleToolFromDisk(dir);
    const ws = await newWorkspace();
    await ws.createTool({
      ...tool,
      manifest: { ...tool.manifest, version: '2.0.0' },
    });
    const result = await importModelFile(ws, sampleModelText(dir, file));
    expect(result.report.toolVersionDiffers).toBe(true);
    expect(result.report.fileTool.version).toBe('1.0.0');
    expect(result.report.tool.version).toBe('2.0.0');
    expect(result.report.messages.join(' ')).toContain('version 1.0.0');
  });

  it('gives a new id when the workspace already has a model with that id', async () => {
    const tool = sampleToolFromDisk(dir);
    const original = sampleModelFromDisk(dir, file);
    const ws = await newWorkspace();
    await ws.createTool(tool);
    await ws.createModel(original);
    const result = await importModelFile(ws, exportMkModel(tool, original));
    expect(result.report.idChanged).toBe(true);
    expect(result.model.manifest.id).not.toBe(original.manifest.id);
    expect(await ws.listModels()).toHaveLength(2);
  });

  it('explains when the tool library is not in the workspace', async () => {
    const ws = await newWorkspace();
    const text = sampleModelText(dir, file);
    await expect(importModelFile(ws, text)).rejects.toThrow(FormatError);
    await expect(importModelFile(ws, text)).rejects.toThrow(
      /not in this workspace/,
    );
  });

  it('adds nothing when the file has problems', async () => {
    const tool = sampleToolFromDisk(dir);
    const ws = await newWorkspace();
    await ws.createTool(tool);
    const broken = JSON.parse(sampleModelText(dir, file));
    broken.elements[0].class = 'Nonsense';
    await expect(importModelFile(ws, JSON.stringify(broken))).rejects.toThrow(
      MkModelError,
    );
    expect(await ws.listModels()).toHaveLength(0);
  });
});
