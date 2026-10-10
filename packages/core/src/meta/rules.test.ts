import { describe, expect, it } from 'vitest';
import { SAMPLE, sampleKit } from '../testing/sample-kit';
import { createKitStore } from './commands';
import { validateKit } from './guards';
import type { Rule } from './rule-types';
import type { AttributeDef, Kit } from './types';

/** The plan's rule: high-priority tasks need an owner. */
const PLAN_RULE: Rule = {
  id: 'rule_high_priority_owner',
  label: 'High-priority tasks need an owner',
  when: {
    event: 'attribute.changed',
    class: SAMPLE.task,
    attribute: 'Priority',
  },
  if: "= Priority == 'High' && Owner == null",
  then: [
    { action: 'setAttribute', attribute: 'Status', value: 'Needs owner' },
    {
      action: 'message',
      kind: 'warning',
      text: "= 'Task \"' + Name + '\" is high priority but has no owner.'",
    },
  ],
};

const paths = (kit: unknown) => validateKit(kit).map((i) => i.path);

function withRule(rule: Rule): Kit {
  return { ...sampleKit(), rules: { [rule.id]: rule } } as Kit;
}

describe('rules in the Kit', () => {
  it("accept the plan's rule", () => {
    expect(validateKit(withRule(PLAN_RULE))).toEqual([]);
  });

  it('report an unknown event, class, action and a bad command entry with their paths', () => {
    const bad = {
      ...PLAN_RULE,
      when: { event: 'object.exploded', class: 'cls_none' },
      then: [
        { action: 'frobnicate' },
        { action: 'createObject', class: 'cls_missing' },
      ],
      command: { label: 'x', place: 'model' },
    } as never;
    const p = paths(withRule(bad));
    expect(p).toContain('rules.rule_high_priority_owner.when.event');
    expect(p).toContain('rules.rule_high_priority_owner.then[0].action');
    expect(p).toContain('rules.rule_high_priority_owner.command');
  });

  it('check references to classes when the structure is sound', () => {
    const rule = {
      ...PLAN_RULE,
      when: { event: 'object.created', class: 'cls_none' },
    } as Rule;
    expect(paths(withRule(rule))).toContain(
      'rules.rule_high_priority_owner.when.class',
    );
  });

  it('are put and removed by commands, and a rule that is not valid is refused', () => {
    const store = createKitStore(sampleKit());
    store.execute({ type: 'putRule', rule: PLAN_RULE });
    expect(store.state.rules[PLAN_RULE.id]?.label).toBe(PLAN_RULE.label);
    expect(() =>
      store.execute({
        type: 'putRule',
        rule: { ...PLAN_RULE, id: 'oops' } as never,
      }),
    ).toThrow(/rule_/);
    expect(() =>
      store.execute({
        type: 'putRule',
        rule: { ...PLAN_RULE, then: [{ action: 'nope' }] } as never,
      }),
    ).toThrow(/not valid/);
    store.undo();
    expect(store.state.rules[PLAN_RULE.id]).toBeUndefined();
    store.redo();
    store.execute({ type: 'removeRule', id: PLAN_RULE.id });
    expect(store.state.rules).toEqual({});
  });

  it('follow a renamed attribute: the trigger, the condition and the actions', () => {
    const kit = sampleKit();
    const withCommand = {
      ...kit,
      rules: { [PLAN_RULE.id]: PLAN_RULE },
    } as Kit;
    const store = createKitStore(withCommand);
    store.execute({
      type: 'renameKey',
      scope: {
        kind: 'attribute',
        owner: { kind: 'class', id: SAMPLE.task },
        id: SAMPLE.attPriority,
      },
      newKey: 'Urgency',
    });
    const rule = store.state.rules[PLAN_RULE.id]!;
    expect(rule.when.attribute).toBe('Urgency');
    expect(rule.if).toBe("= Urgency == 'High' && Owner == null");
    store.undo();
    expect(store.state.rules[PLAN_RULE.id]).toEqual(PLAN_RULE);
  });
});

describe('constraints and default formulas', () => {
  it('are accepted, put and removed, and follow a renamed attribute', () => {
    const store = createKitStore(sampleKit());
    const owner = { kind: 'class', id: SAMPLE.task } as const;
    store.execute({
      type: 'putConstraint',
      owner,
      constraint: {
        id: 'effort',
        formula: 'Effort > 0',
        message: '= "Effort of " + Name + " must be above zero"',
      },
    });
    store.execute({
      type: 'putAttribute',
      owner,
      def: {
        id: 'att_created',
        key: 'Created',
        type: 'date',
        defaultFormula: '= today()',
      } as AttributeDef,
    });
    expect(validateKit(store.state)).toEqual([]);
    store.execute({
      type: 'renameKey',
      scope: { kind: 'attribute', owner, id: SAMPLE.attEffort },
      newKey: 'Hours',
    });
    expect(store.state.classes[SAMPLE.task]!.constraints![0]!.formula).toBe(
      'Hours > 0',
    );
    store.execute({ type: 'removeConstraint', owner, id: 'effort' });
    expect(store.state.classes[SAMPLE.task]!.constraints).toBeUndefined();
    expect(() =>
      store.execute({ type: 'removeConstraint', owner, id: 'effort' }),
    ).toThrow();
  });

  it('are checked for their shape', () => {
    const kit = sampleKit() as unknown as {
      classes: Record<string, Record<string, unknown>>;
    };
    kit.classes[SAMPLE.task]!.constraints = [
      { id: 'a', formula: 1, message: 'x', severity: 'fatal' },
      { id: 'a', formula: 'x', message: 'y' },
    ];
    const p = paths(kit);
    expect(p).toContain(`classes.${SAMPLE.task}.constraints[0].formula`);
    expect(p).toContain(`classes.${SAMPLE.task}.constraints[0].severity`);
    expect(p).toContain(`classes.${SAMPLE.task}.constraints[1].id`);
  });
});
