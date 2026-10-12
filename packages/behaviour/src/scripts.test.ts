import { afterEach, describe, expect, it } from 'vitest';
import {
  createModelStore,
  type ElementId,
  type Script,
  type ScriptId,
  type Kit,
  type KitPermissions,
} from '@metakit-app/core';
import { SAMPLE, emptySampleModel, sampleKit } from '@metakit-app/core/testing';
import { createBehaviour, silentHost, type BehaviourHost } from './index';
import { ScriptEngine } from './scripts';
import type { PermissionGrant } from './permissions';
import type { ScriptFiles, ScriptHttp } from './script-services';

/** The script of the plan (Level 3), word for word. */
const RENUMBER = `import { on, model, ui, commands } from "metakit";

function renumberTasks(): void {
  const tasks = model.objects("Task").sort((a, b) => a.y - b.y || a.x - b.x);
  tasks.forEach((task, index) => {
    task.attrs.Number = index + 1;
  });
}

on("object.created", { class: "Task" }, () => renumberTasks());
on("object.moved", { class: "Task" }, () => renumberTasks());

commands.register({
  id: "renumber-tasks",
  label: "Renumber tasks",
  menu: "Model",
  run: () => {
    renumberTasks();
    ui.message(\`Renumbered \${model.objects("Task").length} tasks.\`);
  },
});
`;

let seq = 0;
const script = (
  source: string,
  name = 'Script',
  extra: Partial<Script> = {},
): Script => ({
  id: `scr_test${++seq}` as ScriptId,
  name,
  source,
  ...extra,
});

function kitWith(scripts: Script[], permissions?: KitPermissions): Kit {
  const kit = sampleKit();
  kit.classes[SAMPLE.task]!.attributes.push({
    id: 'att_number',
    key: 'Number',
    type: 'integer',
  });
  kit.scripts = Object.fromEntries(scripts.map((s) => [s.id, s]));
  if (permissions) kit.manifest.permissions = permissions;
  return kit;
}

interface Rig {
  store: ReturnType<typeof createModelStore>;
  engine: ScriptEngine;
  messages: { kind: string; text: string }[];
  host: BehaviourHost;
  kit: Kit;
  commands: ReturnType<typeof createBehaviour>['commands'];
  addTask: (x: number, y: number) => ElementId;
  number: (id: ElementId) => unknown;
}

const engines: ScriptEngine[] = [];
const behaviours: ReturnType<typeof createBehaviour>[] = [];

async function rig(
  scripts: Script[],
  options: {
    permissions?: KitPermissions;
    grant?: PermissionGrant;
    files?: ScriptFiles;
    http?: ScriptHttp;
    host?: Partial<BehaviourHost>;
    limits?: { handlerMs?: number; runMs?: number };
  } = {},
): Promise<Rig> {
  const kit = kitWith(scripts, options.permissions);
  const store = createModelStore(emptySampleModel(), { kit });
  const messages: { kind: string; text: string }[] = [];
  const host = silentHost({
    message: (kind, text) => messages.push({ kind, text }),
    ...options.host,
  });
  const behaviour = createBehaviour({ store, kit: () => kit, host });
  behaviours.push(behaviour);
  const engine = new ScriptEngine({
    store,
    bus: behaviour.bus,
    calculator: behaviour.calculator,
    kit: () => kit,
    host,
    commands: behaviour.commands,
    ...(options.files ? { files: options.files } : {}),
    ...(options.http ? { http: options.http } : {}),
    permissions: options.grant ?? { network: false, files: false },
    ...(options.limits ? { limits: options.limits } : {}),
  });
  engines.push(engine);
  await engine.reload();
  const addTask = (x: number, y: number): ElementId => {
    const r = store.execute({
      type: 'createElement',
      class: SAMPLE.task,
      x,
      y,
    });
    if (!r.ok) throw new Error(r.reason);
    return r.value as ElementId;
  };
  return {
    store,
    engine,
    messages,
    host,
    kit,
    commands: behaviour.commands,
    addTask,
    number: (id) => store.state.elements[id]?.attrs['att_number'],
  };
}

afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
  for (const b of behaviours.splice(0)) b.dispose();
});

const lines = (r: Rig) => r.engine.log.map((l) => `${l.level}: ${l.text}`);

describe('the "Renumber tasks" script of the plan', () => {
  it('numbers tasks from top to bottom when one is created or moved, in the same undo step', async () => {
    const r = await rig([script(RENUMBER, 'Renumber tasks')]);
    expect(lines(r)).toEqual([]);
    const lower = r.addTask(100, 200);
    expect(r.number(lower)).toBe(1);
    const upper = r.addTask(100, 50);
    expect(r.number(upper)).toBe(1);
    expect(r.number(lower)).toBe(2);
    const middle = r.addTask(0, 120);
    expect([upper, middle, lower].map(r.number)).toEqual([1, 2, 3]);

    // Moving the top task below the others renumbers them all.
    r.store.execute({ type: 'move', id: upper, x: 100, y: 500 });
    expect([middle, lower, upper].map(r.number)).toEqual([1, 2, 3]);

    // One undo takes back the move and the renumbering together.
    expect(r.store.history().slice(-1)).toEqual(['move']);
    r.store.undo();
    expect([upper, middle, lower].map(r.number)).toEqual([1, 2, 3]);
    r.store.undo();
    expect(Object.keys(r.store.state.elements)).toHaveLength(2);
    expect([upper, lower].map(r.number)).toEqual([1, 2]);
    r.store.undo();
    expect(Object.keys(r.store.state.elements)).toHaveLength(1);
    expect(r.number(lower)).toBe(1);
  });

  it('registers the menu command, which renumbers and shows a message, as one undo step', async () => {
    const r = await rig([script(RENUMBER, 'Renumber tasks')]);
    const entry = r.commands.get('script:renumber-tasks');
    expect(entry).toMatchObject({
      label: 'Renumber tasks',
      place: 'model',
      source: 'script',
    });
    // Handlers are not wanted for this part: add tasks, then break the numbers by hand.
    const a = r.addTask(0, 10);
    const b = r.addTask(0, 20);
    r.store.execute({
      type: 'setAttribute',
      target: a,
      attr: 'att_number',
      value: 9,
    });
    r.store.execute({
      type: 'setAttribute',
      target: b,
      attr: 'att_number',
      value: 9,
    });
    const before = r.store.history().length;
    entry!.run(null);
    await r.engine.ready();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect([a, b].map(r.number)).toEqual([1, 2]);
    expect(r.messages).toContainEqual({
      kind: 'info',
      text: 'Renumbered 2 tasks.',
    });
    expect(r.store.history()).toHaveLength(before + 1);
    r.store.undo();
    expect([a, b].map(r.number)).toEqual([9, 9]);
  });

  it('runs by hand through runScript, the way a rule action or the Run button does', async () => {
    const r = await rig([script(RENUMBER, 'Renumber tasks')]);
    const id = Object.keys(r.kit.scripts)[0]!;
    const a = r.addTask(0, 10);
    r.store.execute({
      type: 'setAttribute',
      target: a,
      attr: 'att_number',
      value: 5,
    });
    await r.engine.runScript(id, null);
    expect(r.number(a)).toBe(1);
    expect(r.messages.at(-1)?.text).toBe('Renumbered 1 tasks.');
  });
});

