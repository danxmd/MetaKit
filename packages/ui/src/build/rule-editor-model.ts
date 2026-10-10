import {
  CANCELLABLE_EVENTS,
  EVENT_NAMES,
  RULE_ACTION_TYPES,
  effectiveAttributes,
  effectiveRelationAttributes,
  newId,
  validateKit,
  type AttributeDef,
  type ClassId,
  type CommandPlace,
  type EventName,
  type Json,
  type RelationId,
  type Rule,
  type RuleAction,
  type RuleActionType,
  type RuleId,
  type Kit,
} from '@metakit-app/core';
import { parse } from '@metakit-app/formula';

/**
 * Where an action sits: `[2]` is the third action of the rule, `[2, 'then', 0]` the first action
 * in the "yes" branch of the question that is the third action, `[2, 'else', 1]` the second in
 * its "no" branch.
 */
export type ActionPath = readonly (number | 'then' | 'else')[];

export interface RuleMessage {
  /** `error` blocks saving; `hint` is advice. */
  level: 'error' | 'hint';
  /** Where, in the words of the form: "When", "If", "Action 2". */
  where: string;
  text: string;
}

/** What a dry run of a rule on an object says; the engine's `test` returns the same shape. */
export interface RuleTryResult {
  condition: { value: unknown; error?: string };
  steps: string[];
}

export interface EventGroup {
  label: string;
  events: { event: EventName | 'command'; label: string }[];
}

const EVENT_LABELS: Record<EventName | 'command', string> = {
  'app.started': 'The app has started',
  'app.closing': 'The app is closing',
  'model.creating': 'A model is about to be created',
  'model.created': 'A model was created',
  'model.opened': 'A model was opened',
  'model.deleting': 'A model is about to be deleted',
  'model.deleted': 'A model was deleted',
  'object.creating': 'An object is about to be created',
  'object.created': 'An object was created',
  'object.deleting': 'An object is about to be deleted',
  'object.deleted': 'An object was deleted',
  'object.moved': 'An object was moved',
  'object.resized': 'An object was resized',
  'object.renamed': 'An object was renamed',
  'connector.creating': 'A connector is about to be created',
  'connector.created': 'A connector was created',
  'connector.reconnected': 'A connector was moved to another object',
  'attribute.changing': 'An attribute is about to change',
  'attribute.changed': 'An attribute changed',
  'table.rowAdded': 'A table row was added',
  'table.rowRemoved': 'A table row was removed',
  'view.changing': 'The view is about to change',
  'view.changed': 'The view changed',
  'selection.changed': 'The selection changed',
  command: 'A person runs it (a command or button)',
};

const GROUPS: [string, (EventName | 'command')[]][] = [
  ['Object', EVENT_NAMES.filter((e) => e.startsWith('object.'))],
  ['Connector', EVENT_NAMES.filter((e) => e.startsWith('connector.'))],
  ['Attribute', ['attribute.changing', 'attribute.changed']],
  ['Table', ['table.rowAdded', 'table.rowRemoved']],
  ['Model', EVENT_NAMES.filter((e) => e.startsWith('model.'))],
  ['View', EVENT_NAMES.filter((e) => e.startsWith('view.'))],
  ['App', EVENT_NAMES.filter((e) => e.startsWith('app.'))],
  ['Selection', ['selection.changed']],
  ['On demand', ['command']],
];

/** The events for the "When" dropdown, grouped by what they are about. */
export function eventGroups(): EventGroup[] {
  return GROUPS.map(([label, events]) => ({
    label,
    events: events.map((event) => ({ event, label: EVENT_LABELS[event] })),
  }));
}

export const eventLabel = (event: EventName | 'command'): string =>
  EVENT_LABELS[event];

/** True for events whose rules can stop the action ("is about to ..."). */
export const canCancel = (event: EventName | 'command'): boolean =>
  (CANCELLABLE_EVENTS as readonly string[]).includes(event);

/** Which pickers an event offers next to the dropdown. */
export function filtersFor(event: EventName | 'command'): {
  class: boolean;
  attribute: boolean;
  relation: boolean;
} {
  return {
    class: event.startsWith('object.') || /^(attribute|table)\./.test(event),
    attribute: /^(attribute|table)\./.test(event),
    relation: event.startsWith('connector.'),
  };
}

