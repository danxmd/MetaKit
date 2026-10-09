import type {
  AttributeDef,
  LookBase,
  LookColour,
  LookIconName,
  LookLineStyle,
  MarkerType,
  NodeLook,
  RelationLook,
} from '@metakit-app/core';
import { baseInfo } from '@metakit-app/shapes';

/**
 * The class catalog (openspec/changes/ai-data-catalog): generic classes and relation classes a
 * method engineer adds to a tool library instead of typing them in. The wording is neutral on
 * purpose: no company or product names, and technology fields are free text.
 *
 * Entries carry no ids and no language: `catalogCommands` makes fresh ids and puts the English
 * text under the first language of the tool library when it does not list English.
 */

export type CatalogTopicId =
  'general' | 'business' | 'delivery' | 'data' | 'ai' | 'apps' | 'governance';

export interface CatalogTopic {
  id: CatalogTopicId;
  label: string;
}

export const CATALOG_TOPICS: readonly CatalogTopic[] = [
  { id: 'general', label: 'General' },
  { id: 'business', label: 'Business and strategy' },
  { id: 'delivery', label: 'Project delivery' },
  { id: 'data', label: 'Data' },
  { id: 'ai', label: 'AI and machine learning' },
  { id: 'apps', label: 'Applications and cloud' },
  { id: 'governance', label: 'Governance and risk' },
];

type WithoutIdAndText<T> = T extends unknown
  ? Omit<T, 'id' | 'labels' | 'help'>
  : never;

/** An attribute as the tool library has it, without id; `label` and `help` are English. */
export type CatalogAttribute = WithoutIdAndText<AttributeDef> & {
  label: string;
  help?: string;
};

export interface CatalogClass {
  key: string;
  labels: { en: string };
  topic: CatalogTopicId;
  /** One or two plain sentences, shown in the dialog and as the class help. */
  help: string;
  kind: 'node' | 'container';
  look: NodeLook;
  attributes: CatalogAttribute[];
}

export interface CatalogRelation {
  key: string;
  labels: { en: string };
  help: string;
  /** Catalog class keys; empty means any class (every class of the tool library once added). */
  from: string[];
  to: string[];
  attributes: CatalogAttribute[];
  look: RelationLook;
}

// Attribute helpers --------------------------------------------------------------------------

/** "EffectiveDate" becomes "Effective date"; words in capitals stay as they are. */
function words(key: string): string {
  const parts = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
  return parts
    .map((w, i) => (i === 0 || /^[A-Z0-9]+$/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}

const text = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'text',
  key,
  label,
});
const long = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'text',
  key,
  label,
  multiline: true,
});
const choice = (
  key: string,
  options: string[],
  label = words(key),
): CatalogAttribute => ({ type: 'choice', key, label, options });
const int = (
  key: string,
  range: { min?: number; max?: number } = {},
  label = words(key),
): CatalogAttribute => ({ type: 'integer', key, label, ...range });
const num = (
  key: string,
  extra: { unit?: string; min?: number; max?: number } = {},
  label = words(key),
): CatalogAttribute => ({ type: 'number', key, label, ...extra });
const bool = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'boolean',
  key,
  label,
});
const date = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'date',
  key,
  label,
});
const link = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'link',
  key,
  label,
  target: 'any',
});
const formula = (
  key: string,
  source: string,
  result: 'text' | 'number' | 'boolean',
  help: string,
  label = words(key),
): CatalogAttribute => ({
  type: 'formula',
  key,
  label,
  formula: source,
  result,
  help,
});
const scale = (key: string, label = words(key)) =>
  int(key, { min: 1, max: 5 }, `${label} (1 to 5)`);

const LOW_HIGH = ['Low', 'Medium', 'High'];
const RAG = ['Green', 'Amber', 'Red'];
const WORK = ['Not started', 'In progress', 'Done', 'Blocked'];
const STAGES = ['Development', 'Test', 'Production'];
const LEVELS = ['Public', 'Internal', 'Confidential', 'Restricted'];

// Looks --------------------------------------------------------------------------------------

/** One pair of colours per topic, from the palette of the Appearance editor. */
const TONES: Record<CatalogTopicId, { fill: string; border: string }> = {
  general: { fill: '#e9ecef', border: '#495057' },
  business: { fill: '#b2f2bb', border: '#2f9e44' },
  delivery: { fill: '#ffd8a8', border: '#f08c00' },
  data: { fill: '#a5d8ff', border: '#1c7ed6' },
  ai: { fill: '#eebefa', border: '#9c36b5' },
  apps: { fill: '#96f2d7', border: '#0c8599' },
  governance: { fill: '#ffc9c9', border: '#e03131' },
};

