import { describe, expect, it } from 'vitest';
import {
  memoryKeyValue,
  scriptedProvider,
  asOneStep,
} from '@metakit-app/assistant';
import { createKitStore, validateKit, type Kit } from '@metakit-app/core';
import { SAMPLE, sampleKit } from '@metakit-app/core/testing';
import { AssistantService } from './assistant-service';
import { DraftDialogModel } from './draft-dialog-model';
import { sampleOutgoing, sampleKitForNotice } from './notice';
import { typeCheckWithServer } from './type-check';
import { createLanguageServer } from '../components/build/scripts/script-language';
import { loadTestLibs } from '../components/build/scripts/test-libs';

const FAKE_KEY = 'sk-ant-fake-not-a-real-key-0004';

const kit = (): Kit => {
  const t = sampleKit();
  t.classes[SAMPLE.task]!.attributes.push(
    { id: 'att_owner', key: 'Owner', type: 'text' },
    { id: 'att_number', key: 'Number', type: 'integer' },
  );
  return t;
};

const RULE = `\`\`\`json
{
  "label": "High-priority tasks need an owner",
  "when": { "event": "attribute.changed", "class": "Task", "attribute": "Priority" },
  "if": "= Priority == 'High' && Owner == null",
  "then": [{ "action": "message", "kind": "warning", "text": "A high-priority task needs an owner." }]
}
\`\`\``;

const script = (cls: string) => `\`\`\`ts
// Name: Renumber tasks
import { model } from "metakit";
model.objects("${cls}").forEach((task, index) => {
  task.attrs.Number = index + 1;
});
\`\`\``;

async function service(
  replies: string[],
  options: { on?: boolean; key?: boolean } = {},
) {
  const provider = scriptedProvider(replies);
  const s = new AssistantService({
    kv: memoryKeyValue(),
    createProvider: () => provider,
    typeCheck: typeCheckWithServer(
      (() => {
        const server = createLanguageServer(loadTestLibs());
        return server;
      })(),
    ),
  });
  await s.load();
  if (options.on !== false) await s.setEnabled(true);
  if (options.key !== false) await s.saveKey(FAKE_KEY);
  return { s, provider };
}

describe('AssistantService', () => {
  it('is off by default and on only with the switch and a key', async () => {
    const { s } = await service([], { on: false, key: false });
    expect(s.settings).toMatchObject({
      enabled: false,
      model: 'claude-sonnet-5-5',
    });
    expect(s.enabled).toBe(false);
    await s.setEnabled(true);
    expect(s.enabled).toBe(false); // no key yet
    await s.saveKey(FAKE_KEY);
    expect(s.enabled).toBe(true);
    await s.removeKey();
    expect(s.enabled).toBe(false);
    expect(s.hasKey).toBe(false);
  });

  it('remembers its state in the key-value store', async () => {
    const kv = memoryKeyValue();
    const a = new AssistantService({ kv });
    await a.load();
    await a.setEnabled(true);
    await a.saveKey(FAKE_KEY);
    const b = new AssistantService({ kv });
    await b.load();
    expect(b.enabled).toBe(true);
    await a.removeKey();
    await b.load();
    expect(b.hasKey).toBe(false);
  });

  it('tests the key through the provider and reports errors without the key', async () => {
    const { s } = await service([]);
    await expect(s.testKey()).resolves.toBe('ok');
    const failing = new AssistantService({
      kv: memoryKeyValue(),
      createProvider: () => ({
        id: 'claude',
        test: async (key) => {
          throw new Error(`rejected ${key}`);
        },
        complete: async () => '',
      }),
    });
    await failing.load();
    await failing.saveKey(FAKE_KEY);
    await expect(failing.testKey()).rejects.toThrow('[key removed]');
  });

  it('refuses to draft when it is off or has no key', async () => {
    const off = await service([RULE], { on: false });
    await expect(off.s.draft('rule', kit(), 'x')).rejects.toThrow('turned off');
    const noKey = await service([RULE], { key: false });
    await expect(noKey.s.draft('rule', kit(), 'x')).rejects.toThrow(
      'Add a key',
    );
    expect(off.provider.requests).toHaveLength(0);
    expect(noKey.provider.requests).toHaveLength(0);
  });

  it('notifies listeners when its state changes', async () => {
    const { s } = await service([], { on: false, key: false });
    let calls = 0;
    const stop = s.subscribe(() => calls++);
    await s.setEnabled(true);
    await s.saveKey(FAKE_KEY);
    stop();
    await s.removeKey();
    expect(calls).toBe(2);
  });
});

