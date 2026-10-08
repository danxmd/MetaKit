---
id: script-api
title: Script API
category: behaviour
summary: Every function, event and type of the metakit module that scripts import.
keywords: [script api, metakit module, model.objects, ui.message, commands.register, script functions, script types]
contexts: []
order: 50
---

Scripts import everything from one module called `metakit`. This page lists all of it. The editor knows the same list and fits it to your tool library, so `model.objects("Task")` completes with your own class names. See [[script-editor]].

## What it is

The module has these exports:

```ts
import { on, cancel, model, tool, ui, files, http, commands } from "metakit";
```

Everything crosses a narrow bridge as plain JSON. The host checks every request again (names, permissions, sizes), so a script gains nothing by trying to reach the bridge by other means.

## Where to find it

You write the code in the **Scripts** section of Build mode (see [[scripts]]). Type `model.` in the editor to see the list with documentation as you type.

## How to use it

1. Start the script with `import { ... } from "metakit";`.
2. At the top level of the script, register handlers with `on(...)` and commands with `commands.register(...)`. Calling them inside a handler fails with `on() can only be used at the top level of a script, not inside a handler.`
3. Inside handlers and commands, read and change the model with `model`, talk to the person with `ui`.
4. Return `cancel("reason")` from a "before" handler to stop the action.

## Every option explained

### `on` and `cancel`

| Function | What it does |
| --- | --- |
| `on(event, handler)` | Runs `handler(payload)` each time `event` is announced. |
| `on(event, filter, handler)` | Same, limited by a filter: `{ class }`, `{ relation }` and `{ attribute }` where the event supports them. Names are keys, such as `"Task"`. |
| `cancel(reason?)` | Returns `{ cancel: reason }`. Default reason: `Cancelled by a script.` |

A handler for a "before" event may return `cancel("...")`, `{ cancel: "..." }` or `false`. Other results are ignored. The seven before events are `model.creating`, `model.deleting`, `object.creating`, `object.deleting`, `connector.creating`, `attribute.changing` and `view.changing`. A handler may be `async`. An async handler cannot cancel, because the answer must arrive at once.

The event name `"*"` and patterns such as `"object.*"` also work at run time, but the type checker does not know them. An unknown name fails with `"x" is not an event. The events are: ...`. A filter with another key fails with `The filter "k" is not known. Use class, attribute or relation.`

### The events

All 24 are described in [[rule-triggers]]. Every payload has `event`, `target` (an id or null) and `user`.

| Event | Payload fields besides the base | Filters |
| --- | --- | --- |
| `object.creating` | `class`, `new: {x, y}` | class |
| `object.created`, `object.deleting`, `object.deleted` | `class`, `object` (null if deleted) | class |
| `object.moved` | `old: {x, y}`, `new: {x, y}`, `object` | class |
| `object.resized` | `old: {w, h}`, `new: {w, h}`, `object` | class |
| `object.renamed` | `attribute`, `old`, `new`, `object` | class |
| `connector.creating`, `connector.created` | `relation`, `from`, `to`, `connector` | relation |
| `connector.reconnected` | `end: "from" or "to"`, `old`, `new` (object ids), `connector` | relation |
| `attribute.changing`, `attribute.changed` | `attribute`, `old`, `new`, `object` or `connector` | class, relation, attribute |
| `table.rowAdded`, `table.rowRemoved` | as above plus `row` (index) | class, relation, attribute |
| `view.changing`, `view.changed` | `view` (id or null) | none |
| `selection.changed` | `selection` (list of ids) | none |
| `model.*`, `app.*` | base only | none |

`payload.object` and `payload.connector` are read when you use them and are `null` when the thing no longer exists.

### `model`

| Member | Meaning |
| --- | --- |
| `model.objects(cls?)` | Objects of a class and its subclasses, or all. Bottom of the drawing order first. |
| `model.object(id)` | The object with that id, or `null`. |
| `model.connectors(relation?)` | Connectors of a relation class and its subclasses, or all. |
| `model.selection()` | The selected objects and connectors. |
| `model.create(cls, options?)` | Makes an object. Options: `x`, `y`, `w`, `h`, `parent` (object or id), `attrs`. Returns it. |
| `model.connect(relation, from, to, attrs?)` | Makes a connector. `from` and `to` are objects or ids. |
| `model.update(target, patch)` | Changes an object or connector. Patch: `x`, `y`, `w`, `h`, `attrs`. |
| `model.delete(target)` | Deletes an object or connector. |
| `model.attrs` | The attributes of the model itself. |

### `ModelObject`

| Member | Meaning |
| --- | --- |
| `id`, `class` | Id and class key. `class` is a union of the class and its subclasses. |
| `x`, `y`, `w`, `h` | Position and size. You may assign to them. |
| `attrs` | Attributes by key. `task.attrs.Priority = "High"` writes. An empty value reads as `null`. |
| `parent` | The container, or `null`. |
| `children()` | Objects inside it. |
| `incoming(relation?)` | Objects with a connector to this one. |
| `outgoing(relation?)` | Objects this one points to. |
| `connectors(relation?)` | Connectors on either end. |
| `update(patch)` | Changes it. Patch: `x`, `y`, `w`, `h`, `attrs`, and `parent` (an object, an id, or `null` to take it out of its container). |
| `delete()` | Deletes it. |