interface LookOptions {
  icon?: LookIconName;
  subtitle?: string;
  fields?: string[];
  fill?: LookColour;
  border?: LookColour;
}

function look(
  topic: CatalogTopicId,
  base: LookBase,
  options: LookOptions = {},
): NodeLook {
  const tone = TONES[topic];
  const container = base === 'container';
  const size = { ...baseInfo(base).size };
  // A header box grows with the fields it lists.
  if (options.fields && options.fields.length > 3)
    size.height += (options.fields.length - 3) * 16;
  const result: NodeLook = {
    base,
    fill: options.fill ?? (container ? '#f1f3f5' : tone.fill),
    border: options.border ?? tone.border,
    borderWidth: 1.5,
    borderStyle: container ? 'dashed' : 'solid',
    title: { attribute: 'Name', bold: true },
    size: { ...size, resizable: true },
  };
  if (options.subtitle) result.subtitle = { attribute: options.subtitle };
  if (options.icon) result.icon = { name: options.icon };
  if (options.fields) result.fields = options.fields;
  return result;
}

function line(
  colour: string,
  options: {
    style?: LookLineStyle;
    start?: MarkerType;
    end?: MarkerType;
    label?: string;
  } = {},
): RelationLook {
  return {
    colour,
    width: 1.5,
    style: options.style ?? 'solid',
    routing: 'orthogonal',
    start: options.start ?? 'none',
    end: options.end ?? 'arrow',
    label: options.label ? { attribute: options.label } : null,
  };
}

// Entries ------------------------------------------------------------------------------------

function cls(
  topic: CatalogTopicId,
  key: string,
  label: string,
  help: string,
  shape: NodeLook,
  attributes: CatalogAttribute[],
): CatalogClass {
  const name: CatalogAttribute = {
    type: 'text',
    key: 'Name',
    label: 'Name',
    required: true,
    default: label,
  };
  const own = attributes.some((a) => a.key === 'Description')
    ? []
    : [long('Description')];
  return {
    key,
    labels: { en: label },
    topic,
    help,
    kind: shape.base === 'container' ? 'container' : 'node',
    look: shape,
    attributes: [name, ...own, ...attributes],
  };
}

