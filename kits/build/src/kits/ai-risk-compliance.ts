import type { KitId } from '@metakit-app/core';
import {
  bool,
  choice,
  date,
  formula,
  line,
  link,
  long,
  look,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * AI risk and compliance: a register of AI systems with their intended purpose and a generic risk
 * tier, the risks they carry and the controls that reduce them, the obligations they are subject
 * to, assessments, incidents, owners and evidence. The tiers are generic on purpose: the Kit
 * names no law and gives no legal advice.
 */

const GOV = { fill: '#ffc9c9', border: '#e03131' };

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
): SampleElement => ({ id, class: cls, x, y, attributes });
const c = (relation: string, from: string, to: string): SampleConnector => ({
  relation,
  from,
  to,
});

const RATING = (score: string) =>
  `${score} == null ? null : (${score} >= 15 ? 'High' : (${score} >= 8 ? 'Medium' : 'Low'))`;

export const aiRiskCompliance: KitSpec = {
  folder: 'ai-risk-compliance',
  id: 'kit_airiskcompliance' as KitId,
  name: 'AI risk and compliance',
  catalog: { keys: ['Risk', 'Control', 'Person'] },
  classes: [
    {
      key: 'AISystem',
      label: 'AI system',
      help: 'A system that uses AI, with its intended purpose and its risk tier. The tiers are generic: map them to the rules that apply to you.',
      look: look('header-box', {
        fill: {
          by: 'RiskTier',
          values: {
            Minimal: '#d3f9d8',
            Limited: '#fff3bf',
            High: '#ffd8a8',
            Unacceptable: '#ffc9c9',
          },
          fallback: '#e9ecef',
        },
        border: '#495057',
        icon: 'bot',
        fields: [
          'RiskTier',
          'LifecycleStage',
          'ResidualRisk',
          'OpenObligations',
        ],
        width: 210,
      }),
      attributes: [
        long('IntendedPurpose', {
          help: 'What the system is for, who uses it and on whom.',
        }),
        long('ForeseeableMisuse', {
          help: 'How it could be used in a way it was not meant for.',
        }),
        choice('RiskTier', ['Minimal', 'Limited', 'High', 'Unacceptable'], {
          help: 'Minimal: little risk. Limited: people must know they deal with AI. High: decisions that matter to people, under strict controls. Unacceptable: must not be built or used.',
        }),
        choice('LifecycleStage', ['Idea', 'Development', 'In use', 'Retired']),
        choice('Sourcing', [
          'Built in-house',
          'Bought',
          'Built on a bought model',
        ]),
        bool('AffectsPeople', {
          label: 'Makes or supports decisions about people',
        }),
        formula(
          'Owner',
          "join(incoming('Owns').Name, ', ')",
          'text',
          'The people with an "Owns" connector to this system.',
        ),
        formula(
          'InherentRisk',
          "max(outgoing('HasRisk').Score)",
          'number',
          'The highest score of its risks before controls, from 1 to 25.',
          { label: 'Highest risk before controls' },
        ),
        formula(
          'ResidualRisk',
          "max(outgoing('HasRisk').ResidualScore)",
          'number',
          'The highest score of its risks after controls, from 1 to 25.',
          { label: 'Highest risk after controls' },
        ),
        formula(
          'OpenObligations',
          "sum(outgoing('SubjectTo').Gap)",
          'number',
          'How many of its obligations no control meets yet.',
        ),
        formula(
          'AssessmentDone',
          "contains(join(incoming('Assesses').Status, ','), 'Completed')",
          'boolean',
          'Yes when at least one assessment of this system is completed.',
          { label: 'Assessed' },
        ),
        formula(
          'OpenIncidents',
          "sum(incoming('Concerns').OpenCount)",
          'number',
          'How many incidents about this system are not closed.',
        ),
      ],
      constraints: [
        {
          id: 'k_system_tier',
          formula: 'RiskTier != null',
          message: "= 'AI system \"' + Name + '\" has no risk tier.'",
        },
        {
          id: 'k_system_unacceptable',
          formula:
            "RiskTier != 'Unacceptable' || LifecycleStage == 'Idea' || LifecycleStage == 'Retired'",
          message:
            "= 'AI system \"' + Name + '\" is in the unacceptable tier: it should not be developed or used.'",
          severity: 'error',
        },
        {
          id: 'k_system_assessment',
          formula: "RiskTier != 'High' || AssessmentDone",
          message:
            "= 'AI system \"' + Name + '\" is in the high tier, but no assessment of it is completed.'",
        },
        {
          id: 'k_system_risks',
          formula:
            "RiskTier == null || RiskTier == 'Minimal' || LifecycleStage == 'Idea' || LifecycleStage == 'Retired' || count(outgoing('HasRisk')) > 0",
          message:
            "= 'AI system \"' + Name + '\" is above the minimal tier, but no risk of it is recorded.'",
        },
        {
          id: 'k_system_owner',
          formula: "count(incoming('Owns')) > 0",
          message: "= 'AI system \"' + Name + '\" has no owner.'",
        },
      ],
    },
    {
      key: 'Obligation',
      label: 'Obligation',
      help: 'A requirement an AI system must meet, from a law, a standard, a contract or an internal policy. Controls meet it.',
      look: look('document', {
        fill: {
          by: 'Met',
          values: { true: '#d3f9d8', false: '#ffc9c9' },
          fallback: '#e9ecef',
        },
        border: '#495057',
        subtitle: 'Source',
        width: 190,
        height: 80,
      }),
      attributes: [
        long('Requirement'),
        choice('Source', [
          'Law or regulation',
          'Industry standard',
          'Contract',
          'Internal policy',
        ]),
        text('Reference', {
          help: 'Where it is written, such as a clause or a section, as free text.',
        }),
        formula(
          'Controls',
          "count(incoming('Satisfies'))",
          'number',
          'How many controls meet it.',
        ),
        formula(
          'Met',
          'Controls > 0',
          'boolean',
          'Yes when at least one control meets it. The fill turns green.',
          { label: 'Covered' },
        ),
        formula(
          'Gap',
          'Controls > 0 ? 0 : 1',
          'number',
          '1 while no control meets it, so a system can count its open obligations.',
          { label: 'Not covered' },
        ),
      ],
      constraints: [
        {
          id: 'k_obligation_control',
          formula: "count(incoming('SubjectTo')) == 0 || Controls > 0",
          message:
            '= \'No control meets obligation "\' + Name + \'": connect one with "Satisfies".\'',
        },
      ],
    },
    {
      key: 'Assessment',
      label: 'Assessment',
      help: 'A review of an AI system, such as an impact assessment or a fairness test, with its outcome.',
      look: look('rounded', {
        fill: {
          by: 'Status',
          values: {
            Planned: '#e9ecef',
            'In progress': '#fff3bf',
            Completed: '#d3f9d8',
          },
          fallback: '#e9ecef',
        },
        border: '#1c7ed6',
        icon: 'check',
        subtitle: 'Kind',
        width: 180,
      }),
      attributes: [
        choice('Kind', [
          'Impact assessment',
          'Fairness test',
          'Transparency review',
          'Security review',
          'Privacy review',
        ]),
        choice('Status', ['Planned', 'In progress', 'Completed'], {
          default: 'Planned',
        }),
        date('Date'),
        text('Assessor'),
        choice('Outcome', ['Pass', 'Pass with actions', 'Fail']),
        long('Findings'),
      ],
      constraints: [
        {
          id: 'k_assessment_system',
          formula: "count(outgoing('Assesses')) > 0",
          message:
            '= \'Assessment "\' + Name + \'" assesses no AI system: connect it with "Assesses".\'',
        },
        {
          id: 'k_assessment_outcome',
          formula: "Status != 'Completed' || Outcome != null",
          message:
            "= 'Assessment \"' + Name + '\" is completed but has no outcome.'",
        },
      ],
    },
    {
      key: 'Incident',
      label: 'Incident',
      help: 'Something that went wrong with an AI system, such as an unfair result or a leak, and what caused it.',
      look: look('rounded', {
        fill: {
          by: 'Status',
          values: {
            Open: '#ffc9c9',
            Investigating: '#ffec99',
            Resolved: '#d3f9d8',
            Closed: '#e9ecef',
          },
          fallback: '#ffc9c9',
        },
        border: GOV.border,
        icon: 'warning',
        subtitle: 'Severity',
        width: 180,
      }),
      attributes: [
        long('Description'),
        choice('Severity', ['Low', 'Medium', 'High', 'Critical']),
        choice('Status', ['Open', 'Investigating', 'Resolved', 'Closed'], {
          default: 'Open',
        }),
        date('Date'),
        long('RootCause'),
        formula(
          'OpenCount',
          "Status == 'Closed' ? 0 : 1",
          'number',
          '1 while the incident is not closed, so systems and the model can count open incidents.',
          { label: 'Counts as open' },
        ),
      ],
      constraints: [
        {
          id: 'k_incident_system',
          formula: "count(outgoing('Concerns')) > 0",
          message:
            '= \'Incident "\' + Name + \'" concerns no AI system: connect it with "Concerns".\'',
        },
        {
          id: 'k_incident_cause',
          formula: "Status != 'Closed' || !isEmpty(RootCause)",
          message:
            "= 'Incident \"' + Name + '\" is closed without a root cause.'",
        },
      ],
    },
    {
      key: 'Evidence',
      label: 'Evidence',
      help: 'A record that shows a control works or an assessment was done, such as a test report or a sign-off.',
      look: look('document', {
        fill: '#e9ecef',
        border: '#495057',
        subtitle: 'Kind',
        width: 110,
        height: 70,
      }),
      attributes: [
        choice('Kind', [
          'Document',
          'Test result',
          'Log',
          'Sign-off',
          'Screenshot',
        ]),
        link('Link'),
        date('Date'),
        text('Owner'),
      ],
      constraints: [
        {
          id: 'k_evidence_proves',
          formula: "count(outgoing('Proves')) > 0",
          message:
            '= \'Evidence "\' + Name + \'" proves nothing: connect it to a control or an assessment with "Proves".\'',
        },
      ],
    },
  ],
  amend: {
    Risk: {
      help: 'Something that may go wrong with an AI system. Score is likelihood times impact; each effective control lowers the likelihood, which gives the residual score.',
      attributes: [
        choice('Category', [
          'Fairness',
          'Privacy',
          'Safety',
          'Security',
          'Transparency',
          'Accuracy',
          'Misuse',
        ]),
        formula(
          'ResidualLikelihood',
          "Likelihood == null ? null : max(1, Likelihood - sum(incoming('Mitigates').Reduction))",
          'number',
          'The likelihood minus 2 for each effective control and 1 for each partly effective one, at least 1.',
        ),
        formula(
          'ResidualScore',
          'ResidualLikelihood == null || Impact == null ? null : ResidualLikelihood * Impact',
          'number',
          'Residual likelihood times impact, from 1 to 25.',
        ),
        formula(
          'ResidualRating',
          RATING('ResidualScore'),
          'text',
          'High from 15, Medium from 8, otherwise Low. The fill shows it.',
        ),
      ],
      look: look('header-box', {
        fill: {
          by: 'ResidualRating',
          values: { Low: '#b2f2bb', Medium: '#ffec99', High: '#ffc9c9' },
          fallback: '#e9ecef',
        },
        border: GOV.border,
        icon: 'warning',
        fields: ['Category', 'Score', 'ResidualScore'],
        width: 190,
      }),
      constraints: [
        {
          id: 'k_risk_control',
          formula:
            "Rating == null || Rating == 'Low' || count(incoming('Mitigates')) > 0",
          message:
            "= 'Risk \"' + Name + '\" is ' + Rating + ' and no control mitigates it.'",
        },
        {
          id: 'k_risk_residual',
          formula: "ResidualRating != 'High' || Status == 'Accepted'",
          message:
            "= 'Risk \"' + Name + '\" is still high after its controls; add controls or record that it is accepted.'",
        },
      ],
    },
    Control: {
      help: 'A measure that prevents or detects a problem, how well it works, and the evidence for that.',
      remove: ['Effective'],
      attributes: [
        choice(
          'Effectiveness',
          ['Not tested', 'Not effective', 'Partly effective', 'Effective'],
          { default: 'Not tested' },
        ),
        date('LastTested'),
        text('Owner'),
        formula(
          'Reduction',
          "Effectiveness == 'Effective' ? 2 : (Effectiveness == 'Partly effective' ? 1 : 0)",
          'number',
          'How much it lowers the likelihood of the risks it mitigates: 2 when effective, 1 when partly effective.',
        ),
        formula(
          'EvidenceCount',
          "count(incoming('Proves'))",
          'number',
          'How many pieces of evidence prove it.',
          { label: 'Evidence' },
        ),
      ],
      look: look('rounded', {
        fill: {
          by: 'Effectiveness',
          values: {
            'Not tested': '#e9ecef',
            'Not effective': '#ffc9c9',
            'Partly effective': '#fff3bf',
            Effective: '#d3f9d8',
          },
          fallback: '#e9ecef',
        },
        border: GOV.border,
        icon: 'check',
        subtitle: 'Effectiveness',
        width: 180,
      }),
      constraints: [
        {
          id: 'k_control_evidence',
          formula: "Effectiveness != 'Effective' || EvidenceCount > 0",
          message:
            "= 'Control \"' + Name + '\" is marked effective, but no evidence proves it.'",
        },
        {
          id: 'k_control_purpose',
          formula:
            "count(outgoing('Mitigates')) + count(outgoing('Satisfies')) > 0",
          message:
            "= 'Control \"' + Name + '\" mitigates no risk and meets no obligation.'",
        },
      ],
    },
  },
  relations: [
    {
      key: 'HasRisk',
      label: 'Has risk',
      help: 'The AI system is exposed to the risk.',
      from: ['AISystem'],
      to: ['Risk'],
      look: line(GOV.border, { style: 'dotted' }),
    },
    {
      key: 'SubjectTo',
      label: 'Subject to',
      help: 'The AI system must meet the obligation.',
      from: ['AISystem'],
      to: ['Obligation'],
      look: line('#495057', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'Satisfies',
      label: 'Satisfies',
      help: 'The control meets the obligation.',
      from: ['Control'],
      to: ['Obligation'],
      look: line('#2f9e44'),
    },
    {
      key: 'Proves',
      label: 'Proves',
      help: 'The evidence shows the control works or the assessment was done.',
      from: ['Evidence'],
      to: ['Control', 'Assessment'],
      look: line('#495057', { style: 'dotted' }),
    },
    {
      key: 'Assesses',
      label: 'Assesses',
      help: 'The assessment reviews the AI system.',
      from: ['Assessment'],
      to: ['AISystem'],
      look: line('#1c7ed6'),
    },
    {
      key: 'Concerns',
      label: 'Concerns',
      help: 'The incident happened with the AI system.',
      from: ['Incident'],
      to: ['AISystem'],
      look: line(GOV.border),
    },
  ],
  amendRelations: {
    Owns: {
      to: ['AISystem', 'Risk', 'Control', 'Obligation'],
      replace: true,
    },
  },
  modelTypes: [
    {
      key: 'AIRegister',
      label: 'AI risk register',
      help: 'AI systems with their risk tier, risks and controls, obligations and evidence, assessments, incidents and owners.',
      views: [
        {
          key: 'Risks',
          label: 'Risks and controls',
          classes: ['AISystem', 'Risk', 'Control', 'Person'],
          relations: ['HasRisk', 'Mitigates', 'Owns'],
        },
        {
          key: 'Compliance',
          label: 'Compliance',
          classes: [
            'AISystem',
            'Obligation',
            'Control',
            'Evidence',
            'Assessment',
          ],
          relations: ['SubjectTo', 'Satisfies', 'Proves', 'Assesses'],
        },
        {
          key: 'Incidents',
          label: 'Incidents',
          classes: ['AISystem', 'Incident', 'Person'],
          relations: ['Concerns', 'Owns'],
        },
      ],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        date('ReviewedOn'),
        formula(
          'Systems',
          "count(objects('AISystem'))",
          'number',
          'How many AI systems the register holds.',
        ),
        formula(
          'OpenIncidents',
          "sum(objects('Incident').OpenCount)",
          'number',
          'How many incidents are not closed.',
        ),
        formula(
          'UncoveredObligations',
          "sum(objects('Obligation').Gap)",
          'number',
          'How many obligations no control meets.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'AISystem',
      tabs: [
        {
          label: 'System',
          items: [
            'Name',
            { attribute: 'IntendedPurpose', control: 'textarea' },
            { attribute: 'ForeseeableMisuse', control: 'textarea' },
            { attribute: 'LifecycleStage', control: 'segmented' },
            { attribute: 'Sourcing', control: 'select' },
            'AffectsPeople',
            'Owner',
          ],
        },
        {
          label: 'Risk and compliance',
          items: [
            { attribute: 'RiskTier', control: 'segmented' },
            'InherentRisk',
            'ResidualRisk',
            'OpenObligations',
            'AssessmentDone',
            'OpenIncidents',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Risk',
      tabs: [
        {
          label: 'Risk',
          items: [
            'Name',
            { attribute: 'Category', control: 'select' },
            { attribute: 'Description', control: 'textarea' },
            'Owner',
            { attribute: 'Status', control: 'segmented' },
          ],
        },
        {
          label: 'Score',
          items: [
            'Likelihood',
            'Impact',
            'Score',
            'Rating',
            'ResidualLikelihood',
            'ResidualScore',
            'ResidualRating',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'recruitment-register.mkmodel.json',
    id: 'mdl_recruitmentregister',
    name: 'AI register 2027',
    modelType: 'AIRegister',
    attributes: {
      Title: 'AI register 2027',
      Organisation: 'A recruitment agency',
      ReviewedOn: '2027-02-15',
    },
    // "Candidate ranking" is in the high tier and its impact assessment is only planned, on purpose.
    intendedWarnings: 1,
    elements: [
      e('a_rank', 'Assessment', 40, 20, {
        Name: 'Impact of candidate ranking',
        Kind: 'Impact assessment',
        Status: 'Planned',
        Date: '2027-04-30',
        Assessor: 'Risk officer',
      }),
      e('inc_rank', 'Incident', 240, 20, {
        Name: 'Ranking favoured one region',
        Severity: 'Medium',
        Status: 'Closed',
        Date: '2026-12-02',
        RootCause:
          'The training data held far more placements from one region; it was rebalanced.',
      }),
      e('a_chat', 'Assessment', 440, 20, {
        Name: 'Chat assistant review',
        Kind: 'Transparency review',
        Status: 'Completed',
        Date: '2026-11-15',
        Assessor: 'Risk officer',
        Outcome: 'Pass',
      }),
      e('p_hr', 'Person', 900, 10, {
        Name: 'Mia Torres',
        Role: 'Head of recruitment',
      }),
      e('p_it', 'Person', 700, 10, {
        Name: 'Leo Hartmann',
        Role: 'IT manager',
      }),
      e('sys_rank', 'AISystem', 40, 170, {
        Name: 'Candidate ranking',
        IntendedPurpose:
          'Ranks applicants for a vacancy by how well their experience matches it, for a recruiter to review.',
        ForeseeableMisuse:
          'Recruiters reject applicants by rank alone, without reading their applications.',
        RiskTier: 'High',
        LifecycleStage: 'In use',
        Sourcing: 'Built on a bought model',
        AffectsPeople: true,
      }),
      e('sys_chat', 'AISystem', 340, 170, {
        Name: 'Candidate chat assistant',
        IntendedPurpose:
          'Answers questions of applicants about vacancies and the application process.',
        RiskTier: 'Limited',
        LifecycleStage: 'In use',
        Sourcing: 'Built on a bought model',
      }),
      e('sys_spam', 'AISystem', 640, 170, {
        Name: 'Email spam filter',
        IntendedPurpose: 'Moves unwanted email out of the inbox.',
        RiskTier: 'Minimal',
        LifecycleStage: 'In use',
        Sourcing: 'Bought',
      }),
      e('sys_emotion', 'AISystem', 940, 170, {
        Name: 'Emotion reading in video interviews',
        IntendedPurpose:
          'Proposed: judge the emotions of applicants from interview videos. Rejected in the review.',
        RiskTier: 'Unacceptable',
        LifecycleStage: 'Idea',
        AffectsPeople: true,
      }),
      e('o_oversight', 'Obligation', 40, 690, {
        Name: 'Human oversight of decisions about people',
        Source: 'Law or regulation',
        Requirement:
          'A trained person reviews and can overrule every result that affects an applicant.',
      }),
      e('o_records', 'Obligation', 340, 690, {
        Name: 'Records of testing',
        Source: 'Internal policy',
        Requirement: 'Keep the results of every fairness test for five years.',
      }),
      e('o_transparency', 'Obligation', 640, 690, {
        Name: 'Tell people they talk to AI',
        Source: 'Law or regulation',
        Requirement:
          'People who chat with an AI system are told so at the start of the chat.',
      }),
      e('r_bias', 'Risk', 190, 370, {
        Name: 'Unfair ranking of applicants',
        Category: 'Fairness',
        Likelihood: 4,
        Impact: 5,
        Owner: 'Head of recruitment',
        Status: 'Mitigated',
      }),
      e('r_errors', 'Risk', 490, 370, {
        Name: 'Wrong answers to applicants',
        Category: 'Accuracy',
        Likelihood: 3,
        Impact: 2,
        Owner: 'Head of recruitment',
        Status: 'Mitigated',
      }),
      e('r_privacy', 'Risk', 790, 370, {
        Name: 'Personal data kept in chat logs',
        Category: 'Privacy',
        Likelihood: 3,
        Impact: 4,
        Owner: 'IT manager',
        Status: 'Open',
      }),
      e('c_review', 'Control', 40, 550, {
        Name: 'A recruiter reviews every shortlist',
        Type: 'Preventive',
        Frequency: 'Every vacancy',
        Effectiveness: 'Effective',
        LastTested: '2027-01-20',
      }),
      e('c_biastest', 'Control', 340, 550, {
        Name: 'Quarterly fairness test',
        Type: 'Detective',
        Frequency: 'Quarterly',
        Effectiveness: 'Effective',
        LastTested: '2027-01-10',
      }),
      e('c_disclosure', 'Control', 640, 550, {
        Name: 'AI notice at the start of each chat',
        Type: 'Preventive',
        Frequency: 'Always',
        Effectiveness: 'Effective',
        LastTested: '2026-11-15',
      }),
      e('c_retention', 'Control', 940, 550, {
        Name: 'Delete chat logs after 30 days',
        Type: 'Preventive',
        Frequency: 'Daily',
        Effectiveness: 'Partly effective',
      }),
      e('ev_signoff', 'Evidence', 222, 550, {
        Name: 'Shortlist sign-off log',
        Kind: 'Log',
        Owner: 'Head of recruitment',
      }),
      e('ev_report', 'Evidence', 522, 550, {
        Name: 'Fairness test report, Q4',
        Kind: 'Test result',
        Date: '2027-01-10',
        Owner: 'Risk officer',
      }),
      e('ev_banner', 'Evidence', 822, 550, {
        Name: 'Screenshot of the chat notice',
        Kind: 'Screenshot',
        Date: '2026-11-15',
        Owner: 'IT manager',
      }),
    ],
    connectors: [
      c('Assesses', 'a_rank', 'sys_rank'),
      c('Concerns', 'inc_rank', 'sys_rank'),
      c('Assesses', 'a_chat', 'sys_chat'),
      c('Owns', 'p_hr', 'sys_rank'),
      c('Owns', 'p_hr', 'sys_chat'),
      c('Owns', 'p_hr', 'sys_emotion'),
      c('Owns', 'p_it', 'sys_spam'),
      c('SubjectTo', 'sys_rank', 'o_oversight'),
      c('SubjectTo', 'sys_rank', 'o_records'),
      c('SubjectTo', 'sys_chat', 'o_transparency'),
      c('HasRisk', 'sys_rank', 'r_bias'),
      c('HasRisk', 'sys_chat', 'r_errors'),
      c('HasRisk', 'sys_chat', 'r_privacy'),
      c('Mitigates', 'c_review', 'r_bias'),
      c('Mitigates', 'c_biastest', 'r_bias'),
      c('Mitigates', 'c_disclosure', 'r_errors'),
      c('Mitigates', 'c_retention', 'r_privacy'),
      c('Satisfies', 'c_review', 'o_oversight'),
      c('Satisfies', 'c_biastest', 'o_records'),
      c('Satisfies', 'c_disclosure', 'o_transparency'),
      c('Proves', 'ev_signoff', 'c_review'),
      c('Proves', 'ev_report', 'c_biastest'),
      c('Proves', 'ev_banner', 'c_disclosure'),
    ],
  },
};
