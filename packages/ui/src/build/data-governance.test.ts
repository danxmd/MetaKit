import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ModelCalculator,
  KIT_FORMAT_VERSION,
  createEmptyModel,
  createModelStore,
  effectiveAttributes,
  validateModel,
  validateKit,
  type ClassId,
  type ElementId,
  type Model,
  type ModelStore,
  type NodeShape,
  type RelationId,
  type RelationShape,
  type Kit,
} from '@metakit-app/core';
import {
  exportMkModel,
  fromLayout,
  importMkModel,
  toLayout,
} from '@metakit-app/storage';
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
import {
  compileNode,
  nodeShapeFromLook,
  relationShapeFromLook,
} from '@metakit-app/shapes';
import { createLanguageServer } from '../components/build/scripts/script-language';
import { loadTestLibs } from '../components/build/scripts/test-libs';

/**
 * The "Data governance and ownership" Kit (openspec/changes/ai-data-catalog): domains, data
 * products, data assets, people in their roles, glossary terms, policies, classifications and
 * quality rules. The sample model is "Sales and finance domains"; set WRITE_SAMPLE=1 to write it
 * again after the Kit changes.
 */

const here = (path: string) =>
  fileURLToPath(
    new URL(`../../../../kits/data-governance/${path}`, import.meta.url),
  );
