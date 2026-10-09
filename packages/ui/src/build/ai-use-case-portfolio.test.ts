import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ModelCalculator,
  TOOL_FORMAT_VERSION,
  createEmptyModel,
  createModelStore,
  effectiveAttributes,
  formulaSource,
  validateModel,
  validateToolLibrary,
  type ClassId,
  type ElementId,
  type Model,
  type ModelStore,
  type NodeShape,
  type RelationId,
  type RelationShape,
  type ToolLibrary,
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
import { nodeShapeFromLook, relationShapeFromLook } from '@metakit-app/shapes';
import { createLanguageServer } from '../components/build/scripts/script-language';
import { loadTestLibs } from '../components/build/scripts/test-libs';

/**
 * The built-in "AI use-case portfolio" tool (openspec/changes/ai-data-catalog): use cases scored on
 * value, feasibility, data readiness and risk, with a priority score, a quadrant and a ranking
 * command. The sample model is a customer operations portfolio; set WRITE_SAMPLE=1 to write it
 * again after the tool library changes.
 */

const here = (path: string) =>
  fileURLToPath(
    new URL(`../../../../tools/ai-use-case-portfolio/${path}`, import.meta.url),
  );
const loadTool = () =>
  JSON.parse(readFileSync(here('tool.json'), 'utf8')) as ToolLibrary;
