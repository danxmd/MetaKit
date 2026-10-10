import { compileScript, generateDeclarations } from '@metakit-app/behaviour';
import {
  Checker,
  MAX_SCRIPT_CHARS,
  checkRuleReferences,
  checkRules,
  checkShapeReferences,
  effectiveAttributes,
  effectiveRelationAttributes,
  subclasses,
  validateToolLibrary,
  type AttributeDef,
  type ClassDef,
  type Issue,
  type Rule,
  type RuleId,
  type ShapeDef,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  FUNCTION_NAMES,
  callsIn,
  describeFormulaProblem,
  namesIn,
  parseCached,
} from '@metakit-app/formula';
import { extractCode, parseJsonObject } from './extract';
import type { DraftKind } from './prompts';
import type {
  ClassDraft,
  DraftMap,
  RuleDraft,
  ScriptDraft,
  ShapeDraft,
  TypeCheck,
} from './types';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Stand-in ids used only while a draft is being checked; the real ones come with the commands. */
export const CHECK_IDS = {
  rule: 'rule_draftcheck' as RuleId,
  shape: 'shp_draftcheck',
  class: 'cls_draftcheck',
  attribute: (n: number) => `att_draftcheck${n}`,
};

const KNOWN_FUNCTIONS = new Set(FUNCTION_NAMES.map((n) => n.toLowerCase()));

// -- formulas ---------------------------------------------------------------------------------

/** What is wrong with formula text (a leading `=` is optional), or null. */
export function formulaProblem(
  text: string,
  names?: ReadonlySet<string> | null,
): string | null {
  const source = text.trim().replace(/^=/, '').trim();
  if (source === '') return 'The formula is empty.';
  const parsed = parseCached(source);
  if ('error' in parsed)
    return (
      describeFormulaProblem({
        error: `${parsed.error} (at ${parsed.at})`,
        code: parsed.code,
      }) ?? parsed.error
    );
  for (const fn of callsIn(parsed.expr))
    if (!KNOWN_FUNCTIONS.has(fn))
      return `The formula calls "${fn}", which is not a known function.`;
  if (names) {
    for (const name of namesIn(parsed.expr))
      if (!names.has(name) && !name.startsWith('$'))
        return `The formula uses the name "${name}", which is not an attribute here. Attributes: ${[...names].filter((n) => !BUILTIN_NAMES.has(n)).join(', ') || 'none'}.`;
  }
  return null;
}

const BUILTIN_NAMES = new Set(['self', 'parent', 'from', 'to']);

