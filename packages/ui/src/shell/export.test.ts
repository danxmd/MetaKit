import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { Kit } from '@metakit-app/core';
import { MemoryAdapter, Workspace } from '@metakit-app/storage';
import { AppController } from './controller';

// The browser download is replaced: the tests read what would have been saved.
const downloads = vi.hoisted(
  () => [] as { fileName: string; data: Uint8Array | string }[],
);
vi.mock('./files', async (original) => ({
  ...(await original<typeof import('./files')>()),
  downloadFile: (fileName: string, data: Uint8Array | string) =>
    downloads.push({ fileName, data }),
}));

const bpmn = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../kits/bpmn-lite/kit.json', import.meta.url),
    ),
    'utf8',
  ),
) as Kit;

/** An open model with a save delay far longer than the test, so nothing is written on its own. */
async function openModel() {
  const adapter = new MemoryAdapter('aaaa0001');
  const ws = await Workspace.create(adapter, { name: 'Team' });
  const kitSlug = await ws.createKit(bpmn);
  const app = new AppController({
    flushMs: 60_000,
    presence: false,
    health: false,
  });
  await app.openWorkspace(adapter);
  const slug = (await app.createModel({
    kitSlug,
    modelType: Object.values(bpmn.modelTypes)[0]!.id,
    name: 'Order process',
  }))!;
  app.state.open!.store.execute({
    type: 'createElement',
    class: 'cls_task',
    x: 5,
    y: 6,
    attrs: { att_name: 'Edited just now' },
  } as never);
  return { app, slug };
}

describe('exports from the open model', () => {
  it('write pending edits first, so the model file has them', async () => {
    downloads.length = 0;
    const { app, slug } = await openModel();
    expect(app.state.save).toBe('saving');
    expect(await app.exportModelFile(slug)).toBe(true);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.fileName).toBe('order-process.mkmodel.json');
    expect(downloads[0]!.data as string).toContain('Edited just now');
  });

  it('make a bundle and CSV files with the edit too', async () => {
    downloads.length = 0;
    const { app, slug } = await openModel();
    expect(await app.exportBundle([slug])).toBe(true);
    expect(await app.exportCsv(slug)).toBe(true);
    expect(downloads.map((d) => d.fileName)).toEqual([
      'order-process.mkbundle',
      `${slug}.csv.zip`,
    ]);
    expect(app.state.save).toBe('saved');
  });

  it('say false and give the reason when a model is missing', async () => {
    downloads.length = 0;
    const { app } = await openModel();
    expect(await app.exportModelFile('no-such-model')).toBe(false);
    expect(app.state.error).toBeTruthy();
    expect(downloads).toHaveLength(0);
  });
});
