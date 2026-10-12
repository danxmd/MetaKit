import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  int,
  line,
  long,
  look,
  num,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Data quality management: rules with thresholds check data assets and measure quality
 * dimensions; the last check of a rule gives its result. Issues found by the rules have a severity,
 * a status and an owner, and remediation actions resolve them. Data assets and dimensions add up
 * the results of their rules into a pass rate and a quality score.
 */

const ISSUE_FILL = {
  by: 'Status',
  values: {
    Open: '#ffc9c9',
    'In progress': '#fff3bf',
    Resolved: '#d3f9d8',
    Closed: '#e9ecef',
  },
  fallback: '#ffc9c9',
};

const ACTION_FILL = {
  by: 'Status',
  values: {
    'Not started': '#e9ecef',
    'In progress': '#fff3bf',
    Done: '#d3f9d8',
  },
  fallback: '#e9ecef',
};

const QUALITY_FILL = {
  by: 'QualityLevel',
  values: { Good: '#b2f2bb', Fair: '#ffec99', Poor: '#ffc9c9' },
  fallback: '#a5d8ff',
};

const isOpen = "Status != 'Resolved' && Status != 'Closed'";

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

/** A rule with its last check: records checked and records that failed. */
const rule = (
  id: string,
  x: number,
  values: {
    Name: string;
    Threshold: number;
    RecordsChecked: number;
    RecordsFailed: number;
    Expression: string;
  },
) =>
  e(id, 'DataQualityRule', x, 170, {
    ...values,
    Frequency: 'Daily',
    LastRun: '2027-03-15',
  });