const scriptSource = () =>
  readFileSync(here('rank-use-cases.script.ts'), 'utf8').replace(/\r\n/g, '\n');

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
  ): ElementId => {
    const cls = byKey(tool.classes, key).id as ClassId;
    const r = store.execute({
      type: 'createElement',
      class: cls,
      x,
      y,
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

/** Eight use cases in all four quadrants, with what they serve, need and risk. */
function customerOperations(tool: ToolLibrary): Model {
  const model = createEmptyModel(
    tool,
    byKey(tool.modelTypes, 'Portfolio').id as never,
    { name: 'Customer operations AI portfolio' },
  );
  const b = builder(tool, model);
  b.store.execute({
    type: 'setAttribute',
    target: 'model',
    attr: 'att_pftitle',
    value: 'Customer operations AI portfolio',
  } as never);
  b.store.execute({
    type: 'setAttribute',
    target: 'model',
    attr: 'att_pfperiod',
    value: 'Next 12 months',
  } as never);

  // Objectives and KPIs along the top.
  const response = b.put(
    'Objective',
    {
      Name: 'Faster customer response',
      Description: 'Answer customers sooner, in every channel.',
    },
    40,
    40,
  );
  const cost = b.put(
    'Objective',
    {
      Name: 'Lower cost to serve',
      Description: 'Spend less effort on routine contacts and paperwork.',
    },
    560,
    40,
  );
  const retention = b.put(
    'Objective',
    {
      Name: 'Keep more customers',
      Description: 'Fewer customers leave at the end of their contract.',
      Horizon: 'Next year',
    },
    1080,
    40,
  );
  const firstResponse = b.put(
    'KPI',
    {
      Name: 'First response time',
      Unit: 'hours',
      Target: 4,
      Current: 6,
      Direction: 'Lower is better',
    },
    240,
    20,
  );
  const handling = b.put(
    'KPI',
    {
      Name: 'Average handling time',
      Unit: 'minutes',
      Target: 6,
      Current: 7.5,
      Direction: 'Lower is better',
    },
    760,
    20,
  );
  const straightThrough = b.put(
    'KPI',
    {
      Name: 'Invoices processed without touch',
      Unit: '%',
      Target: 70,
      Current: 72,
      Direction: 'Higher is better',
    },
    900,
    20,
  );
  const kept = b.put(
    'KPI',
    {
      Name: 'Customer retention',
      Unit: '%',
      Target: 92,
      Current: 89,
      Direction: 'Higher is better',
    },
    1280,
    20,
  );

  // The use cases in the middle row.
  const uc = (
    values: Record<string, unknown>,
    x: number,
    y: number,
  ): ElementId => b.put('UseCase', values, x, y);
  const triage = uc(
    {
      Name: 'Email triage',
      Description: 'Sort incoming emails by topic and urgency and route them.',
      Problem: 'Emails wait in one shared inbox until someone reads them.',
      Status: 'Live',
      Value: 4,
      Feasibility: 5,
      DataReadiness: 4,
      RiskLevel: 'Low',
      Effort: 6,
      EstimatedAnnualValue: 180000,
    },
    40,
    240,
  );
  const summaries = uc(
    {
      Name: 'Call summarisation',
      Description: 'Write a summary of each call into the customer record.',
      Problem: 'Agents spend minutes after each call writing notes.',
      Status: 'In delivery',
      Value: 4,
      Feasibility: 4,
      DataReadiness: 3,
      RiskLevel: 'Medium',
      Effort: 10,
      EstimatedAnnualValue: 250000,
    },
    300,
    240,
  );
  const churn = uc(
    {
      Name: 'Churn prediction',
      Description: 'Score each customer on how likely they are to leave.',
      Problem: 'Retention offers reach customers after they have decided.',
      Status: 'Assessed',
      Value: 5,
      Feasibility: 2,
      DataReadiness: 3,
      RiskLevel: 'Medium',
      Effort: 16,
      EstimatedAnnualValue: 400000,
    },
    560,
    240,
  );
  const nextBest = uc(
    {
      Name: 'Next-best-action',
      Description:
        'Suggest the best offer or step for the customer in contact.',
      Problem: 'Offers are the same for everyone and rarely fit.',
      Status: 'Idea',
      Value: 4,
      Feasibility: 2,
      DataReadiness: 2,
      RiskLevel: 'High',
      Effort: 24,
      EstimatedAnnualValue: 350000,
      Mitigation:
        'Test offers for fair treatment across customer groups before launch; agents can always override.',
    },
    820,
    240,
  );
  const invoices = uc(
    {
      Name: 'Invoice document extraction',
      Description: 'Read supplier invoices and fill in the booking fields.',
      Problem: 'Invoice details are typed in by hand.',
      Status: 'Approved',
      Value: 3,
      Feasibility: 4,
      DataReadiness: 4,
      RiskLevel: 'Low',
      Effort: 8,
      EstimatedAnnualValue: 120000,
    },
    1080,
    240,
  );
  const assistant = uc(
    {
      Name: 'Knowledge assistant for agents',
      Description:
        'Answer agent questions from the knowledge articles, with sources.',
      Problem: 'Agents search several places for the right answer.',
      Status: 'Assessed',
      Value: 2,
      Feasibility: 4,
      DataReadiness: 3,
      RiskLevel: 'High',
      Effort: 8,
      EstimatedAnnualValue: 90000,
      Mitigation:
        'Every answer shows its sources; a weekly review samples answers for accuracy.',
    },
    40,
    420,
  );
  const staffing = uc(
    {
      Name: 'Demand forecasting for staffing',
      Description: 'Forecast contact volumes per hour to plan shifts.',
      Problem: 'Shifts are planned from last year and miss peaks.',
      Status: 'Idea',
      Value: 2,
      Feasibility: 3,
      DataReadiness: 2,
      RiskLevel: 'Low',
      Effort: 6,
      EstimatedAnnualValue: 60000,
    },
    300,
    420,
  );
  const fraud = uc(
    {
      Name: 'Fraud detection',
      Description: 'Flag suspicious refund and account change requests.',
      Problem:
        'Fraud in customer operations is rare, so manual checks find little.',
      Status: 'Stopped',
      Value: 2,
      Feasibility: 2,
      DataReadiness: 2,
      RiskLevel: 'High',
      Effort: 20,
      EstimatedAnnualValue: 40000,
      Mitigation:
        'Stopped: too few cases to train on. Revisit when the volume grows.',
    },
    560,
    420,
  );

  // Stakeholders on the left, data, techniques and risks below.
  const headService = b.put(
    'Stakeholder',
    {
      Name: 'Head of customer service',
      Role: 'Sponsor',
      Interest: 'High',
      Influence: 'High',
    },
    -200,
    240,
  );
  const financeLead = b.put(
    'Stakeholder',
    {
      Name: 'Finance operations lead',
      Role: 'Sponsor',
      Interest: 'High',
      Influence: 'Medium',
    },
    1340,
    240,
  );
  b.put(
    'Stakeholder',
    {
      Name: 'Data protection officer',
      Role: 'Reviewer',
      Interest: 'Medium',
      Influence: 'High',
    },
    -200,
    420,
  );
  const teamLead = b.put(
    'Stakeholder',
    {
      Name: 'Contact centre team lead',
      Role: 'User representative',
      Interest: 'High',
      Influence: 'Low',
    },
    -200,
    600,
  );

  const emails = b.put(
    'DataAsset',
    {
      Name: 'Customer emails',
      Classification: 'Confidential',
      Readiness: 4,
      Owner: 'Customer service',
    },
    40,
    620,
  );
  const calls = b.put(
    'DataAsset',
    {
      Name: 'Call recordings and transcripts',
      Classification: 'Restricted',
      Readiness: 3,
      Owner: 'Customer service',
    },
    260,
    620,
  );
  const history = b.put(
    'DataAsset',
    {
      Name: 'Customer and contract history',
      Classification: 'Confidential',
      Readiness: 3,
      Owner: 'Sales operations',
    },
    480,
    620,
  );
  const invoiceDocs = b.put(
    'DataAsset',
    {
      Name: 'Supplier invoices',
      Classification: 'Internal',
      Readiness: 4,
      Owner: 'Finance operations',
    },
    700,
    620,
  );
  const articles = b.put(
    'DataAsset',
    {
      Name: 'Knowledge articles',
      Classification: 'Internal',
      Readiness: 3,
      Owner: 'Customer service',
    },
    920,
    620,
  );
  const volumes = b.put(
    'DataAsset',
    {
      Name: 'Contact volume history',
      Classification: 'Internal',
      Readiness: 2,
      Owner: 'Workforce planning',
    },
    1140,
    620,
  );

  const textClass = b.put(
    'AITechnique',
    { Name: 'Text classification', Kind: 'Classification' },
    40,
    780,
  );
  const summarise = b.put(
    'AITechnique',
    { Name: 'Summarisation', Kind: 'Generative text' },
    260,
    780,
  );
  const propensity = b.put(
    'AITechnique',
    { Name: 'Propensity model', Kind: 'Classification' },
    480,
    780,
  );
  const recommend = b.put(
    'AITechnique',
    { Name: 'Offer recommendation', Kind: 'Recommendation' },
    700,
    780,
  );
  const extraction = b.put(
    'AITechnique',
    { Name: 'Invoice field extraction', Kind: 'Document understanding' },
    920,
    780,
  );
  const answers = b.put(
    'AITechnique',
    {
      Name: 'Answers from documents',
      Kind: 'Generative text',
      Notes:
        'Retrieves the relevant articles and writes an answer citing them.',
    },
    1140,
    780,
  );
  const forecast = b.put(
    'AITechnique',
    { Name: 'Time series forecast', Kind: 'Forecasting' },
    1360,
    780,
  );
  const anomaly = b.put(
    'AITechnique',
    { Name: 'Anomaly detection', Kind: 'Other' },
    1360,
    620,
  );

  const bias = b.put(
    'Risk',
    {
      Name: 'Unfair offers',
      Kind: 'Bias',
      Likelihood: 3,
      Impact: 5,
      Description: 'Some customer groups get worse offers than others.',
    },
    820,
    940,
  );
  const privacy = b.put(
    'Risk',
    {
      Name: 'Personal data in transcripts',
      Kind: 'Privacy',
      Likelihood: 3,
      Impact: 4,
    },
    260,
    940,
  );
  const wrong = b.put(
    'Risk',
    {
      Name: 'Wrong answers to agents',
      Kind: 'Accuracy',
      Likelihood: 3,
      Impact: 3,
    },
    40,
    940,
  );
  const adoption = b.put(
    'Risk',
    {
      Name: 'Agents do not trust suggestions',
      Kind: 'Adoption',
      Likelihood: 2,
      Impact: 3,
    },
    540,
    940,
  );
  const falseAlerts = b.put(
    'Risk',
    {
      Name: 'Too many false alerts',
      Kind: 'Accuracy',
      Likelihood: 4,
      Impact: 3,
    },
    1080,
    940,
  );

  b.link('ContributesTo', triage, response);
  b.link('ContributesTo', summaries, cost);
  b.link('ContributesTo', invoices, cost);
  b.link('ContributesTo', assistant, response);
  b.link('ContributesTo', staffing, cost);
  b.link('ContributesTo', churn, retention);
  b.link('ContributesTo', nextBest, retention);
  b.link('ContributesTo', fraud, cost);
  b.link('MeasuredBy', response, firstResponse);
  b.link('MeasuredBy', cost, handling);
  b.link('MeasuredBy', retention, kept);
  b.link('MeasuredBy', triage, firstResponse);
  b.link('MeasuredBy', summaries, handling);
  b.link('MeasuredBy', invoices, straightThrough);
  b.link('Sponsors', headService, triage);
  b.link('Sponsors', headService, summaries);
  b.link('Sponsors', headService, assistant);
  b.link('Sponsors', financeLead, invoices);
  b.link('Sponsors', teamLead, staffing);
  b.link('NeedsData', triage, emails, { Criticality: 'High' });
  b.link('NeedsData', summaries, calls, { Criticality: 'High' });
  b.link('NeedsData', churn, history, { Criticality: 'High' });
  b.link('NeedsData', nextBest, history, { Criticality: 'High' });
  b.link('NeedsData', invoices, invoiceDocs, { Criticality: 'High' });
  b.link('NeedsData', assistant, articles, { Criticality: 'High' });
  b.link('NeedsData', staffing, volumes, { Criticality: 'Medium' });
  b.link('NeedsData', fraud, history, { Criticality: 'Medium' });
  b.link('UsesTechnique', triage, textClass);
  b.link('UsesTechnique', summaries, summarise);
  b.link('UsesTechnique', churn, propensity);
  b.link('UsesTechnique', nextBest, recommend);
  b.link('UsesTechnique', invoices, extraction);
  b.link('UsesTechnique', assistant, answers);
  b.link('UsesTechnique', staffing, forecast);
  b.link('UsesTechnique', fraud, anomaly);
  b.link('HasRisk', nextBest, bias);
  b.link('HasRisk', summaries, privacy);
  b.link('HasRisk', assistant, wrong);
  b.link('HasRisk', assistant, adoption);
  b.link('HasRisk', nextBest, adoption);
  b.link('HasRisk', fraud, falseAlerts);
  return b.store.state as Model;
}

const SAMPLE = 'customer-operations.mkmodel.json';

describe('the tool library', () => {
  it('is valid and in the current format', () => {
    const tool = loadTool();
    expect(tool.formatVersion).toBe(TOOL_FORMAT_VERSION);
    expect(tool.manifest.id).toBe('tool_aiportfolio');
    expect(validateToolLibrary(tool)).toEqual([]);
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
        const source = value.trimStart().startsWith('=')
          ? value.trimStart().slice(1)
          : value;
        seen++;
        const r = parseCached(source);
        if ('error' in r) bad.push(`${path}: ${r.error}`);
      } else if (Array.isArray(value))
        value.forEach((v, i) => walk(v, `${path}[${i}]`, key));
      else if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, k);
    };
    walk(loadTool(), 'tool');
    expect(seen).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });

  it('draws every class and relation class with a simple look', () => {
    // The parts must be exactly what the look gives, or the simple look editor would show a
    // look that differs from the drawing.
    const tool = loadTool();
    for (const owner of [
      ...Object.values(tool.classes),
      ...Object.values(tool.relations),
    ]) {
      const shape = tool.shapes[owner.shape!]!;
      expect(shape.look, owner.key).toBeDefined();
      const again =
        shape.kind === 'node'
          ? nodeShapeFromLook((shape as NodeShape).look!, shape.id, shape.name)
          : relationShapeFromLook(
              (shape as RelationShape).look!,
              shape.id,
              shape.name,
            );
      expect(shape, owner.key).toEqual(again);
    }
  });

  it('has the script that the tool carries equal to its source file', () => {
    expect(loadTool().scripts['scr_rank' as never]!.source).toBe(
      scriptSource(),
    );
  });

  it('round trips through the Git layout without a change', () => {
    const tool = loadTool();
    const layout = toLayout(tool);
    const back = fromLayout(layout);
    expect(back.issues).toEqual([]);
    expect(back.tool).toEqual(tool);
  });

  it('has a script that type-checks against the declarations of the tool', () => {
    const tool = loadTool();
    const server = createLanguageServer(loadTestLibs());
    server.setDeclarations(generateDeclarations(tool));
    expect(server.diagnostics(scriptSource()).map((d) => d.message)).toEqual(
      [],
    );
  });
});