describe('DraftDialogModel', () => {
  it('drafts, describes in plain English, and accepts as one undo step', async () => {
    const t = kit();
    const { s } = await service([RULE]);
    const model = new DraftDialogModel('rule', t, s);
    const seen: string[] = [];
    model.subscribe(() => seen.push(model.view.status));
    expect(model.canStart).toBe(false);
    model.sentence = 'High-priority tasks need an owner';
    const started = model.start();
    expect(model.view.status).toBe('drafting');
    await started;
    expect(seen).toEqual(['drafting', 'done']);
    const v = model.view;
    expect(v.problems).toEqual([]);
    expect(v.canAccept).toBe(true);
    expect(v.lines[0]).toBe(
      'Add the rule "High-priority tasks need an owner".',
    );
    expect(v.rawLabel).toBe('JSON');
    expect(JSON.parse(v.raw).label).toBe('High-priority tasks need an owner');

    const store = createKitStore(t);
    const before = structuredClone(store.state);
    const commands = model.accept(store.state)!;
    expect(store.execute(asOneStep(commands)).ok).toBe(true);
    expect(Object.keys(store.state.rules)).toHaveLength(1);
    store.undo();
    expect(store.state).toEqual(before);
  });

  it('cannot accept a draft that still has problems, but shows them', async () => {
    const bad = RULE.replace('Priority == ', 'Priority = = ');
    const { s } = await service([bad, bad]);
    const model = new DraftDialogModel('rule', kit(), s);
    model.sentence = 'x';
    await model.start();
    expect(model.view.canAccept).toBe(false);
    expect(model.view.problems.length).toBeGreaterThan(0);
    expect(model.view.attempts).toBe(2);
    expect(model.accept()).toBeNull();
  });

  it('shows a service problem as an error and keeps no draft', async () => {
    const { s } = await service([], { key: false });
    const model = new DraftDialogModel('rule', kit(), s);
    model.sentence = 'x';
    await model.start();
    expect(model.view.error).toContain('Add a key');
    expect(model.view.hasDraft).toBe(false);
  });

  it('ignores an answer that arrives after a discard', async () => {
    const { s } = await service([RULE]);
    const model = new DraftDialogModel('rule', kit(), s);
    model.sentence = 'x';
    const started = model.start();
    model.discard();
    await started;
    expect(model.view.status).toBe('idle');
    expect(model.accept()).toBeNull();
  });
});

describe('type check of drafted scripts', () => {
  it('finds a wrong class name that compiling cannot', async () => {
    const server = createLanguageServer(loadTestLibs());
    const check = typeCheckWithServer(server);
    const t = kit();
    const { generateDeclarations } = await import('@metakit-app/behaviour');
    const declarations = generateDeclarations({ ...t, scripts: {}, rules: {} });
    expect(
      await check(
        'import { model } from "metakit";\nmodel.objects("Task");\n',
        declarations,
      ),
    ).toEqual([]);
    const errors = await check(
      'import { model } from "metakit";\nmodel.objects("Taks");\n',
      declarations,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^line 2:/);
  });

  it('is part of the retry: a script with a wrong class is redrafted', async () => {
    const t = kit();
    const { s, provider } = await service([script('Taks'), script('Task')]);
    const model = new DraftDialogModel('script', t, s);
    model.sentence = 'Renumber tasks by position';
    await model.start();
    expect(model.view.attempts).toBe(2);
    expect(model.view.problems).toEqual([]);
    expect(provider.requests[1]!.messages[2]!.content).toMatch(/line 3/);
    expect(model.view.rawLabel).toBe('TypeScript');
    const store = createKitStore(t);
    expect(store.execute(asOneStep(model.accept(store.state)!)).ok).toBe(true);
    expect(validateKit(store.state)).toEqual([]);
    expect(Object.values(store.state.scripts)[0]!.name).toBe('Renumber tasks');
  });
});

describe('the notice', () => {
  it('shows a sample request that holds the Kit and never a model', () => {
    const text = sampleOutgoing();
    expect(text).toContain('Priority (choice: Low | Medium | High)');
    expect(text).toContain('High-priority tasks need an owner');
    expect(sampleKitForNotice().classes).not.toEqual({});
  });
});
