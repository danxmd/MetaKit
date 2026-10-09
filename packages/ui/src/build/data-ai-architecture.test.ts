import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ModelCalculator,
  createEmptyModel,
  createModelStore,
  effectiveAttributes,
  validateModel,
  validateToolLibrary,
  type ClassId,
  type ElementId,
  type Model,
  type ModelStore,
  type NodeShape,
  type RelationId,
  type RelationShape,
  type ShapeId,
  type ToolLibrary,
} from '@metakit-app/core';
import { exportMkModel, importMkModel } from '@metakit-app/storage';
import {
  attachRules,
  attachScripts,
  createBehaviour,
  generateDeclarations,
  silentHost,
  type Behaviour,
  type ScriptsHandle,
} from '@metakit-app/behaviour';
import { parseCached } from '@metakit-app/formula';
import { nodeShapeFromLook, relationShapeFromLook } from '@metakit-app/shapes';
import { createLanguageServer } from '../components/build/scripts/script-language';
import { loadTestLibs } from '../components/build/scripts/test-libs';

/**
 * The built-in "Data and AI architecture" tool (openspec/changes/ai-data-catalog): sources,
 * pipelines, stores, datasets, models, AI services and consumers connected by data flows. The
 * sample model is a customer 360 platform with a churn model; set WRITE_SAMPLE=1 to write it
 * again after the tool library changes.
 */

const here = (path: string) =>
  fileURLToPath(
    new URL(`../../../../tools/data-ai-architecture/${path}`, import.meta.url),
  );
const loadTool = () =>
  JSON.parse(readFileSync(here('tool.json'), 'utf8')) as ToolLibrary;
// Windows checkouts may turn the line ends of the script file into CRLF.
const scriptFile = () =>
  readFileSync(here('show-lineage.script.ts'), 'utf8').replace(/\r\n/g, '\n');

const byKey = <T extends { key: string; id: string }>(
  table: Record<string, T>,
  key: string,
): T => {
  const found = Object.values(table).find((x) => x.key === key);
  if (!found) throw new Error(`No ${key}`);
  return found;
};

/** Builds models through commands, naming classes, relations and attributes by their keys. */
function builder(tool: ToolLibrary, model: Model) {
  const store = createModelStore(model, { tool });
  const attrs = (cls: ClassId, values: Record<string, unknown>) => {
    const defs = effectiveAttributes(tool, cls);
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
    const cls = byKey(tool.classes, key).id as ClassId;
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
    const rel = byKey(tool.relations, key);
    const defs = rel.attributes;
    store.execute({
      type: 'createConnector',
      relation: rel.id as RelationId,
      from,
      to,
      attrs: Object.fromEntries(
        Object.entries(values).map(([k, v]) => {
          const def = defs.find((d) => d.key === k);
          if (!def) throw new Error(`${key} has no attribute ${k}`);
          return [def.id, v];
        }),
      ),
    } as never);
  };
  return { store, put, link };
}

/**
 * Customer data from a CRM, web events and billing lands in a raw zone, is curated in a
 * lakehouse and feeds a churn model whose scores reach a dashboard and the CRM app. The event
 * archive is not approved for personal data, and the event stream carries it there: the one
 * warning of the sample, on purpose.
 */