const loadKit = () => JSON.parse(readFileSync(here('kit.json'), 'utf8')) as Kit;
/** The script as the Kit carries it; a Windows checkout may have CRLF line ends. */
const scriptFile = () =>
  readFileSync(here('check-governance.script.ts'), 'utf8').replace(
    /\r\n/g,
    '\n',
  );

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
  const put = (
    key: string,
    values: Record<string, unknown>,
    x: number,
    y: number,
    parent?: ElementId,
    size?: { w: number; h: number },
  ): ElementId => {
    const cls = byKey(kit.classes, key).id as ClassId;
    const defs = effectiveAttributes(kit, cls);
    const attrs = Object.fromEntries(
      Object.entries(values).map(([k, v]) => {
        const def = defs.find((d) => d.key === k);
        if (!def) throw new Error(`${key} has no attribute ${k}`);
        return [def.id, v];
      }),
    );
    const r = store.execute({
      type: 'createElement',
      class: cls,
      x,
      y,
      ...(parent ? { parent } : {}),
      ...size,
      attrs,
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
    store.execute({
      type: 'createConnector',
      relation: rel.id as RelationId,
      from,
      to,
      attrs: Object.fromEntries(
        Object.entries(values).map(([k, v]) => [
          rel.attributes.find((d) => d.key === k)!.id,
          v,
        ]),
      ),
    } as never);
  };
  return { store, put, link };
}

/**
 * Two domains with their products, assets and people. On purpose, "Sales pipeline" has no owner
 * and "Payroll file" is restricted without a policy, so the checks have something to report; the
 * quality rule "Dashboard matches ledger" fails and the term "Fiscal period" defines nothing.
 */
function salesAndFinance(kit: Kit): Model {
  const model = createEmptyModel(
    kit,
    byKey(kit.modelTypes, 'Governance').id as never,
    { name: 'Sales and finance domains' },
  );
  const b = builder(kit, model);
  const { put, link } = b;
  b.store.execute({
    type: 'setAttribute',
    target: 'model',
    attr: 'att_govtitle',
    value: 'Sales and finance domains',
  } as never);
  b.store.execute({
    type: 'setAttribute',
    target: 'model',
    attr: 'att_govscope',
    value: 'Who owns, looks after and checks the data of two business domains.',
  } as never);

  // People, above the domains.
  const person = (name: string, email: string, team: string, x: number) =>
    put(
      'Person',
      { Name: name, Email: `${email}@example.com`, Team: team },
      x,
      20,
    );
  const amira = person('Amira Haddad', 'amira', 'Sales', 80);
  const jonas = person('Jonas Weber', 'jonas', 'Sales', 230);
  const li = person('Li Na', 'li', 'Data platform', 560);
  const carlos = person('Carlos Mendes', 'carlos', 'Finance', 900);
  const grace = person('Grace Okafor', 'grace', 'Finance', 1050);

  // Domains. Positions are on the canvas, not relative to the container.
  const domain = { w: 620, h: 440 };
  const sales = put(
    'DataDomain',
    {
      Name: 'Sales',
      DomainLead: 'Amira Haddad',
      Description: 'Customers, orders and the sales pipeline.',
    },
    40,
    170,
    undefined,
    domain,
  );
  const finance = put(
    'DataDomain',
    {
      Name: 'Finance',
      DomainLead: 'Carlos Mendes',
      Description: 'Ledger, invoices, payroll and revenue reporting.',
    },
    700,
    170,
    undefined,
    domain,
  );

  // Data products.
  const c360 = put(
    'DataProduct',
    {
      Name: 'Customer 360',
      Status: 'Published',
      Description: 'One view of every customer and their orders.',
      SLA: 'Refreshed daily by 06:00',
      Consumers: 'Marketing, customer service',
      Classification: 'Confidential',
    },
    60,
    210,
    sales,
  );
  const pipeline = put(
    'DataProduct',
    {
      Name: 'Sales pipeline',
      Status: 'Draft',
      Description: 'Open opportunities and the churn forecast.',
      Classification: 'Internal',
    },
    300,
    210,
    sales,
  );
  const revenue = put(
    'DataProduct',
    {
      Name: 'Revenue reporting',
      Status: 'Published',
      SLA: 'Closed by the third working day of the month',
      Consumers: 'Leadership team',
      Classification: 'Confidential',
    },
    720,
    210,
    finance,
  );
  const invoices = put(
    'DataProduct',
    {
      Name: 'Invoice ledger',
      Status: 'Published',
      SLA: 'Updated every hour',
      Consumers: 'Accounts receivable',
      Classification: 'Restricted',
    },
    960,
    210,
    finance,
  );

  // Data assets.
  const asset = (
    values: Record<string, unknown>,
    x: number,
    y: number,
    parent: ElementId,
  ) => put('DataAsset', values, x, y, parent);
  const customers = asset(
    {
      Name: 'Customer table',
      Kind: 'Table',
      Classification: 'Confidential',
      ContainsPersonalData: true,
      RetentionPeriod: 'P7Y',
    },
    60,
    320,
    sales,
  );
  const orders = asset(
    { Name: 'Orders table', Kind: 'Table', Classification: 'Internal' },
    250,
    320,
    sales,
  );
  const events = asset(
    { Name: 'Web events stream', Kind: 'Stream', Classification: 'Internal' },
    440,
    320,
    sales,
  );
  const churn = asset(
    { Name: 'Churn model', Kind: 'Model', Classification: 'Internal' },
    250,
    420,
    sales,
  );
  const winLoss = asset(
    { Name: 'Win and loss report', Kind: 'Report', Classification: 'Public' },
    440,
    420,
    sales,
  );
  const ledger = asset(
    {
      Name: 'General ledger',
      Kind: 'Table',
      Classification: 'Restricted',
      RetentionPeriod: 'P10Y',
    },
    720,
    320,
    finance,
  );
  const payroll = asset(
    {
      Name: 'Payroll file',
      Kind: 'File',
      Classification: 'Restricted',
      ContainsPersonalData: true,
      RetentionPeriod: 'P10Y',
    },
    910,
    320,
    finance,
  );
  const dashboard = asset(
    { Name: 'Revenue dashboard', Kind: 'Report', Classification: 'Internal' },
    1100,
    320,
    finance,
  );

  // Glossary terms.
  const term = (
    values: Record<string, unknown>,
    x: number,
    y: number,
    parent: ElementId,
  ) => put('GlossaryTerm', values, x, y, parent);
  const customerTerm = term(
    {
      Name: 'Customer',
      Status: 'Approved',
      Definition: 'A person or company that has placed at least one order.',
      Synonyms: 'Client, account',
    },
    60,
    420,
    sales,
  );
  const churnTerm = term(
    {
      Name: 'Churn',
      Status: 'Approved',
      Definition: 'A customer who has not ordered for twelve months.',
    },
    60,
    510,
    sales,
  );
  const revenueTerm = term(
    {
      Name: 'Revenue',
      Status: 'Approved',
      Definition: 'Income from sales after returns and discounts.',
      Synonyms: 'Net sales',
    },
    720,
    420,
    finance,
  );
  term(
    {
      Name: 'Fiscal period',
      Status: 'Draft',
      Definition: 'A month of the financial year.',
    },
    870,
    420,
    finance,
  );

  // Policies and classifications, below the domains.
  const policy = (
    name: string,
    kind: string,
    effective: string,
    review: string,
    x: number,
  ) =>
    put(
      'Policy',
      { Name: name, Kind: kind, EffectiveDate: effective, ReviewDate: review },
      x,
      650,
    );
  const privacy = policy(
    'Customer data privacy',
    'Privacy',
    '2026-01-01',
    '2027-01-01',
    80,
  );
  const retention = policy(
    'Record retention',
    'Retention',
    '2025-01-01',
    '2028-01-01',
    400,
  );
  const access = policy(
    'Financial records access',
    'Access',
    '2025-07-01',
    '2026-07-01',
    760,
  );
  const handling: Record<string, string> = {
    Public: 'May be shared outside the organisation.',
    Internal: 'For staff only.',
    Confidential: 'Named groups only; encrypted at rest.',
    Restricted: 'Named people only; access is logged and reviewed.',
  };
  const level = Object.fromEntries(
    Object.entries(handling).map(([l, h], i) => [
      l,
      put(
        'Classification',
        { Name: l, Level: l, Handling: h },
        80 + i * 180,
        790,
      ),
    ]),
  );

  // Quality rules, to the right of the domains.
  const qr = (
    name: string,
    dimension: string,
    threshold: number,
    result: number,
    y: number,
  ) =>
    put(
      'QualityRule',
      {
        Name: name,
        Dimension: dimension,
        Threshold: threshold,
        LastResult: result,
      },
      1380,
      y,
    );
  const emails = qr('Customer email filled', 'Completeness', 98, 99.2, 210);
  const unique = qr('Customer id unique', 'Uniqueness', 100, 100, 300);
  const daily = qr('Orders loaded daily', 'Timeliness', 95, 97, 390);
  const balances = qr('Ledger balances', 'Consistency', 100, 100, 480);
  const matches = qr('Dashboard matches ledger', 'Accuracy', 99, 96.5, 570);

  // Roles.
  link('Owns', amira, sales);
  link('Owns', carlos, finance);
  link('Owns', amira, c360);
  link('Owns', carlos, revenue);
  link('Owns', carlos, invoices);
  link('Owns', amira, customers);
  link('Owns', carlos, ledger);
  link('Stewards', jonas, c360);
  link('Stewards', jonas, customers);
  link('Stewards', jonas, pipeline);
  link('Stewards', grace, revenue);
  link('Stewards', grace, invoices);
  link('CustodianOf', li, customers);
  link('CustodianOf', li, orders);
  link('CustodianOf', li, events);
  link('CustodianOf', grace, ledger);
  link('CustodianOf', grace, payroll);

  // What the products are made of and use.
  link('Contains', c360, customers);
  link('Contains', c360, orders);
  link('Contains', c360, events);
  link('Contains', pipeline, churn);
  link('Contains', pipeline, winLoss);
  link('Contains', revenue, dashboard);
  link('Contains', invoices, ledger);
  link('Consumes', pipeline, c360, { Purpose: 'Customer history' });
  link('Consumes', revenue, invoices, { Purpose: 'Booked revenue' });

  // Policies and classifications.
  link('GovernedBy', c360, privacy);
  link('GovernedBy', customers, privacy);
  link('GovernedBy', customers, retention);
  link('GovernedBy', ledger, access);
  link('GovernedBy', ledger, retention);
  link('GovernedBy', invoices, access);
  for (const [a, l] of [
    [customers, 'Confidential'],
    [orders, 'Internal'],
    [events, 'Internal'],
    [churn, 'Internal'],
    [winLoss, 'Public'],
    [ledger, 'Restricted'],
    [payroll, 'Restricted'],
    [dashboard, 'Internal'],
  ] as const)
    link('ClassifiedAs', a, level[l]!);

  // Meanings and checks.
  link('Defines', customerTerm, customers);
  link('Defines', customerTerm, c360);
  link('Defines', churnTerm, churn);
  link('Defines', revenueTerm, dashboard);
  link('Defines', revenueTerm, ledger);
  link('Checks', emails, customers);
  link('Checks', unique, customers);
  link('Checks', daily, orders);
  link('Checks', balances, ledger);
  link('Checks', matches, dashboard);
  link('Checks', matches, ledger);
  return b.store.state as Model;
}

const SAMPLE = 'sales-finance.mkmodel.json';
const loadSample = (kit: Kit) =>
  importMkModel(kit, readFileSync(here(SAMPLE), 'utf8'));

describe('the Kit', () => {
  it('is valid and in the current format', () => {
    const kit = loadKit();
    expect(validateKit(kit)).toEqual([]);
    expect(kit.formatVersion).toBe(KIT_FORMAT_VERSION);
    expect(kit.manifest).toMatchObject({
      id: 'tool_datagov',
      version: '1.0.0',
      languages: ['en'],
    });
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

  it('draws every shape from a simple look, so the simple look editor can edit it', () => {
    const kit = loadKit();
    for (const shape of Object.values(kit.shapes)) {
      expect(shape.look, shape.id).toBeDefined();
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
    for (const owner of [
      ...Object.values(kit.classes),
      ...Object.values(kit.relations),
    ])
      expect(kit.shapes[owner.shape!], owner.key).toBeDefined();
  });

  it('has a panel for every class', () => {
    const kit = loadKit();
    for (const cls of Object.values(kit.classes))
      expect(kit.panels[cls.id]?.class, cls.key).toBe(cls.id);
  });

  it('asks for exactly one owner of every data product', () => {
    const kit = loadKit();
    expect(byKey(kit.modelTypes, 'Governance').cardinalities).toEqual([
      {
        kind: 'degree',
        class: 'cls_product',
        relation: 'rel_owns',
        end: 'to',
        min: 1,
        max: 1,
      },
    ]);
  });

  it('has the script that the Kit carries equal to its source file', () => {
    const kit = loadKit();
    expect(kit.scripts['scr_checkgov' as never]!.source).toBe(scriptFile());
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
    expect(server.diagnostics(scriptFile()).map((d) => d.message)).toEqual([]);
  });
});

/** The value of a formula attribute of the object with this Name. */
function computed(kit: Kit, model: Model, name: string, key: string): unknown {
  const calc = new ModelCalculator(kit, () => model);
  const el = Object.values(model.elements).find((e) =>
    Object.values(e.attrs).includes(name as never),
  );
  if (!el) throw new Error(`No ${name}`);
  return calc.get(el.id, key);
}

describe('the sample "Sales and finance domains"', () => {
  if (process.env['WRITE_SAMPLE'] === '1' || !existsSync(here(SAMPLE))) {
    it('writes the sample model', () => {
      const kit = loadKit();
      writeFileSync(here(SAMPLE), exportMkModel(kit, salesAndFinance(kit)));
    });
  }

  it('matches the model built by the test', () => {
    const kit = loadKit();
    const stored = loadSample(kit);
    const built = salesAndFinance(kit);
    expect(Object.keys(stored.elements)).toHaveLength(
      Object.keys(built.elements).length,
    );
    expect(Object.keys(stored.connectors)).toHaveLength(
      Object.keys(built.connectors).length,
    );
    const count = (m: Model, key: string) =>
      Object.values(m.elements).filter(
        (e) => e.class === byKey(kit.classes, key).id,
      ).length;
    expect(
      Object.fromEntries(
        Object.values(kit.classes).map((c) => [c.key, count(stored, c.key)]),
      ),
    ).toEqual({
      DataDomain: 2,
      DataProduct: 4,
      DataAsset: 8,
      Person: 5,
      GlossaryTerm: 4,
      Policy: 3,
      Classification: 4,
      QualityRule: 5,
    });
  });

  it('reports exactly the missing owner and the unprotected restricted asset', () => {
    const kit = loadKit();
    const model = loadSample(kit);
    const calculator = new ModelCalculator(kit, () => model);
    const issues = validateModel(kit, model, calculator).map((i) => ({
      severity: i.severity,
      code: i.code,
      message: i.message,
    }));
    expect(issues).toEqual([
      {
        severity: 'warning',
        code: 'degree-below-min',
        message:
          'Data product "Sales pipeline" has 0 Owns entering it, but needs at least 1.',
      },
      {
        severity: 'warning',
        code: 'constraint',
        message:
          'A restricted data asset, or a confidential one with personal data, needs a policy ("Governed by").',
      },
    ]);
  });

  it('computes the quality scores and outcomes', () => {
    const kit = loadKit();
    const model = loadSample(kit);
    const score = (name: string) => computed(kit, model, name, 'QualityScore');
    expect(score('Customer table')).toBe(100);
    expect(score('Orders table')).toBe(100);
    expect(score('General ledger')).toBe(50);
    expect(score('Revenue dashboard')).toBe(0);
    expect(score('Payroll file')).toBeNull();
    expect(computed(kit, model, 'Dashboard matches ledger', 'Passing')).toBe(
      false,
    );
    expect(computed(kit, model, 'Dashboard matches ledger', 'Outcome')).toBe(
      'Failing',
    );
    expect(computed(kit, model, 'Customer email filled', 'Outcome')).toBe(
      'Passing',
    );
    expect(computed(kit, model, 'Customer 360', 'OwnerName')).toBe(
      'Amira Haddad',
    );
    expect(computed(kit, model, 'Grace Okafor', 'Responsibilities')).toBe(4);
  });

  it('warns when a second owner is added and when a quality rule checks nothing', () => {
    const kit = loadKit();
    const model = loadSample(kit);
    const store = createModelStore(model, { kit });
    const idOf = (name: string) =>
      Object.values(model.elements).find((e) =>
        Object.values(e.attrs).includes(name as never),
      )!.id;
    store.execute({
      type: 'createConnector',
      relation: 'rel_owns',
      from: idOf('Jonas Weber'),
      to: idOf('Customer 360'),
    } as never);
    store.execute({
      type: 'createElement',
      class: 'cls_rule',
      x: 1300,
      y: 700,
      attrs: { att_rulename: 'Orphan rule' },
    } as never);
    const now = store.state as Model;
    const messages = validateModel(
      kit,
      now,
      new ModelCalculator(kit, () => now),
    ).map((i) => i.message);
    expect(messages).toContain(
      'Data product "Customer 360" has 2 Owns entering it, but at most 1 is allowed.',
    );
    expect(messages).toContain(
      'A quality rule should check at least one data asset.',
    );
  });
});

describe('the looks', () => {
  it('draw every object of the sample without a problem, with the failing badge where it belongs', () => {
    const kit = loadKit();
    const model = loadSample(kit);
    const calc = new ModelCalculator(kit, () => model);
    const texts: Record<string, string[]> = {};
    for (const el of Object.values(model.elements)) {
      const cls = kit.classes[el.class]!;
      const shape = kit.shapes[cls.shape!] as NodeShape;
      const out = compileNode(shape, {
        w: el.w ?? shape.size.width,
        h: el.h ?? shape.size.height,
        scope: calc.scope(el.id, { $label: cls.labels['en']! }),
      });
      expect(out.messages, `${cls.key} ${el.id}`).toEqual([]);
      texts[String(calc.get(el.id, 'Name'))] = out.ops.flatMap((o) =>
        o.op === 'text' ? o.lines.map((l) => l.text) : [],
      );
    }
    expect(texts['Dashboard matches ledger']).toContain('Fail');
    expect(texts['Ledger balances']).not.toContain('Fail');
    expect(texts['General ledger']).toContain('QualityScore: 50');
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
async function start(): Promise<Rig> {
  const kit = loadKit();
  const store = createModelStore(loadSample(kit), { kit });
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
  return rig;
}

describe('Check governance', () => {
  it('summarises the gaps in the sample', async () => {
    const r = await start();
    r.behaviour.commands.get('script:check-governance')!.run(null);
    await r.handle.engine!.ready();
    expect(
      r.handle.log.filter((l) => l.level === 'error').map((l) => l.text),
    ).toEqual([]);
    expect(r.messages).toEqual([
      {
        kind: 'warning',
        text: [
          'Data products without one owner:',
          '- "Sales pipeline" has no owner.',
          '',
          'Sensitive data assets without a policy:',
          '- "Payroll file" is Restricted with personal data and no policy governs it.',
          '',
          'Quality rules:',
          '- "Dashboard matches ledger" fails: 96.5% against a threshold of 99% on "Revenue dashboard", "General ledger".',
          '',
          'Unused glossary terms:',
          '- "Fiscal period" defines no data product or asset.',
        ].join('\n'),
      },
    ]);
  });
});

describe('the rule "Warn when a quality rule fails"', () => {
  it('warns when a new result is below the threshold, and not when it passes', async () => {
    const r = await start();
    const rule = Object.values((r.store.state as Model).elements).find((e) =>
      Object.values(e.attrs).includes('Orders loaded daily' as never),
    )!;
    const set = (value: number) =>
      r.store.execute({
        type: 'setAttribute',
        target: rule.id,
        attr: 'att_ruleresult',
        value,
      } as never);
    set(98);
    expect(r.messages).toEqual([]);
    set(90);
    expect(r.messages).toEqual([
      {
        kind: 'warning',
        text: 'Quality rule "Orders loaded daily" is below its threshold: 90% of 95%.',
      },
    ]);
  });
});