/** The formulas (strings starting with `=`) found anywhere in a value, with where they are. */
function formulasIn(
  value: unknown,
  path: string,
  extraKeys: readonly string[] = [],
): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (v: unknown, p: string, key: string): void => {
    if (typeof v === 'string') {
      if (v.trimStart().startsWith('=') || extraKeys.includes(key))
        out.push({ path: p, text: v });
    } else if (Array.isArray(v))
      v.forEach((x, i) => walk(x, `${p}[${i}]`, key));
    else if (isRec(v))
      for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`, k);
  };
  walk(value, path, '');
  return out;
}

function formulaErrors(
  found: { path: string; text: string }[],
  names?: ReadonlySet<string> | null,
): string[] {
  const errors: string[] = [];
  for (const f of found) {
    const problem = formulaProblem(f.text, names);
    if (problem) errors.push(`${f.path}: ${problem}`);
  }
  return errors;
}

function issueLines(issues: Issue[], prefix: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of issues) {
    if (!i.path.startsWith(prefix)) continue;
    const where = i.path.slice(prefix.length).replace(/^\./, '') || 'the draft';
    const line = `${where}: ${i.message}`;
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}

// -- attribute names --------------------------------------------------------------------------

function allAttributeKeys(tool: ToolLibrary): Set<string> {
  const keys = new Set<string>();
  for (const owner of [
    ...Object.values(tool.classes),
    ...Object.values(tool.relations),
    ...Object.values(tool.modelTypes),
  ])
    for (const a of owner.attributes) keys.add(a.key);
  return keys;
}

/** The names a rule's formulas can read: the attributes of its class and its subclasses. */
function ruleNames(tool: ToolLibrary, rule: RuleDraft): Set<string> {
  const names = new Set<string>(BUILTIN_NAMES);
  const cls = rule.when?.class ? tool.classes[rule.when.class] : undefined;
  const rel = rule.when?.relation
    ? tool.relations[rule.when.relation]
    : undefined;
  const add = (attrs: AttributeDef[]) => attrs.forEach((a) => names.add(a.key));
  if (cls) {
    for (const c of [cls, ...subclasses(tool, cls.id)]) {
      try {
        add(effectiveAttributes(tool, c.id));
      } catch {
        add(c.attributes);
      }
    }
    return names;
  }
  if (rel) {
    try {
      add(effectiveRelationAttributes(tool, rel.id));
    } catch {
      add(rel.attributes);
    }
    return names;
  }
  allAttributeKeys(tool).forEach((k) => names.add(k));
  return names;
}

// -- parsing and normalising ------------------------------------------------------------------

export type Parsed<K extends DraftKind> =
  { draft: DraftMap[K]; errors: string[] } | { draft: null; errors: string[] };

const idOrKey = (
  table: Record<string, { key: string }>,
  value: unknown,
): unknown => {
  if (typeof value !== 'string' || value in table) return value;
  const hit = Object.entries(table).find(([, d]) => d.key === value);
  return hit ? hit[0] : value;
};

/** The drafting model sees ids in the summary but may write a key; both are accepted. */
function resolveRuleRefs(tool: ToolLibrary, rule: Rec): void {
  const when = rule.when;
  if (isRec(when)) {
    if ('class' in when) when.class = idOrKey(tool.classes, when.class);
    if ('relation' in when)
      when.relation = idOrKey(tool.relations, when.relation);
  }
  const fix = (actions: unknown): void => {
    if (!Array.isArray(actions)) return;
    for (const a of actions) {
      if (!isRec(a)) continue;
      if ('class' in a) a.class = idOrKey(tool.classes, a.class);
      if ('relation' in a) a.relation = idOrKey(tool.relations, a.relation);
      fix(a.then);
      fix(a.else);
    }
  };
  fix(rule.then);
}

export function parseDraftReply<K extends DraftKind>(
  kind: K,
  reply: string,
  tool: ToolLibrary,
  sentence: string,
): Parsed<K> {
  type R = Parsed<K>;
  if (kind === 'script') {
    const code = extractCode(reply, ['ts', 'typescript']);
    if (code === '')
      return {
        draft: null,
        errors: ['The reply contains no script.'],
      } as unknown as R;
    const m = /^\s*\/\/\s*name:\s*(.+)$/im.exec(code);
    const name =
      m?.[1]?.trim() ||
      sentence.trim().replace(/\s+/g, ' ').slice(0, 40) ||
      'Drafted script';
    // The name comment stays in the script, so that line numbers in the errors match the reply.
    const draft: ScriptDraft = { name, source: `${code.trimEnd()}\n` };
    return { draft, errors: [] } as unknown as R;
  }

  const code = extractCode(reply, ['json']);
  const parsed = parseJsonObject(code);
  if ('error' in parsed)
    return { draft: null, errors: [parsed.error] } as unknown as R;
  const value = parsed.value;
  delete value.id;

  if (kind === 'rule') {
    resolveRuleRefs(tool, value);
    if (typeof value.if === 'string' && value.if.trim() !== '') {
      if (!value.if.trimStart().startsWith('=')) value.if = `= ${value.if}`;
    } else if (value.if === '' || value.if === null) delete value.if;
    // A command rule without an entry would never be reachable.
    if (
      isRec(value.when) &&
      value.when.event === 'command' &&
      value.command === undefined
    )
      value.command = {
        label: typeof value.label === 'string' ? value.label : 'Run rule',
        place: 'model',
      };
    return { draft: value as unknown as RuleDraft, errors: [] } as unknown as R;
  }

  if (kind === 'shape') {
    if (value.kind === undefined)
      value.kind = 'line' in value ? 'relation' : 'node';
    return {
      draft: value as unknown as ShapeDraft,
      errors: [],
    } as unknown as R;
  }

  // class
  const languages = tool.manifest.languages;
  const cleanLabels = (labels: unknown): Record<string, string> | undefined => {
    if (!isRec(labels)) return undefined;
    const out: Record<string, string> = {};
    for (const [lang, text] of Object.entries(labels))
      if (languages.includes(lang) && typeof text === 'string')
        out[lang] = text;
    return out;
  };
  const key = typeof value.key === 'string' ? value.key : '';
  const labels = cleanLabels(value.labels);
  value.labels =
    labels && Object.keys(labels).length > 0
      ? labels
      : { [languages[0] ?? 'en']: key };
  if (value.kind === undefined) value.kind = 'node';
  if (Array.isArray(value.attributes)) {
    for (const a of value.attributes) {
      if (!isRec(a)) continue;
      delete a.id;
      if ('labels' in a) {
        const l = cleanLabels(a.labels);
        if (l && Object.keys(l).length > 0) a.labels = l;
        else delete a.labels;
      }
    }
  } else if (value.attributes === undefined) value.attributes = [];
  if (Array.isArray(value.constraints))
    value.constraints.forEach((k, i) => {
      if (isRec(k) && (typeof k.id !== 'string' || k.id === ''))
        k.id = `check-${i + 1}`;
    });
  return { draft: value as unknown as ClassDraft, errors: [] } as unknown as R;
}

// -- class drafts to definitions -------------------------------------------------------------

function sanitiseKey(key: string): string {
  const cleaned = key.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

/** A class key that no class has yet: `Task`, then `Task2`, `Task3`. */
export function uniqueClassKey(tool: ToolLibrary, wanted: string): string {
  const base = sanitiseKey(wanted || 'NewClass');
  const used = new Set(Object.values(tool.classes).map((c) => c.key));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}${n}`)) return `${base}${n}`;
}

