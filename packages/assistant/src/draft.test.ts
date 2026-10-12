import { describe, expect, it } from 'vitest';
import {
  createEmptyKit,
  createKitStore,
  validateKit,
  type Kit,
} from '@metakit-app/core';
import { SAMPLE } from '@metakit-app/core/testing';
import { asOneStep, describeDraftChange, draftToCommands } from './apply';
import { draft } from './draft';
import { extractCode } from './extract';
import {
  CLASS_REPLY,
  RULE_REPLY,
  SCRIPT_REPLY,
  SHAPE_REPLY,
  planKit,
} from './fixtures';
import { scriptedProvider } from './testing';

const run = <K extends 'rule' | 'script' | 'shape' | 'class'>(
  kind: K,
  replies: string[],
  kit: Kit = planKit(),
  extra: { typeCheck?: (s: string, d: string) => Promise<string[]> } = {},
) => {
  const provider = scriptedProvider(replies);
  return {
    provider,
    done: draft({ provider, key: 'fake', kit, kind, sentence: 'x', ...extra }),
  };
};

describe('drafting the examples of the plan', () => {
  it('a rule: high-priority tasks need an owner', async () => {
    const kit = planKit();
    const { done, provider } = run('rule', [RULE_REPLY], kit);
    const out = await done;
    expect(out.errors).toEqual([]);
    expect(out.attempts).toBe(1);
    expect(out.draft).toMatchObject({
      label: 'High-priority tasks need an owner',
      // The class key written by the model became the class id; the condition got its "=".
      when: { event: 'attribute.changed', class: SAMPLE.task },
      if: "= Priority == 'High' && Owner == null",
    });
    expect(provider.keys).toEqual(['fake']);
    expect(provider.requests[0]!.system).toContain('Task');
    expect(provider.requests[0]!.system).toContain('object.moved');
    expect(provider.requests[0]!.system).toContain('setAttribute');
  });

  it('a script: renumber tasks by position', async () => {
    const out = await run('script', [SCRIPT_REPLY]).done;
    expect(out.errors).toEqual([]);
    expect(out.draft!.name).toBe('Renumber tasks');
    expect(out.draft!.source).toContain('model.objects("Task")');
    expect(out.draft!.source).toContain('// Name: Renumber tasks');
  });

  it('a shape: a rounded blue task box showing its name', async () => {
    const out = await run('shape', [SHAPE_REPLY]).done;
    expect(out.errors).toEqual([]);
    expect(out.draft).toMatchObject({ kind: 'node', name: 'Blue task box' });
  });

  it('a class: Task with a name, a priority and an owner', async () => {
    const out = await run('class', [CLASS_REPLY], createEmptyKit({ name: 'T' }))
      .done;
    expect(out.errors).toEqual([]);
    expect(out.draft!.attributes.map((a) => a.key)).toEqual([
      'Name',
      'Priority',
      'Owner',
    ]);
  });

  it('the script prompt carries the generated declarations and the example', async () => {
    const { provider, done } = run('script', [SCRIPT_REPLY]);
    await done;
    const system = provider.requests[0]!.system;
    expect(system).toContain('declare module "metakit"');
    expect(system).toContain('Owner');
    expect(system).toContain('renumber-tasks');
  });
});