export const dataQuality: KitSpec = {
  folder: 'data-quality',
  id: 'kit_dataquality' as KitId,
  name: 'Data quality management',
  catalog: { keys: ['DataQualityRule', 'Dataset', 'Issue', 'DataSteward'] },
  classes: [
    {
      key: 'QualityDimension',
      label: 'Quality dimension',
      help: 'An aspect of quality, such as completeness, validity, uniqueness or timeliness. Its score is the average result of the rules that measure it.',
      look: look('hexagon', {
        fill: {
          by: 'OnTarget',
          values: { true: '#b2f2bb', false: '#ffc9c9' },
          fallback: '#e9ecef',
        },
        border: '#1c7ed6',
        subtitle: 'ScoreText',
        width: 160,
        height: 70,
      }),
      attributes: [
        long('Description'),
        num('Target', {
          label: 'Target score',
          unit: '%',
          min: 0,
          max: 100,
          help: 'The score this dimension should reach.',
        }),
        formula(
          'Score',
          "IFERROR(round(avg(incoming('Measures').LastResult), 2), null)",
          'number',
          'The average last result of the rules that measure it, in percent.',
        ),
        formula(
          'OnTarget',
          'Score == null || Target == null ? null : Score >= Target',
          'boolean',
          'Yes when the score reaches the target. The fill shows it.',
        ),
        formula(
          'ScoreText',
          "Score == null ? 'No results' : text(Score) + '%' + (Target == null ? '' : ' of ' + text(Target) + '%')",
          'text',
          'The score and the target, shown under the name.',
        ),
      ],
    },
    {
      key: 'RemediationAction',
      label: 'Remediation action',
      help: 'Work that resolves a data quality issue: fix the data, fix the source, change a process or change the rule.',
      look: look('rounded', {
        fill: ACTION_FILL,
        border: '#f08c00',
        icon: 'gear',
        subtitle: 'Owner',
        width: 180,
        height: 70,
      }),
      attributes: [
        long('Description'),
        choice(
          'ActionType',
          [
            'Fix the data',
            'Fix the source',
            'Change the process',
            'Change the rule',
          ],
          { label: 'Type' },
        ),
        text('Owner'),
        choice('Status', ['Not started', 'In progress', 'Done'], {
          default: 'Not started',
        }),
        date('Due'),
        choice('Effort', ['Small', 'Medium', 'Large']),
      ],
      constraints: [
        {
          id: 'k_action_issue',
          formula: "count(outgoing('Resolves')) > 0",
          message: "= 'Remediation action \"' + Name + '\" resolves no issue.'",
        },
      ],
    },
  ],
  amend: {
    DataQualityRule: {
      help: 'A check that every record of a data asset must pass, with the share of records that must pass. Its last check gives the result; Passing compares the result with the threshold.',
      attributes: [
        formula(
          'Dimension',
          "join(outgoing('Measures').Name, ', ')",
          'text',
          'The quality dimensions it measures.',
        ),
        long('Expression', {
          help: 'The condition each record must meet, in words or as code.',
        }),
        text('Owner'),
        choice('Frequency', ['Hourly', 'Daily', 'Weekly', 'Monthly']),
        date('LastRun', { label: 'Last check' }),
        int('RecordsChecked', { min: 0 }),
        int('RecordsFailed', { min: 0 }),
        formula(
          'LastResult',
          'RecordsChecked == null || RecordsFailed == null || RecordsChecked == 0 ? null : round((RecordsChecked - RecordsFailed) / RecordsChecked * 100, 2)',
          'number',
          'The share of records that passed the last check, in percent.',
          { label: 'Last result (%)' },
        ),
        formula(
          'PassCount',
          'Passing == null ? null : (Passing ? 1 : 0)',
          'number',
          'One when the rule passes and zero when it fails, so data assets can count the rules that pass.',
          { label: 'Counts as passed' },
        ),
      ],
      look: look('header-box', {
        fill: {
          by: 'Passing',
          values: { true: '#b2f2bb', false: '#ffc9c9' },
          fallback: '#e9ecef',
        },
        border: '#1c7ed6',
        icon: 'check',
        fields: ['Dimension', 'Threshold', 'LastResult'],
        width: 190,
      }),
      constraints: [
        {
          id: 'k_rule_checks',
          formula: "count(outgoing('Checks')) > 0",
          message:
            '= \'Rule "\' + Name + \'" checks no data asset: connect it with "Checks".\'',
        },
        {
          id: 'k_rule_failed',
          formula:
            'RecordsChecked == null || RecordsFailed == null || RecordsFailed <= RecordsChecked',
          message:
            "= 'Rule \"' + Name + '\" has more failed records than checked ones.'",
        },
      ],
    },
    Dataset: {
      label: 'Data asset',
      help: 'A table, file or other set of data whose quality is checked. Pass rate and quality score add up the results of its rules.',
      attributes: [
        text('Owner'),
        choice('Criticality', ['Low', 'Medium', 'High'], {
          help: 'How much the business depends on it. A highly critical asset needs at least one rule.',
        }),
        formula(
          'Rules',
          "count(incoming('Checks'))",
          'number',
          'How many rules check it.',
        ),
        formula(
          'RulesPassed',
          "sum(incoming('Checks').PassCount)",
          'number',
          'How many of its rules passed their last check.',
        ),
        formula(
          'PassRate',
          "count(incoming('Checks').PassCount) == 0 ? null : round(RulesPassed / count(incoming('Checks').PassCount) * 100, 1)",
          'number',
          'The share of its checked rules that pass, in percent.',
          { label: 'Pass rate (%)' },
        ),
        formula(
          'QualityScore',
          "IFERROR(round(avg(incoming('Checks').LastResult), 1), null)",
          'number',
          'The average last result of its rules, in percent.',
          { label: 'Quality score (%)' },
        ),
        formula(
          'QualityLevel',
          "PassRate == null ? null : PassRate == 100 ? 'Good' : PassRate >= 50 ? 'Fair' : 'Poor'",
          'text',
          'Good when every rule passes, Fair when at least half pass, otherwise Poor. The header colour shows it.',
        ),
        formula(
          'OpenIssues',
          "sum(incoming('Affects').OpenCount)",
          'number',
          'How many issues that affect it are not resolved or closed.',
        ),
      ],
      look: look('header-box', {
        fill: QUALITY_FILL,
        border: '#1c7ed6',
        icon: 'database',
        fields: ['PassRate', 'QualityScore', 'OpenIssues'],
        width: 190,
      }),
      constraints: [
        {
          id: 'k_dataset_rules',
          formula: "Criticality != 'High' || Rules > 0",
          message:
            "= 'Data asset \"' + Name + '\" is highly critical but no rule checks it.'",
        },
      ],
    },
    Issue: {
      label: 'Data quality issue',
      help: 'A problem in the data that needs fixing, with its severity, status and owner. The fill shows the status.',
      attributes: [
        date('Found'),
        int('RecordsAffected', { min: 0 }),
        long('RootCause'),
        formula(
          'OpenCount',
          `${isOpen} ? 1 : 0`,
          'number',
          'One while the issue is not resolved or closed, so data assets can count open issues.',
          { label: 'Counts as open' },
        ),
        formula(
          'Overdue',
          `Due != null && ${isOpen} && daysBetween(today(), Due) < 0`,
          'boolean',
          'Yes when the due date has passed and the issue is still open.',
        ),
        formula(
          'Actions',
          "count(incoming('Resolves'))",
          'number',
          'How many remediation actions work on it.',
        ),
      ],
      look: look('rounded', {
        fill: ISSUE_FILL,
        border: '#e03131',
        icon: 'warning',
        subtitle: 'Severity',
        width: 180,
        height: 70,
      }),
      constraints: [
        {
          id: 'k_issue_owner',
          formula: `!(${isOpen}) || !isEmpty(Owner)`,
          message: "= 'Open issue \"' + Name + '\" has no owner.'",
        },
        {
          id: 'k_issue_action',
          formula: `!(${isOpen}) || (Severity != 'High' && Severity != 'Critical') || Actions > 0`,
          message:
            "= 'Issue \"' + Name + '\" is ' + lower(Severity) + ' but no remediation action works on it.'",
        },
      ],
    },
  },
  relations: [
    {
      key: 'Checks',
      label: 'Checks',
      help: 'The rule checks the records of the data asset.',
      from: ['DataQualityRule'],
      to: ['Dataset'],
      look: line('#1c7ed6'),
    },
    {
      key: 'Measures',
      label: 'Measures',
      help: 'The rule measures this quality dimension.',
      from: ['DataQualityRule'],
      to: ['QualityDimension'],
      look: line('#1c7ed6', { style: 'dotted' }),
    },
    {
      key: 'FoundBy',
      label: 'Found by',
      help: 'The issue was found by the rule.',
      from: ['Issue'],
      to: ['DataQualityRule'],
      look: line('#e03131', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'Affects',
      label: 'Affects',
      help: 'The issue is in the data of the data asset.',
      from: ['Issue'],
      to: ['Dataset'],
      look: line('#e03131'),
    },
    {
      key: 'Resolves',
      label: 'Resolves',
      help: 'The action fixes the issue.',
      from: ['RemediationAction'],
      to: ['Issue'],
      look: line('#f08c00'),
    },
  ],
  modelTypes: [
    {
      key: 'DataQuality',
      label: 'Data quality',
      help: 'Data assets with the rules that check them and the quality dimensions those rules measure, the issues found, who owns them and the actions that resolve them.',
      views: [
        {
          key: 'Rules',
          label: 'Rules and results',
          classes: ['QualityDimension', 'DataQualityRule', 'Dataset'],
          relations: ['Checks', 'Measures'],
        },
        {
          key: 'Issues',
          label: 'Issues and actions',
          classes: ['Issue', 'RemediationAction', 'Dataset', 'DataSteward'],
          relations: ['Affects', 'FoundBy', 'Resolves', 'Stewards'],
        },
      ],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'OverallPassRate',
          "count(objects('DataQualityRule').PassCount) == 0 ? null : round(sum(objects('DataQualityRule').PassCount) / count(objects('DataQualityRule').PassCount) * 100, 1)",
          'number',
          'The share of all checked rules that pass, in percent.',
          { label: 'Overall pass rate (%)' },
        ),
        formula(
          'OpenIssues',
          "sum(objects('Issue').OpenCount)",
          'number',
          'How many issues are not resolved or closed.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'DataQualityRule',
      tabs: [
        {
          label: 'Rule',
          items: [
            'Name',
            'Dimension',
            { attribute: 'Expression', control: 'textarea' },
            'Threshold',
            'Owner',
            { attribute: 'Frequency', control: 'select' },
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Last check',
          items: [
            'LastRun',
            'RecordsChecked',
            'RecordsFailed',
            'LastResult',
            'Passing',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Issue',
      tabs: [
        {
          label: 'Issue',
          items: [
            'Name',
            { attribute: 'Severity', control: 'segmented' },
            { attribute: 'Status', control: 'segmented' },
            'Owner',
            'Found',
            'Due',
            'Overdue',
          ],
        },
        {
          label: 'Details',
          items: [
            'RecordsAffected',
            { attribute: 'RootCause', control: 'textarea' },
            { attribute: 'Description', control: 'textarea' },
            'Actions',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'bank-customer-data.mkmodel.json',
    id: 'mdl_bankcustomerdata',
    name: 'Customer and account data quality',
    modelType: 'DataQuality',
    attributes: {
      Title: 'Customer and account data quality',
      Organisation: 'A retail bank',
    },
    // "Duplicate customers after a branch merger" is critical and has no action yet, on purpose.
    intendedWarnings: 1,
    elements: [
      e('dim_complete', 'QualityDimension', 205, 40, {
        Name: 'Completeness',
        Target: 99,
      }),
      e('dim_valid', 'QualityDimension', 530, 40, {
        Name: 'Validity',
        Target: 99,
      }),
      e('dim_unique', 'QualityDimension', 860, 40, {
        Name: 'Uniqueness',
        Target: 100,
      }),
      e('dim_timely', 'QualityDimension', 1180, 40, {
        Name: 'Timeliness',
        Target: 95,
      }),
      rule('r_birth', 200, {
        Name: 'Customer has a date of birth',
        Threshold: 99,
        RecordsChecked: 1250000,
        RecordsFailed: 3100,
        Expression: 'date_of_birth is not empty',
      }),
      rule('r_email', 415, {
        Name: 'Email is well formed',
        Threshold: 98,
        RecordsChecked: 980000,
        RecordsFailed: 31000,
        Expression: 'email matches name@domain',
      }),
      rule('r_unique', 630, {
        Name: 'One customer per national id',
        Threshold: 100,
        RecordsChecked: 1250000,
        RecordsFailed: 420,
        Expression: 'national_id is unique',
      }),
      rule('r_iban', 845, {
        Name: 'Account numbers are valid',
        Threshold: 100,
        RecordsChecked: 1900000,
        RecordsFailed: 0,
        Expression: 'check digits of the account number are correct',
      }),
      rule('r_balances', 1060, {
        Name: 'Balances loaded by 07:00',
        Threshold: 95,
        RecordsChecked: 30,
        RecordsFailed: 1,
        Expression: 'the daily balance file arrived before 07:00',
      }),
      rule('r_account', 1275, {
        Name: 'Transaction has an account',
        Threshold: 100,
        RecordsChecked: 45000000,
        RecordsFailed: 0,
        Expression: 'account_id is not empty and exists',
      }),
      e('ds_customers', 'Dataset', 415, 400, {
        Name: 'Customers',
        Owner: 'Head of retail banking',
        Criticality: 'High',
        RowCount: 1250000,
        Classification: 'Confidential',
        ContainsPersonalData: true,
      }),
      e('ds_accounts', 'Dataset', 950, 400, {
        Name: 'Accounts',
        Owner: 'Head of finance',
        Criticality: 'High',
        RowCount: 1900000,
        Classification: 'Confidential',
      }),
      e('ds_transactions', 'Dataset', 1275, 400, {
        Name: 'Transactions',
        Owner: 'Head of finance',
        Criticality: 'High',
        Classification: 'Confidential',
      }),
      e('stw_customer', 'DataSteward', 40, 390, {
        Name: 'Customer data steward',
        Domain: 'Customer',
      }),
      e('stw_finance', 'DataSteward', 1530, 560, {
        Name: 'Finance data steward',
        Domain: 'Finance',
      }),
      e('iss_email', 'Issue', 290, 580, {
        Name: 'Bad emails from the branch sign-up form',
        Severity: 'High',
        Status: 'In progress',
        Owner: 'Branch systems team',
        Found: '2027-02-20',
        Due: '2027-04-30',
        RecordsAffected: 31000,
        RootCause: 'The form accepts any text as an email address.',
      }),
      e('iss_duplicates', 'Issue', 520, 580, {
        Name: 'Duplicate customers after a branch merger',
        Severity: 'Critical',
        Status: 'Open',
        Owner: 'Customer data steward',
        Found: '2027-03-01',
        RecordsAffected: 420,
      }),
      e('iss_late', 'Issue', 950, 580, {
        Name: 'Late balance file on 3 March',
        Severity: 'Low',
        Status: 'Resolved',
        Owner: 'Finance data steward',
        Found: '2027-03-03',
      }),
      e('act_form', 'RemediationAction', 290, 730, {
        Name: 'Check emails on the sign-up form',
        ActionType: 'Fix the source',
        Owner: 'Branch systems team',
        Status: 'In progress',
        Due: '2027-04-15',
        Effort: 'Small',
      }),
      e('act_cleanup', 'RemediationAction', 520, 730, {
        Name: 'Correct the bad emails',
        ActionType: 'Fix the data',
        Owner: 'Customer data steward',
        Status: 'Not started',
        Due: '2027-04-30',
        Effort: 'Medium',
      }),
      e('act_alert', 'RemediationAction', 950, 730, {
        Name: 'Alert when the balance file is late',
        ActionType: 'Change the process',
        Owner: 'Finance data steward',
        Status: 'Done',
        Effort: 'Small',
      }),
    ],
    connectors: [
      c('Measures', 'r_birth', 'dim_complete'),
      c('Measures', 'r_email', 'dim_valid'),
      c('Measures', 'r_unique', 'dim_unique'),
      c('Measures', 'r_iban', 'dim_valid'),
      c('Measures', 'r_balances', 'dim_timely'),
      c('Measures', 'r_account', 'dim_complete'),
      c('Checks', 'r_birth', 'ds_customers'),
      c('Checks', 'r_email', 'ds_customers'),
      c('Checks', 'r_unique', 'ds_customers'),
      c('Checks', 'r_iban', 'ds_accounts'),
      c('Checks', 'r_balances', 'ds_accounts'),
      c('Checks', 'r_account', 'ds_transactions'),
      c('Stewards', 'stw_customer', 'ds_customers'),
      c('Stewards', 'stw_finance', 'ds_accounts'),
      c('Stewards', 'stw_finance', 'ds_transactions'),
      c('FoundBy', 'iss_email', 'r_email'),
      c('FoundBy', 'iss_duplicates', 'r_unique'),
      c('FoundBy', 'iss_late', 'r_balances'),
      c('Affects', 'iss_email', 'ds_customers'),
      c('Affects', 'iss_duplicates', 'ds_customers'),
      c('Affects', 'iss_late', 'ds_accounts'),
      c('Resolves', 'act_form', 'iss_email'),
      c('Resolves', 'act_cleanup', 'iss_email'),
      c('Resolves', 'act_alert', 'iss_late'),
    ],
  },
};
