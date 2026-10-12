import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  validateKit,
  type ElementId,
  type Json,
  type Model,
  type Rule,
  type Kit,
} from '@metakit-app/core';
import { clone, SAMPLE, sampleKit } from '@metakit-app/core/testing';
import { emptySampleModel } from '@metakit-app/core/testing';
import {
  attachRules,
  createBehaviour,
  runActionAttribute,
  silentHost,
  type BehaviourHost,
} from './index';

/** The sample Kit with the attributes the plan's rule needs. */
export function kitWithOwner(): Kit {
  const kit = clone(sampleKit());
  kit.classes[SAMPLE.task]!.attributes.push(
    { id: 'att_status', key: 'Status', type: 'text' },
    { id: 'att_owner', key: 'Owner', type: 'text' },
    {
      id: 'att_go',
      key: 'Go',
      type: 'action',
      run: { kind: 'rule', ref: 'rule_cmd' },
    },
  );
  return kit;
}

const planRule = (): Rule => ({
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
});

interface Setup {
  kit: Kit;
  store: ReturnType<typeof createModelStore>;
  messages: string[];
  engine: ReturnType<typeof attachRules>['engine'];
  attached: ReturnType<typeof attachRules>;
  b: ReturnType<typeof createBehaviour>;
  task: (attrs?: Record<string, Json>) => ElementId;
  get: (id: string, att: string) => Json | undefined;
  host: BehaviourHost;
}

function setup(rules: Rule[], host: Partial<BehaviourHost> = {}): Setup {
  const kit = kitWithOwner();
  for (const r of rules) kit.rules[r.id] = r;
  const store = createModelStore(emptySampleModel(), { kit });
  const messages: string[] = [];
  const h = silentHost({
    message: (kind, text) => void messages.push(`${kind}: ${text}`),
    ...host,
  });
  const b = createBehaviour({ store, kit: () => kit, host: h });
  const attached = attachRules(b, { store, kit: () => kit });
  return {
    kit,
    store,
    messages,
    engine: attached.engine,
    attached,
    b,
    host: h,
    task: (attrs = {}) =>
      (
        store.execute({
          type: 'createElement',
          class: SAMPLE.task as never,
          x: 10,
          y: 20,
          attrs,
        }) as unknown as { value: ElementId }
      ).value,
    get: (id, att) =>
      (store.state as Model).elements[id as ElementId]?.attrs[att as never],
  };
}

const set = (s: Setup, id: string, attr: string, value: Json) =>
  s.store.execute({
    type: 'setAttribute',
    target: id as never,
    attr: attr as never,
    value,
  });

describe('the plan rule', () => {
  it('is a valid rule of the Kit', () => {
    const s = setup([planRule()]);
    expect(validateKit(s.kit)).toEqual([]);
  });

  it('sets the status and warns when a task gets High priority without an owner', () => {
    const s = setup([planRule()]);
    const id = s.task({ [SAMPLE.attName]: 'Pack' });
    set(s, id, SAMPLE.attPriority, 'High');
    expect(s.get(id, 'att_status')).toBe('Needs owner');
    expect(s.messages).toEqual([
      'warning: Task "Pack" is high priority but has no owner.',
    ]);
  });

  it('does nothing when the owner is set or the priority is not High', () => {
    const s = setup([planRule()]);
    const id = s.task({ att_owner: 'Ann' });
    set(s, id, SAMPLE.attPriority, 'High');
    const other = s.task();
    set(s, other, SAMPLE.attPriority, 'Low');
    expect(s.get(id, 'att_status')).toBeUndefined();
    expect(s.get(other, 'att_status')).toBeUndefined();
    expect(s.messages).toEqual([]);
  });

  it('undoes the trigger and the rule in one step', () => {
    const s = setup([planRule()]);
    const id = s.task();
    set(s, id, SAMPLE.attPriority, 'High');
    expect(s.store.undo()).toBe(true);
    expect(s.get(id, SAMPLE.attPriority)).toBe('Medium');
    expect(s.get(id, 'att_status')).toBeUndefined();
    s.store.redo();
    expect(s.get(id, SAMPLE.attPriority)).toBe('High');
    expect(s.get(id, 'att_status')).toBe('Needs owner');
  });

  it('does not run for merged changes', () => {
    const s = setup([planRule()]);
    const id = s.task();
    const next = clone(s.store.state as Model);
    next.elements[id]!.attrs[SAMPLE.attPriority] = 'High';
    s.store.applyRemote(next, [
      {
        path: ['elements', id, 'attrs', SAMPLE.attPriority],
        before: undefined,
        after: 'High',
      } as never,
    ]);
    expect(s.get(id, 'att_status')).toBeUndefined();
    expect(s.messages).toEqual([]);
  });
});