describe('events', () => {
  it('filters by class, subclass and attribute and gives class and attribute keys, not ids', async () => {
    const r = await rig([
      script(`
        import { on } from "metakit";
        on("attribute.changed", { class: "FlowNode", attribute: "Priority" }, (e) => {
          console.log(e.class + ":" + e.attribute + ":" + e.old + ">" + e.new);
        });
        on("object.created", { class: "Gateway" }, () => console.log("gateway"));
      `),
    ]);
    const id = r.addTask(0, 0);
    r.store.execute({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attPriority,
      value: 'High',
    });
    r.store.execute({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attEffort,
      value: 3,
    });
    expect(lines(r)).toEqual(['log: Task:Priority:Medium>High']);
  });

  it('hands the object of the event to the handler as a live proxy', async () => {
    const r = await rig([
      script(`
        import { on } from "metakit";
        on("object.created", { class: "Task" }, (e) => {
          const task = e.object!;
          task.attrs.Effort = 4;
          task.attrs.Name = "Task at " + task.x + "," + task.y;
          console.log(task.class, task.attrs.Priority, task.attrs.Cost);
        });
      `),
    ]);
    const id = r.addTask(7, 9);
    const attrs = r.store.state.elements[id]!.attrs;
    expect(attrs[SAMPLE.attName]).toBe('Task at 7,9');
    // Priority is the class default; Cost is a formula (Effort * 85) read before the step ends.
    expect(lines(r)[0]).toMatch(/^log: Task Medium /);
  });

  it('cancels an action from a "before" handler with cancel(), a returned object or false', async () => {
    const r = await rig([
      script(`
        import { on, cancel } from "metakit";
        on("object.deleting", { class: "Task" }, (e) => {
          if (e.object!.attrs.Priority === "High") return cancel("High tasks cannot be deleted.");
        });
        on("object.creating", { class: "Gateway" }, () => false);
        on("attribute.changing", { attribute: "Effort" }, (e) => {
          if ((e.new as number) < 0) return { cancel: "Effort cannot be negative." };
        });
      `),
    ]);
    const id = r.addTask(0, 0);
    r.store.execute({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attPriority,
      value: 'High',
    });
    const del = r.store.execute({ type: 'delete', id });
    expect(del).toEqual({
      ok: false,
      cancelled: true,
      reason: 'High tasks cannot be deleted.',
    });
    expect(r.store.state.elements[id]).toBeDefined();

    const gateway = r.store.execute({
      type: 'createElement',
      class: SAMPLE.gateway,
      x: 0,
      y: 0,
    });
    expect(gateway).toMatchObject({
      ok: false,
      reason: 'Cancelled by a script.',
    });

    const effort = r.store.execute({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attEffort,
      value: -1,
    });
    expect(effort).toMatchObject({
      ok: false,
      reason: 'Effort cannot be negative.',
    });
    expect(
      r.store.execute({
        type: 'setAttribute',
        target: id,
        attr: SAMPLE.attEffort,
        value: 2,
      }).ok,
    ).toBe(true);
  });

  it('refuses to change the model from a "before" handler, with a clear error, and does not cancel', async () => {
    const r = await rig([
      script(
        `import { on, model } from "metakit";
         on("object.creating", () => { model.create("Task", { x: 1, y: 1 }); });`,
        'Greedy',
      ),
    ]);
    const id = r.addTask(0, 0);
    expect(r.store.state.elements[id]).toBeDefined();
    expect(lines(r).join('\n')).toMatch(
      /error: A before handler cannot run commands; it can only cancel\./,
    );
    expect(r.messages[0]?.text).toMatch(/^Greedy: A before handler/);
  });

  it('only fires for changes made here: a change that arrives from another instance runs nothing', async () => {
    const r = await rig([
      script(
        `import { on } from "metakit"; on("object.*", () => console.log("heard"));`,
      ),
    ]);
    const before = r.store.state;
    const next = JSON.parse(JSON.stringify(before));
    next.elements['el_remote'] = {
      id: 'el_remote',
      class: SAMPLE.task,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      attrs: {},
      pos: 'a',
    };
    r.store.applyRemote(next, [
      { path: ['elements', 'el_remote'], after: next.elements.el_remote },
    ]);
    expect(lines(r)).toEqual([]);
    r.addTask(0, 0);
    expect(lines(r)).toEqual(['log: heard', 'log: heard']);
  });

  it('rejects an unknown event name and a handler registered inside a handler', async () => {
    const r = await rig([
      script(
        `import { on } from "metakit"; on("object.exploded", () => {});`,
        'Bad event',
      ),
      script(
        `import { on } from "metakit"; on("object.created", () => { on("object.moved", () => {}); });`,
        'Late',
      ),
    ]);
    expect(lines(r)[0]).toMatch(/"object.exploded" is not an event/);
    r.addTask(0, 0);
    expect(lines(r).join('\n')).toMatch(/can only be used at the top level/);
  });
});