export function classDefFromDraft(
  tool: ToolLibrary,
  draft: ClassDraft,
  ids: { class: string; attribute: (n: number) => string },
): ClassDef {
  const parent = draft.extends
    ? (tool.classes[draft.extends as never] ??
      Object.values(tool.classes).find((c) => c.key === draft.extends))
    : undefined;
  return {
    id: ids.class,
    key: uniqueClassKey(tool, draft.key),
    kind: draft.kind,
    labels: draft.labels,
    ...(parent ? { extends: parent.id } : {}),
    ...(draft.abstract ? { abstract: true } : {}),
    attributes: draft.attributes.map((a, n) => ({
      id: ids.attribute(n),
      ...a,
    })) as unknown as AttributeDef[],
    ...(draft.constraints && draft.constraints.length > 0
      ? { constraints: draft.constraints }
      : {}),
  } as unknown as ClassDef;
}

// -- validation -------------------------------------------------------------------------------

function validateRule(tool: ToolLibrary, draft: RuleDraft): string[] {
  if (!isRec(draft)) return ['The rule must be an object.'];
  const id = CHECK_IDS.rule;
  const rule = { id, ...draft } as Rule;
  const c = new Checker();
  checkRules(c, { [id]: rule });
  if (c.issues.length === 0)
    checkRuleReferences(c, { ...tool, rules: { [id]: rule } });
  const errors = issueLines(c.issues, `rules.${id}`);
  if (errors.length > 0) return errors;

  const names = ruleNames(tool, draft);
  const found: { path: string; text: string }[] = [];
  if (typeof draft.if === 'string') found.push({ path: 'if', text: draft.if });
  found.push(...formulasIn(draft.then, 'then'));
  errors.push(...formulaErrors(found, names));

  // An attribute key that no class has would fail when the rule runs.
  const known = allAttributeKeys(tool);
  const missing = (key: unknown, path: string) => {
    if (typeof key === 'string' && !known.has(key))
      errors.push(
        `${path}: There is no attribute with the key "${key}" in this Kit. Attributes: ${[...known].join(', ') || 'none'}.`,
      );
  };
  missing(draft.when?.attribute, 'when.attribute');
  const walk = (actions: Rule['then'], path: string) =>
    actions.forEach((a, i) => {
      const p = `${path}[${i}]`;
      if (a.action === 'setAttribute' || a.action === 'choose')
        missing(a.attribute, `${p}.attribute`);
      if (a.action === 'createObject')
        for (const k of Object.keys(a.attributes ?? {}))
          missing(k, `${p}.attributes.${k}`);
      if (a.action === 'ask') {
        walk(a.then, `${p}.then`);
        walk(a.else ?? [], `${p}.else`);
      }
    });
  walk(draft.then, 'then');
  return errors;
}

