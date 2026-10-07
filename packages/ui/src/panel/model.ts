import {
  deepEqual,
  effectiveAttributes,
  effectiveRelationAttributes,
  optionValue,
  type AttributeDef,
  type ChoiceOption,
  type ConnectorId,
  type ElementId,
  type Json,
  type Labels,
  type Model,
  type ModelCalculator,
  type ToolLibrary,
  type ValidationIssue,
} from '@metakit-app/core';

export type ControlKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'switch'
  | 'checkbox'
  | 'date'
  | 'date-time'
  | 'duration'
  | 'select'
  | 'segmented'
  | 'chips'
  | 'table'
  | 'reference'
  | 'link'
  | 'readonly'
  | 'button';

export interface PanelOption {
  value: string;
  label: string;
}

export interface Field {
  attr: AttributeDef;
  label: string;
  help?: string;
  control: ControlKind;
  /** The value all targets share; undefined when unset or when `mixed`. */
  value: Json | undefined;
  /** True when the targets have different values; the control then shows a dash. */
  mixed: boolean;
  readOnly: boolean;
  required: boolean;
  issues: string[];
  /** For a formula attribute: why it has no value, in plain English. */
  error?: string;
  options?: PanelOption[];
  unit?: string;
  decimals?: number;
  group?: string;
}

export interface PanelSection {
  /** The attribute group; undefined for attributes without one. */
  title: string | undefined;
  fields: Field[];
}

export interface PanelOptions {
  /** Shows formula attributes and constraint messages; without it formula attributes show nothing. */
  calculator?: ModelCalculator;
}

export interface PanelTarget {
  id: ElementId | ConnectorId;
}

export function pickLabel(
  labels: Labels | undefined,
  language: string,
): string | undefined {
  return labels?.[language] ?? labels?.['en'];
}

function optionsOf(
  options: readonly ChoiceOption[],
  language: string,
): PanelOption[] {
  return options.map((o) => ({
    value: optionValue(o),
    label:
      typeof o === 'string' ? o : (pickLabel(o.labels, language) ?? o.value),
  }));
}

export function controlFor(attr: AttributeDef): ControlKind {
  switch (attr.type) {
    case 'text':
      return attr.multiline ? 'textarea' : 'text';
    case 'integer':
      return 'integer';
    case 'number':
      return 'number';
    case 'boolean':
      return attr.display === 'checkbox' ? 'checkbox' : 'switch';
    case 'date':
    case 'date-time':
    case 'duration':
    case 'table':
    case 'reference':
    case 'link':
      return attr.type;
    case 'choice':
      return attr.options.length >= 1 && attr.options.length <= 4
        ? 'segmented'
        : 'select';
    case 'multi-choice':
      return 'chips';
    case 'formula':
      return 'readonly';
    case 'action':
      return 'button';
  }
}

function formatValue(value: unknown, asBoolean: boolean): string {
  if (typeof value === 'number')
    // Rounding hides floating point noise such as 0.1 + 0.2.
    return String(Number(value.toFixed(10)));
  if (typeof value === 'boolean' || (asBoolean && value !== null))
    return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value.map((v) => formatValue(v, false)).join(', ');
  return JSON.stringify(value);
}

/** A calculated value as the panel shows it, following the attribute's `result` type. */
export function formatFormulaValue(
  attr: AttributeDef,
  value: unknown,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  return formatValue(
    value,
    attr.type === 'formula' && attr.result === 'boolean',
  );
}

/** The value and the problem of a formula attribute of one object. */
export function computedValue(
  calculator: ModelCalculator,
  id: string,
  attr: AttributeDef,
): { value: string | undefined; error?: string } {
  const error = calculator.errorOf(id, attr.key);
  const value = formatFormulaValue(attr, calculator.get(id, attr.key));
  return error === undefined ? { value } : { value, error };
}

/** The issue messages that belong to no single field, such as a constraint that names two attributes. */
export function objectMessages(
  issues: readonly ValidationIssue[],
  ids: readonly string[],
): string[] {
  const set = new Set(ids);
  const out: string[] = [];
  for (const i of issues) {
    if (!set.has(i.id) || i.attr !== undefined) continue;
    if (i.code !== 'constraint' && i.code !== 'formula-error') continue;
    if (!out.includes(i.message)) out.push(i.message);
  }
  return out;
}