describe('the model API', () => {
  it('queries, creates, connects, updates and deletes through commands, in one undo step', async () => {
    const r = await rig([
      script(
        `import { model, commands } from "metakit";
         commands.register({ id: "build", label: "Build", run: () => {
           const a = model.create("Task", { x: 10, y: 20, attrs: { Name: "A", Priority: "High", Effort: 2 } });
           const b = model.create("Task", { x: 10, y: 120, attrs: { Name: "B" } });
           const c = model.connect("SequenceFlow", a, b, { Condition: "ok" });
           b.x = 300;
           b.update({ y: 150, attrs: { Name: "B2" } });
           console.log(model.objects("FlowNode").length, model.connectors().length, c.from.attrs.Name, c.to.attrs.Name);
           console.log(a.outgoing("SequenceFlow").map((o) => o.attrs.Name).join(","), b.incoming().length);
           console.log(JSON.stringify(a.attrs.Priority), a.attrs.Cost, b.x, b.y, b.parent);
           a.delete();
           console.log(model.objects().length, model.connectors().length);
         }});`,
      ),
    ]);
    const before = r.store.history().length;
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)).toEqual([
      'log: 2 1 A B2',
      'log: B2 1',
      'log: "High" 170 300 150 null',
      'log: 1 0',
    ]);
    expect(r.store.history()).toHaveLength(before + 1);
    r.store.undo();
    expect(Object.keys(r.store.state.elements)).toHaveLength(0);
  });

  it('reports a wrong class, attribute or value in plain English and leaves the model alone', async () => {
    const r = await rig([
      script(
        `import { model, commands } from "metakit";
         commands.register({ id: "bad", label: "Bad", run: () => {
           const t = model.create("Task", { x: 0, y: 0 });
           const attempts: (() => void)[] = [
             () => model.create("Nope" as any),
             () => model.create("FlowNode" as any),
             () => { (t.attrs as any).Nope = 1; },
             () => { (t.attrs as any).Effort = "lots"; },
             () => { (t.attrs as any).Cost = 5; },
             () => { (t.attrs as any).Priority = "Urgent"; },
             () => model.object(42 as any),
           ];
           for (const attempt of attempts) {
             try { attempt(); } catch (e) { console.log((e as Error).message); }
           }
         }});`,
      ),
    ]);
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    const out = lines(r);
    expect(out[0]).toMatch(/This Kit has no class "Nope"\. Classes: /);
    expect(out[1]).toMatch(/The class "FlowNode" is abstract/);
    expect(out[2]).toMatch(
      /Nope is not an attribute of the class "Task"\. Attributes: /,
    );
    expect(out[3]).toMatch(/"Effort" must be a number/);
    expect(out[4]).toMatch(/"Cost" is calculated and cannot be set/);
    expect(out[5]).toMatch(/"Priority" must be one of: Low, Medium, High/);
    expect(out[6]).toMatch(/must be an object of the model or its id/);
  });

  it('reads the selection and the meta-model of the Kit', async () => {
    const r = await rig([
      script(
        `import { model, kit, commands } from "metakit";
         commands.register({ id: "info", label: "Info", run: (target) => {
           console.log(model.selection().map((o) => o.id).join(","), target && target.id);
           const priority = kit.attribute("Task", "Priority");
           console.log(kit.name, kit.classes().map((c) => c.key).join(","));
           console.log(JSON.stringify(priority && priority.options), kit.class("Task").extends);
           console.log(kit.relation("SequenceFlow").from.join(","), kit.modelType("Process").classes.length);
         }});`,
      ),
    ]);
    const a = r.addTask(0, 0);
    // The engine asks the app for the selection; this rig has none, so the target alone is used.
    await r.engine.reload();
    r.commands.get('script:info')!.run(a);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lines(r)).toEqual([
      `log:  ${a}`,
      'log: Sample EndEvent,FlowNode,Gateway,Lane,StartEvent,Task',
      'log: ["Low","Medium","High"] FlowNode',
      'log: FlowNode 5',
    ]);
  });

  it('still runs a script written before the rename, which imports "tool", the same object as "kit"', async () => {
    const r = await rig([
      script(
        `import { kit, tool } from "metakit";
         import * as metakit from "metakit";
         console.log(kit === tool, Object.isFrozen(kit), metakit.tool === metakit.kit);
         console.log(tool.name, tool.classes().map((c) => c.key).join(","));
         console.log(tool.class("Task").extends, tool.relations().length, tool.modelTypes().length);`,
      ),
    ]);
    expect(r.messages).toEqual([]);
    expect(lines(r)).toEqual([
      'log: true true true',
      'log: Sample EndEvent,FlowNode,Gateway,Lane,StartEvent,Task',
      'log: FlowNode 1 1',
    ]);
  });
});