export const ACTION_LABELS: Record<RuleActionType, string> = {
  setAttribute: 'Set an attribute',
  createObject: 'Create an object',
  createConnector: 'Create a connector',
  delete: 'Delete an object',
  message: 'Show a message',
  ask: 'Ask a yes or no question',
  choose: 'Ask to pick an answer',
  cancel: 'Cancel the action',
  openModel: 'Open a model',
  runCommand: 'Run a command',
  runScript: 'Run a script',
};

export const ACTION_TYPES = RULE_ACTION_TYPES;

export function classesFor(kit: Kit): { id: ClassId; key: string }[] {
  return Object.values(kit.classes)
    .map((c) => ({ id: c.id, key: c.key }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function relationsFor(kit: Kit): { id: RelationId; key: string }[] {
  return Object.values(kit.relations)
    .map((r) => ({ id: r.id, key: r.key }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function defsOf(
  kit: Kit,
  owner: ClassId | RelationId | undefined,
): AttributeDef[] {
  try {
    if (!owner) return [];
    if (owner.startsWith('rel_'))
      return effectiveRelationAttributes(kit, owner as RelationId);
    return effectiveAttributes(kit, owner as ClassId);
  } catch {
    return [];
  }
}

/**
 * The attribute keys of a class (with the ones it inherits), or of every class when none is
 * given. `settable` leaves out calculated attributes and buttons, which a rule cannot write.
 */
export function attributesFor(
  kit: Kit,
  classId: ClassId | undefined,
  settable = false,
): string[] {
  const defs = classId
    ? defsOf(kit, classId)
    : Object.keys(kit.classes).flatMap((c) => defsOf(kit, c as ClassId));
  const keys = defs
    .filter((d) => !settable || (d.type !== 'formula' && d.type !== 'action'))
    .map((d) => d.key);
  return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
}

/** Why a formula does not parse, in plain English, or null when it does (or is not a formula). */
export function formulaProblem(text: string): string | null {
  const t = text.trimStart();
  if (!t.startsWith('=')) return null;
  const body = t.slice(1).trim();
  if (body === '') return 'The formula is empty after the "=".';
  const p = parse(body);
  return p.ok ? null : `${p.error} (at character ${p.at + 1} of the formula)`;
}

function blankAction(type: RuleActionType, kit: Kit): RuleAction {
  switch (type) {
    case 'setAttribute':
      return { action: type, attribute: '', value: '' };
    case 'createObject':
      return { action: type, class: classesFor(kit)[0]?.id ?? ('' as never) };
    case 'createConnector':
      return {
        action: type,
        relation: relationsFor(kit)[0]?.id ?? ('' as never),
      };
    case 'delete':
      return { action: type };
    case 'message':
      return { action: type, kind: 'info', text: '' };
    case 'ask':
      return { action: type, text: '', then: [] };
    case 'choose':
      return { action: type, text: '', options: [], attribute: '' };
    case 'cancel':
      return { action: type, reason: '' };
    case 'openModel':
      return { action: type, model: '' };
    case 'runCommand':
      return { action: type, command: '' };
    case 'runScript':
      return { action: type, script: '' };
  }
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Removes keys set to undefined so that the stored rule stays small. */
function tidy<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o))
    if (v !== undefined) out[k] = Array.isArray(v) ? v.map(tidyAny) : v;
  return out as T;
}
function tidyAny(v: unknown): unknown {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? tidy(v as object)
    : v;
}

/** Plain-English place for the path of an issue from the Kit check. */
function whereOf(path: string, id: string): string {
  const rest = path.slice(`rules.${id}`.length);
  const then = /^\.then\[(\d+)\]/.exec(rest);
  if (then) return `Action ${Number(then[1]) + 1}`;
  if (rest.startsWith('.when')) return 'When';
  if (rest.startsWith('.if')) return 'If';
  if (rest.startsWith('.command')) return 'Command';
  if (rest.startsWith('.label')) return 'Name';
  return 'Rule';
}

/**
 * The rule being edited in Build mode. It is a draft: nothing is stored until the component asks
 * for `toRule()` and sends it as a `putRule` command. The editor only draws what this holds.
 */
export class RuleEditorModel {
  private draft: Rule;

  constructor(
    private kit: Kit,
    rule?: Rule,
  ) {
    this.draft = rule
      ? copy(rule)
      : {
          id: RuleEditorModel.newRuleId(),
          label: 'New rule',
          when: { event: 'attribute.changed' },
          then: [],
        };
  }

  static newRuleId(): RuleId {
    return newId('rule') as RuleId;
  }

  /** Takes the Kit after it changed, so that the pickers list what exists now. */
  setKit(kit: Kit): void {
    this.kit = kit;
  }

  get id(): RuleId {
    return this.draft.id;
  }

  /** A copy of the draft as it would be stored. */
  toRule(): Rule {
    const r = copy(this.draft);
    if (r.if !== undefined && r.if.trim() === '') delete r.if;
    if (r.enabled === true) delete r.enabled;
    if (r.when.event !== 'command') delete r.command;
    return tidy({ ...r, when: tidy(r.when) });
  }

  // When --------------------------------------------------------------------------------------

  setLabel(label: string): void {
    this.draft.label = label;
  }

  setEnabled(enabled: boolean): void {
    this.draft.enabled = enabled;
  }

  /** Changes the event and drops the filters that do not apply to it any more. */
  setEvent(event: EventName | 'command'): void {
    const f = filtersFor(event);
    const w = this.draft.when;
    this.draft.when = {
      event,
      ...(f.class && w.class ? { class: w.class } : {}),
      ...(f.attribute && w.attribute ? { attribute: w.attribute } : {}),
      ...(f.relation && w.relation ? { relation: w.relation } : {}),
    };
    if (event === 'command')
      this.draft.command ??= { label: this.draft.label, place: 'context' };
    else delete this.draft.command;
  }

  setClass(id: ClassId | undefined): void {
    this.draft.when = tidy({ ...this.draft.when, class: id || undefined });
    // An attribute of another class would never match.
    const key = this.draft.when.attribute;
    if (key && id && !attributesFor(this.kit, id).includes(key))
      delete this.draft.when.attribute;
  }

  setAttribute(key: string | undefined): void {
    this.draft.when = tidy({ ...this.draft.when, attribute: key || undefined });
  }

  setRelation(id: RelationId | undefined): void {
    this.draft.when = tidy({ ...this.draft.when, relation: id || undefined });
  }

  /** The entry of a rule with the event "command"; with no label it is removed. */
  setCommand(label: string, place: CommandPlace): void {
    if (this.draft.when.event !== 'command') return;
    this.draft.command = { label, place };
  }

  // If ----------------------------------------------------------------------------------------

  /** A condition is a formula, so text that does not start with `=` gets one. */
  setCondition(text: string): void {
    const t = text.trim();
    if (t === '') delete this.draft.if;
    else this.draft.if = t.startsWith('=') ? t : `= ${t}`;
  }

  // Then --------------------------------------------------------------------------------------

  private list(path: ActionPath): RuleAction[] | null {
    let list: RuleAction[] = this.draft.then;
    for (let i = 0; i < path.length; i += 2) {
      const index = path[i];
      const branch = path[i + 1];
      if (typeof index !== 'number') return null;
      if (branch === undefined) return list;
      const a = list[index];
      if (!a || a.action !== 'ask' || (branch !== 'then' && branch !== 'else'))
        return null;
      list = branch === 'then' ? a.then : (a.else ??= []);
    }
    return list;
  }

  /** The list an action path points into, and its index. */
  private locate(
    path: ActionPath,
  ): { list: RuleAction[]; index: number } | null {
    if (path.length % 2 === 0) return null;
    const list = this.list(path.slice(0, -1));
    const index = path[path.length - 1];
    if (!list || typeof index !== 'number' || !list[index]) return null;
    return { list, index };
  }

  actionAt(path: ActionPath): RuleAction | undefined {
    const at = this.locate(path);
    return at ? at.list[at.index] : undefined;
  }

  /** Adds an action at the end of the rule, or of a branch of a question (`[2, 'then']`). */
  addAction(type: RuleActionType, branch: ActionPath = []): ActionPath | null {
    const list = this.list(branch);
    if (!list) return null;
    list.push(blankAction(type, this.kit));
    return [...branch, list.length - 1];
  }

  /** Changes fields of an action; a field set to undefined is removed. */
  updateAction(path: ActionPath, patch: Record<string, unknown>): void {
    const at = this.locate(path);
    if (!at) return;
    at.list[at.index] = tidy({
      ...at.list[at.index],
      ...patch,
    } as RuleAction);
  }

  /** Swaps an action for a blank one of another type, keeping nothing of the old one. */
  changeActionType(path: ActionPath, type: RuleActionType): void {
    const at = this.locate(path);
    if (at) at.list[at.index] = blankAction(type, this.kit);
  }

  /** Moves an action up (-1) or down (1) inside its list. */
  moveAction(path: ActionPath, delta: number): void {
    const at = this.locate(path);
    if (!at) return;
    const to = at.index + delta;
    if (to < 0 || to >= at.list.length) return;
    const [a] = at.list.splice(at.index, 1);
    at.list.splice(to, 0, a!);
  }

  removeAction(path: ActionPath): void {
    const at = this.locate(path);
    if (at) at.list.splice(at.index, 1);
  }

  // Checking ----------------------------------------------------------------------------------

  /** The type of an attribute of the rule's class, to turn typed text into a number or a flag. */
  attributeType(key: string): AttributeDef['type'] | undefined {
    const owner = this.draft.when.class;
    const defs = owner
      ? defsOf(this.kit, owner)
      : Object.keys(this.kit.classes).flatMap((c) =>
          defsOf(this.kit, c as ClassId),
        );
    return defs.find((d) => d.key === key)?.type;
  }

  /** Text typed for a value: a formula stays text, numbers and flags become numbers and flags for attributes of that type. */
  valueFromText(attribute: string, text: string): Json {
    if (text.trimStart().startsWith('=')) return text;
    const t = this.attributeType(attribute);
    if ((t === 'number' || t === 'integer') && text.trim() !== '') {
      const n = Number(text);
      if (Number.isFinite(n)) return n;
    }
    if (t === 'boolean') {
      if (text.trim().toLowerCase() === 'true') return true;
      if (text.trim().toLowerCase() === 'false') return false;
    }
    return text;
  }

  /** Everything that is wrong with the draft, then advice. Errors are what the Kit check says. */
  messages(): RuleMessage[] {
    const rule = this.toRule();
    const out: RuleMessage[] = [];
    const probe = {
      ...this.kit,
      rules: { ...this.kit.rules, [rule.id]: rule },
    };
    for (const issue of validateKit(probe))
      if (issue.path.startsWith(`rules.${rule.id}`))
        out.push({
          level: 'error',
          where: whereOf(issue.path, rule.id),
          text: issue.message,
        });
    const formula = (where: string, text: unknown) => {
      if (typeof text !== 'string') return;
      const p = formulaProblem(text);
      if (p) out.push({ level: 'error', where, text: p });
    };
    if (rule.if !== undefined) formula('If', rule.if);
    const walk = (list: readonly RuleAction[], label: string) =>
      list.forEach((a, i) => {
        const where = `${label} ${i + 1}`;
        for (const [k, v] of Object.entries(a)) {
          if (k === 'action') continue;
          if (k === 'then' || k === 'else') walk(v as RuleAction[], where);
          else if (k === 'attributes' && v && typeof v === 'object')
            Object.values(v as object).forEach((x) => formula(where, x));
          else formula(where, v);
        }
        if (a.action === 'setAttribute' && a.attribute === '')
          out.push({
            level: 'error',
            where,
            text: 'Pick the attribute to set.',
          });
      });
    walk(rule.then, 'Action');
    const cancels = (list: readonly RuleAction[]): boolean =>
      list.some(
        (a) =>
          a.action === 'cancel' ||
          (a.action === 'ask' && (cancels(a.then) || cancels(a.else ?? []))),
      );
    if (!canCancel(rule.when.event) && cancels(rule.then))
      out.push({
        level: 'hint',
        where: 'Then',
        text: 'Cancel only works for events that say "about to", before the action happens. Here it does nothing.',
      });
    if (rule.when.event === 'attribute.changed' && !rule.when.attribute)
      out.push({
        level: 'hint',
        where: 'When',
        text: 'No attribute is picked, so the rule runs when any attribute changes.',
      });
    return out;
  }

  /** True when the draft can be stored. */
  get valid(): boolean {
    return this.messages().every((m) => m.level !== 'error');
  }
}