describe('validation and the retry', () => {
  const badRule = RULE_REPLY.replace(
    "Priority == 'High' && Owner == null",
    "Priority = = 'High'",
  );

  it('retries once with the errors appended, then shows the valid draft', async () => {
    const { provider, done } = run('rule', [badRule, RULE_REPLY]);
    const out = await done;
    expect(out.attempts).toBe(2);
    expect(out.errors).toEqual([]);
    expect(out.draft!.if).toContain('Owner == null');
    const retry = provider.requests[1]!;
    expect(retry.messages).toHaveLength(3);
    expect(retry.messages[1]).toEqual({ role: 'assistant', content: badRule });
    expect(retry.messages[2]!.content).toMatch(/if: /);
    expect(retry.messages[2]!.content).toMatch(/not written correctly/);
  });

  it('shows the draft with its errors when it is invalid twice', async () => {
    const { provider, done } = run('rule', [badRule, badRule]);
    const out = await done;
    expect(out.attempts).toBe(2);
    expect(out.errors.length).toBeGreaterThan(0);
    expect(out.draft).not.toBeNull();
    expect(provider.requests).toHaveLength(2);
  });

  it('retries a reply that is not JSON', async () => {
    const out = await run('rule', ['Sorry, I cannot.', RULE_REPLY]).done;
    expect(out.attempts).toBe(2);
    expect(out.errors).toEqual([]);
  });

  it('returns no draft when the second reply is still unreadable', async () => {
    const out = await run('rule', ['nope', 'still nope']).done;
    expect(out.draft).toBeNull();
    expect(out.raw).toBe('still nope');
    expect(out.errors[0]).toMatch(/not valid JSON/);
  });

  it('finds unknown functions, attributes, events and classes', async () => {
    const reply = (patch: (r: Record<string, unknown>) => void) => {
      const r = JSON.parse(extractCode(RULE_REPLY, ['json'])) as Record<
        string,
        unknown
      >;
      patch(r);
      return JSON.stringify(r);
    };
    const errors = async (patch: (r: Record<string, unknown>) => void) =>
      (await run('rule', [reply(patch), reply(patch)]).done).errors.join('\n');
    expect(await errors((r) => (r.if = '= frobnicate(Priority)'))).toMatch(
      /not a known function/,
    );
    expect(await errors((r) => (r.if = '= Colour == 1'))).toMatch(
      /name "Colour"/,
    );
    expect(
      await errors(
        (r) => ((r.when as { event: string }).event = 'object.exploded'),
      ),
    ).toMatch(/when\.event/);
    expect(
      await errors((r) => ((r.when as { class: string }).class = 'Nothing')),
    ).toMatch(/when\.class/);
    expect(
      await errors(
        (r) =>
          (r.then = [{ action: 'setAttribute', attribute: 'Nope', value: 1 }]),
      ),
    ).toMatch(/no attribute with the key "Nope"/);
  });

  it('checks shapes: a bad part and a bad formula', async () => {
    const bad = SHAPE_REPLY.replace('"type": "rect"', '"type": "blob"');
    expect((await run('shape', [bad, bad]).done).errors.join()).toMatch(
      /parts\[0\]/,
    );
    const badFormula = SHAPE_REPLY.replace('"= Name"', '"= Name +"');
    expect(
      (await run('shape', [badFormula, badFormula]).done).errors.join(),
    ).toMatch(/parts\[1\]\.text/);
  });

  it('checks classes: duplicate attribute keys and a missing parent', async () => {
    const dup = CLASS_REPLY.replace('"key": "Owner"', '"key": "Name"');
    const e1 = (await run('class', [dup, dup]).done).errors.join();
    expect(e1).toMatch(/two attributes with the key "Name"/);
    const parent = CLASS_REPLY.replace(
      '"kind": "node",',
      '"kind": "node", "extends": "Nope",',
    );
    expect((await run('class', [parent, parent]).done).errors.join()).toMatch(
      /no class called "Nope"/,
    );
  });

  it('compiles scripts and uses the type check when one is given', async () => {
    const broken =
      '```ts\nimport { on } from "metakit";\non("object.created", () => {\n```';
    const out = await run('script', [broken, broken]).done;
    expect(out.errors.length).toBeGreaterThan(0);
    expect(out.errors[0]).toMatch(/^line \d+:/);

    const other = '```ts\nimport fs from "fs";\n```';
    expect((await run('script', [other, other]).done).errors.join()).toMatch(
      /only import from "metakit"/,
    );

    // The type check finds what compiling cannot; its findings are retried like any other.
    let calls = 0;
    const typeCheck = async () =>
      ++calls === 1 ? ['line 6: "Taks" is not a class of this tool.'] : [];
    const { provider, done } = run(
      'script',
      [SCRIPT_REPLY, SCRIPT_REPLY],
      planKit(),
      {
        typeCheck,
      },
    );
    const typed = await done;
    expect(typed.attempts).toBe(2);
    expect(typed.errors).toEqual([]);
    expect(provider.requests[1]!.messages[2]!.content).toContain('"Taks"');
  });

  it('wraps errors of the provider without the key', async () => {
    const provider = {
      id: 'broken',
      test: async () => 'x',
      complete: async (_r: unknown, key: string) => {
        throw new Error(`failed for ${key}`);
      },
    };
    await expect(
      draft({
        provider,
        key: 'sk-ant-fake-not-a-real-key-0003',
        kit: planKit(),
        kind: 'rule',
        sentence: 'x',
      }),
    ).rejects.toThrow('[key removed]');
  });
});