export const CATALOG_CLASSES: readonly CatalogClass[] = [
  // General
  cls(
    'general',
    'Note',
    'Note',
    'A free note on a diagram, for comments and explanations.',
    look('general', 'document', { fill: '#ffec99', border: '#f2c200' }),
    [long('Text')],
  ),
  cls(
    'general',
    'Group',
    'Group',
    'A box that gathers related objects. It has no meaning of its own beyond its purpose.',
    look('general', 'container'),
    [text('Purpose')],
  ),
  cls(
    'general',
    'Person',
    'Person',
    'A named individual who takes part in the work.',
    look('general', 'person', { subtitle: 'Role' }),
    [text('Role'), text('Email'), text('Team')],
  ),
  cls(
    'general',
    'Role',
    'Role',
    'A part that people play, such as reviewer or approver, independent of who fills it.',
    look('general', 'pill'),
    [long('Responsibilities')],
  ),
  cls(
    'general',
    'Team',
    'Team',
    'A group of people who work together. Place people inside it.',
    look('general', 'container', { subtitle: 'Lead' }),
    [text('Lead'), text('Location')],
  ),
  cls(
    'general',
    'OrganisationUnit',
    'Organisation unit',
    'A department, division or other part of the organisation.',
    look('general', 'container', { subtitle: 'Code' }),
    [text('Code'), text('Head')],
  ),
  cls(
    'general',
    'Location',
    'Location',
    'A place where people work or where systems run.',
    look('general', 'pill', { icon: 'flag', subtitle: 'City' }),
    [text('Country'), text('City')],
  ),
  cls(
    'general',
    'Document',
    'Document',
    'A written document, with a link to where it is kept.',
    look('general', 'document', { subtitle: 'Status' }),
    [
      link('Link'),
      text('Version'),
      choice('Status', ['Draft', 'In review', 'Approved', 'Retired']),
    ],
  ),
  cls(
    'general',
    'GlossaryTerm',
    'Glossary term',
    'A word with an agreed meaning, so that everyone uses it the same way.',
    look('general', 'pill', { subtitle: 'Status' }),
    [
      long('Definition'),
      text('Synonyms'),
      choice('Status', ['Proposed', 'Approved', 'Deprecated']),
    ],
  ),

  // Business and strategy
  cls(
    'business',
    'Goal',
    'Goal',
    'Something the organisation wants to achieve, with a time horizon and a way to measure it.',
    look('business', 'hexagon', { icon: 'star', subtitle: 'Horizon' }),
    [
      long('Description'),
      choice('Horizon', ['Short term', 'Medium term', 'Long term']),
      text('Measure'),
    ],
  ),
  cls(
    'business',
    'BusinessCapability',
    'Business capability',
    'What the organisation is able to do, independent of how or by whom it is done.',
    look('business', 'header-box', {
      fields: ['Level', 'Maturity', 'StrategicImportance'],
    }),
    [
      int('Level', { min: 1 }),
      scale('Maturity'),
      choice('StrategicImportance', LOW_HIGH),
    ],
  ),
  cls(
    'business',
    'BusinessProcess',
    'Business process',
    'A repeatable set of activities that produces a result for a customer or for the organisation.',
    look('business', 'rounded', { subtitle: 'Owner' }),
    [
      text('Owner'),
      choice('Frequency', [
        'Ad hoc',
        'Daily',
        'Weekly',
        'Monthly',
        'Quarterly',
        'Yearly',
      ]),
      choice('AutomationLevel', [
        'Manual',
        'Partly automated',
        'Fully automated',
      ]),
    ],
  ),
  cls(
    'business',
    'ValueStream',
    'Value stream',
    'The stages through which value reaches a customer, from first request to final result.',
    look('business', 'pill', { subtitle: 'Customer' }),
    [text('Customer'), long('ValueProposition')],
  ),
  cls(
    'business',
    'Stakeholder',
    'Stakeholder',
    'A person or group with an interest in the outcome, and how much they can influence it.',
    look('business', 'person', { subtitle: 'Attitude' }),
    [
      choice('Interest', LOW_HIGH),
      choice('Influence', LOW_HIGH),
      choice('Attitude', ['Supportive', 'Neutral', 'Resistant']),
    ],
  ),
  cls(
    'business',
    'KPI',
    'KPI',
    'A key performance indicator: a number with a target. On track compares the current value with the target.',
    look('business', 'circle', {
      icon: 'flag',
      border: {
        by: 'OnTrack',
        values: { true: '#2f9e44', false: '#e03131' },
        fallback: '#495057',
      },
    }),
    [
      text('Unit'),
      num('Target'),
      num('Current'),
      choice('Direction', ['Higher is better', 'Lower is better']),
      formula(
        'OnTrack',
        "Current == null || Target == null ? null : (Direction == 'Lower is better' ? Current <= Target : Current >= Target)",
        'boolean',
        'Yes when the current value has reached the target in the given direction.',
      ),
    ],
  ),
  cls(
    'business',
    'Benefit',
    'Benefit',
    'A measurable gain that a change is expected to bring, and what it has brought so far.',
    look('business', 'rounded', { icon: 'star', subtitle: 'Type' }),
    [
      choice('Type', ['Cost', 'Revenue', 'Risk', 'Experience']),
      num('EstimatedValue'),
      num('RealisedValue'),
    ],
  ),
  cls(
    'business',
    'ProductOrService',
    'Product or service',
    'Something the organisation offers to its customers.',
    look('business', 'rounded', { subtitle: 'LifecycleStage' }),
    [
      text('CustomerSegment'),
      choice('LifecycleStage', [
        'Idea',
        'Launch',
        'Growth',
        'Mature',
        'Decline',
      ]),
    ],
  ),

  // Project delivery
  cls(
    'delivery',
    'Initiative',
    'Initiative',
    'A project or programme with a sponsor, a budget and dates.',
    look('delivery', 'header-box', { fields: ['Sponsor', 'Status', 'End'] }),
    [
      text('Sponsor'),
      num('Budget', { min: 0 }),
      date('Start'),
      date('End'),
      choice('Status', [
        'Proposed',
        'Approved',
        'In progress',
        'Done',
        'Stopped',
      ]),
    ],
  ),
  cls(
    'delivery',
    'Workstream',
    'Workstream',
    'A part of an initiative with its own lead. Place its tasks and deliverables inside it.',
    look('delivery', 'container', {
      subtitle: 'Status',
      border: {
        by: 'Status',
        values: { Green: '#2f9e44', Amber: '#f08c00', Red: '#e03131' },
        fallback: '#f08c00',
      },
    }),
    [text('Lead'), choice('Status', RAG, 'Status (red, amber, green)')],
  ),
  cls(
    'delivery',
    'Deliverable',
    'Deliverable',
    'Something a project hands over, with a due date and how it will be accepted.',
    look('delivery', 'document', { subtitle: 'Status' }),
    [date('Due'), choice('Status', WORK), long('AcceptanceCriteria')],
  ),
  cls(
    'delivery',
    'Milestone',
    'Milestone',
    'A point in time that marks progress, such as the end of a phase.',
    look('delivery', 'diamond', { icon: 'flag', subtitle: 'Date' }),
    [date('Date'), bool('Reached')],
  ),
  cls(
    'delivery',
    'Task',
    'Task',
    'A piece of work for one owner, with an effort and a due date.',
    look('delivery', 'rounded', { subtitle: 'Status' }),
    [
      text('Owner'),
      num('Effort', { unit: 'h', min: 0 }, 'Effort (hours)'),
      choice('Status', WORK),
      date('Due'),
    ],
  ),
  cls(
    'delivery',
    'Decision',
    'Decision',
    'A choice that was made or must be made, with the reason for it.',
    look('delivery', 'diamond', { subtitle: 'Status' }),
    [
      choice('Status', ['Proposed', 'Agreed', 'Superseded']),
      date('Date'),
      long('Rationale'),
    ],
  ),
  cls(
    'delivery',
    'Assumption',
    'Assumption',
    'Something taken as true for planning that still needs to be checked.',
    look('delivery', 'pill'),
    [bool('Validated'), choice('Impact', LOW_HIGH)],
  ),
  cls(
    'delivery',
    'Issue',
    'Issue',
    'A problem that is happening now and needs an owner to resolve it.',
    look('delivery', 'rounded', { icon: 'warning', subtitle: 'Severity' }),
    [
      choice('Severity', ['Low', 'Medium', 'High', 'Critical']),
      text('Owner'),
      choice('Status', ['Open', 'In progress', 'Resolved', 'Closed']),
      date('Due'),
    ],
  ),
  cls(
    'delivery',
    'Dependency',
    'Dependency',
    'Something the work needs from elsewhere, and by when it is needed.',
    look('delivery', 'pill', { subtitle: 'Status' }),
    [
      choice('Type', ['Internal', 'External']),
      date('NeededBy'),
      choice('Status', ['Open', 'Agreed', 'Delivered', 'At risk']),
    ],
  ),
  cls(
    'delivery',
    'Requirement',
    'Requirement',
    'A need the result must meet, with its priority and how it will be accepted.',
    look('delivery', 'rounded', { subtitle: 'Priority' }),
    [
      choice('Priority', [
        'Must have',
        'Should have',
        'Could have',
        "Won't have",
      ]),
      choice('Type', ['Functional', 'Non-functional']),
      long('AcceptanceCriteria'),
    ],
  ),

  // Data
  cls(
    'data',
    'DataDomain',
    'Data domain',
    'An area of the business that owns a set of data, such as sales or finance. Place its data inside it.',
    look('data', 'container', { subtitle: 'DomainOwner' }),
    [text('DomainOwner'), long('Description')],
  ),
  cls(
    'data',
    'SourceSystem',
    'Source system',
    'A system where data is first created or captured.',
    look('data', 'box', { icon: 'database', subtitle: 'Technology' }),
    [
      text('Technology'),
      text('Owner'),
      choice('Hosting', ['On-premises', 'Cloud', 'Software as a service']),
    ],
  ),
  cls(
    'data',
    'DataStore',
    'Data store',
    'A place where data is kept for use, such as a warehouse, a lake or a database.',
    look('data', 'box', { icon: 'database', subtitle: 'Kind' }),
    [
      choice('Kind', [
        'Lake',
        'Warehouse',
        'Lakehouse',
        'Database',
        'Feature store',
        'Vector store',
      ]),
      text('Technology'),
      bool('ApprovedForPersonalData'),
    ],
  ),
  cls(
    'data',
    'Dataset',
    'Dataset',
    'A named collection of data, such as a table or a set of files, with how often it is refreshed and how sensitive it is.',
    look('data', 'header-box', {
      fields: ['Format', 'Refresh', 'Classification'],
    }),
    [
      text('Format'),
      choice('Refresh', [
        'Real time',
        'Hourly',
        'Daily',
        'Weekly',
        'Monthly',
        'On demand',
      ]),
      choice('Classification', LEVELS),
      bool('ContainsPersonalData'),
      int('RowCount', { min: 0 }),
    ],
  ),
  cls(
    'data',
    'DataEntity',
    'Data entity',
    'A kind of thing the data describes, such as Customer or Order, with its fields.',
    look('data', 'header-box'),
    [
      {
        type: 'table',
        key: 'Fields',
        label: 'Fields',
        columns: [
          { id: 'name', key: 'Name', type: 'text' },
          { id: 'type', key: 'Type', type: 'text' },
          { id: 'key', key: 'Key', type: 'boolean' },
          { id: 'nullable', key: 'Nullable', type: 'boolean' },
        ],
      },
    ],
  ),
  cls(
    'data',
    'DataProduct',
    'Data product',
    'Data packaged for others to use, with an owner, its consumers and a promised service level.',
    look('data', 'hexagon', { subtitle: 'Status' }),
    [
      text('Owner'),
      text('Consumers'),
      text('SLA', 'Service level'),
      choice('Status', ['Idea', 'In development', 'Live', 'Retired']),
    ],
  ),
  cls(
    'data',
    'DataPipeline',
    'Data pipeline',
    'A job that moves and transforms data from one place to another.',
    look('data', 'pill', { icon: 'gear', subtitle: 'Kind' }),
    [
      choice('Kind', ['Batch', 'Streaming', 'Change data capture']),
      text('Schedule'),
      text('Tool'),
    ],
  ),
  cls(
    'data',
    'EventStream',
    'Event stream',
    'A continuous flow of events that other systems can subscribe to.',
    look('data', 'pill', { icon: 'bolt', subtitle: 'Topic' }),
    [text('Topic'), text('Throughput'), text('Retention')],
  ),
  cls(
    'data',
    'API',
    'API',
    'An interface that other systems call to read or change data.',
    look('data', 'pill', { subtitle: 'Protocol' }),
    [
      choice('Protocol', ['REST', 'GraphQL', 'gRPC']),
      text('Auth', 'Authentication'),
      text('Version'),
    ],
  ),
  cls(
    'data',
    'ReportOrDashboard',
    'Report or dashboard',
    'A report or dashboard that shows data to people.',
    look('data', 'document', { subtitle: 'Audience' }),
    [text('Tool'), text('Audience'), text('Refresh')],
  ),
  cls(
    'data',
    'DataQualityRule',
    'Data quality rule',
    'A check on data, with the share of records that must pass. Passing compares the last result with the threshold.',
    look('data', 'rounded', {
      icon: 'check',
      subtitle: 'Dimension',
      border: {
        by: 'Passing',
        values: { true: '#2f9e44', false: '#e03131' },
        fallback: '#1c7ed6',
      },
    }),
    [
      choice('Dimension', [
        'Completeness',
        'Validity',
        'Uniqueness',
        'Timeliness',
        'Accuracy',
        'Consistency',
      ]),
      num('Threshold', { unit: '%', min: 0, max: 100 }),
      num('LastResult', { unit: '%', min: 0, max: 100 }),
      formula(
        'Passing',
        'LastResult == null || Threshold == null ? null : LastResult >= Threshold',
        'boolean',
        'Yes when the last result reached the threshold.',
      ),
    ],
  ),

  // AI and machine learning
  cls(
    'ai',
    'AIUseCase',
    'AI use case',
    'A way to use AI for a business purpose, rated by the value it brings and how feasible it is.',
    look('ai', 'header-box', {
      icon: 'star',
      fields: ['Value', 'Feasibility', 'Status'],
    }),
    [
      scale('Value'),
      scale('Feasibility'),
      choice('Status', [
        'Idea',
        'Assessed',
        'Pilot',
        'In production',
        'Stopped',
      ]),
    ],
  ),
  cls(
    'ai',
    'MLModel',
    'ML model',
    'A machine learning model trained for one task, with the metric it is judged by.',
    look('ai', 'hexagon', { icon: 'bot', subtitle: 'Task' }),
    [
      choice('Task', [
        'Classification',
        'Regression',
        'Forecasting',
        'Ranking',
        'Clustering',
        'Generation',
      ]),
      text('Framework'),
      text('Version'),
      text('Metric'),
      num('Score'),
    ],
  ),
  cls(
    'ai',
    'FoundationModel',
    'Foundation model',
    'A large pre-trained model used through prompts, such as a language model.',
    look('ai', 'hexagon', { icon: 'bot', subtitle: 'Provider' }),
    [
      text('Provider'),
      int('ContextWindow', { min: 0 }, 'Context window (tokens)'),
      choice('Hosting', ['Provider service', 'Private cloud', 'On-premises']),
      num('CostPer1kTokens', { min: 0 }, 'Cost per 1,000 tokens'),
    ],
  ),
  cls(
    'ai',
    'Prompt',
    'Prompt',
    'The instructions given to a model, kept with a version and an owner.',
    look('ai', 'document', { subtitle: 'Version' }),
    [long('Template'), text('Version'), text('Owner')],
  ),
  cls(
    'ai',
    'AIAgent',
    'AI agent',
    'A program that uses a model to plan and take actions with tools, within the autonomy it is given.',
    look('ai', 'person', { icon: 'bot', subtitle: 'Autonomy' }),
    [
      choice('Autonomy', ['Suggests', 'Acts with approval', 'Acts alone']),
      long('Tools'),
      num('CostLimit', { min: 0 }),
    ],
  ),
  cls(
    'ai',
    'KnowledgeBase',
    'Knowledge base',
    'Documents prepared for a model to search, split into chunks and stored as embeddings.',
    look('ai', 'box', { icon: 'database', subtitle: 'Source' }),
    [text('Source'), text('Chunking'), text('EmbeddingModel'), text('Refresh')],
  ),
  cls(
    'ai',
    'Feature',
    'Feature',
    'One input value a model learns from, with where it comes from.',
    look('ai', 'pill', { subtitle: 'Type' }),
    [
      choice('Type', ['Numeric', 'Categorical', 'Text', 'Embedding', 'Date']),
      text('Source'),
      text('Owner'),
    ],
  ),
  cls(
    'ai',
    'Experiment',
    'Experiment',
    'A test of an idea, with the hypothesis, the metric and what came out.',
    look('ai', 'rounded', { subtitle: 'Result' }),
    [long('Hypothesis'), text('Metric'), text('Result'), date('Date')],
  ),
  cls(
    'ai',
    'Evaluation',
    'Evaluation',
    'A measured test of a model or prompt on a test dataset. Passed compares the score with the threshold.',
    look('ai', 'rounded', {
      icon: 'check',
      subtitle: 'Metric',
      border: {
        by: 'Passed',
        values: { true: '#2f9e44', false: '#e03131' },
        fallback: '#9c36b5',
      },
    }),
    [
      text('TestSet', 'Test dataset'),
      text('Metric'),
      num('Score'),
      num('Threshold'),
      formula(
        'Passed',
        'Score == null || Threshold == null ? null : Score >= Threshold',
        'boolean',
        'Yes when the score reached the threshold.',
      ),
    ],
  ),
  cls(
    'ai',
    'Guardrail',
    'Guardrail',
    'A check on what goes into or comes out of a model, or a policy it must follow.',
    look('ai', 'hexagon', { icon: 'lock', subtitle: 'Type' }),
    [choice('Type', ['Input', 'Output', 'Policy']), long('Rule')],
  ),
  cls(
    'ai',
    'ModelDeployment',
    'Model deployment',
    'A model running in an environment where others can call it.',
    look('ai', 'box', { icon: 'cloud', subtitle: 'Environment' }),
    [
      choice('Environment', STAGES),
      text('Endpoint'),
      text('Version'),
      choice('Status', ['Planned', 'Live', 'Retired']),
    ],
  ),
  cls(
    'ai',
    'Monitor',
    'Monitor',
    'A watch on a running model or pipeline that raises an alert when a signal crosses its threshold.',
    look('ai', 'circle', { icon: 'clock' }),
    [
      choice('Signal', ['Drift', 'Latency', 'Cost', 'Quality']),
      num('Threshold'),
      text('AlertChannel'),
    ],
  ),

  // Applications and cloud
  cls(
    'apps',
    'Application',
    'Application',
    'A software application people use, with its owner and what should happen to it.',
    look('apps', 'box', { subtitle: 'Lifecycle' }),
    [
      text('Owner'),
      choice('Lifecycle', ['Invest', 'Tolerate', 'Migrate', 'Eliminate']),
      int('Users', { min: 0 }),
    ],
  ),
  cls(
    'apps',
    'Service',
    'Service',
    'A piece of software that offers one function to other software.',
    look('apps', 'pill', { icon: 'gear', subtitle: 'Team' }),
    [text('Team'), text('Language'), text('Runtime')],
  ),
  cls(
    'apps',
    'CloudPlatform',
    'Cloud platform',
    'A cloud account or region where systems run. Place what runs there inside it.',
    look('apps', 'container', { icon: 'cloud', subtitle: 'Region' }),
    [text('Provider'), text('Region')],
  ),
  cls(
    'apps',
    'Environment',
    'Environment',
    'A stage such as development, test or production. Place what runs there inside it.',
    look('apps', 'container', { subtitle: 'Stage' }),
    [choice('Stage', STAGES)],
  ),
  cls(
    'apps',
    'Compute',
    'Compute',
    'Machines or runtime capacity that software runs on.',
    look('apps', 'box', { subtitle: 'Type' }),
    [
      choice('Type', ['Virtual machine', 'Container', 'Serverless', 'GPU']),
      text('Size'),
    ],
  ),
  cls(
    'apps',
    'Integration',
    'Integration',
    'A connection that exchanges data between two systems.',
    look('apps', 'pill', { subtitle: 'Pattern' }),
    [choice('Pattern', ['Batch', 'API', 'Event', 'File']), text('Frequency')],
  ),
  cls(
    'apps',
    'Interface',
    'Interface',
    'A point where a system receives or sends data, with its format.',
    look('apps', 'pill', { subtitle: 'Direction' }),
    [choice('Direction', ['Inbound', 'Outbound', 'Both']), text('Format')],
  ),

  // Governance and risk
  cls(
    'governance',
    'Policy',
    'Policy',
    'A rule the organisation sets for itself, with when it applies and when it is reviewed.',
    look('governance', 'document', { icon: 'lock', subtitle: 'Owner' }),
    [text('Owner'), date('EffectiveDate'), date('ReviewDate')],
  ),
  cls(
    'governance',
    'Control',
    'Control',
    'A measure that prevents or detects a problem, and whether it works.',
    look('governance', 'rounded', { icon: 'check', subtitle: 'Type' }),
    [
      choice('Type', ['Preventive', 'Detective']),
      text('Frequency'),
      bool('Effective'),
    ],
  ),
  cls(
    'governance',
    'Risk',
    'Risk',
    'Something that may go wrong. Score is likelihood times impact; Rating turns it into Low, Medium or High and colours the shape.',
    look('governance', 'diamond', {
      icon: 'warning',
      subtitle: 'Rating',
      fill: {
        by: 'Rating',
        values: { Low: '#b2f2bb', Medium: '#ffec99', High: '#ffc9c9' },
        fallback: '#e9ecef',
      },
    }),
    [
      scale('Likelihood'),
      scale('Impact'),
      text('Owner'),
      choice('Status', ['Open', 'Mitigated', 'Accepted', 'Closed']),
      formula(
        'Score',
        'Likelihood == null || Impact == null ? null : Likelihood * Impact',
        'number',
        'Likelihood times impact, from 1 to 25.',
      ),
      formula(
        'Rating',
        "Score == null ? null : (Score >= 15 ? 'High' : (Score >= 8 ? 'Medium' : 'Low'))",
        'text',
        'High from 15, Medium from 8, otherwise Low.',
      ),
    ],
  ),
  cls(
    'governance',
    'Regulation',
    'Regulation',
    'A law or external rule the organisation must follow.',
    look('governance', 'document', { subtitle: 'Jurisdiction' }),
    [text('Jurisdiction'), text('Reference')],
  ),
  cls(
    'governance',
    'Classification',
    'Classification',
    'A level of sensitivity that decides who may see data.',
    look('governance', 'pill', { icon: 'lock', subtitle: 'Level' }),
    [choice('Level', LEVELS)],
  ),
  cls(
    'governance',
    'DataOwner',
    'Data owner',
    'The person accountable for a set of data and for decisions about it.',
    look('governance', 'person', { subtitle: 'Domain' }),
    [text('Domain'), text('Email')],
  ),
  cls(
    'governance',
    'DataSteward',
    'Data steward',
    'The person who looks after the quality and meaning of a set of data day to day.',
    look('governance', 'person', { subtitle: 'Domain' }),
    [text('Domain'), text('Email')],
  ),
];

