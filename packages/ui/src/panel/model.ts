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

export interface PanelTarget {
  id: ElementId | ConnectorId;
}

function text(
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
    label: typeof o === 'string' ? o : (text(o.labels, language) ?? o.value),
  }));
}

function controlFor(attr: AttributeDef): ControlKind {
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
    const values = targets.map((t) => storedValue(model, t.id, attr));
    const mixed = values.some((v) => !deepEqual(v, values[0]));
    const control = controlFor(attr);
    const field: Field = {
      attr,
      label: text(attr.labels, language) ?? attr.key,
      control,
      value: mixed ? undefined : values[0],
      mixed,
      readOnly: attr.type === 'formula' || attr.type === 'action',
      required: attr.required === true,
      issues: [
        ...new Set(
          issues
            .filter((i) => ids.has(i.id) && i.attr === attr.id)
            .map((i) => i.message),
        ),
      ],
    };
    const help = text(attr.help, language);
    if (help !== undefined) field.help = help;
    if (attr.type === 'choice' || attr.type === 'multi-choice')
      field.options = optionsOf(attr.options, language);
    if (attr.type === 'number') {
      if (attr.unit !== undefined) field.unit = attr.unit;
      if (attr.decimals !== undefined) field.decimals = attr.decimals;
    }
    if (attr.group !== undefined) field.group = attr.group;

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