/** Issues shown under a field; a formula attribute's own problem is already shown as its error. */
export function fieldIssues(
  issues: readonly ValidationIssue[],
  ids: ReadonlySet<string>,
  attr: AttributeDef,
  hasCalculator: boolean,
): string[] {
  return [
    ...new Set(
      issues
        .filter(
          (i) =>
            ids.has(i.id) &&
            i.attr === attr.id &&
            !(
              hasCalculator &&
              i.code === 'formula-error' &&
              attr.type === 'formula'
            ),
        )
        .map((i) => i.message),
    ),
  ];
}

/**
 * The field model of one attribute for the given targets' values (one entry per target; an unset
 * value is `undefined`). Shared by the generated panel and the layout panel so both look the same.
 */
export function buildField(
  attr: AttributeDef,
  values: readonly (Json | undefined)[],
  issues: string[],
  language = 'en',
): Field {
  const mixed = values.some((v) => !deepEqual(v, values[0]));
  const field: Field = {
    attr,
    label: pickLabel(attr.labels, language) ?? attr.key,
    control: controlFor(attr),
    value: mixed ? undefined : values[0],
    mixed,
    readOnly: attr.type === 'formula' || attr.type === 'action',
    required: attr.required === true,
    issues,
  };
  const help = pickLabel(attr.help, language);
  if (help !== undefined) field.help = help;
  if (attr.type === 'choice' || attr.type === 'multi-choice')
    field.options = optionsOf(attr.options, language);
  if (attr.type === 'number') {
    if (attr.unit !== undefined) field.unit = attr.unit;
    if (attr.decimals !== undefined) field.decimals = attr.decimals;
  }
  if (attr.group !== undefined) field.group = attr.group;
  return field;
}

function attributesOf(
  tool: ToolLibrary,
  model: Model,
  id: ElementId | ConnectorId,
): AttributeDef[] | null {
  const el = model.elements[id as ElementId];
  try {
    if (el) return effectiveAttributes(tool, el.class);
    const cn = model.connectors[id as ConnectorId];
    // An unknown class or relation has no attributes, so the panel stays empty.
    if (cn) return effectiveRelationAttributes(tool, cn.relation);
  } catch {
    return [];
  }
  return [];
}

function storedValue(
  model: Model,
  id: ElementId | ConnectorId,
  attr: AttributeDef,
): Json | undefined {
  const data =
    model.elements[id as ElementId] ?? model.connectors[id as ConnectorId];
  const value = data?.attrs[attr.id];
  return value === null ? undefined : value;
}

/**
 * The fields of the attribute panel for the selected elements or connectors, grouped into
 * sections. With several targets only attributes that all of them have (by attribute id) appear.
 * A selection that mixes elements and connectors, or is empty, has no sections.
 */
export function buildPanel(
  tool: ToolLibrary,
  model: Model,
  targets: readonly PanelTarget[],
  issues: readonly ValidationIssue[],
  language = 'en',
  options: PanelOptions = {},
): PanelSection[] {
  const first = targets[0];
  if (first === undefined) return [];
  const isElement = (id: string) => id in model.elements;
  const kind = isElement(first.id);
  if (targets.some((t) => isElement(t.id) !== kind)) return [];

  const lists = targets.map((t) => attributesOf(tool, model, t.id) ?? []);
  const common = lists[0]!.filter((a) =>
    lists.every((list) => list.some((b) => b.id === a.id)),
  );
  const ids = new Set<string>(targets.map((t) => t.id));

  const sections: PanelSection[] = [];
  const byTitle = new Map<string | undefined, PanelSection>();
  const ungrouped: PanelSection = { title: undefined, fields: [] };
  byTitle.set(undefined, ungrouped);
  sections.push(ungrouped);

  for (const attr of common) {
    const calc = options.calculator;
    const computed =
      attr.type === 'formula' && calc
        ? targets.map((t) => computedValue(calc, t.id, attr))
        : undefined;
    const field = buildField(
      attr,
      computed
        ? computed.map((c) => c.value)
        : targets.map((t) => storedValue(model, t.id, attr)),
      fieldIssues(issues, ids, attr, calc !== undefined),
      language,
    );
    const problem = computed?.find((c) => c.error !== undefined)?.error;
    if (problem !== undefined) field.error = problem;

    let section = byTitle.get(attr.group);
    if (!section) {
      section = { title: attr.group, fields: [] };
      byTitle.set(attr.group, section);
      sections.push(section);
    }
    section.fields.push(field);
  }
  // A selection with only grouped attributes should not start with an empty untitled section.
  return sections.filter((s) => s.fields.length > 0);
}