function rel(
  key: string,
  label: string,
  help: string,
  from: string[],
  to: string[],
  shape: RelationLook,
  attributes: CatalogAttribute[] = [],
): CatalogRelation {
  return {
    key,
    labels: { en: label },
    help,
    from,
    to,
    attributes,
    look: shape,
  };
}

const DATA_LINE = '#1c7ed6';
const AI_LINE = '#9c36b5';
const GOV_LINE = '#e03131';
const PLAIN_LINE = '#6b7a90';

export const CATALOG_RELATIONS: readonly CatalogRelation[] = [
  rel(
    'FlowsTo',
    'Flows to',
    'Data moves from one place to the next.',
    [
      'SourceSystem',
      'DataPipeline',
      'DataStore',
      'Dataset',
      'EventStream',
      'API',
    ],
    [
      'DataPipeline',
      'DataStore',
      'Dataset',
      'ReportOrDashboard',
      'MLModel',
      'API',
    ],
    line(DATA_LINE, { label: 'Frequency' }),
    [text('Frequency'), text('Format'), bool('ContainsPersonalData')],
  ),
  rel(
    'ReadsFrom',
    'Reads from',
    'One thing reads data from another.',
    ['DataPipeline', 'MLModel', 'AIAgent'],
    ['DataStore', 'Dataset', 'KnowledgeBase', 'API'],
    line(DATA_LINE, { style: 'dashed' }),
  ),
  rel(
    'WritesTo',
    'Writes to',
    'A pipeline writes data into a store or a dataset.',
    ['DataPipeline'],
    ['DataStore', 'Dataset'],
    line(DATA_LINE),
  ),
  rel(
    'TrainsOn',
    'Trains on',
    'A model learns from a dataset or a feature.',
    ['MLModel'],
    ['Dataset', 'Feature'],
    line(AI_LINE, { style: 'dashed' }),
  ),
  rel(
    'UsesModel',
    'Uses model',
    'A use case, agent or application relies on a model.',
    ['AIUseCase', 'AIAgent', 'Application'],
    ['MLModel', 'FoundationModel'],
    line(AI_LINE),
  ),
  rel(
    'Owns',
    'Owns',
    'A person or team is accountable for something.',
    ['Person', 'Team', 'DataOwner'],
    [],
    line(PLAIN_LINE, { start: 'diamond', end: 'none' }),
  ),
  rel(
    'Stewards',
    'Stewards',
    'A data steward looks after data day to day.',
    ['DataSteward'],
    ['Dataset', 'DataProduct', 'DataEntity'],
    line(PLAIN_LINE, { style: 'dashed', start: 'circle', end: 'none' }),
  ),
  rel(
    'Measures',
    'Measures',
    'A KPI measures how well something is doing.',
    ['KPI'],
    ['Goal', 'BusinessProcess', 'AIUseCase', 'Initiative'],
    line('#2f9e44', { style: 'dotted' }),
  ),
  rel(
    'ContributesTo',
    'Contributes to',
    'Something helps to reach a goal or to move a KPI.',
    ['AIUseCase', 'Initiative', 'Benefit'],
    ['Goal', 'KPI'],
    line('#2f9e44'),
  ),
  rel(
    'Supports',
    'Supports',
    'A capability or application makes a process or value stream possible.',
    ['BusinessCapability', 'Application'],
    ['BusinessProcess', 'ValueStream'],
    line(PLAIN_LINE),
  ),
  rel(
    'DependsOn',
    'Depends on',
    'One thing needs another to work or to be done first.',
    [],
    [],
    line(PLAIN_LINE, { style: 'dashed', end: 'open-arrow' }),
  ),
  rel(
    'Mitigates',
    'Mitigates',
    'A control or guardrail makes a risk less likely or less harmful.',
    ['Control', 'Guardrail'],
    ['Risk'],
    line(GOV_LINE, { end: 'bar' }),
  ),
  rel(
    'HasRisk',
    'Has risk',
    'Something is exposed to a risk.',
    ['AIUseCase', 'Initiative', 'DataProduct', 'Application'],
    ['Risk'],
    line(GOV_LINE, { style: 'dotted' }),
  ),
  rel(
    'GovernedBy',
    'Governed by',
    'Data or a use case must follow a policy or a regulation.',
    ['Dataset', 'DataProduct', 'AIUseCase'],
    ['Policy', 'Regulation'],
    line(GOV_LINE, { style: 'dashed', end: 'open-arrow' }),
  ),
  rel(
    'Delivers',
    'Delivers',
    'A workstream or initiative produces a deliverable.',
    ['Workstream', 'Initiative'],
    ['Deliverable'],
    line('#f08c00'),
  ),
  rel(
    'Evaluates',
    'Evaluates',
    'An evaluation tests a model or a prompt.',
    ['Evaluation'],
    ['MLModel', 'FoundationModel', 'Prompt'],
    line(AI_LINE, { style: 'dotted' }),
  ),
  rel(
    'DeployedAs',
    'Deployed as',
    'A model runs as a deployment.',
    ['MLModel'],
    ['ModelDeployment'],
    line(AI_LINE, { end: 'triangle' }),
  ),
  rel(
    'Monitors',
    'Monitors',
    'A monitor watches a deployment or a pipeline.',
    ['Monitor'],
    ['ModelDeployment', 'DataPipeline'],
    line(AI_LINE, { style: 'dashed' }),
  ),
  rel(
    'Defines',
    'Defines',
    'A glossary term gives the meaning of an entity or a dataset.',
    ['GlossaryTerm'],
    ['DataEntity', 'Dataset'],
    line(PLAIN_LINE, { style: 'dotted' }),
  ),
];