describe('accepting a draft', () => {
  it('applies a rule in one undo step, and undo restores the Kit', async () => {
    const kit = planKit();
    const store = createKitStore(kit);
    const out = await run('rule', [RULE_REPLY], kit).done;
    const before = structuredClone(store.state);
    const commands = draftToCommands('rule', out.draft!, store.state);
    const result = store.execute(asOneStep(commands));
    expect(result.ok).toBe(true);
    const rules = Object.values(store.state.rules);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toMatch(/^rule_/);
    expect(validateKit(store.state)).toEqual([]);
    expect(store.undo()).toBe(true);
    expect(store.state).toEqual(before);
  });

  it('applies a script, a shape and a class, each undoable', async () => {
    const store = createKitStore(planKit());
    const before = structuredClone(store.state);

    const script = await run('script', [SCRIPT_REPLY]).done;
    expect(
      store.execute(
        asOneStep(draftToCommands('script', script.draft!, store.state)),
      ).ok,
    ).toBe(true);
    const shape = await run('shape', [SHAPE_REPLY]).done;
    expect(
      store.execute(
        asOneStep(draftToCommands('shape', shape.draft!, store.state)),
      ).ok,
    ).toBe(true);
    const cls = await run('class', [CLASS_REPLY]).done;
    expect(cls.errors).toEqual([]);
    expect(
      store.execute(
        asOneStep(draftToCommands('class', cls.draft!, store.state)),
      ).ok,
    ).toBe(true);

    expect(Object.values(store.state.scripts)[0]!.name).toBe('Renumber tasks');
    expect(Object.values(store.state.shapes)).toHaveLength(1);
    // Task exists already, so the new key is made unique.
    const keys = Object.values(store.state.classes).map((c) => c.key);
    expect(keys).toContain('Task2');
    expect(validateKit(store.state)).toEqual([]);

    store.undo();
    store.undo();
    store.undo();
    expect(store.state).toEqual(before);
  });

  it('makes a script name unique', async () => {
    const kit = planKit();
    const script = await run('script', [SCRIPT_REPLY], kit).done;
    const store = createKitStore(kit);
    store.execute(
      asOneStep(draftToCommands('script', script.draft!, store.state)),
    );
    store.execute(
      asOneStep(draftToCommands('script', script.draft!, store.state)),
    );
    expect(
      Object.values(store.state.scripts)
        .map((s) => s.name)
        .sort(),
    ).toEqual(['Renumber tasks', 'Renumber tasks 2']);
  });

  it('describes each change in plain English', async () => {
    const kit = planKit();
    const rule = (await run('rule', [RULE_REPLY], kit).done).draft!;
    const lines = describeDraftChange('rule', rule, kit);
    expect(lines[0]).toBe('Add the rule "High-priority tasks need an owner".');
    expect(lines[1]).toBe(
      'When an attribute is changed for Task (attribute Priority).',
    );
    expect(lines.join('\n')).toContain('Set Status to "Needs owner"');
    expect(lines.join('\n')).toContain('Show a warning');

    const script = (await run('script', [SCRIPT_REPLY], kit).done).draft!;
    const s = describeDraftChange('script', script, kit).join('\n');
    expect(s).toContain('Add the script "Renumber tasks"');
    expect(s).toContain('object.created, object.moved');
    expect(s).toContain('Renumber tasks');

    const shape = (await run('shape', [SHAPE_REPLY], kit).done).draft!;
    expect(describeDraftChange('shape', shape, kit)[0]).toBe(
      'Add the shape "Blue task box", 140 by 70.',
    );
    const cls = (await run('class', [CLASS_REPLY], kit).done).draft!;
    const c = describeDraftChange('class', cls, kit).join('\n');
    expect(c).toContain('Add the class "Task2" (the key Task is taken)');
    expect(c).toContain('Priority (choice, choices Low, Medium, High');
  });
});