function customer360(tool: ToolLibrary): Model {
  const model = createEmptyModel(
    tool,
    byKey(tool.modelTypes, 'Architecture').id as never,
    { name: 'Customer 360 and churn model' },
  );
  const b = builder(tool, model);
  b.store.execute({
    type: 'setAttribute',
    target: 'model',
    attr: 'att_datitle',
    value: 'Customer 360 and churn model',
  } as never);
  b.store.execute({
    type: 'setAttribute',
    target: 'model',
    attr: 'att_dapurpose',
    value:
      'One view of each customer, and a model that predicts which customers are likely to leave.',
  } as never);

  const raw = b.put('Zone', { Name: 'Raw zone', Layer: 'Raw' }, 260, 20);
  const curated = b.put(
    'Zone',
    { Name: 'Curated zone', Layer: 'Curated' },
    820,
    20,
  );
  const serving = b.put(
    'Zone',
    { Name: 'Serving zone', Layer: 'Serving' },
    1380,
    20,
  );

  const crm = b.put(
    'SourceSystem',
    { Name: 'CRM', Technology: 'CRM', Owner: 'Sales operations' },
    20,
    60,
  );
  const web = b.put(
    'SourceSystem',
    { Name: 'Web events', Technology: 'Web analytics', Owner: 'Digital team' },
    20,
    200,
  );
  const billing = b.put(
    'SourceSystem',
    { Name: 'Billing', Technology: 'Billing system', Owner: 'Finance' },
    20,
    340,
  );
  const batch = b.put(
    'Ingestion',
    { Name: 'Batch import', Mode: 'Batch', Schedule: 'Nightly' },
    290,
    100,
    raw,
  );
  const stream = b.put(
    'Ingestion',
    { Name: 'Event stream', Mode: 'Streaming' },
    290,
    220,
    raw,
  );
  const landing = b.put(
    'DataStore',
    {
      Name: 'Landing store',
      Kind: 'Lake',
      Region: 'Home region',
      ApprovedForPersonalData: true,
    },
    560,
    100,
    raw,
  );
  const archive = b.put(
    'DataStore',
    { Name: 'Event archive', Kind: 'Lake', ApprovedForPersonalData: false },
    560,
    220,
    raw,
  );
  const clean = b.put(
    'DataPipeline',
    {
      Name: 'Clean and join',
      Engine: 'SQL jobs',
      Schedule: 'Daily',
      Transformation:
        'Removes duplicates, joins customers across systems and adds session counts.',
    },
    850,
    100,
    curated,
  );
  const lakehouse = b.put(
    'DataStore',
    {
      Name: 'Lakehouse',
      Kind: 'Lakehouse',
      Region: 'Home region',
      ApprovedForPersonalData: true,
      Owner: 'Data platform team',
    },
    1100,
    100,
    curated,
  );
  const profile = b.put(
    'Dataset',
    {
      Name: 'Customer profile',
      Format: 'Table',
      Refresh: 'Daily',
      Classification: 'Restricted',
      ContainsPersonalData: true,
      Owner: 'Customer data team',
    },
    970,
    200,
    curated,
  );
  const features = b.put(
    'DataPipeline',
    {
      Name: 'Feature build',
      Engine: 'SQL jobs',
      Schedule: 'Daily',
      Transformation: 'Turns profiles into pseudonymous churn features.',
    },
    1410,
    100,
    serving,
  );
  const featureStore = b.put(
    'DataStore',
    {
      Name: 'Feature store',
      Kind: 'Feature store',
      ApprovedForPersonalData: false,
    },
    1660,
    100,
    serving,
  );
  const churnFeatures = b.put(
    'Dataset',
    {
      Name: 'Churn features',
      Format: 'Table',
      Refresh: 'Daily',
      Classification: 'Confidential',
      ContainsPersonalData: false,
      Owner: 'Data science team',
    },
    1530,
    200,
    serving,
  );
  const churn = b.put(
    'MLModel',
    {
      Name: 'Churn model',
      Task: 'Classification',
      Framework: 'Gradient boosting',
      Version: '1.2',
      Metric: 'AUC',
      Score: 0.87,
      Owner: 'Data science team',
    },
    1530,
    380,
  );
  const api = b.put(
    'AIService',
    { Name: 'Churn score API', Kind: 'API', Endpoint: '/churn/score' },
    1530,
    520,
  );
  const dashboard = b.put(
    'Consumer',
    { Name: 'Retention dashboard', Kind: 'Dashboard', Audience: 'Internal' },
    1110,
    520,
  );
  const crmApp = b.put(
    'Consumer',
    { Name: 'CRM app', Kind: 'Application', Audience: 'Internal' },
    1900,
    520,
  );

  const pd = { ContainsPersonalData: true };
  b.link('FlowsTo', crm, batch, { ...pd, Format: 'Extract' });
  b.link('FlowsTo', billing, batch, { ...pd, Format: 'Extract' });
  b.link('FlowsTo', web, stream, {
    ...pd,
    Frequency: 'Streaming',
    Format: 'Events',
  });
  b.link('FlowsTo', batch, landing, pd);
  // The deliberate problem: personal data lands in a store nobody approved for it.
  b.link('FlowsTo', stream, archive, { ...pd, Frequency: 'Streaming' });
  b.link('FlowsTo', landing, clean, pd);
  b.link('FlowsTo', archive, clean, pd);
  b.link('FlowsTo', clean, lakehouse, pd);
  b.link('FlowsTo', lakehouse, profile, pd);
  b.link('FlowsTo', profile, features, pd);
  b.link('FlowsTo', features, featureStore);
  b.link('FlowsTo', featureStore, churnFeatures);
  b.link('FlowsTo', profile, dashboard, { ...pd, Frequency: 'On demand' });
  b.link('TrainsOn', churn, churnFeatures);
  b.link('Serves', churn, api, { Channel: 'Model call' });
  b.link('Serves', api, dashboard, { Channel: 'Nightly scores' });
  b.link('Serves', api, crmApp, { Channel: 'API call' });
  return b.store.state as Model;
}

