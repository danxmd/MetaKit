import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ModelCalculator,
  createEmptyModel,
  createModelStore,
  effectiveAttributes,
  validateModel,
  validateKit,
  type ClassId,
  type ElementId,
  type Model,
  type ModelStore,
  type RelationId,
  type Kit,
} from '@metakit-app/core';
import {
  exportMkModel,
  fromLayout,
  importMkModel,
  toLayout,
} from '@metakit-app/storage';
import {
  attachScripts,
  createBehaviour,
  generateDeclarations,
  silentHost,
  type Behaviour,
  type ScriptsHandle,
} from '@metakit-app/behaviour';
import { attachRules } from '@metakit-app/behaviour';
import { parseCached } from '@metakit-app/formula';
import { createLanguageServer } from '../components/build/scripts/script-language';
import { loadTestLibs } from '../components/build/scripts/test-libs';

/**
 * The "Agent pipeline" Kit (openspec/changes/agent-pipeline-tool): a language for pipelines in
 * which agents and humans perform tasks and create artifacts. The sample model is a code review
 * pipeline; set WRITE_SAMPLE=1 to write it again after the Kit changes.
 */

const here = (path: string) =>
  fileURLToPath(
    new URL(`../../../../kits/agent-pipeline/${path}`, import.meta.url),
  );
const kitJson = () => readFileSync(here('kit.json'), 'utf8');
const loadKit = () => JSON.parse(kitJson()) as Kit;

const byKey = <T extends { key: string; id: string }>(
  table: Record<string, T>,
  key: string,
): T => {
  const found = Object.values(table).find((x) => x.key === key);
  if (!found) throw new Error(`No ${key}`);
  return found;
};

/** Builds models through commands, naming classes, relations and attributes by their keys. */
function builder(kit: Kit, model: Model) {
  const store = createModelStore(model, { kit });
  const attrs = (cls: ClassId, values: Record<string, unknown>) => {
    const defs = effectiveAttributes(kit, cls);
    return Object.fromEntries(
      Object.entries(values).map(([k, v]) => {
        const def = defs.find((d) => d.key === k);
        if (!def) throw new Error(`${cls} has no attribute ${k}`);
        return [def.id, v];
      }),
    );
  };
  const put = (
    key: string,
    values: Record<string, unknown>,
    x: number,
    y: number,
    parent?: ElementId,
  ): ElementId => {
    const cls = byKey(kit.classes, key).id as ClassId;
    const r = store.execute({
      type: 'createElement',
      class: cls,
      x,
      y,
      ...(parent ? { parent } : {}),
      attrs: attrs(cls, values),
    } as never);
    return (r as unknown as { value: ElementId }).value;
  };
  const link = (
    key: string,
    from: ElementId,
    to: ElementId,
    values: Record<string, unknown> = {},
  ) => {
    const rel = byKey(kit.relations, key);
    const defs = rel.attributes;
    store.execute({
      type: 'createConnector',
      relation: rel.id as RelationId,
      from,
      to,
      attrs: Object.fromEntries(
        Object.entries(values).map(([k, v]) => [
          defs.find((d) => d.key === k)!.id,
          v,
        ]),
      ),
    } as never);
  };
  return { store, put, link };
}