describe('scoring', () => {
  /** One use case with these values, and a calculator over it. */
  const score = (values: Record<string, unknown>) => {
    const tool = loadTool();
    const b = builder(
      tool,
      createEmptyModel(tool, byKey(tool.modelTypes, 'Portfolio').id as never, {
        name: 'Scoring',
      }),
    );
    const id = b.put('UseCase', { Name: 'Test', ...values }, 0, 0);
    const model = b.store.state as Model;
    const calc = new ModelCalculator(tool, () => model);
    const fill = (tool.shapes['shp_usecase' as never] as NodeShape).parts[1]!
      .fill as string;
    return {
      score: calc.get(id, 'PriorityScore'),
      quadrant: calc.get(id, 'Quadrant'),
      colour: calc.evaluate(id, formulaSource(fill)).value,
      issues: validateModel(tool, model, calc).map((i) => i.message),
    };
  };

  it.each([
    [3, 3, 3, 60, 'Quick win', '#b2f2bb'],
    [2, 5, 3, 64, 'Fill-in', '#ffec99'],
    [5, 2, 3, 70, 'Strategic bet', '#a5d8ff'],
    [1, 1, 1, 20, 'Deprioritise', '#dee2e6'],
    [5, 4, 5, 94, 'Quick win', '#b2f2bb'],
    [5, 5, 5, 100, 'Quick win', '#b2f2bb'],
    [4, 5, 4, 86, 'Quick win', '#b2f2bb'],
  ])(
    'Value %i, Feasibility %i, Data readiness %i: score %i, %s, drawn in %s',
    (Value, Feasibility, DataReadiness, expected, quadrant, colour) => {
      const r = score({ Value, Feasibility, DataReadiness });
      expect(r.score).toBe(expected);
      expect(r.quadrant).toBe(quadrant);
      expect(r.colour).toBe(colour);
    },
  );

  it('leaves the score and the quadrant empty while a value is missing', () => {
    const r = score({ Value: null, Feasibility: 4, DataReadiness: 4 });
    expect(r.score).toBeNull();
    expect(r.quadrant).toBeNull();
    expect(r.colour).toBe('#f1f3f5');
  });

  it('asks a high-risk use case for a mitigation, and only then', () => {
    const message = 'A high-risk use case needs a mitigation.';
    expect(score({ RiskLevel: 'High' }).issues).toContain(message);
    expect(score({ RiskLevel: 'High', Mitigation: '   ' }).issues).toContain(
      message,
    );
    expect(
      score({ RiskLevel: 'High', Mitigation: 'Human review of every answer.' })
        .issues,
    ).not.toContain(message);
    expect(score({ RiskLevel: 'Medium' }).issues).not.toContain(message);
  });

  it('asks an approved use case for a sponsor', () => {
    const message =
      'An approved, delivered or live use case needs a stakeholder who sponsors it.';
    expect(score({ Status: 'Approved' }).issues).toContain(message);
    expect(score({ Status: 'Live' }).issues).toContain(message);
    expect(score({ Status: 'Assessed' }).issues).not.toContain(message);
  });

  it('gives risks a score and a rating, and KPIs whether they are on track', () => {
    const tool = loadTool();
    const b = builder(
      tool,
      createEmptyModel(tool, byKey(tool.modelTypes, 'Portfolio').id as never, {
        name: 'Risks',
      }),
    );
    const high = b.put('Risk', { Likelihood: 3, Impact: 5 }, 0, 0);
    const low = b.put('Risk', { Likelihood: 2, Impact: 3 }, 0, 200);
    const lower = b.put(
      'KPI',
      { Target: 4, Current: 3, Direction: 'Lower is better' },
      300,
      0,
    );
    const higher = b.put(
      'KPI',
      { Target: 90, Current: 80, Direction: 'Higher is better' },
      300,
      200,
    );
    const model = b.store.state as Model;
    const calc = new ModelCalculator(tool, () => model);
    expect([calc.get(high, 'Score'), calc.get(high, 'Rating')]).toEqual([
      15,
      'High',
    ]);
    expect([calc.get(low, 'Score'), calc.get(low, 'Rating')]).toEqual([
      6,
      'Low',
    ]);
    expect(calc.get(lower, 'OnTrack')).toBe(true);
    expect(calc.get(higher, 'OnTrack')).toBe(false);
  });
});