function validateShape(tool: ToolLibrary, draft: ShapeDraft): string[] {
  if (!isRec(draft)) return ['The shape must be an object.'];
  const id = CHECK_IDS.shape;
  const def = { id, ...draft } as ShapeDef;
  const probe = { ...tool, shapes: { ...tool.shapes, [id]: def } };
  const prefix = `shapes.${id}`;
  let issues = validateToolLibrary(probe);
  const errors = issueLines(issues, prefix);
  if (errors.length === 0) {
    const c = new Checker();
    checkShapeReferences(c, probe);
    issues = c.issues;
    errors.push(...issueLines(issues, prefix));
  }
  if (errors.length > 0) return errors;
  // Shapes are not tied to one class, so only the syntax and the function names are checked.
  return formulaErrors(formulasIn(draft, '', ['when', 'over']));
}

function validateClass(tool: ToolLibrary, draft: ClassDraft): string[] {
  if (!isRec(draft)) return ['The class must be an object.'];
  const errors: string[] = [];
  if (
    typeof draft.extends === 'string' &&
    !tool.classes[draft.extends as never] &&
    !Object.values(tool.classes).some((c) => c.key === draft.extends)
  )
    errors.push(`extends: There is no class called "${draft.extends}".`);
  if (!Array.isArray(draft.attributes))
    return [...errors, 'attributes: The attributes must be a list.'];
  const def = classDefFromDraft(tool, draft, {
    class: CHECK_IDS.class,
    attribute: CHECK_IDS.attribute,
  });
  const probe = {
    ...tool,
    classes: { ...tool.classes, [def.id]: def },
  } as ToolLibrary;
  errors.push(...issueLines(validateToolLibrary(probe), `classes.${def.id}`));
  if (errors.length > 0) return errors;
  const found = [
    ...formulasIn(draft.attributes, 'attributes'),
    ...(draft.constraints ?? []).flatMap((k, i) => [
      { path: `constraints[${i}].formula`, text: k.formula },
      ...(k.message.trimStart().startsWith('=')
        ? [{ path: `constraints[${i}].message`, text: k.message }]
        : []),
    ]),
  ];
  return formulaErrors(found);
}

const IMPORT =
  /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

async function validateScript(
  tool: ToolLibrary,
  draft: ScriptDraft,
  typeCheck?: TypeCheck,
): Promise<string[]> {
  if (!isRec(draft) || typeof draft.source !== 'string')
    return ['The script must be text.'];
  if (draft.source.trim() === '') return ['The script is empty.'];
  if (draft.source.length > MAX_SCRIPT_CHARS)
    return [`The script is longer than ${MAX_SCRIPT_CHARS} characters.`];
  const errors: string[] = [];
  for (const m of draft.source.matchAll(IMPORT)) {
    const from = m[1] ?? m[2] ?? m[3];
    if (from !== 'metakit')
      errors.push(
        `A script can only import from "metakit" (it imports "${from}").`,
      );
  }
  const compiled = await compileScript(draft.source);
  if ('errors' in compiled) {
    errors.push(...compiled.errors.map((e) => `line ${e.line}: ${e.message}`));
    return errors;
  }
  if (errors.length > 0) return errors;
  if (typeCheck) {
    const declarations = generateDeclarations({
      ...tool,
      scripts: {},
      rules: {},
    });
    errors.push(...(await typeCheck(draft.source, declarations)));
  }
  return errors;
}

/** Every check for a draft of the given kind; an empty list means it can be shown as valid. */
export async function validateDraft<K extends DraftKind>(
  kind: K,
  draft: DraftMap[K],
  tool: ToolLibrary,
  options: { typeCheck?: TypeCheck } = {},
): Promise<string[]> {
  switch (kind) {
    case 'rule':
      return validateRule(tool, draft as RuleDraft);
    case 'shape':
      return validateShape(tool, draft as ShapeDraft);
    case 'class':
      return validateClass(tool, draft as ClassDraft);
    case 'script':
      return validateScript(tool, draft as ScriptDraft, options.typeCheck);
    default:
      return ['Unknown kind of draft.'];
  }
}