describe('dialogs', () => {
  it('goes through the host for every dialog', async () => {
    const asked: string[] = [];
    const r = await rig(
      [
        script(
          `import { ui, commands } from "metakit";
           commands.register({ id: "talk", label: "Talk", run: () => {
             ui.message("hello"); ui.warn("careful"); ui.error("oops");
             console.log(ui.confirm("Sure?"), ui.prompt("Name?", "x"), ui.choose("Which?", ["a", "b"]));
             console.log(JSON.stringify(ui.form([{ key: "n", label: "N", type: "number" }], "Settings")));
             const total = ui.progress("Working", (p) => { p.update(0.5, "half"); return 7; });
             console.log(total);
           }});`,
        ),
      ],
      {
        host: {
          confirm: (t) => (asked.push(`confirm ${t}`), true),
          prompt: (t, initial) => (asked.push(`prompt ${t} ${initial}`), 'Ada'),
          choose: (t, o) => (asked.push(`choose ${t} ${o.join('/')}`), o[1]!),
          form: (spec) => (
            asked.push(`form ${spec.title} ${spec.fields[0]!.key}`),
            { n: 3 }
          ),
          progress: (label) => ({
            update: (f, t) => void asked.push(`progress ${label} ${f} ${t}`),
            done: () => void asked.push('progress done'),
          }),
        },
      },
    );
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(r.messages).toEqual([
      { kind: 'info', text: 'hello' },
      { kind: 'warning', text: 'careful' },
      { kind: 'error', text: 'oops' },
    ]);
    expect(asked).toEqual([
      'confirm Sure?',
      'prompt Name? x',
      'choose Which? a/b',
      'form Settings n',
      'progress Working 0.5 half',
      'progress done',
    ]);
    expect(lines(r)).toEqual(['log: true Ada b', 'log: {"n":3}', 'log: 7']);
  });

  it('says so when the app cannot show a dialog', async () => {
    const r = await rig([
      script(
        `import { ui, commands } from "metakit";
         commands.register({ id: "t", label: "T", run: () => { ui.prompt("x"); } });`,
      ),
    ]);
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)[0]).toBe('error: This app cannot ask for text.');
  });
});

