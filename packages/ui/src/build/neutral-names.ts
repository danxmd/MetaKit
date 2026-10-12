/**
 * Companies, consultancies and vendor products that built-in content (Kits and the class
 * catalog) must not name. Only tests read this list.
 */
export const NEUTRAL_NAMES: readonly string[] = [
  'Accenture',
  'Deloitte',
  'McKinsey',
  'PwC',
  'KPMG',
  'EY',
  'Capgemini',
  'IBM',
  'Microsoft',
  'Azure',
  'AWS',
  'Amazon',
  'Google',
  'GCP',
  'Snowflake',
  'Databricks',
  'Salesforce',
  'SAP',
  'Oracle',
  'OpenAI',
  'Anthropic',
  'Tableau',
  'Power BI',
  'Informatica',
  'Collibra',
];

/** Matches any of the names as a whole word, in any case. */
export const NEUTRAL_NAME_PATTERN = new RegExp(
  `\b(${NEUTRAL_NAMES.join('|')})\b`,
  'i',
);
