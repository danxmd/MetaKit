import { namesIn, parseCached, toText, truthy } from '@metakit-app/formula';
import type { ModelCalculator } from '../calc/calculator';
import type { AttributeId, ConnectorId, ElementId } from '../ids';
import {
  effectiveAttributes,
  effectiveEnds,
  effectiveRelationAttributes,
  allowsEnd,
  isA,
  modelTypeAllowsClass,
  modelTypeAllowsRelation,
  relationIsA,
  classChain,
  relationChain,
} from '../meta/inherit';
import type { Constraint } from '../meta/rule-types';
import type {
  AttributeDef,
  ClassDef,
  Labels,
  ModelTypeDef,
  RelationDef,
  ToolLibrary,
} from '../meta/types';
import { checkAttributeValue, isEmptyValue } from '../meta/values';
import {
  containerAccepts,
  isContainerClass,
  parentChainLoops,
} from '../model/containers';
import {
  inDrawingOrder,
  type ConnectorData,
  type ElementData,
  type Model,
} from '../model/types';

export type Severity = 'error' | 'warning' | 'info';

/** One problem found in a model. `code` is stable; `message` is for people. */
export interface ValidationIssue {
  /** The element or connector the problem belongs to, or `'model'`. */
  id: ElementId | ConnectorId | 'model';
  severity: Severity;
  code: string;
  /** The attribute the problem is about; for a constraint, the one its formula names, if only one. */
  attr?: AttributeId;
  /** The id of the violated constraint (code `constraint`). */
  constraint?: string;
  message: string;
}

function labelOf(
  tool: ToolLibrary,
  labels: Labels | undefined,
  fallback: string,
): string {
  if (!labels) return fallback;
  for (const lang of tool.manifest.languages)
    if (labels[lang]) return labels[lang]!;
  return Object.values(labels)[0] ?? fallback;
}

const attrLabel = (tool: ToolLibrary, def: AttributeDef) =>
  labelOf(tool, def.labels, def.key);

/** "Task "Review order"": the class and, when it has one, the value of its Name attribute. */
function describeElement(tool: ToolLibrary, el: ElementData): string {
  const cls = tool.classes[el.class];
  if (!cls) return `Element ${el.id}`;
  const label = labelOf(tool, cls.labels, cls.key);
  let name: unknown;
  try {
    const nameAttr = effectiveAttributes(tool, el.class).find(
      (a) => a.key === 'Name',
    );
    name = nameAttr ? el.attrs[nameAttr.id] : undefined;
  } catch {
    // A broken inheritance chain is a tool library problem; fall back to the class label.
  }
  return typeof name === 'string' && name !== '' ? `${label} "${name}"` : label;
}

function describeConnector(tool: ToolLibrary, cn: ConnectorData): string {
  const rel = tool.relations[cn.relation];
  return rel ? labelOf(tool, rel.labels, rel.key) : `Connector ${cn.id}`;
}

function listLabels(tool: ToolLibrary, ids: readonly string[]): string {
  return ids
    .map((id) =>
      tool.classes[id as never]
        ? labelOf(
            tool,
            tool.classes[id as never]!.labels,
            tool.classes[id as never]!.key,
          )
        : id,
    )
    .join(', ');
}

function checkValues(
  tool: ToolLibrary,
  who: string,
  id: ValidationIssue['id'],
  defs: AttributeDef[],
  values: Record<string, unknown>,
  out: ValidationIssue[],
  owner: string,
): void {
  for (const def of defs) {
    if (def.type === 'formula' || def.type === 'action') continue;
    const value = values[def.id];
    const name = attrLabel(tool, def);
    if (def.required && isEmptyValue(value)) {
      out.push({
        id,
        severity: 'warning',
        code: 'required',
        attr: def.id,
        message: `${who}: ${name} is required.`,
      });
      continue;
    }
    for (const p of checkAttributeValue(def, value)) {
      out.push({
        id,
        severity: 'warning',
        code: p.code,
        attr: def.id,
        message: `${who}: ${name} ${p.message}.`,
      });
    }
  }
  const known = new Set(defs.map((d) => d.id));
  for (const key of Object.keys(values)) {
    if (!known.has(key as AttributeId)) {
      out.push({
        id,
        severity: 'info',
        code: 'unknown-attribute',
        attr: key as AttributeId,
        message: `${who}: has a value for ${key}, which ${owner} no longer has. The value is kept.`,
      });
    }
  }
}