describe('the sample portfolio', () => {
  if (process.env['WRITE_SAMPLE'] === '1' || !existsSync(here(SAMPLE))) {
    it('writes the sample model', () => {
      const tool = loadTool();
      writeFileSync(
        here(SAMPLE),
        exportMkModel(tool, customerOperations(tool)),
      );
    });
  }

  it('has no problems at all when the formulas run', () => {
    const tool = loadTool();
    const model = importMkModel(tool, readFileSync(here(SAMPLE), 'utf8'));
    const calculator = new ModelCalculator(tool, () => model);
    const issues = validateModel(tool, model, calculator).map((i) => i.message);
    expect(issues).toEqual([]);
  });

  it('matches the model built by the test, with use cases in all four quadrants', () => {
    const tool = loadTool();
    const stored = importMkModel(tool, readFileSync(here(SAMPLE), 'utf8'));
    expect(Object.keys(stored.elements)).toHaveLength(
      Object.keys(customerOperations(tool).elements).length,
    );
    expect(Object.keys(stored.connectors)).toHaveLength(
      Object.keys(customerOperations(tool).connectors).length,
    );
    const calc = new ModelCalculator(tool, () => stored);
    const useCases = Object.values(stored.elements).filter(
      (e) => e.class === 'cls_usecase',
    );
    expect(useCases).toHaveLength(8);
    expect(new Set(useCases.map((e) => calc.get(e.id, 'Quadrant')))).toEqual(
      new Set(['Quick win', 'Strategic bet', 'Fill-in', 'Deprioritise']),
    );
  });
});