/** The code review pipeline: a plan stage and a build stage with a human gate. */
function codeReviewPipeline(kit: Kit): Model {
  const model = createEmptyModel(
    kit,
    byKey(kit.modelTypes, 'Pipeline').id as never,
    {
      name: 'Code review pipeline',
    },
  );
  const b = builder(kit, model);
  b.store.execute({
    type: 'setAttribute',
    target: 'model',
    attr: 'att_pltitle',
    value: 'Code review pipeline',
  } as never);
  const plan = b.put('Stage', { StageName: 'Plan' }, 40, 40);
  const build = b.put('Stage', { StageName: 'Build' }, 40, 300);
  const priya = b.put(
    'Human',
    { Name: 'Priya', Role: 'Tech lead', Team: 'Platform' },
    60,
    80,
    plan,
  );
  const planner = b.put(
    'Agent',
    {
      Name: 'Planner',
      Role: 'Plans work',
      AgentKind: 'LLM agent',
      Autonomy: 'Approval',
      ModelName: 'claude-opus-5-5',
    },
    260,
    80,
    plan,
  );
  const spec = b.put(
    'Task',
    { Name: 'Write spec', Status: 'Done', Effort: 2, ActualEffort: 3 },
    60,
    180,
    plan,
  );
  const draft = b.put(
    'Task',
    { Name: 'Draft plan', Status: 'Done', Effort: 0.5, ActualEffort: 0.4 },
    330,
    180,
    plan,
  );
  const specDoc = b.put(
    'Artifact',
    { Name: 'Spec', Status: 'Approved', ApprovedBy: 'Priya' },
    460,
    50,
    plan,
  );
  const planDoc = b.put(
    'Artifact',
    { Name: 'Plan', Status: 'Approved', ApprovedBy: 'Priya' },
    600,
    50,
    plan,
  );
  const coder = b.put(
    'Agent',
    {
      Name: 'Coder',
      Role: 'Writes code',
      AgentKind: 'LLM agent',
      Autonomy: 'Autonomous',
      CostLimit: 5,
    },
    60,
    340,
    build,
  );
  const sam = b.put(
    'Human',
    { Name: 'Sam', Role: 'Reviewer', Team: 'Platform' },
    500,
    340,
    build,
  );
  const implement = b.put(
    'Task',
    { Name: 'Implement', Status: 'Running', Effort: 1, EstimatedCost: 3 },
    60,
    440,
    build,
  );
  const patch = b.put(
    'Artifact',
    { Name: 'Patch', ArtifactType: 'Code', Status: 'In review' },
    240,
    420,
    build,
  );
  const gate = b.put(
    'Gate',
    {
      Name: 'Code review',
      Criteria: 'Tests pass and the change is understood.',
      Approver: 'Sam',
    },
    400,
    440,
    build,
  );
  const merge = b.put(
    'Task',
    { Name: 'Merge', Status: 'Planned', Effort: 0.2 },
    560,
    440,
    build,
  );
  b.link('Performs', priya, spec);
  b.link('Performs', planner, draft);
  b.link('Performs', coder, implement);
  b.link('Performs', sam, merge);
  b.link('Produces', spec, specDoc);
  b.link('Feeds', specDoc, draft);
  b.link('Produces', draft, planDoc);
  b.link('Feeds', planDoc, implement);
  b.link('Produces', implement, patch);
  b.link('Approves', gate, patch);
  b.link('Feeds', patch, merge);
  b.link('HandsOverTo', spec, draft);
  b.link('HandsOverTo', draft, implement, { Handoff: 'Automatic' });
  b.link('HandsOverTo', implement, gate, { Handoff: 'Needs human' });
  b.link('HandsOverTo', gate, merge, {
    Condition: 'approved',
    Handoff: 'Needs human',
  });
  b.link('DelegatesTo', priya, planner, { Scope: 'Drafting plans' });
  return b.store.state as Model;
}

const SAMPLE = 'code-review.mkmodel.json';

describe('the Kit', () => {
  it('is valid', () => {
    expect(validateKit(loadKit())).toEqual([]);
  });

  it('has formulas that all parse', () => {
    // The Kit-level check does not read constraint formulas, so this walks every formula in the file.
    const bad: string[] = [];
    const FORMULA_KEYS = new Set(['formula', 'defaultFormula', 'if', 'when']);
    const walk = (value: unknown, path: string, key = ''): void => {
      if (typeof value === 'string') {
        const isFormula =
          value.trimStart().startsWith('=') ||
          (FORMULA_KEYS.has(key) && !path.endsWith('.when.event'));
        if (!isFormula || path.includes('scripts.')) return;
        const source = value.trimStart().startsWith('=')
          ? value.trimStart().slice(1)
          : value;
        const r = parseCached(source);
        if ('error' in r) bad.push(`${path}: ${r.error}`);
      } else if (Array.isArray(value))
        value.forEach((v, i) => walk(v, `${path}[${i}]`, key));
      else if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, k);
    };
    walk(loadKit(), 'kit');
    expect(bad).toEqual([]);
  });

  it('has the script that the Kit carries equal to its source file', () => {
    const kit = loadKit();
    expect(kit.scripts['scr_check' as never]!.source).toBe(
      readFileSync(here('check-pipeline.script.ts'), 'utf8'),
    );
  });

  it('round trips through the Git layout without a change', () => {
    const kit = loadKit();
    const layout = toLayout(kit);
    const back = fromLayout(layout);
    expect(back.issues).toEqual([]);
    expect(back.kit).toEqual(kit);
    expect(toLayout(back.kit!)).toEqual(layout);
  });

  it('has a script that type-checks against the declarations of the Kit', () => {
    const kit = loadKit();
    const server = createLanguageServer(loadTestLibs());
    server.setDeclarations(generateDeclarations(kit));
    const source = readFileSync(here('check-pipeline.script.ts'), 'utf8');
    expect(server.diagnostics(source).map((d) => d.message)).toEqual([]);
  });
});

describe('the sample pipeline', () => {
  it('has no formula or constraint problems when the formulas run', () => {
    const kit = loadKit();
    const model = importMkModel(kit, readFileSync(here(SAMPLE), 'utf8'));
    const calculator = new ModelCalculator(kit, () => model);
    const issues = validateModel(kit, model, calculator).map((i) => i.message);
    expect(issues).toEqual([]);
  });

  if (process.env['WRITE_SAMPLE'] === '1' || !existsSync(here(SAMPLE))) {
    it('writes the sample model', () => {
      const kit = loadKit();
      writeFileSync(here(SAMPLE), exportMkModel(kit, codeReviewPipeline(kit)));
    });
  }

  it('matches the model built by the test and has no problems', () => {
    const kit = loadKit();
    const stored = importMkModel(kit, readFileSync(here(SAMPLE), 'utf8'));
    const issues = validateModel(kit, stored).filter(
      (i) => i.severity === 'error',
    );
    expect(issues).toEqual([]);
    expect(Object.keys(stored.elements)).toHaveLength(
      Object.keys(codeReviewPipeline(kit).elements).length,
    );
  });
});

