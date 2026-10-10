import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getVersion, run } from './index';

const kitsDir = fileURLToPath(new URL('../../../kits', import.meta.url));
const bpmn = join(kitsDir, 'bpmn-lite');
const erLite = join(kitsDir, 'er-lite');
const portfolio = join(kitsDir, 'ai-use-case-portfolio');
const dataGovernance = join(kitsDir, 'data-governance');

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
  scratch = await mkdtemp(join(tmpdir(), 'metakit-cli-'));
});
afterEach(async () => {
  await rm(scratch, { recursive: true, force: true });
});

describe('basics', () => {
  it('reads the version from package.json', () => {
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints the version for --version and for no arguments', async () => {
    expect(await capture(['--version'])).toEqual({
      code: 0,
      out: getVersion(),
      err: '',
    });
    expect((await capture([])).out).toBe(getVersion());
  });

  it('prints usage for an unknown command, listing validate and export', async () => {
    const result = await capture(['frobnicate']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('Unknown command "frobnicate"');
    expect(result.err).toContain('validate');
    expect(result.err).toContain('export');
  });

  it('lists the commands under their new names and the older names separately in --help', async () => {
    const help = await capture(['--help']);
    expect(help.code).toBe(0);
    expect(help.out).toContain('  export-kit <kit>');
    expect(help.out).toContain('  import-kit <file>');
    expect(help.out).toContain('--kit <path>');
    expect(help.out).toContain('--no-kit');
    const older = help.out.slice(help.out.indexOf('Older names'));
    expect(older).toContain('export-tool, import-tool');
    expect(older).toContain('--tool, --no-tool');
    expect(help.out.indexOf('Older names')).toBeGreaterThan(
      help.out.indexOf('export-csv'),
    );
  });

  it('names the flag as it was typed when its value is missing', async () => {
    const result = await capture(['validate', bpmn, '--tool']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('--tool needs a value.');
  });

  it('rejects unknown options and a missing path', async () => {
    expect((await capture(['validate', '--nope', bpmn])).code).toBe(1);
    expect((await capture(['validate'])).code).toBe(1);
  });
});

describe('validate', () => {
  it('accepts the sample Kits', async () => {
    for (const dir of [bpmn, erLite, portfolio]) {
      const result = await capture(['validate', dir]);
      expect(result.code).toBe(0);
      expect(result.out).toContain('0 errors, 0 warnings');
    }
  });

  it('accepts the Data and AI architecture Kit and finds the one warning its sample shows on purpose', async () => {
    const dir = join(kitsDir, 'data-ai-architecture');
    const kit = await capture(['validate', dir]);
    expect(kit.code).toBe(0);
    expect(kit.out).toContain('0 errors, 0 warnings');
    const sample = await capture([
      'validate',
      join(dir, 'customer-360.mkmodel.json'),
    ]);
    expect(sample.code).toBe(0);
    expect(sample.out).toContain('0 errors, 1 warning');
    expect(sample.out).toContain('Event archive');
  });

  it('accepts the data governance sample and shows the two gaps it is built to have', async () => {
    const kit = await capture(['validate', dataGovernance]);
    expect(kit.code).toBe(0);
    expect(kit.out).toContain('0 errors, 0 warnings');
    const result = await capture([
      'validate',
      join(dataGovernance, 'sales-finance.mkmodel.json'),
    ]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('0 errors, 2 warnings');
    expect(result.out).toContain('[degree-below-min]');
    expect(result.out).toContain('needs a policy ("Governed by")');
  });

  it('finds the Kit next to a model file and shows no warnings for the samples', async () => {
    const result = await capture([
      'validate',
      join(bpmn, 'order-process.mkmodel.json'),
    ]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('0 errors, 0 warnings');
  });

  it('names the file and the path of a broken Kit', async () => {
    const dir = join(scratch, 'broken');
    await cp(bpmn, dir, { recursive: true });
    const file = join(dir, 'kit.json');
    const kit = JSON.parse(await readFile(file, 'utf8'));
    kit.classes[Object.keys(kit.classes)[0]!].extends = 'cls_missing00';
    await writeFile(file, JSON.stringify(kit, null, 2) + '\n');
    const result = await capture(['validate', dir]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('kit.json');
    expect(result.out).toContain('cls_missing00');
  });

  it('still reads a Kit folder, and the Kit of a model, under the older name tool.json', async () => {
    const dir = join(scratch, 'older');
    await mkdir(dir, { recursive: true });
    await cp(join(bpmn, 'kit.json'), join(dir, 'tool.json'));
    await cp(
      join(bpmn, 'order-process.mkmodel.json'),
      join(dir, 'order-process.mkmodel.json'),
    );
    const folder = await capture(['validate', dir]);
    expect(folder.code).toBe(0);
    expect(folder.out).toContain('tool.json');
    const model = await capture([
      'validate',
      join(dir, 'order-process.mkmodel.json'),
    ]);
    expect(model.code).toBe(0);
  });

  it('exits 0 on warnings, and 1 with --strict', async () => {
    const model = join(scratch, 'two-starts.mkmodel.json');
    const doc = JSON.parse(
      await readFile(join(bpmn, 'order-process.mkmodel.json'), 'utf8'),
    );
    const start = doc.elements.find(
      (e: { class: string }) => e.class === 'StartEvent',
    );
    expect(start).toBeDefined();
    doc.elements.push({ ...start, id: 'start2', y: 400, parent: undefined });
    await writeFile(model, JSON.stringify(doc, null, 2) + '\n');
    const kit = ['--kit', join(bpmn, 'kit.json')];

    const lenient = await capture(['validate', model, ...kit]);
    expect(lenient.code).toBe(0);
    expect(lenient.out).toContain('count-above-max');

    const strict = await capture(['validate', model, ...kit, '--strict']);
    expect(strict.code).toBe(1);

    // The flag's name from before the Kit rename still works.
    const older = await capture([
      'validate',
      model,
      '--tool',
      join(bpmn, 'kit.json'),
      '--strict',
    ]);
    expect(older.code).toBe(1);
    expect(older.out).toContain('count-above-max');
  });

  it('prints JSON with --json', async () => {
    const result = await capture(['validate', bpmn, '--json']);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.out) as {
      documents: { kind: string }[];
    };
    // "kit" since the Kit rename; releases before it said "tool".
    expect(report.documents.map((d) => d.kind)).toEqual(['kit']);
  });

  it('validates a workspace folder document by document', async () => {
    const ws = join(scratch, 'ws');
    await cp(bpmn, join(ws, 'tools', 'bpmn-lite'), { recursive: true });
    await writeFile(
      join(ws, 'workspace.json'),
      JSON.stringify({ format: 1, kind: 'workspace' }, null, 2) + '\n',
    );
    const result = await capture(['validate', ws]);
    // Whether the layout is accepted is the workspace reader's call; the CLI must report, not crash.
    expect([0, 1]).toContain(result.code);
    expect(result.out + result.err).not.toBe('');
  });

  it('validates a workspace from before the Kit rename, with Kits in tools/ and kits/', async () => {
    const ws = join(scratch, 'old');
    await cp(
      fileURLToPath(
        new URL(
          '../../../packages/storage/fixtures/before-kit-rename/workspace',
          import.meta.url,
        ),
      ),
      ws,
      { recursive: true },
    );
    const pkg = join(scratch, 'er.mkkit');
    expect((await capture(['export-kit', erLite, '--out', pkg])).code).toBe(0);
    expect((await capture(['import-kit', pkg, '--workspace', ws])).code).toBe(
      0,
    );
    const result = await capture(['validate', ws]);
    expect(result.err).toBe('');
    expect(result.code).toBe(0);
    expect(result.out).toContain('tools/bpmn-lite');
    expect(result.out).toContain('kits/er-lite');
    expect(result.out).toContain('models/order-process-old1');
  });
});

describe('export', () => {
  it('writes an editable model file to the standard output', async () => {
    const result = await capture([
      'export',
      join(bpmn, 'order-process.mkmodel.json'),
      '--format',
      'json',
    ]);
    expect(result.code).toBe(0);
    const doc = JSON.parse(result.out);
    expect(Array.isArray(doc.elements)).toBe(true);
  });

  it('writes to --out', async () => {
    const out = join(scratch, 'copy.mkmodel.json');
    const result = await capture([
      'export',
      join(bpmn, 'order-process.mkmodel.json'),
      '--format',
      'json',
      '--out',
      out,
    ]);
    expect(result.code).toBe(0);
    expect((await readFile(out, 'utf8')).endsWith('\n')).toBe(true);
  });

  it('refuses an unsupported format', async () => {
    const result = await capture([
      'export',
      join(bpmn, 'order-process.mkmodel.json'),
      '--format',
      'xml',
    ]);
    expect(result.code).toBe(1);
  });
});
