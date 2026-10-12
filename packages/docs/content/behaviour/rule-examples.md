---
id: rule-examples
title: Rule examples
category: behaviour
summary: Worked rules from the sample Kits, with the form settings and the stored JSON.
keywords: [rule examples, example rules, mark ready rule, autonomous agents need a gate, total effort rule]
contexts: []
order: 35
---

This page walks through rules that really ship with the sample Kits in the repository folder `kits/`. They show the three usual shapes: a hint that reacts to a change, a status button, and a calculation on demand.

## What it is

Each example gives the settings as you would fill them in the rule form (see [[rules]]), then the JSON that is stored in the Kit. You do not need the JSON to build rules. It helps when you read a Kit file or a Git repository (see [[git-layout]]).

## Where to find it

The rules live in the Kit `kits/agent-pipeline/kit.json` and the file `kits/behaviour-examples/total-effort.rule.json` of the MetaKit repository. Add the Kit to a workspace with **Add > From file…** on the [[page-kits|Kits page]], then open it in Build mode and choose **Rules**.

## How to use it

1. Open the Kit in Build mode and choose **Rules**.
2. Open a rule from the list.
3. Compare the form with the table below.
4. Open a model made with the Kit, select an object and press **Try on the selected object** to read what the rule would do.

## Every option explained

### A hint when an attribute changes: "Autonomous agents need a gate"

| Part | Setting |
| --- | --- |
| Event | An attribute changed |
| Class | Agent |
| Attribute | Autonomy |
| If | `= Autonomy == 'Autonomous'` |
| Then | **Show a message**, kind Warning, text `= Name + ' acts alone now. Add a gate that approves what it produces before other tasks use it.'` |

```json
{
  "id": "rule_autonomous_hint",
  "label": "Autonomous agents need a gate",
  "when": {
    "event": "attribute.changed",
    "class": "cls_agent",
    "attribute": "Autonomy"
  },
  "if": "= Autonomy == 'Autonomous'",
  "then": [
    {
      "action": "message",
      "kind": "warning",
      "text": "= Name + ' acts alone now. Add a gate that approves what it produces before other tasks use it.'"
    }
  ]
}
```

The text is a formula because it starts with `=`. It joins the agent's `Name` with plain text.

### A status button: "Mark ready"

| Part | Setting |
| --- | --- |
| Event | A person runs it (a command or button) |
| Name in the menu | Mark ready |
| Where it appears | Toolbar |
| If | `= Priority != null` |
| Then | **Set an attribute** `Status` to `Ready`, **On** `self` |

```json
{
  "id": "rule_ready",
  "label": "Mark ready",
  "when": { "event": "command" },
  "if": "= Priority != null",
  "then": [
    {
      "action": "setAttribute",
      "attribute": "Status",
      "value": "Ready",
      "target": "self"
    }
  ],
  "command": { "label": "Mark ready", "place": "toolbar" }
}
```

The condition `Priority != null` is a trick. Only tasks have a `Priority`, so the rule does nothing when an agent is selected. A command rule cannot be limited to one class (a known limit). See [[behaviour-commands]].

### A calculation on demand: "Total effort"

| Part | Setting |
| --- | --- |
| Event | A person runs it |
| Name in the menu | Total effort |
| Where it appears | Model menu |
| Then | **Show a message**, kind Information |

```json
{
  "id": "rule_total_effort",
  "label": "Total effort",
  "when": { "event": "command" },
  "then": [
    {
      "action": "message",
      "kind": "info",
      "text": "= 'Total effort: ' + sum(objects('Task').Effort) + ' h in ' + count(objects('Task')) + ' tasks.'"
    }
  ],
  "command": { "label": "Total effort", "place": "model" }
}
```

`objects('Task')` is the list of all tasks. `.Effort` reads the effort of each. `sum` adds them, skipping empty ones. See [[formula-reference]].

## Examples

Try these small changes on the rules above.

- Change **Where it appears** of "Mark ready" to **Right-click menu**. The button leaves the toolbar and appears when you right-click a task.
- Add a second action to "Mark ready": **Show a message** with the text `= Name + ' is ready.'`. The dry run now lists two steps.
- Turn "Autonomous agents need a gate" into a blocker: change the event to "An attribute is about to change", the condition to `= $new == 'Autonomous'` (before the change, `Autonomy` still has the old value) and replace the message with **Cancel the action**. The change is then refused.

## Good to know

- **Ids in the JSON.** `cls_agent` is the id of the class, not its key. Ids never change when you rename a class. See [[keys-and-renaming]].
- **Formulas are text.** A value that starts with `=` is a formula in the file too.
- **Messages are not saved.** A message is shown and forgotten. It does not write anything into the model.
- **Check the whole Kit.** Run the Kit check from [[kit-validation]] after you change rules by hand.

## Related

[[rules]] · [[rule-triggers]] · [[rule-actions]] · [[script-examples]] · [[formula-reference]] · [[file-formats]]