describe('disabled and reloaded rules', () => {
  it('skips a disabled rule and picks it up after reload', () => {
    const rule = { ...planRule(), enabled: false };
    const s = setup([rule]);
    const id = s.task();
    set(s, id, SAMPLE.attPriority, 'High');
    expect(s.get(id, 'att_status')).toBeUndefined();
    s.kit.rules[rule.id] = { ...rule, enabled: true };
    s.attached.reload();
    const other = s.task();
    set(s, other, SAMPLE.attPriority, 'High');
    expect(s.get(other, 'att_status')).toBe('Needs owner');
    s.attached.dispose();
    const third = s.task();
    set(s, third, SAMPLE.attPriority, 'High');
    expect(s.get(third, 'att_status')).toBeUndefined();
  });
});

describe('actions', () => {
  const on = (
    id: string,
    then: Rule['then'],
    when: Rule['when'] = { event: 'object.created', class: SAMPLE.task },
    extra: Partial<Rule> = {},
  ): Rule => ({ id: id as never, label: id, when, then, ...extra });

  it('sets an attribute of another object by formula and uses $old and $new', () => {
    const s = setup([
      on(
        'rule_a',
        [
          {
            action: 'setAttribute',
            attribute: 'Status',
            value: "= 'was ' + $old + ' now ' + $new",
          },
        ],
        {
          event: 'attribute.changed',
          class: SAMPLE.task,
          attribute: 'Priority',
        },
      ),
    ]);
    const id = s.task();
    set(s, id, SAMPLE.attPriority, 'Low');
    set(s, id, SAMPLE.attPriority, 'High');
    expect(s.get(id, 'att_status')).toBe('was Low now High');
  });

  it('creates an object next to self with attributes, and connects it', () => {
    const s = setup([
      on(
        'rule_a',
        [
          {
            action: 'createObject',
            class: SAMPLE.task as never,
            attributes: { Name: '= Name + " follow-up"' },
            offset: { x: 100, y: 5 },
          },
          { action: 'createConnector', relation: SAMPLE.flow as never },
        ],
        { event: 'attribute.changed', attribute: 'Status' },
      ),
    ]);
    const id = s.task({ [SAMPLE.attName]: 'Pack' });
    set(s, id, 'att_status', 'go');
    const m = s.store.state as Model;
    const made = Object.values(m.elements).find(
      (e) => e.attrs[SAMPLE.attName] === 'Pack follow-up',
    );
    expect(made).toMatchObject({ x: 110, y: 25 });
    expect(Object.values(m.connectors)).toHaveLength(1);
    expect(Object.values(m.connectors)[0]).toMatchObject({
      from: id,
      to: made!.id,
    });
  });

  it('deletes the object', () => {
    const s = setup([
      on(
        'rule_a',
        [{ action: 'delete' }],
        { event: 'attribute.changed', attribute: 'Status' },
        { if: "= Status == 'gone'" },
      ),
    ]);
    const id = s.task();
    set(s, id, 'att_status', 'gone');
    expect((s.store.state as Model).elements[id]).toBeUndefined();
    s.store.undo();
    expect((s.store.state as Model).elements[id]).toBeDefined();
  });

  it('cancels a deletion and shows the reason', () => {
    const s = setup([
      on('rule_a', [{ action: 'cancel', reason: 'Tasks cannot be deleted.' }], {
        event: 'object.deleting',
        class: SAMPLE.task,
      }),
    ]);
    const id = s.task();
    const r = s.store.execute({ type: 'delete', id });
    expect(r).toMatchObject({ ok: false, cancelled: true });
    expect((s.store.state as Model).elements[id]).toBeDefined();
    expect(s.messages).toEqual(['warning: Tasks cannot be deleted.']);
  });

  it('asks before cancelling, and both answers work', () => {
    const rule = on(
      'rule_a',
      [
        {
          action: 'ask',
          text: 'Delete the task for good?',
          then: [],
          else: [{ action: 'cancel', reason: 'Kept.' }],
        },
      ],
      { event: 'object.deleting', class: SAMPLE.task },
    );
    const no = setup([rule], { confirm: () => false });
    const a = no.task();
    expect(no.store.execute({ type: 'delete', id: a })).toMatchObject({
      cancelled: true,
    });
    const asked: string[] = [];
    const yes = setup([rule], {
      confirm: (t) => (asked.push(t), true),
    });
    const b = yes.task();
    expect(yes.store.execute({ type: 'delete', id: b })).toMatchObject({
      ok: true,
    });
    expect(asked).toEqual(['Delete the task for good?']);
  });

  it('ask runs the then branch on yes', () => {
    const s = setup(
      [
        on('rule_a', [
          {
            action: 'ask',
            text: 'Mark it?',
            then: [{ action: 'setAttribute', attribute: 'Status', value: 'Y' }],
            else: [{ action: 'setAttribute', attribute: 'Status', value: 'N' }],
          },
        ]),
      ],
      { confirm: () => true },
    );
    expect(s.get(s.task(), 'att_status')).toBe('Y');
  });

  it('choose puts the answer in the attribute, and cancel before an action stops it', () => {
    const choose = on('rule_a', [
      {
        action: 'choose',
        text: 'Who owns it?',
        options: ['Ann', 'Bob'],
        attribute: 'Owner',
      },
    ]);
    const s = setup([choose], { choose: () => 'Bob' });
    expect(s.get(s.task(), 'att_owner')).toBe('Bob');

    const before = on(
      'rule_b',
      [
        {
          action: 'choose',
          text: 'Really change it?',
          options: ['Yes'],
          attribute: 'Owner',
        },
      ],
      { event: 'attribute.changing', attribute: 'Priority' },
    );
    const t = setup([before], { choose: () => null });
    const id = t.task();
    expect(set(t, id, SAMPLE.attPriority, 'High')).toMatchObject({
      cancelled: true,
    });
    expect(t.get(id, SAMPLE.attPriority)).toBe('Medium');
  });

  it('shows messages, opens models and runs commands and scripts', () => {
    const calls: string[] = [];
    const s = setup(
      [
        on('rule_a', [
          { action: 'message', kind: 'info', text: 'Hello' },
          { action: 'openModel', model: 'Other' },
          { action: 'runCommand', command: 'Tidy' },
          { action: 'runCommand', command: 'rule_cmd' },
          { action: 'runScript', script: 'scr' },
        ]),
        on(
          'rule_cmd',
          [{ action: 'setAttribute', attribute: 'Status', value: 'cmd' }],
          { event: 'command' },
          { command: { label: 'Mark', place: 'context' } },
        ),
      ],
      {
        openModel: (m) => void calls.push(`open ${m}`),
        runCommand: (c, t) => void calls.push(`cmd ${c} ${t ? 'on' : 'none'}`),
        runScript: (c) => void calls.push(`script ${c}`),
      },
    );
    const id = s.task();
    expect(s.messages).toEqual(['info: Hello']);
    expect(calls).toEqual(['open Other', 'cmd Tidy on', 'script scr']);
    expect(s.get(id, 'att_status')).toBe('cmd');
  });
});