describe('files and web services need a permission', () => {
  const FILES: ScriptFiles = {
    read: (p) => Promise.resolve(`contents of ${p}`),
    write: () => Promise.resolve(),
    list: () => Promise.resolve(['a.txt']),
    exists: () => Promise.resolve(true),
  };
  const READ = `import { files, commands } from "metakit";
    commands.register({ id: "r", label: "R", run: async () => {
      console.log(await files.read("notes/a.txt"));
    }});`;

  it('refuses a Kit that does not declare the permission', async () => {
    const r = await rig([script(READ)], { files: FILES });
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)[0]).toMatch(
      /^error: This script tries to use files, but the Kit does not say it needs to\. Add the "files" permission/,
    );
  });

  it('refuses when the person has not allowed it in this browser', async () => {
    const r = await rig([script(READ)], {
      files: FILES,
      permissions: { files: true },
    });
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)[0]).toMatch(
      /^error: This script tries to use files, but you have not allowed that for this Kit in this browser\./,
    );
  });

  it('works when declared and allowed, with an undo step for what follows an await', async () => {
    const r = await rig([script(READ)], {
      files: FILES,
      permissions: { files: true },
      grant: { files: true, network: false },
    });
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)).toEqual(['log: contents of notes/a.txt']);
  });

  it('keeps scripts inside the workspace folder', async () => {
    const r = await rig(
      [
        script(
          `import { files, commands } from "metakit";
           commands.register({ id: "r", label: "R", run: async () => {
             for (const p of ["../secret.txt", "/etc/passwd", "a/../../b", "C:\\\\x"]) {
               try { await files.read(p); } catch (e) { console.log("refused"); }
             }
           }});`,
        ),
      ],
      {
        files: FILES,
        permissions: { files: true },
        grant: { files: true, network: false },
      },
    );
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)).toEqual([
      'log: refused',
      'log: refused',
      'log: refused',
      'log: refused',
    ]);
  });

  it('runs the dialogs of the host for open and save', async () => {
    const saved: string[] = [];
    const r = await rig(
      [
        script(
          `import { files, commands } from "metakit";
           commands.register({ id: "d", label: "D", run: async () => {
             const f = await files.open({ accept: [".csv"] });
             console.log(f && f.name, f && f.text);
             console.log(await files.save("out.csv", "a,b"));
           }});`,
        ),
      ],
      {
        permissions: { files: true },
        grant: { files: true, network: false },
        host: {
          openFile: () => Promise.resolve({ name: 'in.csv', text: 'x,y' }),
          saveFile: (n, t) => (saved.push(`${n}=${t}`), Promise.resolve(true)),
        },
      },
    );
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)).toEqual(['log: in.csv x,y', 'log: true']);
    expect(saved).toEqual(['out.csv=a,b']);
  });

  const CALL = `import { http, commands } from "metakit";
    commands.register({ id: "h", label: "H", run: async () => {
      const data = await http.json<{ n: number }>("https://example.com/api?q=1");
      console.log(data.n);
      const res = await http.post("https://example.com/x", { a: 1 });
      console.log(res.status, res.ok, res.text());
      try { await http.get("file:///etc/passwd"); } catch (e) { console.log((e as Error).message); }
    }});`;
  const HTTP = (seen: string[]): ScriptHttp => ({
    request: (req) => {
      seen.push(
        `${req.method} ${req.url} ${req.body ?? ''} ${req.headers['Content-Type'] ?? ''}`,
      );
      return Promise.resolve(
        req.method === 'GET'
          ? { status: 200, headers: {}, text: '{"n":42}' }
          : { status: 201, headers: {}, text: 'made' },
      );
    },
  });

  it('calls web services only with the network permission', async () => {
    const seen: string[] = [];
    const denied = await rig([script(CALL)], { http: HTTP(seen) });
    await denied.engine.runScript(Object.keys(denied.kit.scripts)[0]!, null);
    expect(lines(denied)[0]).toMatch(/does not say it needs to/);
    expect(seen).toEqual([]);

    const allowed = await rig([script(CALL)], {
      http: HTTP(seen),
      permissions: { network: true },
      grant: { network: true, files: false },
    });
    await allowed.engine.runScript(Object.keys(allowed.kit.scripts)[0]!, null);
    expect(lines(allowed)).toEqual([
      'log: 42',
      'log: 201 true made',
      'log: Scripts can only call web addresses that start with http:// or https://.',
    ]);
    expect(seen).toEqual([
      'GET https://example.com/api?q=1  ',
      'POST https://example.com/x {"a":1} application/json',
    ]);
  });
});