interface Rig {
  tool: ToolLibrary;
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
  const tool = loadTool();
  const model = importMkModel(tool, readFileSync(here(SAMPLE), 'utf8'));
  const store = createModelStore(model, { tool });
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
  const rig = { tool, store, behaviour, handle, messages };
  rigs.push(rig);
  return rig;
}
const useCaseNamed = (r: Rig, name: string) =>
  Object.values((r.store.state as Model).elements).find(
    (e) => e.attrs['att_ucname' as never] === name,
  )!;

describe('Rank use cases', () => {
  it('lists the sample from the highest score down and counts the quadrants', async () => {
    const r = await start();
    r.behaviour.commands.get('script:rank-use-cases')!.run(null);
    await r.handle.engine!.ready();
    expect(
      r.handle.log.filter((l) => l.level === 'error').map((l) => l.text),
    ).toEqual([]);
    expect(r.messages).toEqual([
      {
        kind: 'info',
        text: [
          '8 use cases, by priority score:',
          '1. Email triage: 86 (Quick win, Live)',
          '2. Call summarisation: 74 (Quick win, In delivery)',
          '3. Invoice document extraction: 72 (Quick win, Approved)',
          '4. Churn prediction: 70 (Strategic bet, Assessed)',
          '5. Knowledge assistant for agents: 58 (Fill-in, Assessed)',
          '6. Next-best-action: 56 (Strategic bet, Idea)',
          '7. Demand forecasting for staffing: 46 (Fill-in, Idea)',
          '8. Fraud detection: 40 (Deprioritise, Stopped)',
          '',
          'Per quadrant: Quick win: 3, Strategic bet: 2, Fill-in: 2, Deprioritise: 1.',
        ].join('\n'),
      },
    ]);
  });
});