### `Connector`

`id`, `relation`, `from`, `to` (objects), `attrs`, `update({ attrs })` and `delete()`.

### Attribute values

| Attribute type | Script value |
| --- | --- |
| text, date, date-time, duration, link | `string` |
| integer, number | `number` |
| boolean | `boolean` |
| choice | One of its option values (a union of strings) |
| multi-choice | A list of option values |
| table | A list of rows; each row is an object by column key |
| reference | A list of object ids |
| formula | Read only. The calculated value. |
| action (button) | Not available |

Writing checks the value. A wrong one fails with `The attribute "X" ...`, for example about a type or a choice that is not an option. Writing a formula attribute fails with `The attribute "X" is calculated and cannot be set.`

### `tool`

Read-only facts about the meta-model: `tool.name`, `tool.version`, `tool.classes()`, `tool.class(key)`, `tool.relations()`, `tool.relation(key)`, `tool.modelTypes()`, `tool.modelType(key)` and `tool.attribute(owner, key)`. They return `ClassInfo`, `RelationInfo`, `ModelTypeInfo` and `AttributeInfo` records. `ClassInfo.attributes` includes inherited attributes.

### `ui`

| Function | Meaning |
| --- | --- |
| `ui.message(text, kind?)` | Shows a message. `kind` is `"info"`, `"warning"` or `"error"`. |
| `ui.warn(text)`, `ui.error(text)` | Shortcuts. |
| `ui.confirm(text)` | Yes or no. Returns a boolean. |
| `ui.prompt(text, initial?)` | Asks for a line. `null` if cancelled. |
| `ui.choose(text, options)` | Picks one option. `null` if cancelled. |
| `ui.form(fields, title?)` | A form with `text`, `number`, `boolean` and `choice` fields. |
| `ui.progress(label, work)` | Shows progress while `work(progress)` runs. `progress.update(fraction, text?)`. |

> **Note:** The web app currently provides messages, `confirm`, `prompt` and `choose`. `ui.form` fails with `This app cannot show a form.` and `ui.progress` shows nothing. These two are in the API for later.

### `files`

Needs the `files` permission. All functions return a promise.

| Function | Meaning |
| --- | --- |
| `files.read(path)` | Text of a file in the workspace. |
| `files.write(path, text)` | Creates a new file. |
| `files.list(folder?)` | Names in a folder. |
| `files.exists(path)` | True or false. |
| `files.open(options?)` | Open-file dialog. Not provided by the web app yet: `This app cannot show an open-file dialog.` |
| `files.save(name, text)` | Save-as dialog. Not provided by the web app yet: `This app cannot show a save-file dialog.` |

Paths are written like `reports/tasks.csv`, without `..` or a drive letter, or the call fails with `A file path must be inside the workspace, ...`. Files and folders that start with `_` belong to MetaKit and are refused. `files.write` never replaces a file: `"x" already exists. Scripts can create new files but cannot replace existing ones; choose another name.`

### `http`

Needs the `network` permission. Requests go out with no cookies and no credentials.

| Function | Meaning |
| --- | --- |
| `http.get(url, options?)` | GET. |
| `http.post(url, body?, options?)`, `http.put(...)` | Send a body. An object is sent as JSON with the right header. |
| `http.delete(url, options?)` | DELETE. |
| `http.json(url, options?)` | GET and parse JSON. Fails for a status that is not a success. |

A response has `status`, `ok`, `headers`, `text()` and `json()`. Only `http:` and `https:` addresses work. A browser only lets a page read answers from services that allow it, so many services will fail.

### `commands`

`commands.register({ id, label, menu?, toolbar?, context?, run })`. The `id` uses letters, digits, dots, dashes and underscores. See [[behaviour-commands]]. `run(target)` receives the selected object, a connector, or `null`, and may be `async`.

## Examples

```ts
import { model, ui } from "metakit";

const open = model.objects("Task").filter((t) => t.attrs.Status !== "Done");
for (const task of open) {
  if (task.incoming("Performs").length === 0)
    ui.warn(`Nobody performs "${task.attrs.Name}".`);
}
```

See [[script-examples]] for a longer one.

## Good to know

- **Errors.** Typical texts: `This tool has no class "X". Classes: A, B.`; `The object el_x does not exist in this model (it may have been deleted).`; `The class "X" is abstract; create one of its subclasses.`; `The change was cancelled: reason`.
- **Not allowed.** `The model itself cannot be deleted by a script.`, `A connector has attributes only; it has no position or size.`
- **Fresh reads.** Objects are looked up each time you read a field. Do not keep copies across an `await`; read again.
- **Keep calls short.** Time limits are in [[scripts]].

## Related

[[scripts]] · [[script-editor]] · [[script-permissions]] · [[script-console]] · [[rule-triggers]] · [[attribute-types]] · [[references]]
