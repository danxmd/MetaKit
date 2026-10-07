import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createModelStore,
  validateToolLibrary,
  type Rule,
  type Script,
  type ToolLibrary,
} from '@metakit-app/core';
import { importMkModel } from '@metakit-app/storage';
import {
  attachScripts,
  createBehaviour,
  generateDeclarations,
  silentHost,
  type Behaviour,
  type BehaviourHost,
  type ScriptsHandle,
} from '@metakit-app/behaviour';
import { createLanguageServer } from '../components/build/scripts/script-language';
import { loadTestLibs } from '../components/build/scripts/test-libs';

/**
 * The three behaviours chosen from ADOxx tools (docs/phase-7-behaviour-candidates.md), rebuilt as
 * scripts and rules. The sources live in tools/behaviour-examples and are run here against the
 * sample tool libraries and models of tools/.
 */

const read = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../../../tools/${path}`, import.meta.url)),
    'utf8',
  );

const script = (id: string, name: string, file: string): Script => ({
  id: id as Script['id'],
  name,
  source: read(`behaviour-examples/${file}`),
});

interface Rig {
  tool: ToolLibrary;
  behaviour: Behaviour;
  handle: ScriptsHandle;
  store: ReturnType<typeof createModelStore>;
  messages: { kind: string; text: string }[];
}

const open: Rig[] = [];
afterEach(() => {
  for (const r of open.splice(0)) {
    r.handle.dispose();
    r.behaviour.dispose();
  }
});

async function start(
  toolName: string,
  modelFile: string,
  scripts: Script[],
  options: {
    permissions?: ToolLibrary['manifest']['permissions'];
    host?: Partial<BehaviourHost>;
  } = {},
): Promise<Rig> {
  const tool = JSON.parse(read(`${toolName}/tool.json`)) as ToolLibrary;
  tool.scripts = Object.fromEntries(scripts.map((s) => [s.id, s]));
  if (options.permissions) tool.manifest.permissions = options.permissions;
  const model = importMkModel(tool, read(`${toolName}/${modelFile}`));
  const store = createModelStore(model, { tool });
  const messages: { kind: string; text: string }[] = [];
  const behaviour = createBehaviour({
    store,
    tool: () => tool,
    host: silentHost({
      message: (kind, text) => messages.push({ kind, text }),
      ...options.host,
    }),
  });
  const handle = await attachScripts(behaviour, {
    store,
    tool: () => tool,
    permissions: {
      granted: () => ({
        network: false,
        files: options.permissions?.files === true,
      }),
      request: () => Promise.resolve(true),
      forget: () => Promise.resolve(),
    },
  });
  const rig = { tool, behaviour, handle, store, messages };
  open.push(rig);
  return rig;
}

const problems = (handle: ScriptsHandle) =>
  handle.log.filter((l) => l.level === 'error').map((l) => l.text);

describe('every example script', () => {
  it('type-checks against the declarations generated from its tool', () => {
    const libs = loadTestLibs();
    const cases: [string, Script][] = [
      [
        'bpmn-lite',
        script('scr_gateways', 'Check gateways', 'gateway-check.script.ts'),
      ],
      [
        'bpmn-lite',
        script('scr_effort', 'Total effort', 'total-effort.script.ts'),
      ],
      ['er-lite', script('scr_sql', 'Export SQL', 'er-to-sql.script.ts')],
    ];
    for (const [toolName, s] of cases) {
      const tool = JSON.parse(read(`${toolName}/tool.json`)) as ToolLibrary;
      const server = createLanguageServer(libs);
      server.setDeclarations(generateDeclarations(tool));
      expect(
        server.diagnostics(s.source).map((d) => d.message),
        s.name,
      ).toEqual([]);
    }
  });
});

describe('candidate 1: check gateways (BPMN lite, script)', () => {
  const gateways = script(
    'scr_gateways',
    'Check gateways',
    'gateway-check.script.ts',
  );

  it('finds nothing wrong in the sample order process', async () => {
    const r = await start('bpmn-lite', 'order-process.mkmodel.json', [
      gateways,
    ]);
    r.behaviour.commands.get('script:check-gateways')!.run(null);
    await r.handle.engine!.ready();
    expect(problems(r.handle)).toEqual([]);
    expect(r.messages).toEqual([
      { kind: 'info', text: 'All gateways are fine.' },
    ]);
  });

  it('names the flows without a condition and a gateway that leads nowhere', async () => {
    const r = await start('bpmn-lite', 'order-process.mkmodel.json', [
      gateways,
    ]);
    const m = r.store.state;
    const condition = Object.values(r.tool.relations)[0]!.attributes.find(
      (a) => a.key === 'Condition',
    )!;
    const flow = Object.values(m.connectors).find(
      (c) => c.attrs[condition.id] === 'no',
    )!;
    r.store.execute({
      type: 'setAttribute',
      target: flow.id,
      attr: condition.id,
      value: '',
    });
    const classId = (key: string) =>
      Object.values(r.tool.classes).find((c) => c.key === key)!.id;
    const nameId = Object.values(r.tool.classes)
      .flatMap((c) => c.attributes)
      .find((a) => a.key === 'Name')!.id;
    r.store.execute({
      type: 'createElement',
      class: classId('Gateway'),
      x: 500,
      y: 20,
      attrs: { [nameId]: 'Extra' },
    });
    await r.handle.runScript('scr_gateways', null);
    expect(r.messages).toEqual([
      {
        kind: 'warning',
        text: 'Approved?: the flow to "Reject order" has no condition.\nExtra: nothing follows this gateway.',
      },
    ]);
  });
});

describe('candidate 2: total effort (BPMN lite, rule and script)', () => {
  const rule: Rule = JSON.parse(
    read('behaviour-examples/total-effort.rule.json'),
  );

  it('the rule is valid in the tool and its message formula adds up the effort of the tasks', async () => {
    const r = await start('bpmn-lite', 'order-process.mkmodel.json', []);
    const tool = { ...r.tool, rules: { [rule.id]: rule } };
    expect(validateToolLibrary(tool)).toEqual([]);
    const action = rule.then[0]! as { action: 'message'; text: string };
    const result = r.behaviour.calculator.evaluate(null, action.text);
    expect(result.error).toBeUndefined();
    expect(result.value).toBe('Total effort: 4 h in 3 tasks.');
  });

  it('the script adds a breakdown by lane and leaves the model alone', async () => {
    const r = await start('bpmn-lite', 'order-process.mkmodel.json', [
      script('scr_effort', 'Total effort', 'total-effort.script.ts'),
    ]);
    const before = r.store.state;
    await r.handle.runScript('scr_effort', null);
    expect(problems(r.handle)).toEqual([]);
    expect(r.messages).toEqual([
      { kind: 'info', text: 'Total effort: 4 h in 3 tasks.\nSales: 4 h' },
    ]);
    expect(r.store.state).toBe(before);
  });
});

describe('candidate 3: export the ER diagram as SQL (ER lite, script with files permission)', () => {
  const sql = script('scr_sql', 'Export SQL', 'er-to-sql.script.ts');

  it('writes a table for each entity and one for each relationship, through the save dialog', async () => {
    const saved: { name: string; text: string }[] = [];
    const r = await start('er-lite', 'library.mkmodel.json', [sql], {
      permissions: { files: true },
      host: {
        saveFile: (name, text) => (
          saved.push({ name, text }),
          Promise.resolve(true)
        ),
      },
    });
    await r.handle.runScript('scr_sql', null);
    expect(problems(r.handle)).toEqual([]);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toBe('schema.sql');
    expect(saved[0]!.text).toBe(
      [
        'CREATE TABLE book (\n  isbn TEXT NOT NULL,\n  title TEXT,\n  PRIMARY KEY (isbn)\n);',
        'CREATE TABLE author (\n  born DATE\n);',
        'CREATE TABLE writes (\n  book_isbn TEXT NOT NULL REFERENCES book (isbn)\n);',
      ].join('\n\n') + '\n',
    );
    // The author has no key, which the script says instead of guessing.
    expect(r.messages.at(-1)?.text).toBe(
      'Saved. Note: "Author" has no key attribute.',
    );
  });

  it('does nothing without the files permission, and says why', async () => {
    const saved: string[] = [];
    const r = await start('er-lite', 'library.mkmodel.json', [sql], {
      host: { saveFile: (n) => (saved.push(n), Promise.resolve(true)) },
    });
    await r.handle.runScript('scr_sql', null);
    expect(saved).toEqual([]);
    expect(problems(r.handle)[0]).toMatch(/does not say it needs to/);
  });
});