/**
 * Runs the constraints and the formula attributes of one object. A constraint holds when its
 * formula is true; a formula that cannot be evaluated is reported as a warning because it says
 * nothing about the object, only about the tool library.
 */
function checkFormulas(
  calc: ModelCalculator,
  tool: ToolLibrary,
  who: string,
  id: ValidationIssue['id'],
  defs: AttributeDef[],
  constraints: Constraint[],
  out: ValidationIssue[],
): void {
  for (const def of defs) {
    if (def.type !== 'formula') continue;
    const problem = calc.errorOf(id, def.key);
    if (problem)
      out.push({
        id,
        severity: 'warning',
        code: 'formula-error',
        attr: def.id,
        message: `${who}: the formula of ${attrLabel(tool, def)} cannot be calculated. ${problem}`,
      });
  }
  const byKey = new Map(defs.map((d) => [d.key, d]));
  for (const c of constraints) {
    const result = calc.evaluate(id === 'model' ? null : id, c.formula);
    if (result.error) {
      out.push({
        id,
        severity: 'warning',
        code: 'formula-error',
        constraint: c.id,
        message: `${who}: the constraint "${c.message.startsWith('=') ? c.formula : c.message}" cannot be checked. ${result.error}`,
      });
      continue;
    }
    if (truthy(result.value)) continue;
    let message = c.message;
    if (message.startsWith('=')) {
      const m = calc.evaluate(id === 'model' ? null : id, message);
      message = m.error ? `${who}: a constraint is not met.` : toText(m.value);
    }
    const parsed = parseCached(c.formula.trim().replace(/^=/, ''));
    const named =
      'expr' in parsed
        ? [...namesIn(parsed.expr)].flatMap((n) => byKey.get(n) ?? [])
        : [];
    out.push({
      id,
      severity: c.severity ?? 'error',
      code: 'constraint',
      constraint: c.id,
      ...(named.length === 1 ? { attr: named[0]!.id } : {}),
      message,
    });
  }
}

