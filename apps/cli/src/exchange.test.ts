import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  importMkModel,
  migrate,
  NodeFsAdapter,
  unzipFiles,
  Workspace,
} from '@metakit-app/storage/node-entry';
import type { ToolLibrary } from '@metakit-app/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './index';

const toolsDir = fileURLToPath(new URL('../../../tools', import.meta.url));
const bpmn = join(toolsDir, 'bpmn-lite');

async function capture(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

let scratch: string;
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'metakit-cli-exchange-'));
});
afterEach(async () => {
  await rm(scratch, { recursive: true, force: true });
});

async function sourceWorkspace() {
  const root = join(scratch, 'source');
  const ws = await Workspace.create(new NodeFsAdapter(root), {
    name: 'Source',
  });
  const tool = migrate(
    'tool-document',
    JSON.parse(await readFile(join(bpmn, 'tool.json'), 'utf8')),
  ).value as unknown as ToolLibrary;
  const toolSlug = await ws.createTool(tool);
  const model = importMkModel(
    tool,
    await readFile(join(bpmn, 'order-process.mkmodel.json'), 'utf8'),
  );
  const modelSlug = await ws.createModel(model);
  return { root, ws, tool, toolSlug, model, modelSlug };
}

describe('bundles', () => {
  it('exports a bundle and imports it into a new workspace', async () => {
    const { root, ws, modelSlug } = await sourceWorkspace();
    const file = join(scratch, 'case.mkbundle');
    const exported = await capture([
      'export-bundle',
      '--workspace',
      root,
      '--out',
      file,
      '--name',
      'Case',
    ]);
    expect(exported.code).toBe(0);
    expect(
      Object.keys(unzipFiles(new Uint8Array(await readFile(file)))),
    ).toContain('bundle.json');

    const target = join(scratch, 'target');
    const result = await capture([
      'import-bundle',
      file,
      '--workspace',
      target,
      '--create',
    ]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('Added 1 model');
    const other = await Workspace.open(new NodeFsAdapter(target));
    // The imported model has a new id; everything else is the same.
    const withoutId = (text: string) =>
      text.replace(/"id": "mdl_[a-z0-9]+",?\n/, '');
    expect(
      withoutId(await other.exportModel((await other.listModels())[0]!.slug)),
    ).toBe(withoutId(await ws.exportModel(modelSlug)));
  });

  it('does not import into a folder that is not a workspace without --create', async () => {
    const { root } = await sourceWorkspace();
    const file = join(scratch, 'case.mkbundle');
    await capture(['export-bundle', '--workspace', root, '--out', file]);
    const result = await capture([
      'import-bundle',
      file,
      '--workspace',
      join(scratch, 'nowhere'),
    ]);
    expect(result.code).toBe(1);
    expect(result.err).toContain('not a MetaKit workspace');
  });

  it('needs --out and a real file', async () => {
    const { root } = await sourceWorkspace();
    expect((await capture(['export-bundle', '--workspace', root])).code).toBe(
      1,
    );
    const bad = join(scratch, 'bad.mkbundle');
    await (await import('node:fs/promises')).writeFile(bad, 'not a zip');
    const result = await capture(['import-bundle', bad, '--workspace', root]);
    expect(result.code).toBe(1);
    expect(result.err).toContain('not a valid zip');
  });
});

describe('tool packages', () => {
  it('exports from a workspace or from a tool file, and imports as a new tool', async () => {
    const { root, toolSlug } = await sourceWorkspace();
    const fromWorkspace = join(scratch, 'a.mktool');
    const fromFile = join(scratch, 'b.mktool');
    expect(
      (
        await capture([
          'export-tool',
          toolSlug,
          '--workspace',
          root,
          '--out',
          fromWorkspace,
        ])
      ).code,
    ).toBe(0);
    expect((await capture(['export-tool', bpmn, '--out', fromFile])).code).toBe(
      0,
    );
    expect(
      Object.keys(unzipFiles(new Uint8Array(await readFile(fromFile)))),
    ).toEqual(expect.arrayContaining(['package.json', 'tool.json']));

    const target = join(scratch, 'target');
    const added = await capture([
      'import-tool',
      fromWorkspace,
      '--workspace',
      target,
      '--create',
    ]);
    expect(added.code).toBe(0);
    expect(added.out).toContain('will be added as a new tool library');
    expect((await readdir(join(target, 'tools'))).length).toBe(1);
  });

  it('shows the plan and waits for --yes before updating a tool', async () => {
    const { root } = await sourceWorkspace();
    const pkg = join(scratch, 'a.mktool');
    await capture(['export-tool', bpmn, '--out', pkg]);
    const result = await capture(['import-tool', pkg, '--workspace', root]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('Nothing in the library changes.');
    expect(result.err).toContain('--yes');
    const confirmed = await capture([
      'import-tool',
      pkg,
      '--workspace',
      root,
      '--yes',
    ]);
    expect(confirmed.code).toBe(0);
    expect(confirmed.out).toContain('Updated the tool library');
  });
});

describe('export-csv', () => {
  it('writes one file per class into a folder', async () => {
    const out = join(scratch, 'csv');
    const result = await capture([
      'export-csv',
      join(bpmn, 'order-process.mkmodel.json'),
      '--out',
      out,
      '--bom',
    ]);
    expect(result.code).toBe(0);
    const names = (await readdir(out)).sort();
    expect(names).toContain('Lane.csv');
    expect(names.every((n) => n.endsWith('.csv'))).toBe(true);
    expect(
      (await readFile(join(out, 'Lane.csv'), 'utf8')).startsWith('﻿'),
    ).toBe(true);
  });

  it('writes a zip when --out ends in .zip, reading a model from a workspace', async () => {
    const { root, modelSlug } = await sourceWorkspace();
    const out = join(scratch, 'data.zip');
    const result = await capture([
      'export-csv',
      modelSlug,
      '--workspace',
      root,
      '--out',
      out,
    ]);
    expect(result.code).toBe(0);
    const files = unzipFiles(new Uint8Array(await readFile(out)));
    expect(Object.keys(files).length).toBeGreaterThan(1);
    expect(new TextDecoder().decode(files['Lane.csv']!)).toContain(
      'id,x,y,w,h,parent_id',
    );
  });

  it('asks for --out', async () => {
    const result = await capture([
      'export-csv',
      join(bpmn, 'order-process.mkmodel.json'),
    ]);
    expect(result.code).toBe(1);
    expect(result.err).toContain('--out');
  });
});
