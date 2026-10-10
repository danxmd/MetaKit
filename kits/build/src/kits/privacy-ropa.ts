import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  int,
  line,
  long,
  look,
  text,
  type CatalogAttribute,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Privacy and records of processing: each processing activity has purposes with their legal
 * basis, the categories of personal data and the people it is about, the recipients (with
 * transfers to other countries and their safeguards), how long data is kept and the systems used.
 * A formula counts the criteria that often call for a data protection impact assessment. The
 * wording is generic; the Kit gives an indication, not legal advice.
 */

const yesNo = (key: string, label: string, help: string): CatalogAttribute => ({
  type: 'boolean',
  key,
  label,
  help,
});

const DPIA_FILL = {
  by: 'DPIAIndication',
  values: {
    'Likely needed': '#ffc9c9',
    Consider: '#fff3bf',
    Unlikely: '#d3f9d8',
  },
  fallback: '#e9ecef',
};

const SENSITIVITY_FILL = {
  by: 'Sensitivity',
  values: {
    Ordinary: '#e7f5ff',
    'Special category': '#ffc9c9',
    'Criminal offence data': '#ffa8a8',
  },
  fallback: '#e7f5ff',
};

/** One for each criterion that applies, so they can be added up. */
const one = (condition: string) => `(${condition} ? 1 : 0)`;

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

