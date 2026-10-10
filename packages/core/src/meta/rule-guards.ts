import type { Checker } from './guards';
import {
  CANCELLABLE_EVENTS,
  EVENT_NAMES,
  RULE_ACTION_TYPES,
} from './rule-types';
import type { Kit } from './types';

type Rec = Record<string, unknown>;

const COMMAND_PLACES = ['model', 'toolbar', 'context'];

const ACTION_FIELDS: Record<string, string[]> = {
  setAttribute: ['action', 'attribute', 'value', 'target'],
  createObject: ['action', 'class', 'attributes', 'offset'],
  createConnector: ['action', 'relation', 'from', 'to'],
  delete: ['action', 'target'],
  message: ['action', 'kind', 'text'],
  ask: ['action', 'text', 'then', 'else'],
  choose: ['action', 'text', 'options', 'attribute', 'target'],
  cancel: ['action', 'reason'],
  openModel: ['action', 'model'],
  runCommand: ['action', 'command'],
  runScript: ['action', 'script'],
};

function actions(
  c: Checker,
  value: unknown,
  path: string,
  depth: number,
): void {
  const list = c.array(value, path, 'The actions');
  list?.forEach((raw, i) => {
    const p = `${path}[${i}]`;
    const type = (raw as Rec | null)?.action;
    if (
      typeof type !== 'string' ||
      !RULE_ACTION_TYPES.includes(type as never)
    ) {
      c.add(
        `${p}.action`,
        `The action must be one of ${RULE_ACTION_TYPES.join(', ')} (it is ${JSON.stringify(type)}).`,
      );
      return;
    }
    const a = c.object(raw, p, ACTION_FIELDS[type]!, `A ${type} action`);
    if (!a) return;
    const text = (k: string, what: string) =>
      c.string(a[k], `${p}.${k}`, what, { empty: false });
    switch (type) {
      case 'setAttribute':
        c.key(a.attribute, `${p}.attribute`, 'The attribute key');
        if (a.value === undefined) c.add(`${p}.value`, 'The value is missing.');
        break;
      case 'createObject':
        c.id('class', a.class, `${p}.class`, 'The class');
        break;
      case 'createConnector':
        c.id('relation', a.relation, `${p}.relation`, 'The relation class');
        break;
      case 'message':
        if (!['info', 'warning', 'error'].includes(a.kind as string))
          c.add(`${p}.kind`, 'The kind must be info, warning or error.');
        c.string(a.text, `${p}.text`, 'The text', { empty: true });
        break;
      case 'ask':
        text('text', 'The question');
        if (depth >= 4) c.add(p, 'Questions are nested too deeply.');
        else {
          actions(c, a.then, `${p}.then`, depth + 1);
          if (a.else !== undefined) actions(c, a.else, `${p}.else`, depth + 1);
        }
        break;
      case 'choose':
        text('text', 'The question');
        c.key(a.attribute, `${p}.attribute`, 'The attribute key');
        c.array(a.options, `${p}.options`, 'The options')?.forEach((o, j) => {
          if (typeof o !== 'string')
            c.add(`${p}.options[${j}]`, 'An option is text.');
        });
        break;
      case 'cancel':
        c.string(a.reason, `${p}.reason`, 'The reason', { empty: true });
        break;
      case 'openModel':
        text('model', 'The model');
        break;
      case 'runCommand':
        text('command', 'The command');
        break;
      case 'runScript':
        text('script', 'The script');
        break;
    }
  });
}

