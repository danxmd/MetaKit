import type {
  LookBase,
  LookColour,
  LookIconName,
  LookLineStyle,
  MarkerType,
  NodeLook,
  RelationLook,
} from '@metakit-app/core';
import { baseInfo } from '@metakit-app/shapes';
import type {
  CatalogAttribute,
  CatalogClass,
  CatalogRelation,
  CatalogTopicId,
} from './types';

/**
 * Helpers the topic files of the class catalog write their entries with. The wording of entries
 * is neutral on purpose: no company or product names, and technology fields are free text.
 */

// Attribute helpers --------------------------------------------------------------------------

/** "EffectiveDate" becomes "Effective date"; words in capitals stay as they are. */
function words(key: string): string {
  const parts = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
  return parts
    .map((w, i) => (i === 0 || /^[A-Z0-9]+$/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}

export const text = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'text',
  key,
  label,
});
export const long = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'text',
  key,
  label,
  multiline: true,
});
export const choice = (
  key: string,
  options: string[],
  label = words(key),
): CatalogAttribute => ({ type: 'choice', key, label, options });
export const int = (
  key: string,
  range: { min?: number; max?: number } = {},
  label = words(key),
): CatalogAttribute => ({ type: 'integer', key, label, ...range });
export const num = (
  key: string,
  extra: { unit?: string; min?: number; max?: number } = {},
  label = words(key),
): CatalogAttribute => ({ type: 'number', key, label, ...extra });
export const bool = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'boolean',
  key,
  label,
});
export const date = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'date',
  key,
  label,
});
export const link = (key: string, label = words(key)): CatalogAttribute => ({
  type: 'link',
  key,
  label,
  target: 'any',
});
export const formula = (
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
export const scale = (key: string, label = words(key)) =>
  int(key, { min: 1, max: 5 }, `${label} (1 to 5)`);
/** A share from 0 to 100 per cent. */
export const percent = (key: string, label = words(key)) =>
  num(key, { unit: '%', min: 0, max: 100 }, label);

export const LOW_HIGH = ['Low', 'Medium', 'High'];
export const RAG = ['Green', 'Amber', 'Red'];
export const WORK = ['Not started', 'In progress', 'Done', 'Blocked'];
export const STAGES = ['Development', 'Test', 'Production'];
export const LEVELS = ['Public', 'Internal', 'Confidential', 'Restricted'];
export const SEVERITY = ['Low', 'Medium', 'High', 'Critical'];

/** A border that turns green or red with a yes/no attribute. */
export const passFail = (by: string, fallback: string): LookColour => ({
  by,
  values: { true: '#2f9e44', false: '#e03131' },
  fallback,
});

// Looks --------------------------------------------------------------------------------------

/**
 * One pair of colours per topic, from the palette of the Appearance editor. Topics of one family
 * share a fill, so entries that moved between tabs keep their colours.
 */
const TONES: Record<CatalogTopicId, { fill: string; border: string }> = {
  general: { fill: '#e9ecef', border: '#495057' },
  people: { fill: '#e9ecef', border: '#495057' },
  business: { fill: '#b2f2bb', border: '#2f9e44' },
  customer: { fill: '#ffec99', border: '#f08c00' },
  finance: { fill: '#b2f2bb', border: '#0c8599' },
  delivery: { fill: '#ffd8a8', border: '#f08c00' },
  ea: { fill: '#bac8ff', border: '#4263eb' },
  apps: { fill: '#96f2d7', border: '#0c8599' },
  security: { fill: '#ffc9c9', border: '#1b1f27' },
  data: { fill: '#a5d8ff', border: '#1c7ed6' },
  mesh: { fill: '#a5d8ff', border: '#4263eb' },
  quality: { fill: '#96f2d7', border: '#1c7ed6' },
  analytics: { fill: '#bac8ff', border: '#1c7ed6' },
  ai: { fill: '#eebefa', border: '#9c36b5' },
  genai: { fill: '#eebefa', border: '#9c36b5' },
  governance: { fill: '#ffc9c9', border: '#e03131' },
};

/** The line colour of a topic, for its relation classes. */
export const lineOf = (topic: CatalogTopicId) => TONES[topic].border;

interface LookOptions {
  icon?: LookIconName;
  subtitle?: string;
  fields?: string[];
  fill?: LookColour;
  border?: LookColour;
}

export function look(
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

export function line(
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

export function cls(
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

export function rel(
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

export const DATA_LINE = '#1c7ed6';
export const AI_LINE = '#9c36b5';
export const GOV_LINE = '#e03131';
export const PLAIN_LINE = '#6b7a90';