export const privacyRopa: KitSpec = {
  folder: 'privacy-ropa',
  id: 'kit_privacyropa' as KitId,
  name: 'Privacy and records of processing',
  catalog: { keys: ['Application'] },
  classes: [
    {
      key: 'ProcessingActivity',
      label: 'Processing activity',
      help: 'Something the organisation does with personal data, such as paying staff or keeping patient records: one entry of the records of processing. The fill shows whether an impact assessment is likely needed.',
      look: look('header-box', {
        fill: DPIA_FILL,
        border: '#c92a2a',
        icon: 'document',
        fields: ['Role', 'DPIAIndication', 'DPIAStatus', 'Retention'],
        width: 220,
      }),
      attributes: [
        long('Description'),
        text('Owner', { help: 'The person or team that answers for it.' }),
        choice('Role', ['Controller', 'Joint controller', 'Processor'], {
          help: 'Whether the organisation decides why and how the data is used (controller), decides it together with others, or only acts for someone else (processor).',
        }),
        yesNo(
          'LargeScale',
          'Large scale',
          'Many people, much data, a long time or a wide area.',
        ),
        yesNo(
          'AutomatedDecisions',
          'Automated decisions',
          'Decisions with legal or similarly important effects on people are made without a person.',
        ),
        yesNo(
          'SystematicMonitoring',
          'Systematic monitoring',
          'People are observed or tracked in a regular, planned way.',
        ),
        yesNo(
          'NewTechnology',
          'New technology',
          'New or innovative technology is used, such as biometrics or AI.',
        ),
        choice(
          'DPIAStatus',
          ['Not started', 'In progress', 'Done', 'Not needed'],
          { label: 'Impact assessment' },
        ),
        formula(
          'Purposes',
          "join(outgoing('ForPurpose').Name, ', ')",
          'text',
          'The purposes it serves.',
        ),
        formula(
          'LegalBases',
          "join(outgoing('ForPurpose').LegalBasisText, ', ')",
          'text',
          'The legal bases of its purposes.',
        ),
        formula(
          'Retention',
          "join(outgoing('KeptFor').Period, ', ')",
          'text',
          'How long the data is kept.',
        ),
        formula(
          'SpecialData',
          "contains(join(outgoing('Processes').Sensitivity, '|'), 'Special') || contains(join(outgoing('Processes').Sensitivity, '|'), 'Criminal')",
          'boolean',
          'Yes when one of its data categories is a special category or criminal offence data.',
          { label: 'Sensitive data' },
        ),
        formula(
          'VulnerableSubjects',
          "contains(join(outgoing('About').Vulnerable, '|'), 'true')",
          'boolean',
          'Yes when one of the groups of people it is about is vulnerable.',
        ),
        formula(
          'OutsideTransfers',
          "contains(join(outgoing('DisclosesTo').OtherCountry, '|'), 'true')",
          'boolean',
          'Yes when a recipient receives the data in another country.',
          { label: 'Transfers to other countries' },
        ),
        formula(
          'DPIACriteria',
          [
            one('SpecialData'),
            one('VulnerableSubjects'),
            one('LargeScale'),
            one('AutomatedDecisions'),
            one('SystematicMonitoring'),
            one('NewTechnology'),
          ].join(' + '),
          'number',
          'How many of these apply: sensitive data, vulnerable people, large scale, automated decisions, systematic monitoring and new technology.',
          { label: 'Impact criteria met' },
        ),
        formula(
          'DPIAIndication',
          "DPIACriteria >= 2 ? 'Likely needed' : DPIACriteria == 1 ? 'Consider' : 'Unlikely'",
          'text',
          'Likely needed from two criteria, Consider with one. An indication for the privacy team, not legal advice.',
          { label: 'Impact assessment indication' },
        ),
      ],
      constraints: [
        {
          id: 'k_activity_purpose',
          formula: "count(outgoing('ForPurpose')) > 0",
          message:
            '= \'Processing activity "\' + Name + \'" has no purpose: connect one with "For purpose".\'',
        },
        {
          id: 'k_activity_data',
          formula: "count(outgoing('Processes')) > 0",
          message:
            "= 'Processing activity \"' + Name + '\" names no category of personal data.'",
        },
        {
          id: 'k_activity_retention',
          formula: "count(outgoing('KeptFor')) > 0",
          message:
            "= 'Processing activity \"' + Name + '\" has no retention rule: say how long the data is kept.'",
        },
        {
          id: 'k_activity_dpia',
          formula:
            "DPIAIndication != 'Likely needed' || DPIAStatus == 'In progress' || DPIAStatus == 'Done'",
          message:
            "= 'Processing activity \"' + Name + '\" meets ' + text(DPIACriteria) + ' impact criteria, but no impact assessment is under way.'",
        },
      ],
    },
    {
      key: 'Purpose',
      label: 'Purpose',
      help: 'Why personal data is used, such as "paying salaries". Each purpose needs a legal basis.',
      look: look('pill', {
        fill: '#d3f9d8',
        border: '#2f9e44',
        subtitle: 'LegalBasisText',
        width: 190,
        height: 50,
      }),
      attributes: [
        long('Description'),
        formula(
          'LegalBasisText',
          "join(outgoing('ReliesOn').Basis, ', ')",
          'text',
          'The legal basis it relies on.',
          { label: 'Legal basis' },
        ),
      ],
      constraints: [
        {
          id: 'k_purpose_basis',
          formula: "count(outgoing('ReliesOn')) > 0",
          message:
            '= \'Purpose "\' + Name + \'" has no legal basis: connect one with "Relies on".\'',
        },
      ],
    },
    {
      key: 'LegalBasis',
      label: 'Legal basis',
      help: 'The ground that allows a use of personal data, such as a contract or a legal obligation, with the rule it rests on.',
      look: look('hexagon', {
        fill: '#b2f2bb',
        border: '#2b8a3e',
        subtitle: 'Basis',
        width: 170,
        height: 70,
      }),
      attributes: [
        choice('Basis', [
          'Consent',
          'Contract',
          'Legal obligation',
          'Vital interests',
          'Public task',
          'Legitimate interests',
        ]),
        text('Reference', {
          help: 'The law, article or agreement it rests on.',
        }),
        long('Notes', {
          help: 'For legitimate interests: the balance between the interests of the organisation and those of the people concerned.',
        }),
      ],
    },
    {
      key: 'DataCategory',
      label: 'Data category',
      help: 'A kind of personal data, such as contact details or health data. Special categories, such as health or religion, need extra care.',
      look: look('rounded', {
        fill: SENSITIVITY_FILL,
        border: '#1c7ed6',
        subtitle: 'Sensitivity',
        width: 170,
        height: 60,
      }),
      attributes: [
        choice(
          'Sensitivity',
          ['Ordinary', 'Special category', 'Criminal offence data'],
          { default: 'Ordinary' },
        ),
        text('Examples', { help: 'Such as "name, address and phone".' }),
        text('Source', {
          help: 'Where the data comes from, such as "from the person" or "from a referring doctor".',
        }),
      ],
    },
    {
      key: 'DataSubject',
      label: 'Data subject',
      help: 'A group of people the personal data is about, such as employees or patients.',
      look: look('person', {
        fill: {
          by: 'Vulnerable',
          values: { true: '#ffe3e3', false: '#f3f0ff' },
          fallback: '#f3f0ff',
        },
        border: '#7048e8',
        width: 100,
        height: 110,
      }),
      attributes: [
        yesNo(
          'Vulnerable',
          'Vulnerable',
          'Children, patients, employees towards their employer or others who cannot easily object.',
        ),
        text('Number', { help: 'About how many people, such as "40,000".' }),
      ],
    },
    {
      key: 'Recipient',
      label: 'Recipient',
      help: 'Who receives the personal data: a department, a processor, another organisation or an authority. Data received in another country needs a safeguard.',
      look: look('box', {
        fill: '#fff9db',
        border: {
          by: 'OtherCountry',
          values: { true: '#e03131', false: '#f08c00' },
          fallback: '#f08c00',
        },
        icon: 'mail',
        subtitle: 'TransferText',
        width: 170,
        height: 64,
      }),
      attributes: [
        choice(
          'RecipientType',
          ['Internal', 'Processor', 'Other controller', 'Public authority'],
          { label: 'Type' },
        ),
        text('Country'),
        yesNo(
          'OtherCountry',
          'Transfer to another country',
          'Yes when the data is received in a country outside the area whose privacy law applies.',
        ),
        choice(
          'Safeguard',
          [
            'Adequacy decision',
            'Standard contractual clauses',
            'Binding corporate rules',
            'Specific exemption',
            'None yet',
          ],
          {
            help: 'What protects the data abroad.',
          },
        ),
        formula(
          'TransferText',
          "OtherCountry ? (Country ?? 'Abroad') + ': ' + (Safeguard ?? 'no safeguard') : RecipientType",
          'text',
          'The country and the safeguard of a transfer, or the type of recipient. Shown under the name.',
        ),
      ],
      constraints: [
        {
          id: 'k_recipient_safeguard',
          formula:
            "!OtherCountry || (!isEmpty(Safeguard) && Safeguard != 'None yet')",
          message:
            "= 'Recipient \"' + Name + '\" receives data in another country without a safeguard.'",
        },
      ],
    },
    {
      key: 'RetentionRule',
      label: 'Retention rule',
      help: 'How long data is kept, from when, and what happens after that.',
      look: look('pill', {
        fill: '#e9ecef',
        border: '#495057',
        icon: 'clock',
        subtitle: 'Period',
        width: 190,
        height: 50,
      }),
      attributes: [
        text('Period', { help: 'Such as "7 years".' }),
        int('Months', { min: 0, help: 'The same period in months.' }),
        text('StartsAt', {
          label: 'Counted from',
          help: 'Such as "the end of the contract".',
        }),
        choice('Then', ['Delete', 'Anonymise', 'Archive']),
      ],
    },
  ],
  amend: {
    Application: {
      label: 'System',
      help: 'A system in which the personal data is kept or used.',
      attributes: [text('HostingCountry')],
    },
  },
  relations: [
    {
      key: 'ForPurpose',
      label: 'For purpose',
      help: 'The processing activity serves the purpose.',
      from: ['ProcessingActivity'],
      to: ['Purpose'],
      look: line('#2f9e44'),
    },
    {
      key: 'ReliesOn',
      label: 'Relies on',
      help: 'The purpose rests on the legal basis.',
      from: ['Purpose'],
      to: ['LegalBasis'],
      look: line('#2b8a3e', { end: 'triangle' }),
    },
    {
      key: 'Processes',
      label: 'Processes',
      help: 'The processing activity uses data of this category.',
      from: ['ProcessingActivity'],
      to: ['DataCategory'],
      look: line('#1c7ed6'),
    },
    {
      key: 'About',
      label: 'About',
      help: 'The personal data is about this group of people.',
      from: ['ProcessingActivity'],
      to: ['DataSubject'],
      look: line('#7048e8', { style: 'dashed' }),
    },
    {
      key: 'DisclosesTo',
      label: 'Discloses to',
      help: 'The processing activity passes personal data to the recipient.',
      from: ['ProcessingActivity'],
      to: ['Recipient'],
      look: line('#f08c00'),
    },
    {
      key: 'KeptFor',
      label: 'Kept for',
      help: 'The data of the processing activity is kept as the retention rule says.',
      from: ['ProcessingActivity'],
      to: ['RetentionRule'],
      look: line('#495057', { style: 'dotted' }),
    },
    {
      key: 'UsesSystem',
      label: 'Uses system',
      help: 'The processing activity keeps or uses the data in the system.',
      from: ['ProcessingActivity'],
      to: ['Application'],
      look: line('#0c8599', { style: 'dashed' }),
    },
  ],
  modelTypes: [
    {
      key: 'Records',
      label: 'Records of processing',
      help: 'Processing activities with their purposes and legal bases, data categories, data subjects, recipients and transfers, retention and systems.',
      views: [
        {
          key: 'Lawfulness',
          label: 'Purposes and legal bases',
          classes: ['ProcessingActivity', 'Purpose', 'LegalBasis'],
          relations: ['ForPurpose', 'ReliesOn'],
        },
        {
          key: 'Data',
          label: 'Data, people and recipients',
          classes: [
            'ProcessingActivity',
            'DataCategory',
            'DataSubject',
            'Recipient',
            'RetentionRule',
            'Application',
          ],
          relations: [
            'Processes',
            'About',
            'DisclosesTo',
            'KeptFor',
            'UsesSystem',
          ],
        },
      ],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('PrivacyContact', {
          label: 'Privacy contact',
          help: 'Who people can contact about their data, such as the data protection officer.',
        }),
        formula(
          'Activities',
          "count(objects('ProcessingActivity'))",
          'number',
          'How many processing activities are recorded.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'ProcessingActivity',
      tabs: [
        {
          label: 'Activity',
          items: [
            'Name',
            'Owner',
            { attribute: 'Role', control: 'segmented' },
            { attribute: 'Description', control: 'textarea' },
            'Purposes',
            'LegalBases',
            'Retention',
          ],
        },
        {
          label: 'Impact assessment',
          items: [
            'LargeScale',
            'AutomatedDecisions',
            'SystematicMonitoring',
            'NewTechnology',
            'SpecialData',
            'VulnerableSubjects',
            'OutsideTransfers',
            'DPIACriteria',
            'DPIAIndication',
            { attribute: 'DPIAStatus', control: 'select' },
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'hospital-records.mkmodel.json',
    id: 'mdl_hospitalrecords',
    name: 'Records of processing',
    modelType: 'Records',
    attributes: {
      Title: 'Records of processing',
      Organisation: 'A hospital group',
      PrivacyContact: 'Data protection officer',
    },
    // "Appointment reminders" needs an impact assessment that has not started, and the text
    // message service receives data abroad without a safeguard, on purpose.
    intendedWarnings: 2,
    elements: [
      // Patient care
      e('lb_care', 'LegalBasis', 40, 90, {
        Name: 'Health care law',
        Basis: 'Public task',
        Reference: 'The national law on health care',
      }),
      e('pur_care', 'Purpose', 280, 100, { Name: 'Diagnosis and treatment' }),
      e('act_care', 'ProcessingActivity', 560, 60, {
        Name: 'Patient care records',
        Owner: 'Medical director',
        Role: 'Controller',
        LargeScale: true,
        DPIAStatus: 'Done',
      }),
      e('ret_care', 'RetentionRule', 280, 230, {
        Name: 'Medical records',
        Period: '20 years',
        Months: 240,
        StartsAt: 'the last treatment',
        Then: 'Delete',
      }),
      e('rcp_lab', 'Recipient', 470, 250, {
        Name: 'Laboratory service',
        RecipientType: 'Processor',
        Country: 'Home country',
      }),
      e('sys_ehr', 'Application', 680, 250, {
        Name: 'Electronic health record',
        HostingCountry: 'Home country',
      }),
      e('cat_health', 'DataCategory', 900, 40, {
        Name: 'Health data',
        Sensitivity: 'Special category',
        Examples: 'Diagnoses, test results, medication',
      }),
      e('cat_insurance', 'DataCategory', 900, 120, {
        Name: 'Insurance details',
        Examples: 'Insurer and policy number',
      }),
      e('cat_contact', 'DataCategory', 900, 330, {
        Name: 'Contact details',
        Examples: 'Name, address, phone, email',
      }),
      e('sub_patients', 'DataSubject', 1160, 230, {
        Name: 'Patients',
        Vulnerable: true,
        Number: 'About 300,000 a year',
      }),
      // Staff payroll
      e('lb_contract', 'LegalBasis', 40, 400, {
        Name: 'Employment contract',
        Basis: 'Contract',
      }),
      e('lb_tax', 'LegalBasis', 40, 490, {
        Name: 'Tax law',
        Basis: 'Legal obligation',
        Reference: 'The national tax law',
      }),
      e('pur_salary', 'Purpose', 280, 410, { Name: 'Paying salaries' }),
      e('pur_tax', 'Purpose', 280, 500, { Name: 'Tax reporting' }),
      e('act_payroll', 'ProcessingActivity', 560, 420, {
        Name: 'Staff payroll',
        Owner: 'Head of human resources',
        Role: 'Controller',
        DPIAStatus: 'Not needed',
      }),
      e('ret_payroll', 'RetentionRule', 280, 610, {
        Name: 'Payroll records',
        Period: '7 years',
        Months: 84,
        StartsAt: 'the end of the tax year',
        Then: 'Delete',
      }),
      e('rcp_payroll', 'Recipient', 470, 610, {
        Name: 'Payroll provider',
        RecipientType: 'Processor',
        Country: 'Neighbouring country',
        OtherCountry: true,
        Safeguard: 'Standard contractual clauses',
      }),
      e('rcp_taxoffice', 'Recipient', 680, 610, {
        Name: 'Tax authority',
        RecipientType: 'Public authority',
        Country: 'Home country',
      }),
      e('cat_salary', 'DataCategory', 900, 430, {
        Name: 'Salary and tax',
        Examples: 'Salary, tax code, deductions',
      }),
      e('cat_bank', 'DataCategory', 900, 510, {
        Name: 'Bank details',
        Examples: 'Account number',
      }),
      e('sub_staff', 'DataSubject', 1160, 440, {
        Name: 'Employees',
        Vulnerable: false,
        Number: 'About 9,000',
      }),
      // Appointment reminders
      e('lb_interest', 'LegalBasis', 40, 790, {
        Name: 'Fewer missed appointments',
        Basis: 'Legitimate interests',
        Notes:
          'Reminders help patients and cost them nothing; they can turn them off.',
      }),
      e('pur_remind', 'Purpose', 280, 800, {
        Name: 'Reminding patients of appointments',
      }),
      e('act_remind', 'ProcessingActivity', 560, 780, {
        Name: 'Appointment reminders',
        Owner: 'Head of outpatient clinics',
        Role: 'Controller',
        LargeScale: true,
        NewTechnology: true,
        DPIAStatus: 'Not started',
      }),
      e('ret_remind', 'RetentionRule', 280, 960, {
        Name: 'Reminder log',
        Period: '3 months',
        Months: 3,
        StartsAt: 'the appointment',
        Then: 'Delete',
      }),
      e('rcp_sms', 'Recipient', 470, 970, {
        Name: 'Text message service',
        RecipientType: 'Processor',
        Country: 'Overseas',
        OtherCountry: true,
        Safeguard: 'None yet',
      }),
      e('sys_appointments', 'Application', 680, 970, {
        Name: 'Appointment system',
        HostingCountry: 'Home country',
      }),
      e('cat_appointments', 'DataCategory', 900, 800, {
        Name: 'Appointment times',
        Examples: 'Date, time and clinic',
      }),
    ],
    connectors: [
      c('ForPurpose', 'act_care', 'pur_care'),
      c('ReliesOn', 'pur_care', 'lb_care'),
      c('Processes', 'act_care', 'cat_health'),
      c('Processes', 'act_care', 'cat_insurance'),
      c('Processes', 'act_care', 'cat_contact'),
      c('About', 'act_care', 'sub_patients'),
      c('DisclosesTo', 'act_care', 'rcp_lab'),
      c('KeptFor', 'act_care', 'ret_care'),
      c('UsesSystem', 'act_care', 'sys_ehr'),
      c('ForPurpose', 'act_payroll', 'pur_salary'),
      c('ForPurpose', 'act_payroll', 'pur_tax'),
      c('ReliesOn', 'pur_salary', 'lb_contract'),
      c('ReliesOn', 'pur_tax', 'lb_tax'),
      c('Processes', 'act_payroll', 'cat_contact'),
      c('Processes', 'act_payroll', 'cat_salary'),
      c('Processes', 'act_payroll', 'cat_bank'),
      c('About', 'act_payroll', 'sub_staff'),
      c('DisclosesTo', 'act_payroll', 'rcp_payroll'),
      c('DisclosesTo', 'act_payroll', 'rcp_taxoffice'),
      c('KeptFor', 'act_payroll', 'ret_payroll'),
      c('ForPurpose', 'act_remind', 'pur_remind'),
      c('ReliesOn', 'pur_remind', 'lb_interest'),
      c('Processes', 'act_remind', 'cat_contact'),
      c('Processes', 'act_remind', 'cat_appointments'),
      c('About', 'act_remind', 'sub_patients'),
      c('DisclosesTo', 'act_remind', 'rcp_sms'),
      c('KeptFor', 'act_remind', 'ret_remind'),
      c('UsesSystem', 'act_remind', 'sys_appointments'),
    ],
  },
};