describe('cascades and problems', () => {
  it('runs a rule that sets its own attribute only once', () => {
    const s = setup([
      {
        id: 'rule_self',
        label: 'Self',
        when: { event: 'attribute.changed' },
        then: [
          {
            action: 'setAttribute',
            attribute: 'Name',
            value: '= Name + "x"',
          },
        ],
      },
    ]);
    const id = s.task({ [SAMPLE.attName]: 'N' });
    set(s, id, SAMPLE.attPriority, 'High');
    expect(s.get(id, SAMPLE.attName)).toBe('Nx');
    expect(s.messages).toEqual([]);
  });

  it('stops a chain of rules at depth 8 with a warning', () => {
    const s = setup([
      {
        id: 'rule_chain',
        label: 'Chain',
        when: { event: 'object.created' },
        then: [{ action: 'createObject', class: SAMPLE.task as never }],
      },
    ]);
    s.task();
    expect(Object.keys((s.store.state as Model).elements)).toHaveLength(9);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]).toMatch(/Rule "Chain": stopped .* 8 levels/);
    // The whole chain is one undo step.
    s.store.undo();
    expect(Object.keys((s.store.state as Model).elements)).toHaveLength(0);
  });

  it('turns a broken formula into a warning and skips the rest of the rule', () => {
    const s = setup([
      {
        id: 'rule_bad',
        label: 'Broken',
        when: { event: 'object.created' },
        then: [
          { action: 'setAttribute', attribute: 'Status', value: '= 1 +' },
          { action: 'setAttribute', attribute: 'Owner', value: 'never' },
        ],
      },
    ]);
    const id = s.task();
    expect(s.get(id, 'att_owner')).toBeUndefined();
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]).toMatch(/^warning: Rule "Broken": /);
  });

  it('turns a broken condition and a refused command into warnings', () => {
    const cond = setup([
      {
        id: 'rule_c',
        label: 'Cond',
        when: { event: 'object.created' },
        if: '= nope(',
        then: [],
      },
    ]);
    cond.task();
    expect(cond.messages[0]).toMatch(/^warning: Rule "Cond": the condition/);

    const refused = setup([
      {
        id: 'rule_r',
        label: 'Refused',
        when: { event: 'object.created' },
        then: [
          { action: 'setAttribute', attribute: 'Cost', value: 5 },
          { action: 'setAttribute', attribute: 'Owner', value: 'never' },
        ],
      },
    ]);
    const id = refused.task();
    expect(refused.messages).toHaveLength(1);
    expect(refused.messages[0]).toMatch(/^warning: Rule "Refused": /);
    expect(refused.get(id, 'att_owner')).toBeUndefined();
    // The object the user made is still there.
    expect((refused.store.state as Model).elements[id]).toBeDefined();
  });

  it('explains that a before rule cannot change things', () => {
    const s = setup([
      {
        id: 'rule_b',
        label: 'Early',
        when: { event: 'attribute.changing' },
        then: [{ action: 'setAttribute', attribute: 'Owner', value: 'x' }],
      },
    ]);
    const id = s.task();
    set(s, id, SAMPLE.attPriority, 'High');
    expect(s.messages[0]).toMatch(/Rule "Early": this rule runs before/);
    expect(s.get(id, SAMPLE.attPriority)).toBe('High');
  });
});

