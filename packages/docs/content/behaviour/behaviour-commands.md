---
id: behaviour-commands
title: Commands (menu items from rules and scripts)
category: behaviour
summary: How rules and scripts add entries to the Commands menu, the toolbar and the right-click menu.
keywords: [behaviour command, custom command, commands registry, toolbar command, right-click command, command rule, action attribute]
contexts: []
order: 90
---

A command is something a person starts by hand: "Check pipeline", "Mark ready", "Total effort". A Kit adds commands with [[rules]] and with [[scripts]]. They appear in Model mode next to the built-in controls.

## What it is

The open model keeps a list of commands, called the command registry. Two sources fill it.

| Source | How a command is made | Id in the list |
| --- | --- | --- |
| Rule | A rule with the event "A person runs it (a command or button)". | The id of the rule, such as `rule_ready` |
| Script | `commands.register({ id, label, ... })` at the top level of the script. | `script:` plus the id you gave, such as `script:check-pipeline` |

Each command has a label (the text people see) and a place:

| Place | Where it appears |
| --- | --- |
| Model menu | In the **Commands** menu of the model toolbar. The menu is shown only when at least one command is placed there. |
| Toolbar | As a button on the model toolbar, right after the model name. |
| Right-click menu | In the menu that opens when you right-click in the model. |

The list is sorted by label. When rules or scripts are reloaded, their old commands are removed and the new ones added, so the menus follow the Kit.

## Where to find it

- Make a command rule: Build mode, **Rules**, event "A person runs it", then fill in **Name in the menu** and **Where it appears**. See [[rules]].
- Make a script command: Build mode, **Scripts**, and call `commands.register(...)`. See [[script-api]].
- Use a command: open a model of that Kit in Model mode. Look in the toolbar, in **Commands**, or right-click an object. See [[model-toolbar]] and [[context-menu]].

## How to use it

1. Select an object if the command is about one. The command receives the selected object (the first one, if several are selected). With nothing selected it receives nothing.
2. Press the toolbar button, choose the entry in **Commands**, or right-click and choose the entry.
3. Read the result: a message, a change on the canvas, or both. Press **Undo** to take back what the command did. A command is one undo step. See [[undo-redo]].

## Every option explained

### Command rules

| Setting | Effect |
| --- | --- |
| **Name in the menu** | The label of the entry. Give it a short verb phrase. |
| **Where it appears** | **Model menu**, **Toolbar** or **Right-click menu**. A new command rule starts with the right-click menu. |
| **If** | The rule runs only when the condition is true for the selected object. Otherwise nothing happens and no message appears. |
| Switch in the rule list | A rule that is switched off adds no command. |

A command rule cannot be limited to a class. It appears for every selection. Put a check in **If** that only the right class passes, such as `= Priority != null`.

If the command needs an object (it reads `self` or sets an attribute on "this object") and nothing is selected, the rule shows: `Rule "Name": there is no object to change.`

### Script commands

| Field | Meaning |
| --- | --- |
| `id` | Letters, digits, dots, dashes and underscores. Another command with the same id replaces it. |
| `label` | The text people see. |
| `menu` | `true` or any text puts the command in the **Commands** menu. The text itself is not used to build sub-menus. |
| `toolbar` | `true` puts a button on the toolbar. |
| `context` | `true` puts it in the right-click menu. |
| `run(target)` | The code. `target` is the selected object, a connector, or `null`. It may be `async`. |

If you set none of `menu`, `toolbar` and `context`, the command goes to the **Commands** menu. If you set several, the command appears in each place. The ids then end with the place, for example `script:export:toolbar`.

A script command runs in one undo step. If it waits for a file or a web call with `await`, the changes after the wait are a second step. Limits are in [[scripts]].

### Buttons in the attribute panel

An attribute of the type "button" (action) can point to a rule, a command or a script. When a person presses it in the attribute panel, MetaKit runs it on the selected object.

| Kind | What runs |
| --- | --- |
| rule | The rule with that id, as a command rule. |
| command | The command with that id or label. |
| script | The script with that id. |

See [[attribute-panel]] and [[field-types]].

### Running a command from a rule

The action **Run a command** starts a command by label or id. The command then runs on the object the rule is about. See [[rule-actions]].

## Examples

- "Check pipeline" (script, Model menu) in the Agent pipeline Kit checks the whole model and shows one message with all problems. See [[script-examples]].
- "Mark ready" (rule, Toolbar) sets the status of the selected task.
- "Total effort" (rule, Model menu) shows the sum of all task efforts.

## Good to know

- **Same names.** Two commands with the same label both appear. Give them different labels.
- **Menus update by themselves.** When a script or rule is switched off, its commands go away. You do not need to reload.
- **Commands are local.** Running a command changes the model like any edit. The result reaches other people through [[sync-overview]]. The command itself is not sent.
- **Permissions.** A script command that uses files or the web needs the permissions in [[script-permissions]].
- **Not for events.** Commands are started by people. To react to changes, use [[rule-triggers]].

## Related

[[rules]] · [[scripts]] · [[rule-actions]] · [[script-api]] · [[menu-commands]] · [[model-toolbar]] · [[context-menu]]