/** Checks the structure of `rules`. */
export function checkRules(c: Checker, rules: unknown): void {
  if (rules === undefined) return;
  if (rules === null || typeof rules !== 'object' || Array.isArray(rules)) {
    c.add('rules', 'The rules must be an object keyed by id.');
    return;
  }
  for (const [id, raw] of Object.entries(rules)) {
    const path = `rules.${id}`;
    const r = c.object(
      raw,
      path,
      ['id', 'label', 'enabled', 'when', 'if', 'then', 'command'],
      'A rule',
    );
    if (!r) continue;
    if (r.id !== id)
      c.add(
        `${path}.id`,
        `The id "${String(r.id)}" does not match the entry name "${id}".`,
      );
    if (
      typeof r.id !== 'string' ||
      !r.id.startsWith('rule_') ||
      r.id.length < 6
    )
      c.add(
        `${path}.id`,
        `The rule id must look like rule_something (it is ${JSON.stringify(r.id)}).`,
      );
    c.string(r.label, `${path}.label`, 'The label');
    if (r.enabled !== undefined)
      c.boolean(r.enabled, `${path}.enabled`, 'enabled');
    if (r.if !== undefined) c.string(r.if, `${path}.if`, 'The condition');
    const when = c.object(
      r.when,
      `${path}.when`,
      ['event', 'class', 'attribute', 'relation'],
      'The trigger',
    );
    if (when) {
      if (
        when.event !== 'command' &&
        !EVENT_NAMES.includes(when.event as never)
      )
        c.add(
          `${path}.when.event`,
          `The event must be "command" or one of ${EVENT_NAMES.join(', ')} (it is ${JSON.stringify(when.event)}).`,
        );
      if (when.class !== undefined)
        c.id('class', when.class, `${path}.when.class`, 'The class');
      if (when.relation !== undefined)
        c.id(
          'relation',
          when.relation,
          `${path}.when.relation`,
          'The relation class',
        );
      if (when.attribute !== undefined)
        c.key(when.attribute, `${path}.when.attribute`, 'The attribute key');
    }
    actions(c, r.then, `${path}.then`, 0);
    if (r.command !== undefined) {
      const cmd = c.object(
        r.command,
        `${path}.command`,
        ['label', 'place'],
        'The command',
      );
      if (cmd) {
        c.string(cmd.label, `${path}.command.label`, 'The command label');
        if (!COMMAND_PLACES.includes(cmd.place as string))
          c.add(
            `${path}.command.place`,
            'The place must be model, toolbar or context.',
          );
      }
      if ((r.when as Rec | undefined)?.event !== 'command')
        c.add(
          `${path}.command`,
          'Only a rule with the event "command" can have a command entry.',
        );
    }
  }
}

/** Checks the structure of the `constraints` of a class, relation class or model type. */
export function checkConstraints(
  c: Checker,
  value: unknown,
  path: string,
): void {
  if (value === undefined) return;
  const list = c.array(value, path, 'The constraints');
  const seen = new Set<string>();
  list?.forEach((raw, i) => {
    const p = `${path}[${i}]`;
    const k = c.object(
      raw,
      p,
      ['id', 'formula', 'message', 'severity'],
      'A constraint',
    );
    if (!k) return;
    if (c.string(k.id, `${p}.id`, 'The constraint id') !== null) {
      if (seen.has(k.id as string))
        c.add(`${p}.id`, 'Two constraints have the same id.');
      seen.add(k.id as string);
    }
    c.string(k.formula, `${p}.formula`, 'The formula');
    c.string(k.message, `${p}.message`, 'The message');
    if (
      k.severity !== undefined &&
      k.severity !== 'error' &&
      k.severity !== 'warning'
    )
      c.add(`${p}.severity`, 'The severity must be error or warning.');
  });
}

/** Checks references from rules to classes and relation classes; run only when the structure is sound. */
export function checkRuleReferences(c: Checker, kit: Kit): void {
  const check = (
    actionsList: { action: string; [k: string]: unknown }[],
    path: string,
  ) => {
    actionsList.forEach((a, i) => {
      const p = `${path}[${i}]`;
      if (a.action === 'createObject' && !kit.classes[a.class as never])
        c.add(`${p}.class`, `The class ${String(a.class)} does not exist.`);
      if (a.action === 'createConnector' && !kit.relations[a.relation as never])
        c.add(
          `${p}.relation`,
          `The relation class ${String(a.relation)} does not exist.`,
        );
      if (a.action === 'ask') {
        check((a.then ?? []) as never, `${p}.then`);
        check((a.else ?? []) as never, `${p}.else`);
      }
    });
  };
  for (const r of Object.values(kit.rules ?? {})) {
    const path = `rules.${r.id}`;
    if (r.when.class && !kit.classes[r.when.class])
      c.add(`${path}.when.class`, `The class ${r.when.class} does not exist.`);
    if (r.when.relation && !kit.relations[r.when.relation])
      c.add(
        `${path}.when.relation`,
        `The relation class ${r.when.relation} does not exist.`,
      );
    check(r.then as never, `${path}.then`);
  }
  void CANCELLABLE_EVENTS;
}
