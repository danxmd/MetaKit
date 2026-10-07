import {
  effectiveAttributes,
  effectiveRelationAttributes,
  formulaSource,
  isFormula,
  type AttributeDef,
  type ConnectorId,
  type ElementId,
  type Json,
  type Labels,
  type Model,
  type PanelAttributeItem,
  type PanelControl,
  type PanelItem,
  type PanelLayout,
  type ToolLibrary,
  type ValidationIssue,
} from '@metakit-app/core';
import { run, truthy, type Value } from '@metakit-app/formula';
import { makeScope } from '@metakit-app/shapes';
import {
  buildField,
  pickLabel,
  type ControlKind,
  type Field,
  type PanelTarget,
} from './model';

export interface LayoutFieldNode {
  kind: 'field';
  /** The same field model the generated panel uses, with the layout's control, read-only and required applied. */
  field: Field;
  visible: boolean;
  /** Only for tables and text areas. */
  height?: number;
}

export interface LayoutGroupNode {
  kind: 'group';
  label: string;
  visible: boolean;
  items: LayoutNode[];
}

export type LayoutNode = LayoutFieldNode | LayoutGroupNode;

export interface LayoutTabNode {
  label: string;
  visible: boolean;
  items: LayoutNode[];
}

export interface LayoutPanel {
  tabs: LayoutTabNode[];
  showRelations: boolean;
  /** Plain-English remarks about parts of the layout that could not be used, for the Build mode user. */
  notes: string[];
}

export interface LayoutOptions {
  language?: string;
  /**
   * The values of every selected object by attribute id. Defaults to `[values]`. Differing values
   * show as mixed; conditions always use `values`.
   */
  targets?: readonly Record<string, Json>[];
  /** Validation messages by attribute id. */
  issues?: Readonly<Record<string, readonly string[]>>;
  /** Follows a reference value to that element's values by key, for formulas such as `Owner.Name`. */
  resolve?: (id: string) => Record<string, Value> | undefined;
}

/** The panel controls that suit each attribute type; the first is not necessarily the default. */
const CONTROLS_FOR: Partial<
  Record<AttributeDef['type'], Partial<Record<PanelControl, ControlKind>>>
> = {
  text: { text: 'text', textarea: 'textarea' },
  integer: { number: 'integer' },
  number: { number: 'number' },
  boolean: { switch: 'switch', checkbox: 'checkbox' },
  date: { date: 'date' },
  duration: { duration: 'duration' },
  choice: { select: 'select', segmented: 'segmented' },
  'multi-choice': { chips: 'chips' },
  table: { table: 'table' },
  reference: { reference: 'reference' },
  link: { link: 'link' },
};

/** The panel controls a layout may choose for an attribute of this type. */
export function controlsFor(type: AttributeDef['type']): PanelControl[] {
  return Object.keys(CONTROLS_FOR[type] ?? {}) as PanelControl[];
}

function isGroup(
  item: PanelItem,
): item is Extract<PanelItem, { group: string }> {
  return 'group' in item;
}

const label = (
  labels: Labels | undefined,
  fallback: string,
  language: string,
) => pickLabel(labels, language) ?? fallback;

/**
 * The panel of a layout for one element or connector: tabs, groups and fields with their
 * conditions evaluated against `values` (by attribute id). Attributes the layout does not place
 * appear in a final tab "More", so every attribute stays reachable.
 */