describe('limits and failures', () => {
  it('stops a runaway handler with a plain message, then recreates the sandbox for the other scripts', async () => {
    const r = await rig(
      [
        script(
          `import { on } from "metakit"; on("object.created", () => { while (true) {} });`,
          'Loop',
        ),
        script(
          `import { on } from "metakit"; on("object.created", () => console.log("still here"));`,
          'Fine',
        ),
      ],
      { limits: { handlerMs: 60 } },
    );
    const started = performance.now();
    const id = r.addTask(0, 0);
    expect(performance.now() - started).toBeLessThan(2000);
    // The action itself was not blocked.
    expect(r.store.state.elements[id]).toBeDefined();
    expect(r.messages[0]).toEqual({
      kind: 'error',
      text: 'Loop: The script took longer than 60 ms and was stopped.',
    });
    expect(
      r.engine.log.find((l) => l.level === 'error' && l.scriptName === 'Loop'),
    ).toBeDefined();
    await r.engine.ready();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await r.engine.ready();
    expect(
      r.engine.status(Object.keys(r.kit.scripts)[0] as ScriptId),
    ).toMatchObject({
      state: 'stopped',
    });
    // The restarted sandbox runs the script that did no harm and leaves out the one that did.
    r.engine.clearLog();
    r.addTask(5, 5);
    expect(lines(r)).toEqual(['log: still here']);
  });

  it('stops a memory bomb in a command and reports it', async () => {
    const r = await rig(
      [
        script(
          `import { commands } from "metakit";
           commands.register({ id: "m", label: "M", run: () => {
             const keep: number[][] = [];
             for (;;) keep.push(new Array(100000).fill(1));
           }});`,
        ),
      ],
      { limits: { runMs: 5000 } },
    );
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(r.messages.at(-1)?.text).toMatch(
      /used more memory than it is allowed/,
    );
  });

  it('reports a compile error with its line and keeps the other scripts running', async () => {
    const bad = script('import { on } from "metakit";\non((', 'Broken');
    const good = script(
      'import { on } from "metakit"; on("object.created", () => console.log("ok"));',
      'Good',
    );
    const r = await rig([bad, good]);
    expect(r.engine.status(bad.id)).toMatchObject({ state: 'error', line: 2 });
    expect(r.engine.status(good.id).state).toBe('running');
    expect(r.engine.log.find((l) => l.scriptId === bad.id)?.line).toBe(2);
    r.addTask(0, 0);
    expect(lines(r)).toContainEqual('log: ok');
  });

  it('reports a runtime error with the line it came from and rolls back a command', async () => {
    const r = await rig([
      script(
        `import { model, commands } from "metakit";
commands.register({ id: "x", label: "X", run: () => {
  model.create("Task", { x: 0, y: 0 });
  throw new Error("went wrong");
}});`,
        'Thrower',
      ),
    ]);
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    const error = r.engine.log.find((l) => l.level === 'error')!;
    expect(error).toMatchObject({
      text: 'went wrong',
      line: 4,
      scriptName: 'Thrower',
    });
    // The half-done work of a failed command is not kept.
    expect(Object.keys(r.store.state.elements)).toHaveLength(0);
  });

  it('keeps the newest 500 console lines, with timestamps and script names, and lets a view subscribe', async () => {
    const r = await rig([
      script(
        `import { commands } from "metakit";
         commands.register({ id: "spam", label: "Spam", run: () => { for (let i = 0; i < 600; i++) console.log("line " + i); } });`,
        'Spammer',
      ),
    ]);
    let heard = 0;
    r.engine.onLog(() => heard++);
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(r.engine.log).toHaveLength(500);
    expect(r.engine.log[0]!.text).toBe('line 100');
    expect(r.engine.log.at(-1)).toMatchObject({
      text: 'line 599',
      level: 'log',
      scriptName: 'Spammer',
    });
    expect(r.engine.log.at(-1)!.time).toBeGreaterThan(0);
    expect(heard).toBeGreaterThanOrEqual(600);
    r.engine.clearLog();
    expect(r.engine.log).toHaveLength(0);
  });

  it('runs a script that has no command again by hand, once, in a sandbox of its own, keeping no handlers from that run', async () => {
    const r = await rig([
      script(
        `import { model, ui, on } from "metakit";
         on("object.created", () => console.log("heard"));
         await Promise.resolve();
         ui.message("There are " + model.objects().length + " objects.");`,
        'Once',
      ),
    ]);
    const id = Object.keys(r.kit.scripts)[0]!;
    // The top level of every enabled script runs when the Kit is loaded; top-level await works.
    expect(r.messages).toEqual([
      { kind: 'info', text: 'There are 0 objects.' },
    ]);
    r.addTask(0, 0);
    expect(lines(r)).toEqual(['log: heard']);
    r.engine.clearLog();
    await r.engine.runScript(id, null);
    expect(r.messages.at(-1)).toEqual({
      kind: 'info',
      text: 'There are 1 objects.',
    });
    expect(lines(r)).toEqual([
      'warn: on("object.created") was ignored: this run only runs the script once.',
    ]);
    // Only the handler of the load is listening, not one more from the run.
    r.engine.clearLog();
    r.addTask(0, 0);
    expect(lines(r)).toEqual(['log: heard']);
  });

  it('leaves disabled scripts off', async () => {
    const off = script(
      'import { on } from "metakit"; on("object.created", () => console.log("heard"));',
      'Off',
      { enabled: false },
    );
    const r = await rig([off]);
    r.addTask(0, 0);
    expect(lines(r)).toEqual([]);
    expect(r.engine.status(off.id).state).toBe('disabled');
  });

  it('gives a script no way to the host except the metakit module', async () => {
    const r = await rig([
      script(
        `import { commands } from "metakit";
         commands.register({ id: "probe", label: "Probe", run: () => {
           const g = globalThis as Record<string, unknown>;
           console.log(["__host", "__host_async", "require", "fetch", "process", "window", "setTimeout"].map((n) => typeof g[n]).join(","));
           console.log(Object.getOwnPropertyNames(globalThis).filter((n) => n.startsWith("__")).sort().join(","));
           for (const name of ["__fire", "__run", "__settle", "console"]) {
             try { g[name] = () => 1; console.log(name + " was replaced"); } catch (e) { console.log(name + " is locked"); }
           }
           console.log(String(new Function("return typeof this.__host")()), String(eval("typeof __host_async")));
           console.log("x".repeat(20000).length);
         }});`,
      ),
    ]);
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    expect(lines(r)).toEqual([
      'log: undefined,undefined,undefined,undefined,undefined,undefined,undefined',
      'log: __fire,__loadScript,__run,__runOnce,__setOneShot,__settle',
      'log: __fire is locked',
      'log: __run is locked',
      'log: __settle is locked',
      'log: console is locked',
      'log: undefined undefined',
      'log: 20000',
    ]);
  });

  it('cuts a console line that is enormous', async () => {
    const r = await rig([
      script(
        `import { commands } from "metakit";
         commands.register({ id: "big", label: "Big", run: () => { console.log("y".repeat(50000)); } });`,
      ),
    ]);
    await r.engine.runScript(Object.keys(r.kit.scripts)[0]!, null);
    const text = r.engine.log[0]!.text;
    expect(text.length).toBeLessThan(10_100);
    expect(text).toMatch(/… \(40000 more characters\)$/);
  });

  it('does not touch the sandbox code when no script is enabled', async () => {
    const r = await rig([]);
    expect(r.engine.status('scr_none' as ScriptId).state).toBe('running');
    expect(r.commands.list()).toEqual([]);
  });
});
