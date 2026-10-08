---
id: scripts
title: Scripts
category: behaviour
summary: Scripts are small TypeScript programs in a tool library for the jobs that formulas and rules cannot do.
keywords: [scripts, typescript script, script sandbox, quickjs, script engine, scripts section]
contexts: [build.scripts]
order: 40
---

A script is a piece of TypeScript that belongs to a tool library. It can add menu commands, react to events, read and change the model, ask questions, and, with permission, read files or call web services. Use a script when [[rules]] are not enough, for example to look at the whole graph of a model.

## What it is

Scripts are the third level of behaviour after formulas and rules. They are written in TypeScript. When you save, MetaKit strips the types and runs the result inside a sealed box, a JavaScript engine called QuickJS compiled to WebAssembly. The box cannot touch the page, your files or the network by itself. Everything it does goes through a small set of safe functions, the [[script-api]].

Key facts:

- **One box per tool.** All enabled scripts of a tool library run in one sandbox. They are separate by function scope only and share one global object. Treat a tool's scripts as trusted as the tool is.
- **Only in your tab.** Scripts run in the browser tab where a change was made. Changes that arrive from other people never wake them (see [[sync-overview]]).
- **Only through commands.** A script changes the model only with the same commands as any edit. What a script does in one run is one undo step (see [[undo-redo]]).
- **Loaded when needed.** Nothing of the script engine downloads until a tool has an enabled script. The sandbox is about 236 KB compressed and the compiler about 46 KB. The code editor and its TypeScript checker (about 1 MB compressed) download only when you open a script editor. See [[performance-limits]].
- **Types are not checked at run time.** The editor checks types while you type. At run time only the syntax must be right.

## Where to find it

Open a tool library in Build mode (see [[page-build-view]]) and choose **Scripts** in the section list. The page says: "Scripts are TypeScript for what formulas and rules cannot do. They run only in the browser where a change was made, and they can only change the open model through commands, so everything they do can be undone."

The page has four parts: the list of scripts on the left, the editor and a console area on the right, and at the bottom the box **What the scripts of this tool may do**.

> **Note:** Build mode and an open model are never open together in this version. Scripts run only in a model, so the console area and the **Run** button of this page become useful only when scripts are running next to it. Today you test a script in Model mode.

## How to use it

1. Press **Add a script**. A script called "New script" with a small template opens. A second one is "New script 2", and so on.
2. Rename it with **Rename**. Names must not be empty, must be under 80 characters and must be unique (`There is already a script called "X".`).
3. Write code in the editor. Completion and error marks come from your tool's classes and attributes. See [[script-editor]].
4. Your text is saved about 0.6 seconds after you stop typing. One pause makes one undo step in Build mode.
5. If the script needs files or the web, tick the matching box under **What the scripts of this tool may do**. See [[script-permissions]].
6. To try the script, open a model made with this tool. Scripts run only while a model is open. Their commands are in the **Commands** menu or the toolbar. See [[behaviour-commands]].
7. In the model, press **Script console** in the toolbar to see output and errors. See [[script-console]].
8. Go back to Build mode to fix the script, then open the model again.

The template shows the usual shape of a script:

```ts
import { on, model, ui, commands } from "metakit";

commands.register({
  id: "count-objects",
  label: "Count objects",
  menu: "Model",
  run: () => {
    ui.message(`There are ${model.objects().length} objects.`);
  },
});
```

## Every option explained

### The list

| Item | What it does |
| --- | --- |
| Switch **Run X** | Turns the script on or off. An off script is not loaded. |
| Script name | Opens the script in the editor. |
| **Rename** | Renames in place. Enter confirms, Escape cancels. |
| **Delete** | Asks `Delete the script "X"? You can undo this.` |
| **Add a script** | Adds a script from the template. |
| **Draft with assistant** | Only when the assistant is on. See [[assistant-drafts]]. |
| **Run** | Above the editor, for a script that registers a command. It runs the command on the selected object. Shown only while scripts are running. |
| Note under a name | The state of the script, see below. It shows when the scripts are running. |

### Script states

| State | When | Note shown |
| --- | --- | --- |
| Running | Loaded and listening. | none |
| Off | The switch is off. | none |
| Error | It does not compile, or its top level failed. | `Problem on line 12: ...` |
| Stopped | It used too much time, memory or stack. | `This script was stopped because it used too much time or memory. Change it, or run it again by hand.` or the exact reason, such as `The script took longer than 100 ms and was stopped.` |

A stopped script stays off until you change its source or press **Run** on it again. The other scripts reload into a fresh sandbox without it. The action that woke it is not blocked.

### When code runs

1. **Loading.** When the model opens, and whenever the scripts or permissions of the tool change, every enabled script is compiled and its top level runs once, in order of name. The top level is where `on(...)` and `commands.register(...)` belong.
2. **Handlers.** `on("object.created", ...)` runs each time that event is announced.
3. **Commands.** A command runs when a person chooses it, or when a rule runs it.
4. **Run by hand.** The **Run** button, the action **Run a script** and an action attribute start a script. If the script registered a command, its first command runs. If not, the top level runs once in a throw-away sandbox, and any `on(...)` in it is ignored with a console warning.

### Limits

| Limit | Value |
| --- | --- |
| One event handler | 100 ms |
| One command, or loading one script | 5 seconds |
| A run that waits for files or web | gives up after 60 seconds |
| Memory for the script | 16 MB (on top of the engine itself) |
| Stack | 256 KB |
| Text moved to or from a file or web call | 5,000,000 characters |
| Console | the last 500 lines, each up to 10,000 characters |

Time spent inside MetaKit's own functions is not counted by the clock, so every function in the API is kept short.

## Examples

**A command.** The "Check pipeline" script of the Agent pipeline tool adds a command to the Model menu. It looks for tasks nobody performs, artifacts from nowhere and loops in the hand-overs, then shows one message with all problems. See [[script-examples]].

**An event handler.**

```ts
import { on, ui } from "metakit";

on("attribute.changing", { class: "Task", attribute: "Status" }, (event) => {
  if (event.new === "Done" && event.object?.attrs.Owner == null) {
    return { cancel: "Give the task an owner first." };
  }
});
```

**Reading the model.**

```ts
import { commands, model, ui } from "metakit";

commands.register({
  id: "late-tasks",
  label: "Late tasks",
  run: () => {
    const late = model.objects("Task").filter((t) => t.attrs.Status !== "Done");
    ui.message(`${late.length} tasks are not done.`);
  },
});
```

## Good to know

- **Errors never lock you out.** A script that throws in a "before" handler is reported in the console and as a message. It does not cancel the action.
- **Imports.** The only module is `metakit`. `import x from "other"` fails with `Cannot find module "other". Scripts can only import from "metakit".`
- **No browser objects.** There is no `window`, `document`, `fetch` or `setTimeout`. Use `http` for the web. See [[script-api]].
- **Permissions need two keys.** The tool must declare `network` or `files`, and each browser must allow it. See [[script-permissions]].
- **Never put secrets in a script.** Scripts are part of the tool library and are shared in the workspace folder, in Git, and in tool packages.
- **Several people.** Each script is merged as one unit. Two people editing two scripts do not clash. Two people editing the same script: the later save wins, so tell each other. See [[conflicts-and-merging]].
- **In Git.** In Git mode a script is two files, the source as `.ts` and the rest as `.json`. See [[git-layout]].

## Related

[[script-api]] · [[script-editor]] · [[script-console]] · [[script-permissions]] · [[script-examples]] · [[behaviour-commands]] · [[rules]] · [[troubleshooting]]