describe('commands and buttons', () => {
  const cmd = (enabled = true): Rule => ({
    id: 'rule_cmd',
    label: 'Mark',
    enabled,
    when: { event: 'command' },
    command: { label: 'Mark as done', place: 'toolbar' },
    then: [
      { action: 'setAttribute', attribute: 'Status', value: 'Done' },
      { action: 'setAttribute', attribute: 'Owner', value: 'Me' },
    ],
  });

  it('registers command rules and runs them on the selection in one undo step', () => {
    const s = setup([cmd(), planRule()]);
    expect(
      s.b.commands.list().map((c) => [c.id, c.label, c.place, c.source]),
    ).toEqual([['rule_cmd', 'Mark as done', 'toolbar', 'rule']]);
    const id = s.task();
    s.b.commands.get('rule_cmd')!.run(id);
    expect(s.get(id, 'att_status')).toBe('Done');
    expect(s.get(id, 'att_owner')).toBe('Me');
    s.store.undo();
    expect(s.get(id, 'att_status')).toBeUndefined();
    expect(s.get(id, 'att_owner')).toBeUndefined();
  });

  it('leaves disabled command rules out and drops them on reload', () => {
    const s = setup([cmd(false)]);
    expect(s.b.commands.list()).toEqual([]);
    s.kit.rules['rule_cmd'] = cmd(true);
    s.attached.reload();
    expect(s.b.commands.list()).toHaveLength(1);
    delete s.kit.rules['rule_cmd'];
    s.attached.reload();
    expect(s.b.commands.list()).toEqual([]);
  });

  it('runs the rule an action attribute points to', () => {
    const s = setup([cmd()]);
    const id = s.task();
    const def = s.kit.classes[SAMPLE.task]!.attributes.find(
      (a) => a.key === 'Go',
    ) as never;
    runActionAttribute(s.b, s.engine, def, id);
    expect(s.get(id, 'att_status')).toBe('Done');
  });

  it('sends command and script buttons to the registry and the host', () => {
    const calls: string[] = [];
    const s = setup([cmd()], {
      runCommand: (c) => void calls.push(`cmd ${c}`),
      runScript: (c) => void calls.push(`script ${c}`),
    });
    const id = s.task();
    runActionAttribute(
      s.b,
      s.engine,
      { run: { kind: 'command', ref: 'Mark as done' } },
      id,
    );
    expect(s.get(id, 'att_status')).toBe('Done');
    runActionAttribute(
      s.b,
      s.engine,
      { run: { kind: 'command', ref: 'Other' } },
      id,
    );
    runActionAttribute(
      s.b,
      s.engine,
      { run: { kind: 'script', ref: 'scr' } },
      id,
    );
    expect(calls).toEqual(['cmd Other', 'script scr']);
  });

  it('warns for a missing or switched-off rule', () => {
    const s = setup([cmd(false)]);
    s.engine.run('rule_cmd', null);
    s.engine.run('rule_nope', null);
    expect(s.messages).toEqual([
      'warning: Rule "Mark" is switched off.',
      'warning: The rule rule_nope does not exist.',
    ]);
  });
});

