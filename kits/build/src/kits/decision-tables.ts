import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  line,
  long,
  look,
  table,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Decision tables in the style of decision modelling: decisions with their logic as a table of
 * rules, the input data and other decisions they need, business knowledge models with reusable
 * logic, and knowledge sources that give a decision its authority.
 */

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const c = (relation: string, from: string, to: string): SampleConnector => ({
  relation,
  from,
  to,
});

/** Rows of a decision table: conditions, outcome and an optional note. */
const rules = (rows: [string, string, string?][]) =>
  rows.map(([conditions, outcome, annotation]) => ({
    conditions,
    outcome,
    ...(annotation ? { annotation } : {}),
  }));

export const decisionTables: KitSpec = {
  folder: 'decision-tables',
  id: 'kit_decisiontables' as KitId,
  name: 'Decision tables (DMN-style)',
  catalog: { keys: ['Note'] },
  classes: [
    {
      key: 'Decision',
      label: 'Decision',
      help: 'A question that is answered the same way every time, from the inputs it needs. Its logic is a decision table: one row per rule, with conditions and an outcome.',
      look: look('header-box', {
        fill: '#fff9db',
        border: '#f08c00',
        borderWidth: 2,
        icon: 'gear',
        fields: ['Output', 'HitPolicy', 'Rules'],
        width: 220,
      }),
      attributes: [
        long('Question', {
          help: 'The question it answers, such as "Which risk category does the applicant fall into?".',
        }),
        text('Output', {
          help: 'What it decides, such as "Risk category".',
        }),
        text('AllowedOutcomes', {
          help: 'The answers it can give, such as "Low, Medium, High".',
        }),
        choice('Logic', ['Decision table', 'Expression', 'Manual'], {
          default: 'Decision table',
          help: 'How the answer is found: by a table of rules, by one expression, or by a person.',
        }),
        choice(
          'HitPolicy',
          ['Unique', 'First', 'Priority', 'Any', 'Collect', 'Rule order'],
          {
            label: 'Hit policy',
            help: 'What happens when more than one rule matches. Unique: rules never overlap. First: the first match wins. Priority: the match with the highest outcome wins. Any: all matches give the same outcome. Collect: all outcomes are returned. Rule order: all outcomes, in the order of the rules.',
          },
        ),
        table(
          'DecisionTable',
          [
            { key: 'Conditions', type: 'text' },
            { key: 'Outcome', type: 'text' },
            { key: 'Annotation', type: 'text' },
          ],
          {
            label: 'Rules',
            help: 'One row per rule. Write the conditions on the inputs, such as "Credit score >= 700 and Years trading >= 3", and the outcome when they hold.',
          },
        ),
        text('Owner'),
        choice('Status', ['Draft', 'In review', 'Approved', 'Retired']),
        formula(
          'Rules',
          'len(DecisionTable)',
          'number',
          'How many rules its table has.',
        ),
        formula(
          'Inputs',
          "count(incoming('InformationRequirement'))",
          'number',
          'How many input data and decisions it needs.',
        ),
      ],
      constraints: [
        {
          id: 'k_decision_inputs',
          formula: 'Inputs > 0',
          message:
            '= \'Decision "\' + Name + \'" has no inputs: connect the input data or decisions it needs with "Information requirement".\'',
        },
        {
          id: 'k_decision_rules',
          formula: "Logic != 'Decision table' || Rules > 0",
          message:
            "= 'Decision \"' + Name + '\" is a decision table without rules: add one row per rule.'",
        },
        {
          id: 'k_decision_policy',
          formula: "Logic != 'Decision table' || HitPolicy != null",
          message:
            "= 'Decision \"' + Name + '\" has no hit policy: say what happens when more than one rule matches.'",
        },
      ],
    },
    {
      key: 'InputData',
      label: 'Input data',
      help: 'A piece of information a decision needs, such as the amount of a loan.',
      look: look('pill', {
        fill: '#d0ebff',
        border: '#1c7ed6',
        subtitle: 'DataType',
        width: 170,
        height: 54,
      }),
      attributes: [
        long('Description'),
        choice('DataType', ['Text', 'Number', 'Yes or no', 'Date', 'List'], {
          label: 'Data type',
        }),
        text('AllowedValues', {
          help: 'The values it can take, such as "0 to 999" or "Yes, No".',
        }),
        text('Source', { help: 'Where the value comes from.' }),
      ],
      constraints: [
        {
          id: 'k_input_used',
          formula: "count(outgoing('InformationRequirement')) > 0",
          message:
            "= 'Input data \"' + Name + '\" is not used by any decision.'",
        },
      ],
    },
    {
      key: 'BusinessKnowledgeModel',
      label: 'Business knowledge model',
      help: 'Logic that can be reused by several decisions, such as a calculation or a scoring table.',
      look: look('hexagon', {
        fill: '#e5dbff',
        border: '#6741d9',
        subtitle: 'Parameters',
        width: 200,
        height: 80,
      }),
      attributes: [
        long('Description'),
        text('Parameters', {
          help: 'The values it takes, such as "amount, rate, months".',
        }),
        long('Logic', { help: 'The calculation or rules it applies.' }),
      ],
    },
    {
      key: 'KnowledgeSource',
      label: 'Knowledge source',
      help: 'Where the logic of a decision comes from or who answers for it, such as a policy, a regulation or a team of experts.',
      look: look('document', {
        fill: '#f8f9fa',
        border: '#495057',
        icon: 'document',
        subtitle: 'Kind',
        width: 170,
      }),
      attributes: [
        long('Description'),
        choice('Kind', [
          'Policy',
          'Regulation',
          'Guideline',
          'Expert',
          'Analysis',
        ]),
        text('Owner'),
        text('Reference', { help: 'Where to find it, such as a link.' }),
      ],
    },
  ],
  relations: [
    {
      key: 'InformationRequirement',
      label: 'Information requirement',
      help: 'The decision needs this input data, or the outcome of this other decision.',
      from: ['InputData', 'Decision'],
      to: ['Decision'],
      look: line('#343a40', { end: 'triangle' }),
    },
    {
      key: 'KnowledgeRequirement',
      label: 'Knowledge requirement',
      help: 'The decision or business knowledge model uses the logic of this business knowledge model.',
      from: ['BusinessKnowledgeModel'],
      to: ['Decision', 'BusinessKnowledgeModel'],
      look: line('#6741d9', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'AuthorityRequirement',
      label: 'Authority requirement',
      help: 'The knowledge source is the authority for the decision, business knowledge model or other knowledge source.',
      from: ['KnowledgeSource', 'InputData'],
      to: ['Decision', 'BusinessKnowledgeModel', 'KnowledgeSource'],
      look: line('#495057', { style: 'dashed', end: 'circle' }),
    },
    {
      key: 'Annotates',
      label: 'Annotates',
      help: 'The note explains the object it points to.',
      from: ['Note'],
      to: [
        'Decision',
        'InputData',
        'BusinessKnowledgeModel',
        'KnowledgeSource',
      ],
      look: line('#adb5bd', { style: 'dotted', end: 'none' }),
    },
  ],
  modelTypes: [
    {
      key: 'DecisionModel',
      label: 'Decision requirements',
      help: 'Decisions with their decision tables, the input data and decisions they need, the business knowledge models they use and the knowledge sources behind them.',
      views: [
        {
          key: 'Requirements',
          label: 'Requirements only',
          classes: ['Decision', 'InputData'],
          relations: ['InformationRequirement'],
        },
      ],
      cardinalities: [{ kind: 'count', class: 'Decision', min: 1 }],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Domain', { help: 'The area of the business, such as lending.' }),
        text('Owner'),
        formula(
          'Decisions',
          "count(objects('Decision'))",
          'number',
          'How many decisions the model has.',
        ),
        formula(
          'TotalRules',
          "sum(objects('Decision').Rules)",
          'number',
          'The rules of all decision tables added up.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Decision',
      tabs: [
        {
          label: 'Decision',
          items: [
            'Name',
            { attribute: 'Question', control: 'textarea' },
            'Output',
            'AllowedOutcomes',
            'Owner',
            { attribute: 'Status', control: 'select' },
          ],
        },
        {
          label: 'Logic',
          items: [
            { attribute: 'Logic', control: 'segmented' },
            { attribute: 'HitPolicy', control: 'select' },
            'DecisionTable',
            'Rules',
            'Inputs',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'loan-approval.mkmodel.json',
    id: 'mdl_loanapproval',
    name: 'Small business loan approval',
    modelType: 'DecisionModel',
    attributes: {
      Title: 'Small business loan approval',
      Domain: 'Lending',
      Owner: 'Head of business lending',
    },
    // "Fraud check" is made by hand and has no inputs yet, on purpose.
    intendedWarnings: 1,
    elements: [
      e('d_approval', 'Decision', 470, 20, {
        Name: 'Loan approval',
        Question: 'Do we approve, decline or refer the application?',
        Output: 'Approval',
        AllowedOutcomes: 'Approve, Decline, Refer',
        Logic: 'Decision table',
        HitPolicy: 'First',
        Owner: 'Head of business lending',
        Status: 'Approved',
        DecisionTable: rules([
          ['Fraud check is "Refer"', 'Refer', 'Never decide automatically.'],
          ['Affordable is "No"', 'Decline'],
          ['Risk category is "High"', 'Decline'],
          [
            'Risk category is "Medium" and Loan amount > 100,000',
            'Refer',
            'A lending officer decides.',
          ],
          ['Otherwise', 'Approve'],
        ]),
      }),
      e('ks_policy', 'KnowledgeSource', 860, 30, {
        Name: 'Lending policy',
        Kind: 'Policy',
        Owner: 'Credit committee',
      }),
      e('d_fraud', 'Decision', 40, 240, {
        Name: 'Fraud check',
        Question: 'Does the application need a fraud review?',
        Output: 'Fraud check',
        AllowedOutcomes: 'Clear, Refer',
        Logic: 'Manual',
        Owner: 'Fraud team',
        Status: 'Draft',
      }),
      e('d_risk', 'Decision', 330, 240, {
        Name: 'Risk category',
        Question: 'How risky is lending to this business?',
        Output: 'Risk category',
        AllowedOutcomes: 'Low, Medium, High',
        Logic: 'Decision table',
        HitPolicy: 'Unique',
        Owner: 'Credit risk team',
        Status: 'Approved',
        DecisionTable: rules([
          ['Credit score >= 700 and Years trading >= 3', 'Low'],
          ['Credit score >= 700 and Years trading < 3', 'Medium'],
          ['Credit score 600 to 699', 'Medium'],
          ['Credit score < 600', 'High'],
        ]),
      }),
      e('d_afford', 'Decision', 640, 240, {
        Name: 'Affordability',
        Question: 'Can the business afford the repayments?',
        Output: 'Affordable',
        AllowedOutcomes: 'Yes, No',
        Logic: 'Decision table',
        HitPolicy: 'Unique',
        Owner: 'Credit risk team',
        Status: 'In review',
        DecisionTable: rules([
          ['Monthly repayment <= 20% of monthly turnover', 'Yes'],
          [
            'Monthly repayment > 20% of monthly turnover',
            'No',
            'Turnover is the average of the last twelve months.',
          ],
        ]),
      }),
      e('bkm_repay', 'BusinessKnowledgeModel', 950, 460, {
        Name: 'Repayment calculation',
        Parameters: 'amount, rate, months',
        Logic: 'amount * rate / (1 - (1 + rate) ** -months)',
      }),
      e('ks_risk', 'KnowledgeSource', 100, 30, {
        Name: 'Credit risk team',
        Kind: 'Expert',
      }),
      e('in_score', 'InputData', 240, 460, {
        Name: 'Credit score',
        DataType: 'Number',
        AllowedValues: '0 to 999',
        Source: 'Credit reference check',
      }),
      e('in_years', 'InputData', 440, 460, {
        Name: 'Years trading',
        DataType: 'Number',
        Source: 'Application form',
      }),
      e('in_amount', 'InputData', 960, 268, {
        Name: 'Loan amount',
        DataType: 'Number',
        Source: 'Application form',
      }),
      e('in_turnover', 'InputData', 690, 460, {
        Name: 'Monthly turnover',
        DataType: 'Number',
        Source: 'Bank statements',
      }),
      e(
        'note_fraud',
        'Note',
        40,
        420,
        {
          Name: 'Checked by hand',
          Text: 'The fraud team checks every application by hand until a scoring model is ready.',
        },
        { w: 200, h: 90 },
      ),
    ],
    connectors: [
      c('InformationRequirement', 'd_fraud', 'd_approval'),
      c('InformationRequirement', 'd_risk', 'd_approval'),
      c('InformationRequirement', 'd_afford', 'd_approval'),
      c('InformationRequirement', 'in_amount', 'd_approval'),
      c('InformationRequirement', 'in_score', 'd_risk'),
      c('InformationRequirement', 'in_years', 'd_risk'),
      c('InformationRequirement', 'in_amount', 'd_afford'),
      c('InformationRequirement', 'in_turnover', 'd_afford'),
      c('KnowledgeRequirement', 'bkm_repay', 'd_afford'),
      c('AuthorityRequirement', 'ks_policy', 'd_approval'),
      c('AuthorityRequirement', 'ks_risk', 'd_risk'),
      c('Annotates', 'note_fraud', 'd_fraud'),
    ],
  },
};