interface Rig {
  kit: Kit;
  store: ModelStore;
  behaviour: Behaviour;
  handle: ScriptsHandle;
  messages: { kind: string; text: string }[];
}
const rigs: Rig[] = [];
afterEach(() => {
  for (const r of rigs.splice(0)) {
    r.handle.dispose();
    r.behaviour.dispose();
  }
});
async function start(
  edit?: (
    b: ReturnType<typeof builder>,
    ids: Record<string, ElementId>,
  ) => void,
): Promise<Rig> {
  const kit = loadKit();
  const model = importMkModel(kit, readFileSync(here(SAMPLE), 'utf8'));
  const store = createModelStore(model, { kit });
  const messages: { kind: string; text: string }[] = [];
  const behaviour = createBehaviour({
    store,
    kit: () => kit,
    host: silentHost({
      message: (kind, text) => messages.push({ kind, text }),
    }),
  });
  attachRules(behaviour, { store, kit: () => kit });
  const handle = await attachScripts(behaviour, {
    store,
    kit: () => kit,
    permissions: {
      granted: () => ({ network: false, files: false }),
      request: () => Promise.resolve(true),
      forget: () => Promise.resolve(),
    },
  });
  const rig = { kit, store, behaviour, handle, messages };
  rigs.push(rig);
  if (edit) {
    const ids = Object.fromEntries(
      Object.values(store.state.elements).map((e) => [
        String(
          e.attrs[
            Object.values(kit.classes)
              .flatMap((c) => c.attributes)
              .find((a) => a.key === 'Name' || a.key === 'StageName')!
              .id as never
          ] ?? e.id,
        ),
        e.id,
      ]),
    );
    edit({ store, put: () => '' as ElementId, link: () => undefined }, ids);
  }
  return rig;
}

describe('Check pipeline', () => {
  const run = async (r: Rig) => {
    r.behaviour.commands.get('script:check-pipeline')!.run(null);
    await r.handle.engine!.ready();
  };

  it('finds the sample sound', async () => {
    const r = await start();
    await run(r);
    expect(
      r.handle.log.filter((l) => l.level === 'error').map((l) => l.text),
    ).toEqual([]);
    expect(r.messages).toEqual([
      { kind: 'info', text: 'The pipeline looks sound.' },
    ]);
  });

  it('names a task nobody performs, a loop and an unapproved artifact', async () => {
    const r = await start();
    const st = r.store;
    const model = st.state as Model;
    const idOf = (name: string) =>
      Object.values(model.elements).find((e) =>
        Object.values(e.attrs).includes(name as never),
      )!.id;
    const performs = byKey(r.kit.relations, 'Performs').id;
    const handover = byKey(r.kit.relations, 'HandsOverTo').id;
    const approves = byKey(r.kit.relations, 'Approves').id;
    // Nobody performs "Merge" any more.
    for (const c of Object.values(model.connectors))
      if (c.relation === performs && c.to === idOf('Merge'))
        st.execute({ type: 'delete', id: c.id } as never);
    // The gate no longer approves the patch, but the merge still uses it.
    for (const c of Object.values(model.connectors))
      if (c.relation === approves)
        st.execute({ type: 'delete', id: c.id } as never);
    // Merge hands back to Implement: a loop.
    st.execute({
      type: 'createConnector',
      relation: handover,
      from: idOf('Merge'),
      to: idOf('Implement'),
    } as never);
    await run(r);
    const text = r.messages.map((m) => m.text).join('\n');
    expect(text).toContain('Task "Merge": nobody performs it.');
    expect(text).toContain('Artifact "Patch" is made by an autonomous agent');
    expect(text).toContain('Loop in the hand-overs');
  });
});

describe('status commands', () => {
  it('sets the status of the selected task and undoes in one step', async () => {
    const r = await start();
    const model = r.store.state as Model;
    const merge = Object.values(model.elements).find((e) =>
      Object.values(e.attrs).includes('Merge' as never),
    )!;
    const status = byKey(
      Object.fromEntries(
        r.kit.classes['cls_task' as never]!.attributes.map((a) => [a.id, a]),
      ),
      'Status',
    );
    r.behaviour.commands.get('rule_ready')!.run(merge.id);
    expect(
      (r.store.state as Model).elements[merge.id]!.attrs[status.id as never],
    ).toBe('Ready');
    r.store.undo();
    expect(
      (r.store.state as Model).elements[merge.id]!.attrs[status.id as never],
    ).toBe('Planned');
  });

  it('reports the totals', async () => {
    const r = await start();
    r.behaviour.commands.get('rule_totals')!.run(null);
    expect(r.messages.at(-1)!.text).toContain(
      'Estimated: 3.7 h and $3 in 4 tasks.',
    );
  });
});
