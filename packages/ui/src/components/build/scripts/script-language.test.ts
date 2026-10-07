import { beforeAll, describe, expect, it } from 'vitest';
import { generateDeclarations } from '@metakit-app/behaviour';
import { SAMPLE, sampleTool } from '@metakit-app/core/testing';
import type { ToolLibrary } from '@metakit-app/core';
import { createLanguageServer, type LanguageServer } from './script-language';
import { loadTestLibs as loadLibs } from './test-libs';

/** The plan's script, word for word. */
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

function tool(): ToolLibrary {
  const t = sampleTool();
  t.classes[SAMPLE.task]!.attributes.push({
    id: 'att_number',
    key: 'Number',
    type: 'integer',
  });
  return t;
}

let server: LanguageServer;
beforeAll(() => {
  server = createLanguageServer(loadLibs());
  server.setDeclarations(generateDeclarations(tool()));
});

const messages = (source: string) =>
  server.diagnostics(source).map((d) => d.message);

describe('the script language service', () => {
  it('finds no problem in the "Renumber tasks" script of the plan', () => {
    expect(messages(RENUMBER)).toEqual([]);
  });

  it('knows that task.attrs.Priority is one of the choices', () => {
    expect(
      messages(`import { model } from "metakit";
const task = model.objects("Task")[0]!;
const p: "Low" | "Medium" | "High" | null = task.attrs.Priority;
task.attrs.Priority = "High";`),
    ).toEqual([]);
    const wrong = messages(`import { model } from "metakit";
const task = model.objects("Task")[0]!;
task.attrs.Priority = "Urgent";`);
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toMatch(/"Urgent"/);
  });

  it('reports a wrong class, attribute, event, filter and number type', () => {
    const out = messages(`import { on, model } from "metakit";
model.objects("Nope");
const t = model.objects("Task")[0]!;
t.attrs.Missing = 1;
t.attrs.Effort = "lots";
on("object.exploded", () => {});
on("object.created", { class: "Nope" }, () => {});`);
    expect(out.length).toBeGreaterThanOrEqual(5);
    expect(out.join('\n')).toMatch(/"Nope"/);
    expect(out.join('\n')).toMatch(/Missing/);
    expect(out.join('\n')).toMatch(/object\.exploded/);
  });

  it('refuses to assign a calculated attribute', () => {
    expect(
      messages(`import { model } from "metakit";
model.objects("Task")[0]!.attrs.Cost = 5;`).join('\n'),
    ).toMatch(/read-only/);
  });

  it('types event payloads: moved gives old and new positions', () => {
    expect(
      messages(`import { on } from "metakit";
on("object.moved", { class: "Task" }, (e) => {
  const dx: number = e.new.x - e.old.x;
  return void dx;
});`),
    ).toEqual([]);
  });

  it('allows a "before" handler to cancel and rejects a cancel from an "after" handler', () => {
    expect(
      messages(`import { on, cancel } from "metakit";
on("object.deleting", { class: "Task" }, () => cancel("No"));
on("attribute.changing", { attribute: "Effort" }, (e) => { if ((e.new as number) < 0) return false; });`),
    ).toEqual([]);
    expect(
      messages(`import { on } from "metakit";
on("object.created", () => false);`).length,
    ).toBeGreaterThan(0);
  });

  it('knows the console but not the browser or timers', () => {
    expect(messages('console.log("hi", 1, { a: 1 });')).toEqual([]);
    expect(messages('setTimeout(() => {}, 1);').join('\n')).toMatch(
      /setTimeout/,
    );
    expect(messages('document.title;').join('\n')).toMatch(/document/);
    expect(messages('fetch("x");').join('\n')).toMatch(/fetch/);
  });

  it('allows top-level await and async commands', () => {
    expect(
      messages(`import { commands, files } from "metakit";
const text = await files.read("a.txt");
commands.register({ id: "x", label: "X", run: async () => { await files.write("b.txt", text); } });`),
    ).toEqual([]);
  });

  it('reports a syntax error with its position', () => {
    const d = server.diagnostics('const a = ;\n');
    expect(d[0]).toMatchObject({ severity: 'error', from: 10 });
  });

  it('completes the attribute keys of a task, class names inside the quotes, and array methods', () => {
    const attrs = `import { model } from "metakit";\nconst t = model.objects("Task")[0]!;\nt.attrs.`;
    const names = (src: string, pos = src.length) =>
      server.completions(src, pos)?.items.map((i) => i.label) ?? [];
    expect(names(attrs)).toEqual(
      expect.arrayContaining(['Name', 'Priority', 'Effort', 'Cost', 'Number']),
    );
    expect(names(attrs)).not.toContain('GatewayKind');

    const classes = `import { model } from "metakit";\nmodel.objects("`;
    expect(names(classes)).toEqual(expect.arrayContaining(['Task', 'Gateway']));

    const array = `const xs = [1, 2, 3];\nxs.fil`;
    expect(names(array)).toEqual(expect.arrayContaining(['filter']));
    expect(server.completions(array, array.length)?.from).toBe(
      array.length - 3,
    );
  });

  it('completes the choice values of Priority and the event names', () => {
    const names = (src: string) =>
      server.completions(src, src.length)?.items.map((i) => i.label) ?? [];
    expect(
      names(
        `import { model } from "metakit";\nconst t = model.objects("Task")[0]!;\nt.attrs.Priority = "`,
      ),
    ).toEqual(expect.arrayContaining(['Low', 'Medium', 'High']));
    const src = `import { on } from "metakit";\non("object.cre`;
    expect(names(src)).toEqual(
      expect.arrayContaining(['object.created', 'object.moved']),
    );
    // The word being completed starts after the quote, dot included.
    expect(server.completions(src, src.length)?.from).toBe(
      src.indexOf('object'),
    );
  });

  it('gives hover information with the type', () => {
    const src = `import { model } from "metakit";\nconst t = model.objects("Task")[0]!;\nt.attrs.Priority;`;
    const info = server.quickInfo(src, src.lastIndexOf('Priority') + 2);
    expect(info?.text).toContain('"Low" | "Medium" | "High"');
    expect(
      server.quickInfo(src, src.indexOf('model.objects') + 1)?.text,
    ).toContain('model');
  });

  it('gives the details of a completion entry', () => {
    const src = `import { model } from "metakit";\nconst t = model.objects("Task")[0]!;\nt.attrs.`;
    expect(server.details(src, src.length, 'Effort')?.text).toContain('number');
  });

  it('follows a change of the tool: new declarations, new names', () => {
    const other = sampleTool();
    other.classes = {};
    other.relations = {};
    other.modelTypes = {};
    const s = createLanguageServer(loadLibs());
    s.setDeclarations(generateDeclarations(other));
    expect(
      s.diagnostics(`import { model } from "metakit";\nmodel.objects("Task");`)
        .length,
    ).toBeGreaterThan(0);
    s.setDeclarations(generateDeclarations(tool()));
    expect(
      s.diagnostics(`import { model } from "metakit";\nmodel.objects("Task");`),
    ).toEqual([]);
  });
});
