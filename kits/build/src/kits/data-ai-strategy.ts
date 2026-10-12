import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  line,
  long,
  look,
  num,
  scale,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Data and AI strategy: a vision, goals and objectives, value drivers, AI use cases, the data and
 * AI capabilities they need, initiatives on a roadmap and the benefits they bring.
 */

const STATUS_FILL = {
  by: 'Status',
  values: {
    Proposed: '#fff4e6',
    Approved: '#ffe8cc',
    'In progress': '#ffd8a8',
    Done: '#d3f9d8',
    Stopped: '#e9ecef',
  },
  fallback: '#fff4e6',
};

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const c = (
  relation: string,
  from: string,
  to: string,
  attributes?: SampleConnector['attributes'],
): SampleConnector => ({
  relation,
  from,
  to,
  ...(attributes ? { attributes } : {}),
});

const initiative = (
  id: string,
  phase: string,
  x: number,
  values: Record<string, string | number>,
) => e(id, 'Initiative', x, 930, values, { parent: phase });

export const dataAiStrategy: KitSpec = {
  folder: 'data-ai-strategy',
  id: 'kit_dataaistrategy' as KitId,
  name: 'Data and AI strategy',
  catalog: { keys: ['Goal', 'AIUseCase', 'Initiative', 'Benefit'] },
  classes: [
    {
      key: 'Vision',
      label: 'Vision',
      help: 'Where the organisation wants to be with data and AI, in one or two sentences.',
      look: look('rounded', {
        fill: '#e5dbff',
        border: '#6741d9',
        icon: 'star',
        subtitle: 'Horizon',
        width: 260,
        height: 80,
      }),
      attributes: [
        long('Statement'),
        text('Horizon', { help: 'The year the vision aims at, such as 2030.' }),
      ],
    },
    {
      key: 'Objective',
      label: 'Objective',
      help: 'A measurable step towards a goal, with a target date and an owner.',
      look: look('rounded', {
        fill: '#d3f9d8',
        border: '#2f9e44',
        subtitle: 'TargetDate',
      }),
      attributes: [
        long('Description'),
        text('Measure', { help: 'How progress is measured.' }),
        date('TargetDate'),
        text('Owner'),
      ],
      constraints: [
        {
          id: 'k_objective_goal',
          formula: "count(outgoing('Refines')) > 0",
          message: "= 'Objective \"' + Name + '\" refines no goal.'",
        },
      ],
    },
    {
      key: 'ValueDriver',
      label: 'Value driver',
      help: 'A way data and AI create value, such as revenue growth or lower cost. Benefits count towards it.',
      look: look('pill', {
        fill: '#fff3bf',
        border: '#f08c00',
        icon: 'bolt',
        subtitle: 'Category',
        width: 160,
      }),
      attributes: [
        long('Description'),
        choice('Category', [
          'Revenue growth',
          'Cost reduction',
          'Risk reduction',
          'Customer experience',
          'Productivity',
        ]),
      ],
    },
    {
      key: 'DataAICapability',
      label: 'Data and AI capability',
      help: 'Something the organisation must be able to do with data or AI, with its maturity now and the maturity it needs.',
      look: look('header-box', {
        fill: '#d0ebff',
        border: '#1c7ed6',
        icon: 'database',
        fields: ['Category', 'CurrentMaturity', 'TargetMaturity', 'Gap'],
      }),
      attributes: [
        long('Description'),
        choice('Category', [
          'Data management',
          'Data platform',
          'Analytics',
          'AI and machine learning',
          'Governance',
          'People and skills',
        ]),
        scale('CurrentMaturity', {
          help: '1 initial, 2 repeatable, 3 defined, 4 managed, 5 optimised.',
        }),
        scale('TargetMaturity', {
          help: 'The maturity the strategy needs.',
        }),
        formula(
          'Gap',
          'CurrentMaturity == null || TargetMaturity == null ? null : TargetMaturity - CurrentMaturity',
          'number',
          'Target maturity minus current maturity.',
        ),
      ],
    },
    {
      key: 'RoadmapPhase',
      label: 'Roadmap phase',
      help: 'A stretch of time on the roadmap, such as a year. Place the initiatives of that phase inside it.',
      look: look('container', {
        fill: '#f8f9fa',
        border: '#495057',
        width: 400,
        height: 180,
      }),
      attributes: [
        text('Period', { help: 'Such as "2027" or "2027 Q1 to Q2".' }),
        long('Description'),
      ],
    },
  ],
  amend: {
    Goal: {
      attributes: [
        formula(
          'Support',
          "count(incoming('Refines')) + count(incoming('Drives')) + count(incoming('ContributesTo'))",
          'number',
          'How many objectives, value drivers, initiatives, use cases and benefits point to this goal.',
          { label: 'Supported by' },
        ),
      ],
      constraints: [
        {
          id: 'k_goal_support',
          formula: 'Support > 0',
          message:
            "= 'Nothing supports the goal \"' + Name + '\" yet: no objective, value driver, initiative, use case or benefit points to it.'",
        },
      ],
    },
    AIUseCase: {
      attributes: [
        formula(
          'Score',
          'Value == null || Feasibility == null ? null : Value * Feasibility',
          'number',
          'Value times feasibility, from 1 to 25.',
        ),
      ],
      look: look('header-box', {
        fill: '#eebefa',
        border: '#9c36b5',
        icon: 'bot',
        fields: ['Value', 'Feasibility', 'Score', 'Status'],
      }),
    },
    Initiative: {
      attributes: [
        text('Quarter', {
          label: 'Delivery quarter',
          pattern: '^[0-9]{4} Q[1-4]$',
          help: 'The quarter in which it delivers, such as "2027 Q3".',
        }),
        formula(
          'Phase',
          'parent ? parent.Name : null',
          'text',
          'The roadmap phase it sits in.',
        ),
        formula(
          'ExpectedBenefit',
          "sum(outgoing('Realises').RiskAdjustedValue)",
          'number',
          'The risk-adjusted value of the benefits it realises.',
        ),
        formula(
          'BenefitToCost',
          'Budget == null || Budget == 0 ? null : round(ExpectedBenefit / Budget, 2)',
          'number',
          'Expected benefit divided by budget. Above 1 the initiative pays for itself.',
          { label: 'Benefit to cost' },
        ),
      ],
      look: look('header-box', {
        fill: STATUS_FILL,
        border: '#f08c00',
        fields: ['Quarter', 'Status', 'ExpectedBenefit'],
      }),
      constraints: [
        {
          id: 'k_initiative_strategy',
          formula:
            "count(outgoing('ContributesTo')) > 0 || count(outgoing('Implements')) > 0",
          message:
            '= \'Initiative "\' + Name + \'" is not linked to the strategy: connect it to a goal or objective with "Contributes to", or to the AI use case it implements.\'',
        },
        {
          id: 'k_initiative_dates',
          formula: 'Start == null || End == null || Start <= End',
          message: "= 'Initiative \"' + Name + '\" ends before it starts.'",
        },
      ],
    },
    Benefit: {
      attributes: [
        num('EstimatedValue', {
          help: 'The value per year once the change is in place, in your currency.',
        }),
        num('RealisedValue', { help: 'The value reached so far, per year.' }),
        choice('Confidence', ['Low', 'Medium', 'High'], {
          help: 'How sure the estimate is. Low counts 30%, Medium 60% and High 90% of it.',
        }),
        formula(
          'RiskAdjustedValue',
          "EstimatedValue == null ? null : round(EstimatedValue * (Confidence == 'High' ? 0.9 : Confidence == 'Medium' ? 0.6 : 0.3), 0)",
          'number',
          'The estimated value weighted by the confidence.',
        ),
        formula(
          'RealisedShare',
          'EstimatedValue == null || RealisedValue == null || EstimatedValue == 0 ? null : round(RealisedValue / EstimatedValue * 100, 1)',
          'number',
          'The realised value as a percentage of the estimate.',
          { label: 'Realised (%)' },
        ),
      ],
      look: look('header-box', {
        fill: '#b2f2bb',
        border: '#2f9e44',
        icon: 'star',
        fields: ['Type', 'EstimatedValue', 'RiskAdjustedValue'],
      }),
    },
  },
  relations: [
    {
      key: 'Refines',
      label: 'Refines',
      help: 'An objective makes a goal concrete, or a goal works towards the vision.',
      from: ['Objective', 'Goal'],
      to: ['Goal', 'Vision'],
      look: line('#2f9e44', { end: 'triangle' }),
    },
    {
      key: 'Drives',
      label: 'Drives',
      help: 'The value driver is a reason for the goal or objective.',
      from: ['ValueDriver'],
      to: ['Goal', 'Objective'],
      look: line('#f08c00', { style: 'dashed' }),
    },
    {
      key: 'Realises',
      label: 'Realises',
      help: 'The initiative or use case brings the benefit.',
      from: ['Initiative', 'AIUseCase'],
      to: ['Benefit'],
      look: line('#2f9e44'),
    },
    {
      key: 'Implements',
      label: 'Implements',
      help: 'The initiative builds and runs the AI use case.',
      from: ['Initiative'],
      to: ['AIUseCase'],
      look: line('#9c36b5'),
    },
    {
      key: 'Builds',
      label: 'Builds',
      help: 'The initiative raises the maturity of the capability.',
      from: ['Initiative'],
      to: ['DataAICapability'],
      look: line('#1c7ed6'),
    },
    {
      key: 'Needs',
      label: 'Needs',
      help: 'The use case cannot work without the capability.',
      from: ['AIUseCase'],
      to: ['DataAICapability'],
      look: line('#1c7ed6', { style: 'dotted' }),
    },
    {
      key: 'DependsOn',
      label: 'Depends on',
      help: 'The initiative can start or finish only after the other initiative, or once the capability is in place.',
      from: ['Initiative'],
      to: ['Initiative', 'DataAICapability'],
      look: line('#495057', { style: 'dashed', end: 'open-arrow' }),
    },
  ],
  amendRelations: {
    ContributesTo: { to: ['Objective', 'ValueDriver'] },
  },
  modelTypes: [
    {
      key: 'Strategy',
      label: 'Data and AI strategy',
      help: 'A vision with goals and objectives, value drivers, AI use cases, data and AI capabilities, initiatives on a roadmap and their benefits.',
      views: [
        {
          key: 'Roadmap',
          label: 'Roadmap',
          classes: ['RoadmapPhase', 'Initiative', 'DataAICapability'],
          relations: ['DependsOn', 'Builds'],
        },
        {
          key: 'Value',
          label: 'Value',
          classes: [
            'Vision',
            'Goal',
            'Objective',
            'ValueDriver',
            'Benefit',
            'Initiative',
            'AIUseCase',
          ],
          relations: [
            'Refines',
            'Drives',
            'ContributesTo',
            'Realises',
            'Implements',
          ],
        },
      ],
      cardinalities: [{ kind: 'count', class: 'Vision', max: 1 }],
      containers: { RoadmapPhase: ['Initiative'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('StrategyOwner'),
        formula(
          'TotalBudget',
          "sum(objects('Initiative').Budget)",
          'number',
          'The budget of all initiatives.',
        ),
        formula(
          'TotalExpectedBenefit',
          "sum(objects('Benefit').RiskAdjustedValue)",
          'number',
          'The risk-adjusted value of all benefits, per year.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Initiative',
      tabs: [
        {
          label: 'Initiative',
          items: [
            'Name',
            { attribute: 'Status', control: 'select' },
            'Sponsor',
            { attribute: 'Description', control: 'textarea' },
            'Phase',
            'Quarter',
          ],
        },
        {
          label: 'Money and dates',
          items: ['Budget', 'ExpectedBenefit', 'BenefitToCost', 'Start', 'End'],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Benefit',
      tabs: [
        {
          label: 'Benefit',
          items: [
            'Name',
            { attribute: 'Type', control: 'segmented' },
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Value',
          items: [
            'EstimatedValue',
            { attribute: 'Confidence', control: 'segmented' },
            'RiskAdjustedValue',
            'RealisedValue',
            'RealisedShare',
          ],
        },
      ],
    },
    {
      class: 'DataAICapability',
      tabs: [
        {
          label: 'Capability',
          items: [
            'Name',
            { attribute: 'Category', control: 'select' },
            { attribute: 'Description', control: 'textarea' },
            'CurrentMaturity',
            'TargetMaturity',
            'Gap',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'insurer-strategy.mkmodel.json',
    id: 'mdl_insurerstrategy',
    name: 'Data and AI strategy 2027 to 2029',
    modelType: 'Strategy',
    attributes: {
      Title: 'Data and AI strategy 2027 to 2029',
      Organisation: 'A regional insurer',
      StrategyOwner: 'Chief data officer',
    },
    intendedWarnings: 1,
    elements: [
      e('vision', 'Vision', 540, 20, {
        Name: 'Trusted data and AI in every decision',
        Horizon: '2030',
        Statement:
          'By 2030 every pricing, claims and service decision is informed by data we trust and by AI we can explain.',
      }),
      // Three columns: value driver, goal and objective.
      e('drv_growth', 'ValueDriver', 40, 163, {
        Name: 'Revenue growth',
        Category: 'Revenue growth',
      }),
      e('drv_cost', 'ValueDriver', 440, 163, {
        Name: 'Lower cost to serve',
        Category: 'Cost reduction',
      }),
      e('drv_risk', 'ValueDriver', 840, 163, {
        Name: 'Fewer losses',
        Category: 'Risk reduction',
      }),
      e('goal_keep', 'Goal', 230, 150, {
        Name: 'Keep more customers',
        Horizon: 'Medium term',
        Measure: 'Policy renewal rate',
      }),
      e('goal_claims', 'Goal', 630, 150, {
        Name: 'Settle claims faster',
        Horizon: 'Medium term',
        Measure: 'Days to settle a claim',
      }),
      e('goal_risk', 'Goal', 1030, 150, {
        Name: 'Price and detect risk better',
        Horizon: 'Long term',
        Measure: 'Loss ratio',
      }),
      e('obj_renewals', 'Objective', 215, 270, {
        Name: 'Raise renewals from 82% to 86%',
        Measure: 'Renewal rate of home and car policies',
        TargetDate: '2028-12-31',
        Owner: 'Head of customer',
      }),
      e('obj_oneday', 'Objective', 615, 270, {
        Name: 'Settle simple claims in one day',
        Measure: 'Share of simple claims settled within a day',
        TargetDate: '2029-06-30',
        Owner: 'Head of claims',
      }),
      e('obj_fraud', 'Objective', 1015, 270, {
        Name: 'Cut fraud losses by a fifth',
        Measure: 'Fraud losses per year',
        TargetDate: '2029-12-31',
        Owner: 'Head of risk',
      }),
      // Benefits, use cases and capabilities.
      e('ben_premium', 'Benefit', 205, 390, {
        Name: 'Retained premium',
        Type: 'Revenue',
        EstimatedValue: 2400000,
        Confidence: 'Medium',
      }),
      e('ben_handling', 'Benefit', 605, 390, {
        Name: 'Lower claims handling cost',
        Type: 'Cost',
        EstimatedValue: 1500000,
        Confidence: 'High',
        RealisedValue: 150000,
      }),
      e('ben_fraud', 'Benefit', 1005, 390, {
        Name: 'Fraud losses avoided',
        Type: 'Risk',
        EstimatedValue: 900000,
        Confidence: 'Low',
      }),
      e('uc_churn', 'AIUseCase', 100, 550, {
        Name: 'Churn prediction',
        Value: 4,
        Feasibility: 4,
        Status: 'Pilot',
      }),
      e('uc_triage', 'AIUseCase', 400, 550, {
        Name: 'Claims triage assistant',
        Value: 5,
        Feasibility: 3,
        Status: 'Assessed',
      }),
      e('uc_documents', 'AIUseCase', 700, 550, {
        Name: 'Reading claim documents',
        Value: 3,
        Feasibility: 4,
        Status: 'Idea',
      }),
      e('uc_fraud', 'AIUseCase', 1000, 550, {
        Name: 'Fraud detection',
        Value: 5,
        Feasibility: 3,
        Status: 'Idea',
      }),
      e('cap_platform', 'DataAICapability', 100, 720, {
        Name: 'Customer data platform',
        Category: 'Data platform',
        CurrentMaturity: 2,
        TargetMaturity: 4,
      }),
      e('cap_governance', 'DataAICapability', 400, 720, {
        Name: 'Data governance',
        Category: 'Governance',
        CurrentMaturity: 1,
        TargetMaturity: 3,
      }),
      e('cap_mlops', 'DataAICapability', 700, 720, {
        Name: 'Model building and operations',
        Category: 'AI and machine learning',
        CurrentMaturity: 1,
        TargetMaturity: 3,
      }),
      e('cap_literacy', 'DataAICapability', 1000, 720, {
        Name: 'Data literacy',
        Category: 'People and skills',
        CurrentMaturity: 2,
        TargetMaturity: 3,
      }),
      // The roadmap: one phase a year.
      e(
        'phase_2027',
        'RoadmapPhase',
        40,
        890,
        { Name: '2027: Foundations', Period: '2027' },
        { w: 400, h: 180 },
      ),
      e(
        'phase_2028',
        'RoadmapPhase',
        460,
        890,
        { Name: '2028: Scale', Period: '2028' },
        { w: 400, h: 180 },
      ),
      e(
        'phase_2029',
        'RoadmapPhase',
        880,
        890,
        { Name: '2029: Optimise', Period: '2029' },
        { w: 400, h: 180 },
      ),
      initiative('ini_platform', 'phase_2027', 55, {
        Name: 'Customer data platform',
        Sponsor: 'Chief data officer',
        Budget: 1200000,
        Start: '2027-01-04',
        End: '2027-12-17',
        Quarter: '2027 Q4',
        Status: 'Approved',
      }),
      initiative('ini_governance', 'phase_2027', 245, {
        Name: 'Data governance office',
        Sponsor: 'Chief data officer',
        Budget: 400000,
        Start: '2027-02-01',
        End: '2027-09-30',
        Quarter: '2027 Q3',
        Status: 'In progress',
      }),
      initiative('ini_churn', 'phase_2028', 475, {
        Name: 'Churn prediction in production',
        Sponsor: 'Head of customer',
        Budget: 600000,
        Start: '2028-01-10',
        End: '2028-06-30',
        Quarter: '2028 Q2',
        Status: 'Proposed',
      }),
      initiative('ini_triage', 'phase_2028', 665, {
        Name: 'Claims triage assistant',
        Sponsor: 'Head of claims',
        Budget: 900000,
        Start: '2028-03-01',
        End: '2028-12-15',
        Quarter: '2028 Q4',
        Status: 'Proposed',
      }),
      initiative('ini_fraud', 'phase_2029', 895, {
        Name: 'Fraud detection',
        Sponsor: 'Head of risk',
        Budget: 700000,
        Start: '2029-01-08',
        End: '2029-09-28',
        Quarter: '2029 Q3',
        Status: 'Proposed',
      }),
      // On purpose not linked to a goal, so the check has something to report.
      initiative('ini_literacy', 'phase_2029', 1085, {
        Name: 'Data literacy programme',
        Sponsor: 'Head of people',
        Budget: 250000,
        Start: '2029-01-08',
        End: '2029-12-14',
        Quarter: '2029 Q4',
        Status: 'Proposed',
      }),
    ],
    connectors: [
      c('Refines', 'goal_keep', 'vision'),
      c('Refines', 'goal_claims', 'vision'),
      c('Refines', 'goal_risk', 'vision'),
      c('Refines', 'obj_renewals', 'goal_keep'),
      c('Refines', 'obj_oneday', 'goal_claims'),
      c('Refines', 'obj_fraud', 'goal_risk'),
      c('Drives', 'drv_growth', 'goal_keep'),
      c('Drives', 'drv_cost', 'goal_claims'),
      c('Drives', 'drv_risk', 'goal_risk'),
      c('ContributesTo', 'ben_premium', 'drv_growth'),
      c('ContributesTo', 'ben_handling', 'drv_cost'),
      c('ContributesTo', 'ben_fraud', 'drv_risk'),
      c('ContributesTo', 'uc_churn', 'obj_renewals'),
      c('ContributesTo', 'uc_triage', 'obj_oneday'),
      c('ContributesTo', 'uc_documents', 'obj_oneday'),
      c('ContributesTo', 'uc_fraud', 'obj_fraud'),
      c('ContributesTo', 'ini_platform', 'obj_renewals'),
      c('ContributesTo', 'ini_governance', 'goal_risk'),
      c('Implements', 'ini_churn', 'uc_churn'),
      c('Implements', 'ini_triage', 'uc_triage'),
      c('Implements', 'ini_fraud', 'uc_fraud'),
      c('Realises', 'ini_churn', 'ben_premium'),
      c('Realises', 'ini_triage', 'ben_handling'),
      c('Realises', 'ini_fraud', 'ben_fraud'),
      c('Needs', 'uc_churn', 'cap_platform'),
      c('Needs', 'uc_churn', 'cap_mlops'),
      c('Needs', 'uc_triage', 'cap_mlops'),
      c('Needs', 'uc_documents', 'cap_mlops'),
      c('Needs', 'uc_fraud', 'cap_governance'),
      c('Needs', 'uc_fraud', 'cap_mlops'),
      c('Builds', 'ini_platform', 'cap_platform'),
      c('Builds', 'ini_governance', 'cap_governance'),
      c('Builds', 'ini_churn', 'cap_mlops'),
      c('Builds', 'ini_literacy', 'cap_literacy'),
      c('DependsOn', 'ini_churn', 'ini_platform'),
      c('DependsOn', 'ini_triage', 'ini_platform'),
      c('DependsOn', 'ini_fraud', 'ini_governance'),
    ],
  },
};
