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
import type { Kit } from '@metakit-app/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './index';

const kitsDir = fileURLToPath(new URL('../../../kits', import.meta.url));
const bpmn = join(kitsDir, 'bpmn-lite');

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
  const kit = migrate(
    'kit-document',
    JSON.parse(await readFile(join(bpmn, 'kit.json'), 'utf8')),
  ).value as unknown as Kit;
  const kitSlug = await ws.createKit(kit);
  const model = importMkModel(
    kit,
    await readFile(join(bpmn, 'order-process.mkmodel.json'), 'utf8'),
  );
  const modelSlug = await ws.createModel(model);
  return { root, ws, kit, kitSlug, model, modelSlug };
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

describe('Kit packages', () => {
  it('exports from a workspace or from a Kit file, and imports as a new Kit', async () => {
    const { root, kitSlug } = await sourceWorkspace();
    const fromWorkspace = join(scratch, 'a.mkkit');
    const fromFile = join(scratch, 'b.mkkit');
    expect(
      (
        await capture([
          'export-kit',
          kitSlug,
          '--workspace',
          root,
          '--out',
          fromWorkspace,
        ])
      ).code,
    ).toBe(0);
    expect((await capture(['export-kit', bpmn, '--out', fromFile])).code).toBe(
      0,
    );
    expect(
      Object.keys(unzipFiles(new Uint8Array(await readFile(fromFile)))),
    ).toEqual(expect.arrayContaining(['package.json', 'kit.json']));

    const target = join(scratch, 'target');
    const added = await capture([
      'import-kit',
      fromWorkspace,
      '--workspace',
      target,
      '--create',
    ]);
    expect(added.code).toBe(0);
    expect(added.out).toContain('will be added as a new Kit');
    expect(added.out).toContain('Added the Kit as kits/');
    expect((await readdir(join(target, 'kits'))).length).toBe(1);
  });

  it('shows the plan and waits for --yes before updating a Kit', async () => {
    const { root } = await sourceWorkspace();
    const pkg = join(scratch, 'a.mktool');
    await capture(['export-kit', bpmn, '--out', pkg]);
    const result = await capture(['import-kit', pkg, '--workspace', root]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('Nothing in the Kit changes.');
    expect(result.err).toContain('--yes');
    const confirmed = await capture([
      'import-kit',
      pkg,
      '--workspace',
      root,
      '--yes',
    ]);
    expect(confirmed.code).toBe(0);
    expect(confirmed.out).toContain('Updated the Kit');
  });

  it('keeps the names from before the Kit rename: export-tool, import-tool and --no-tool', async () => {
    const { root } = await sourceWorkspace();
    const pkg = join(scratch, 'old-name.mkkit');
    expect((await capture(['export-tool', bpmn, '--out', pkg])).code).toBe(0);
    const target = join(scratch, 'old-target');
    const added = await capture([
      'import-tool',
      pkg,
      '--workspace',
      target,
      '--create',
    ]);
    expect(added.code).toBe(0);
    expect(added.out).toContain('Added the Kit as kits/');

    for (const flags of [[], ['--no-kit'], ['--no-tool']]) {
      const file = join(scratch, `bundle${flags.join('')}.mkbundle`);
      const exported = await capture([
        'export-bundle',
        '--workspace',
        root,
        '--out',
        file,
        ...flags,
      ]);
      expect(exported.code).toBe(0);
      const names = Object.keys(
        unzipFiles(new Uint8Array(await readFile(file))),
      );
      expect(names.includes('kit/kit.json')).toBe(flags.length === 0);
    }
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