describe('dry run', () => {
  it('evaluates the condition and describes the actions without running them', () => {
    const s = setup([]);
    const id = s.task({
      [SAMPLE.attName]: 'Pack',
      [SAMPLE.attPriority]: 'High',
    });
    const r = s.engine.test(planRule(), id);
    expect(r.condition).toEqual({ value: true });
    expect(r.steps).toEqual([
      'Set Status of the object to "Needs owner".',
      'Show a warning message "Task "Pack" is high priority but has no owner." (from = \'Task "\' + Name + \'" is high priority but has no owner.\').',
    ]);
    expect(s.get(id, 'att_status')).toBeUndefined();
    expect(s.messages).toEqual([]);
  });

  it('reports a false condition and a formula error', () => {
    const s = setup([]);
    const id = s.task({ att_owner: 'Ann' });
    expect(s.engine.test(planRule(), id).condition.value).toBe(false);
    const bad = s.engine.test({ ...planRule(), if: '= (' }, id);
    expect(bad.condition.error).toBeTruthy();
  });

  it('indents the branches of a question', () => {
    const s = setup([]);
    const r = s.engine.test(
      {
        ...planRule(),
        then: [
          {
            action: 'ask',
            text: 'Sure?',
            then: [{ action: 'delete' }],
            else: [{ action: 'cancel', reason: 'No' }],
          },
        ],
      },
      null,
    );
    expect(r.steps).toEqual([
      'Ask "Sure?". If the answer is yes:',
      '  Delete the object.',
      'If the answer is no:',
      '  Cancel the action, saying "No".',
    ]);
  });
});
