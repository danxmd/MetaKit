---
id: script-editor
title: Script editor
category: behaviour
summary: The code editor for scripts, with completion, error marks and hover help that know your tool library.
keywords: [script editor, code editor, typescript language service, code completion, error marks, script source]
contexts: []
order: 60
---

The script editor is where you write the TypeScript of a [[scripts|script]]. It checks your code as you type and offers the class, relation and attribute names of the tool library you are editing.

## What it is

The editor is built on CodeMirror 6. The checking is done by the TypeScript language service, the same engine behind many code editors. It runs in a separate worker so that typing stays smooth.

Both parts download only when you open a script editor. A person who never edits scripts never loads them. Opening a model with scripts does not load them either, because running a script needs only the small compiler and the sandbox. See [[performance-limits]].

The editor knows a custom module called `metakit`. MetaKit writes its description from your tool library each time the library changes. If you add a class `Risk` in Build mode, `model.objects("Risk")` is suggested at once and a misspelt `"Rsik"` gets a red mark.

## Where to find it

In Build mode choose **Scripts**, then pick a script in the list (see [[scripts]]). The editor takes the right side of the page, with the [[script-console]] below it.

## How to use it

1. Click in the editor and type. Your text is saved a moment after you pause.
2. Press **Ctrl+Space** to open the suggestion list at any time. It also opens by itself as you type.
3. Move through the list with the arrow keys. Press **Enter** to take a suggestion, or **Escape** to close the list. A short note beside the highlighted item gives its type and documentation.
4. Hover over a word to see its type in a small box above it.
5. Look at the left edge. A mark in the gutter and a wavy line under the text show a problem. Hover over the line to read the message.
6. Press **Tab** to indent a line. Press **Ctrl+Z** and **Ctrl+Shift+Z** (or **Ctrl+Y**) to undo and redo inside the editor.

## Every option explained

| Feature | What it does |
| --- | --- |
| Line numbers | Show line numbers. They match the line numbers in the console, because the compiler keeps lines in place. |
| Active line | The line with the cursor is lightly marked. |
| Syntax colours | TypeScript colours. |
| Bracket matching and closing | Closing brackets and quotes are added. The matching bracket is marked. |
| Indent on input | Lines indent after a block opens. |
| Error marks | Errors and warnings from the TypeScript checker, with codes like `TS2322`. They refresh about 0.3 seconds after you stop typing. |
| Completion | Names of the module, your classes, relations and attributes, and the usual language words. |
| Hover help | The type or signature of what is under the pointer, and its documentation. |
| Editor history | Undo and redo of your typing. This is separate from the undo of Build mode. |

### What the checker knows

- The whole `metakit` module, see [[script-api]].
- Your tool library: class, relation class, model type and attribute names, and the type of each attribute. `task.attrs.Priority` is typed as the union of its choices, plus `null`.
- The language library for ES2022, and `console`.
- Nothing else. There are no timers, no `window`, no `fetch`.

### Types and the compiler

The checker is advice for you. When a script is saved or loaded, MetaKit only strips the types and runs the code. A type error does not stop a script. A syntax error does: the script goes into the Error state with `Problem on line N: ...`, see [[scripts]].

### When the checker is not available

If the worker cannot start (for example the download was blocked), the editor still works as a plain code editor. A note under it says `Completion and error checking are not available (reason). You can still edit the script.`

## Examples

- Type `model.objects("` and the list shows the class names of your tool library.
- Type `task.attrs.` and the list shows the attributes of a Task. Hover over `Priority` to see `"Low" | "Medium" | "High" | null`.
- Write `task.attrs.Priority = "Urgent"` and a red mark appears: `"Urgent"` is not one of the choices.
- Write `ui.form(...)` and the checker knows its fields, even though the web app does not show forms yet. See [[script-api]].

## Good to know

- **Undo from outside.** If you undo a script edit in Build mode (the **Undo** button of the page), the editor takes the new text. Your cursor may move.
- **Saved every pause.** A burst of typing is one undo step in Build mode. See [[undo-redo]].
- **Other people.** If another person changes the script while you edit it, the later save wins. The editor warns nobody. Agree on who edits which script. See [[conflicts-and-merging]].
- **Language service size.** It is the largest download in the app, about 1 MB compressed, and downloads only when the first script editor opens.
- **Accessibility.** The editor has the label "Script source" for screen readers.

## Related

[[scripts]] · [[script-api]] · [[script-console]] · [[script-permissions]] · [[assistant-drafts]] · [[keys-and-renaming]]