function safely<T>(fallback: T, run: () => T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

/**
 * Checks a model against its tool library and returns every problem found. It never changes the
 * model and never blocks an edit: the application decides what to show and when.
 * Order: the model itself, then elements, then connectors, each in drawing order.
 * With a calculator it also reports violated constraints and formulas that cannot be
 * calculated; without one those checks are skipped.
 */
export function validateModel(
  tool: ToolLibrary,
  model: Model,
  calculator?: ModelCalculator,
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const modelType: ModelTypeDef | undefined =
    tool.modelTypes[model.manifest.modelType];

  // --- the model itself ---
  if (model.manifest.tool !== tool.manifest.id) {
    out.push({
      id: 'model',
      severity: 'warning',
      code: 'tool-mismatch',
      message: `This model was made with the tool ${model.manifest.tool}, but it is being checked against ${tool.manifest.id}.`,
    });
  }
  if (!modelType) {
    out.push({
      id: 'model',
      severity: 'error',
      code: 'unknown-model-type',
      message: `The model type ${model.manifest.modelType} does not exist in the tool library, so the model cannot be checked against its rules.`,
    });
  } else {
    checkValues(
      tool,
      `Model "${model.manifest.name}"`,
      'model',
      modelType.attributes,
      model.attrs,
      out,
      'the model type',
    );
    if (calculator)
      checkFormulas(
        calculator,
        tool,
        `Model "${model.manifest.name}"`,
        'model',
        modelType.attributes,
        modelType.constraints ?? [],
        out,
      );
  }

  const elements = inDrawingOrder(model.elements);
  const connectors = inDrawingOrder(model.connectors);

  // --- cardinalities that count elements ---
  if (modelType) {
    for (const card of modelType.cardinalities) {
      if (card.kind !== 'count') continue;
      const count = elements.filter((e) =>
        isA(tool, e.class, card.class),
      ).length;
      const cls = tool.classes[card.class];
      const name = cls ? labelOf(tool, cls.labels, cls.key) : card.class;
      if (card.min !== undefined && count < card.min) {
        out.push({
          id: 'model',
          severity: 'warning',
          code: 'count-below-min',
          message: `The model has ${count} ${name} element${count === 1 ? '' : 's'}, but at least ${card.min} ${card.min === 1 ? 'is' : 'are'} needed.`,
        });
      }
      if (card.max !== undefined && count > card.max) {
        out.push({
          id: 'model',
          severity: 'warning',
          code: 'count-above-max',
          message: `The model has ${count} ${name} elements, but at most ${card.max} ${card.max === 1 ? 'is' : 'are'} allowed.`,
        });
      }
    }
  }

  // --- elements ---
  for (const el of elements) {
    const cls: ClassDef | undefined = tool.classes[el.class];
    if (el.parent && !model.elements[el.parent]) {
      out.push({
        id: el.id,
        severity: 'error',
        code: 'dangling-parent',
        message: `${describeElement(tool, el)} sits in the container ${el.parent}, which is not in the model.`,
      });
    }
    if (el.parent && parentChainLoops(model, el.id)) {
      out.push({
        id: el.id,
        severity: 'error',
        code: 'parent-loop',
        message: `${describeElement(tool, el)} is inside itself: following its containers leads back to it.`,
      });
    }
    const parentEl = el.parent ? model.elements[el.parent] : undefined;
    if (parentEl && tool.classes[parentEl.class]) {
      if (!isContainerClass(tool, parentEl.class)) {
        out.push({
          id: el.id,
          severity: 'warning',
          code: 'parent-not-container',
          message: `${describeElement(tool, el)} sits in ${describeElement(tool, parentEl)}, which is not a container or swimlane.`,
        });
      } else if (
        modelType &&
        cls &&
        !containerAccepts(tool, modelType.id, parentEl.class, el.class)
      ) {
        out.push({
          id: el.id,
          severity: 'warning',
          code: 'parent-not-accepted',
          message: `${describeElement(tool, el)} sits in ${describeElement(tool, parentEl)}, which does not accept ${labelOf(tool, cls.labels, cls.key)} elements.`,
        });
      }
    }
    if (!cls) {
      out.push({
        id: el.id,
        severity: 'info',
        code: 'unknown-class',
        message: `Element ${el.id} uses the class ${el.class}, which the tool library no longer has. It is kept and shown as a placeholder.`,
      });
      continue;
    }
    const who = describeElement(tool, el);
    if (cls.abstract) {
      out.push({
        id: el.id,
        severity: 'warning',
        code: 'abstract-class',
        message: `${who} is of an abstract class and should be one of its subclasses.`,
      });
    }
    if (modelType && !modelTypeAllowsClass(tool, modelType, el.class)) {
      out.push({
        id: el.id,
        severity: 'warning',
        code: 'class-not-in-model-type',
        message: `${who}: the class ${labelOf(tool, cls.labels, cls.key)} is not allowed in the model type ${labelOf(tool, modelType.labels, modelType.key)}.`,
      });
    }
    checkValues(
      tool,
      who,
      el.id,
      safely([], () => effectiveAttributes(tool, el.class)),
      el.attrs,
      out,
      'its class',
    );
    if (calculator)
      checkFormulas(
        calculator,
        tool,
        who,
        el.id,
        safely([], () => effectiveAttributes(tool, el.class)),
        safely([] as ClassDef[], () => classChain(tool, el.class)).flatMap(
          (c) => c.constraints ?? [],
        ),
        out,
      );
    if (modelType) {
      for (const card of modelType.cardinalities) {
        if (card.kind !== 'degree' || !isA(tool, el.class, card.class))
          continue;
        const degree = connectors.filter(
          (cn) =>
            relationIsA(tool, cn.relation, card.relation) &&
            (card.end === 'from' ? cn.from === el.id : cn.to === el.id),
        ).length;
        const rel = tool.relations[card.relation];
        const relName = rel
          ? labelOf(tool, rel.labels, rel.key)
          : card.relation;
        const side = card.end === 'from' ? 'leaving' : 'entering';
        if (card.min !== undefined && degree < card.min) {
          out.push({
            id: el.id,
            severity: 'warning',
            code: 'degree-below-min',
            message: `${who} has ${degree} ${relName} ${side} it, but needs at least ${card.min}.`,
          });
        }
        if (card.max !== undefined && degree > card.max) {
          out.push({
            id: el.id,
            severity: 'warning',
            code: 'degree-above-max',
            message: `${who} has ${degree} ${relName} ${side} it, but at most ${card.max} ${card.max === 1 ? 'is' : 'are'} allowed.`,
          });
        }
      }
    }
  }

  // --- connectors ---
  for (const cn of connectors) {
    const rel: RelationDef | undefined = tool.relations[cn.relation];
    const who = describeConnector(tool, cn);
    const ends = { from: model.elements[cn.from], to: model.elements[cn.to] };
    for (const end of ['from', 'to'] as const) {
      if (!ends[end]) {
        out.push({
          id: cn.id,
          severity: 'error',
          code: 'dangling-end',
          message: `${who} ${end === 'from' ? 'starts at' : 'ends at'} ${cn[end]}, which is not in the model.`,
        });
      }
    }
    if (!rel) {
      out.push({
        id: cn.id,
        severity: 'info',
        code: 'unknown-relation',
        message: `Connector ${cn.id} uses the relation class ${cn.relation}, which the tool library no longer has. It is kept.`,
      });
      continue;
    }
    if (rel.abstract) {
      out.push({
        id: cn.id,
        severity: 'warning',
        code: 'abstract-relation',
        message: `${who} is of an abstract relation class and should be one of its subclasses.`,
      });
    }
    if (modelType && !modelTypeAllowsRelation(tool, modelType, cn.relation)) {
      out.push({
        id: cn.id,
        severity: 'warning',
        code: 'relation-not-in-model-type',
        message: `${who} is not allowed in the model type ${labelOf(tool, modelType.labels, modelType.key)}.`,
      });
    }
    for (const end of ['from', 'to'] as const) {
      const el = ends[end];
      if (!el || !tool.classes[el.class]) continue;
      if (!safely(true, () => allowsEnd(tool, cn.relation, end, el.class))) {
        const allowed = safely(
          { from: [] as string[], to: [] as string[] },
          () => effectiveEnds(tool, cn.relation),
        )[end];
        out.push({
          id: cn.id,
          severity: 'warning',
          code: `${end}-not-allowed`,
          message: `${who}: ${describeElement(tool, el)} cannot be at the ${end === 'from' ? 'start' : 'end'} of a ${labelOf(tool, rel.labels, rel.key)}. Allowed: ${listLabels(tool, allowed)}.`,
        });
      }
    }
    checkValues(
      tool,
      who,
      cn.id,
      safely([], () => effectiveRelationAttributes(tool, cn.relation)),
      cn.attrs,
      out,
      'its relation class',
    );
    if (calculator)
      checkFormulas(
        calculator,
        tool,
        who,
        cn.id,
        safely([], () => effectiveRelationAttributes(tool, cn.relation)),
        safely([] as RelationDef[], () =>
          relationChain(tool, cn.relation),
        ).flatMap((r) => r.constraints ?? []),
        out,
      );
  }
  return out;
}

export function issuesFor(
  issues: readonly ValidationIssue[],
  id: ValidationIssue['id'],
): ValidationIssue[] {
  return issues.filter((i) => i.id === id);
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