const SAMPLE = 'customer-360.mkmodel.json';
const loadSample = (tool: ToolLibrary) =>
  importMkModel(tool, readFileSync(here(SAMPLE), 'utf8'));

const problems = (tool: ToolLibrary, model: Model) =>
  validateModel(tool, model, new ModelCalculator(tool, () => model));

describe('the tool library', () => {
  it('is valid', () => {
    expect(validateToolLibrary(loadTool())).toEqual([]);
  });

  it('has formulas that all parse', () => {
    // The tool-level check does not read constraint formulas, so this walks every formula in the file.
    const bad: string[] = [];
    const FORMULA_KEYS = new Set(['formula', 'defaultFormula', 'if', 'when']);
    let seen = 0;
    const walk = (value: unknown, path: string, key = ''): void => {
      if (typeof value === 'string') {
        const isFormula =
          value.trimStart().startsWith('=') ||
          (FORMULA_KEYS.has(key) && !path.endsWith('.when.event'));
        if (!isFormula || path.includes('scripts.')) return;
        seen += 1;
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
    walk(loadTool(), 'tool');
    expect(bad).toEqual([]);
    expect(seen).toBeGreaterThan(10);
  });

  it('draws every class and relation class with a simple look the look editor can open', () => {
    const tool = loadTool();
    for (const owner of [
      ...Object.values(tool.classes).filter((c) => !c.abstract),
      ...Object.values(tool.relations),
    ]) {
      const shape = tool.shapes[owner.shape as ShapeId]!;
      expect(shape, owner.key).toBeDefined();
      expect(shape.look, owner.key).toBeDefined();
      const again =
        shape.kind === 'node'
          ? nodeShapeFromLook((shape as NodeShape).look!, shape.id, shape.name)
          : relationShapeFromLook(
              (shape as RelationShape).look!,
              shape.id,
              shape.name,
            );
      expect(again).toEqual(shape);
    }
  });

  it('has the script that the tool carries equal to its source file', () => {
    expect(loadTool().scripts['scr_lineage' as never]!.source).toBe(
      scriptFile(),
    );
  });

  it('has a script that type-checks against the declarations of the tool', () => {
    const server = createLanguageServer(loadTestLibs());
    server.setDeclarations(generateDeclarations(loadTool()));
    expect(server.diagnostics(scriptFile()).map((d) => d.message)).toEqual([]);
  });

  it('names no company or product', () => {
    const text = readFileSync(here('tool.json'), 'utf8').toLowerCase();
    for (const word of [
      'accenture',
      'snowflake',
      'databricks',
      'salesforce',
      'spark',
      'kafka',
      'azure',
      'aws',
      'google',
    ])
      expect(text).not.toContain(word);
  });
});

describe('the sample model', () => {
  if (process.env['WRITE_SAMPLE'] === '1' || !existsSync(here(SAMPLE))) {
    it('writes the sample model', () => {
      const tool = loadTool();
      writeFileSync(here(SAMPLE), exportMkModel(tool, customer360(tool)));
    });
  }

  it('matches the model built by the test and has no errors', () => {
    const tool = loadTool();
    const stored = loadSample(tool);
    const built = customer360(tool);
    expect(
      validateModel(tool, stored).filter((i) => i.severity === 'error'),
    ).toEqual([]);
    expect(Object.keys(stored.elements)).toHaveLength(
      Object.keys(built.elements).length,
    );
    expect(Object.keys(stored.connectors)).toHaveLength(
      Object.keys(built.connectors).length,
    );
    expect(Object.keys(stored.elements).length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(stored.elements).length).toBeLessThanOrEqual(25);
  });

  it('shows exactly one problem: personal data into the event archive', () => {
    const tool = loadTool();
    const issues = problems(tool, loadSample(tool));
    expect(issues.map((i) => [i.severity, i.message])).toEqual([
      [
        'warning',
        'Personal data flows into "Event archive", a data store that is not approved for personal data.',
      ],
    ]);
    expect(issues[0]!.id.startsWith('cn_')).toBe(true);
  });

  it('calculates upstream and downstream counts', () => {
    const tool = loadTool();
    const model = loadSample(tool);
    const calc = new ModelCalculator(tool, () => model);
    const clean = Object.values(model.elements).find((e) =>
      Object.values(e.attrs).includes('Clean and join' as never),
    )!;
    expect(calc.evaluate(clean.id, 'Upstream').value).toBe(2);
    expect(calc.evaluate(clean.id, 'Downstream').value).toBe(1);
  });
});

describe('the checks', () => {
  /** The sample with one change; returns the warning messages. */
  const warningsAfter = (
    change: (
      b: ReturnType<typeof builder>,
      idOf: (name: string) => ElementId,
      tool: ToolLibrary,
    ) => void,
  ) => {
    const tool = loadTool();
    const b = builder(tool, loadSample(tool));
    const idOf = (name: string) =>
      Object.values((b.store.state as Model).elements).find((e) =>
        Object.values(e.attrs).includes(name as never),
      )!.id;
    change(b, idOf, tool);
    return problems(tool, b.store.state as Model).map((i) => i.message);
  };
  const setAttr = (
    b: ReturnType<typeof builder>,
    tool: ToolLibrary,
    id: ElementId,
    cls: string,
    key: string,
    value: unknown,
  ) =>
    b.store.execute({
      type: 'setAttribute',
      target: id,
      attr: effectiveAttributes(tool, byKey(tool.classes, cls).id).find(
        (a) => a.key === key,
      )!.id,
      value,
    } as never);

  it('stops warning about personal data once the store is approved', () => {
    expect(
      warningsAfter((b, idOf, tool) =>
        setAttr(
          b,
          tool,
          idOf('Event archive'),
          'DataStore',
          'ApprovedForPersonalData',
          true,
        ),
      ),
    ).toEqual([]);
  });

  it('does not warn about flows without personal data or into other kinds of object', () => {
    const messages = warningsAfter((b, idOf) => {
      // Into an unapproved store, but without personal data.
      b.link('FlowsTo', idOf('Churn score API'), idOf('Feature store'));
      // Personal data into a pipeline and into a dataset: neither is a store.
      b.link('FlowsTo', idOf('Landing store'), idOf('Feature build'), {
        ContainsPersonalData: true,
      });
      b.link('FlowsTo', idOf('Lakehouse'), idOf('Churn features'), {
        ContainsPersonalData: true,
      });
    });
    expect(messages).toHaveLength(1);
  });

  it('warns about personal data into a second unapproved store', () => {
    const messages = warningsAfter((b, idOf) =>
      b.link('FlowsTo', idOf('Customer profile'), idOf('Feature store'), {
        ContainsPersonalData: true,
      }),
    );
    expect(messages).toContain(
      'Personal data flows into "Feature store", a data store that is not approved for personal data.',
    );
    expect(messages).toHaveLength(2);
  });

  it('warns when a restricted dataset flows to a public consumer, and only then', () => {
    const warning =
      'The restricted dataset "Customer profile" flows to "Retention dashboard", which has a public audience.';
    const publicDashboard = warningsAfter((b, idOf, tool) =>
      setAttr(
        b,
        tool,
        idOf('Retention dashboard'),
        'Consumer',
        'Audience',
        'Public',
      ),
    );
    expect(publicDashboard).toContain(warning);
    expect(publicDashboard).toHaveLength(2);
    const notRestricted = warningsAfter((b, idOf, tool) => {
      setAttr(
        b,
        tool,
        idOf('Retention dashboard'),
        'Consumer',
        'Audience',
        'Public',
      );
      setAttr(
        b,
        tool,
        idOf('Customer profile'),
        'Dataset',
        'Classification',
        'Confidential',
      );
    });
    expect(notRestricted).not.toContain(warning);
    expect(notRestricted).toHaveLength(1);
  });

  it('warns about a public dataset with personal data', () => {
    const messages = warningsAfter((b, idOf, tool) =>
      setAttr(
        b,
        tool,
        idOf('Customer profile'),
        'Dataset',
        'Classification',
        'Public',
      ),
    );
    expect(messages).toContain(
      'A dataset that contains personal data should not be classified as Public.',
    );
  });
});

interface Rig {
  tool: ToolLibrary;
  store: ModelStore;
  behaviour: Behaviour;
  handle: ScriptsHandle;
  messages: { kind: string; text: string }[];
  idOf: (name: string) => ElementId;
}
const rigs: Rig[] = [];
afterEach(() => {
  for (const r of rigs.splice(0)) {
    r.handle.dispose();
    r.behaviour.dispose();
  }
});
async function start(): Promise<Rig> {
  const tool = loadTool();
  const store = createModelStore(loadSample(tool), { tool });
  const messages: { kind: string; text: string }[] = [];
  const behaviour = createBehaviour({
    store,
    tool: () => tool,
    host: silentHost({
      message: (kind, text) => messages.push({ kind, text }),
    }),
  });
  attachRules(behaviour, { store, tool: () => tool });
  const handle = await attachScripts(behaviour, {
    store,
    tool: () => tool,
    permissions: {
      granted: () => ({ network: false, files: false }),
      request: () => Promise.resolve(true),
      forget: () => Promise.resolve(),
    },
  });
  const idOf = (name: string) =>
    Object.values((store.state as Model).elements).find((e) =>
      Object.values(e.attrs).includes(name as never),
    )!.id;
  const rig = { tool, store, behaviour, handle, messages, idOf };
  rigs.push(rig);
  return rig;
}

describe('Show lineage', () => {
  const run = async (r: Rig, target: string | null) => {
    r.behaviour.commands.get('script:show-lineage:context')!.run(target);
    await r.handle.engine!.ready();
    expect(
      r.handle.log.filter((l) => l.level === 'error').map((l) => l.text),
    ).toEqual([]);
    return r.messages.at(-1)!.text;
  };

  it('lists what is upstream and downstream of a dataset, in flow order', async () => {
    const r = await start();
    expect(await run(r, r.idOf('Churn features'))).toBe(
      [
        'Lineage of Churn features (Dataset):',
        'Upstream, in flow order (12):',
        '  8 steps back: CRM (Source system), Billing (Source system), Web events (Source system)',
        '  7 steps back: Batch import (Ingestion), Event stream (Ingestion)',
        '  6 steps back: Landing store (Data store), Event archive (Data store)',
        '  5 steps back: Clean and join (Data pipeline)',
        '  4 steps back: Lakehouse (Data store)',
        '  3 steps back: Customer profile (Dataset)',
        '  2 steps back: Feature build (Data pipeline)',
        '  1 step back: Feature store (Data store)',
        'Downstream, in flow order (4):',
        '  1 step on: Churn model (ML model)',
        '  2 steps on: Churn score API (AI service)',
        '  3 steps on: Retention dashboard (Consumer), CRM app (Consumer)',
      ].join('\n'),
    );
  });

  it('says when nothing flows in or out', async () => {
    const r = await start();
    const text = await run(r, r.idOf('CRM app'));
    expect(text).toContain('Lineage of CRM app (Consumer):');
    expect(text).toContain('Downstream: it flows nowhere.');
    const source = await run(r, r.idOf('CRM'));
    expect(source).toContain('Upstream: nothing flows into it.');
  });

  it('asks for a selection when nothing is selected', async () => {
    const r = await start();
    expect(await run(r, null)).toBe(
      'Select an object first to see its lineage.',
    );
  });
});

describe('commands', () => {
  it('approves the selected store for personal data, which clears the warning, in one undo step', async () => {
    const r = await start();
    const archive = r.idOf('Event archive');
    r.behaviour.commands.get('rule_approvepd')!.run(archive);
    expect(problems(r.tool, r.store.state as Model)).toEqual([]);
    r.store.undo();
    expect(problems(r.tool, r.store.state as Model)).toHaveLength(1);
  });

  it('does nothing to an object that is not a store', async () => {
    const r = await start();
    const before = r.store.state;
    r.behaviour.commands.get('rule_approvepd')!.run(r.idOf('Churn model'));
    expect(r.store.state).toEqual(before);
    expect(r.messages).toEqual([]);
  });

  it('classifies the selected dataset as restricted', async () => {
    const r = await start();
    const id = r.idOf('Churn features');
    r.behaviour.commands.get('rule_restrict')!.run(id);
    const cls = effectiveAttributes(
      r.tool,
      byKey(r.tool.classes, 'Dataset').id,
    ).find((a) => a.key === 'Classification')!;
    expect((r.store.state as Model).elements[id]!.attrs[cls.id]).toBe(
      'Restricted',
    );
  });
});