describe('status commands', () => {
  it('approves an assessed use case in one undo step', async () => {
    const r = await start();
    const churn = useCaseNamed(r, 'Churn prediction');
    r.behaviour.commands.get('rule_approve')!.run(churn.id);
    const status = () =>
      (r.store.state as Model).elements[churn.id]!.attrs[
        'att_ucstatus' as never
      ];
    expect(status()).toBe('Approved');
    r.store.undo();
    expect(status()).toBe('Assessed');
  });

  it('does not approve a use case that is only an idea', async () => {
    const r = await start();
    const idea = useCaseNamed(r, 'Next-best-action');
    r.behaviour.commands.get('rule_approve')!.run(idea.id);
    expect(
      (r.store.state as Model).elements[idea.id]!.attrs[
        'att_ucstatus' as never
      ],
    ).toBe('Idea');
  });

  it('warns when a use case without a mitigation becomes high risk', async () => {
    const r = await start();
    const triage = useCaseNamed(r, 'Email triage');
    r.store.execute({
      type: 'setAttribute',
      target: triage.id,
      attr: 'att_ucrisk',
      value: 'High',
    } as never);
    expect(r.messages).toEqual([
      {
        kind: 'warning',
        text: 'Email triage is high risk now. Describe how the risk is mitigated on the Delivery tab.',
      },
    ]);
  });

  it('reports the value of the portfolio', async () => {
    const r = await start();
    r.behaviour.commands.get('rule_value')!.run(null);
    expect(r.messages.at(-1)!.text).toBe(
      '8 use cases, estimated at $1490000 a year for 98 person-weeks of effort.',
    );
  });
});