export function buildLayoutPanel(
  layout: PanelLayout,
  defs: readonly AttributeDef[],
  values: Record<string, Json>,
  options: LayoutOptions = {},
): LayoutPanel {
  const language = options.language ?? 'en';
  const targets = options.targets ?? [values];
  const notes: string[] = [];
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const placed = new Set<string>();

  const scope = makeScope(
    defs,
    values,
    {
      label: '',
      className: '',
      w: 0,
      h: 0,
      fill: '',
      ...(options.resolve ? { resolve: options.resolve } : {}),
      language,
    },
    undefined,
  );

  /** A fixed boolean or a formula; a failing formula or one that returns nothing keeps the default. */
  const condition = (
    value: boolean | string | undefined,
    fallback: boolean,
    where: string,
  ): boolean => {
    if (value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    if (!isFormula(value)) {
      notes.push(
        `${where}: "${value}" is not true, false or a formula starting with =, so the default is used.`,
      );
      return fallback;
    }
    const result = run(formulaSource(value), scope);
    if (result.error !== undefined) {
      notes.push(
        `${where}: the formula ${value} could not be calculated (${result.error}), so the default is used.`,
      );
      return fallback;
    }
    if (result.value === null) return fallback;
    return truthy(result.value);
  };

  const fieldNode = (
    item: PanelAttributeItem,
    attr: AttributeDef,
  ): LayoutFieldNode => {
    const where = `Attribute ${attr.key}`;
    const field = buildField(
      attr,
      targets.map((t) => {
        const v = t[attr.id];
        return v === null ? undefined : v;
      }),
      [...(options.issues?.[attr.id] ?? [])],
      language,
    );
    if (item.control !== undefined) {
      const kind = CONTROLS_FOR[attr.type]?.[item.control];
      if (kind) field.control = kind;
      else
        notes.push(
          `${where}: the control "${item.control}" does not suit a ${attr.type} attribute, so the default control is used.`,
        );
    }
    const visible = condition(item.visible, true, `${where} (visible)`);
    // A calculated value or a button can never be edited, whatever the layout says.
    const locked = attr.type === 'formula' || attr.type === 'action';
    field.readOnly =
      locked || condition(item.readOnly, false, `${where} (read only)`);
    field.required =
      attr.required === true ||
      condition(item.required, false, `${where} (required)`);
    const node: LayoutFieldNode = { kind: 'field', field, visible };
    if (item.height !== undefined) {
      if (field.control === 'table' || field.control === 'textarea')
        node.height = item.height;
      else
        notes.push(
          `${where}: a height only applies to tables and text areas, so it is ignored.`,
        );
    }
    return node;
  };

  const items = (list: readonly PanelItem[], where: string): LayoutNode[] => {
    const out: LayoutNode[] = [];
    for (const item of list) {
      if (isGroup(item)) {
        out.push({
          kind: 'group',
          label: label(item.labels, item.group, language),
          visible: condition(item.visible, true, `Group ${item.group}`),
          items: items(item.items, `group ${item.group}`),
        });
        continue;
      }
      const attr = byKey.get(item.attribute);
      if (!attr) {
        notes.push(
          `${where}: the attribute "${item.attribute}" does not exist on this class, so it is skipped.`,
        );
        continue;
      }
      if (placed.has(attr.id)) {
        notes.push(
          `${where}: the attribute "${attr.key}" is placed twice; only the first place is used.`,
        );
        continue;
      }
      placed.add(attr.id);
      out.push(fieldNode(item, attr));
    }
    return out;
  };

  const tabs: LayoutTabNode[] = layout.tabs.map((tab) => ({
    label: label(tab.labels, tab.label, language),
    visible: condition(tab.visible, true, `Tab ${tab.label}`),
    items: items(tab.items, `Tab ${tab.label}`),
  }));

  const rest = defs.filter((d) => !placed.has(d.id));
  if (rest.length > 0) {
    tabs.push({
      label: 'More',
      visible: true,
      items: rest.map((attr) => fieldNode({ attribute: attr.key }, attr)),
    });
  }
  return { tabs, showRelations: layout.showRelations === true, notes };
}

/**
 * The layout panel for a selection, or null when the generated panel applies: nothing selected,
 * a mix of elements and connectors, objects of different classes, or a class without a layout.
 */
export function buildLayoutPanelFor(
  tool: ToolLibrary,
  model: Model,
  targets: readonly PanelTarget[],
  issues: readonly ValidationIssue[],
  language = 'en',
): LayoutPanel | null {
  const first = targets[0];
  if (first === undefined) return null;
  const classes = new Set<string>();
  let defs: AttributeDef[];
  const data = targets.map(
    (t) =>
      model.elements[t.id as ElementId] ??
      model.connectors[t.id as ConnectorId],
  );
  if (data.some((d) => d === undefined)) return null;
  for (const d of data)
    classes.add(
      'class' in d!
        ? (d as { class: string }).class
        : (d as { relation: string }).relation,
    );
  if (classes.size !== 1) return null;
  const classId = [...classes][0]!;
  const layout = tool.panels?.[classId];
  if (!layout) return null;
  try {
    defs =
      first.id in model.elements
        ? effectiveAttributes(tool, classId as never)
        : effectiveRelationAttributes(tool, classId as never);
  } catch {
    return null;
  }
  const ids = new Set<string>(targets.map((t) => t.id));
  const byAttr: Record<string, string[]> = {};
  for (const i of issues) {
    if (!ids.has(i.id) || i.attr === undefined) continue;
    const list = (byAttr[i.attr] ??= []);
    if (!list.includes(i.message)) list.push(i.message);
  }
  const valueSets = data.map((d) => d!.attrs as Record<string, Json>);
  return buildLayoutPanel(layout, defs, valueSets[0]!, {
    language,
    targets: valueSets,
    issues: byAttr,
  });
}
