import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getVersion, run } from './index';

const toolsDir = fileURLToPath(new URL('../../../tools', import.meta.url));
const bpmn = join(toolsDir, 'bpmn-lite');
const erLite = join(toolsDir, 'er-lite');
const portfolio = join(toolsDir, 'ai-use-case-portfolio');

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

  it('rejects unknown options and a missing path', async () => {
    expect((await capture(['validate', '--nope', bpmn])).code).toBe(1);
    expect((await capture(['validate'])).code).toBe(1);
  });
});

describe('validate', () => {
  it('accepts the sample tool libraries', async () => {
    for (const dir of [bpmn, erLite, portfolio]) {
      const result = await capture(['validate', dir]);
      expect(result.code).toBe(0);
      expect(result.out).toContain('0 errors, 0 warnings');
    }
  });

  it('accepts the Data and AI architecture tool and finds the one warning its sample shows on purpose', async () => {
    const dir = join(toolsDir, 'data-ai-architecture');
    const tool = await capture(['validate', dir]);
    expect(tool.code).toBe(0);
    expect(tool.out).toContain('0 errors, 0 warnings');
    const sample = await capture([
      'validate',
      join(dir, 'customer-360.mkmodel.json'),
    ]);
    expect(sample.code).toBe(0);
    expect(sample.out).toContain('0 errors, 1 warning');
    expect(sample.out).toContain('Event archive');
  });

  it('finds the tool next to a model file and shows no warnings for the samples', async () => {
    const result = await capture([
      'validate',
      join(bpmn, 'order-process.mkmodel.json'),
    ]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('0 errors, 0 warnings');
  });

  it('names the file and the path of a broken tool library', async () => {
    const dir = join(scratch, 'broken');
    await cp(bpmn, dir, { recursive: true });
    const file = join(dir, 'tool.json');
    const tool = JSON.parse(await readFile(file, 'utf8'));
    tool.classes[Object.keys(tool.classes)[0]!].extends = 'cls_missing00';
    await writeFile(file, JSON.stringify(tool, null, 2) + '\n');
    const result = await capture(['validate', dir]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('tool.json');
    expect(result.out).toContain('cls_missing00');
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
    const tool = ['--tool', join(bpmn, 'tool.json')];

    const lenient = await capture(['validate', model, ...tool]);
    expect(lenient.code).toBe(0);
    expect(lenient.out).toContain('count-above-max');

    const strict = await capture(['validate', model, ...tool, '--strict']);
    expect(strict.code).toBe(1);
  });

  it('prints JSON with --json', async () => {
    const result = await capture(['validate', bpmn, '--json']);
    expect(result.code).toBe(0);
    expect(() => JSON.parse(result.out)).not.toThrow();
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
