---
id: rules
title: Rules
category: behaviour
summary: Rules are no-code reactions that a tool library runs in a model, written as When, If and Then.
keywords: [rules, no-code rules, rule editor, rule engine, when if then]
contexts: [build.rules]
order: 10
---

A rule tells a model what to do when something happens. You build it in Build mode with drop-down lists and short formulas. No programming is needed. Rules are the first of three levels of behaviour: formulas, rules, then [[scripts]].

## What it is

A rule has three parts.

- **When** is the event that wakes the rule, for example "An attribute changed". You can narrow it to one class, one attribute or one relation class. See [[rule-triggers]].
- **If** is an optional condition. It is a formula that must be true for the rule to go on. See [[formula-reference]].
- **Then** is a list of actions that run in order, for example "Set an attribute" or "Show a message". See [[rule-actions]].

A rule belongs to the tool library, not to a model. Every model made with that tool library gets the rule. Rules are stored in the `rules` table of the tool library (tool format 3 and later, see [[format-versions]]), each with an id that starts with `rule_`.

The engine is careful. A rule that has a problem never crashes the app. It shows a warning such as `Rule "Needs an owner": the condition: ...` and stops. Everything a rule changes joins the step that woke it, so one **Undo** takes back both the change and what the rule did.

> **Note:** Rules react only to changes made in your own browser tab. Changes that arrive from other people through [[sync-overview]] never wake a rule. This keeps two people from running the same rule twice.

## Where to find it

1. Open a tool library in Build mode (see [[page-build-view]]).
2. Choose **Rules** in the section list on the left. The sections are Classes, Relation classes, Model types, Shapes, **Rules**, [[scripts|Scripts]] and Settings.

The page shows the text "A rule reacts when something happens in a model: when it, if the condition is true, then its actions." Below it is the list of rules, sorted by name. An empty list says "No rules yet."

## How to use it

1. Press **Add rule**. A rule called "New rule" is added and opened. Its event is "An attribute changed" and it has no actions yet.
2. Type a **Name**. The name is what you see in the list and in warnings.
3. Under **When**, pick an **Event** from the grouped list. Pick a **Class**, **Attribute** or **Relation** if the pickers appear.
4. Under **If**, type a condition, or leave it empty to always run. You may leave out the leading `=`. MetaKit adds it.
5. Under **Then**, use **Add an action...** to add actions. Fill in their fields. Use the arrow buttons to change their order.
6. Read the messages under the form. A message marked with the part of the rule (for example `Action 2:`) says what is wrong. Fix it and the rule saves.
7. Press **Try on the selected object** to see what the rule would do. Nothing is changed. See "Trying a rule" below.
8. Use the switch at the left of a rule in the list to turn it off or on without deleting it.

The form saves after every committed change. You do not press a save button. The line "Saved." appears when it worked. If a change is refused, what you typed is kept in the form, so nothing is lost.

## Every option explained

### The list

| Item | What it does |
| --- | --- |
| Switch before the name | Turns the rule on or off. A rule is on unless it is switched off. |
| Name and event | Click to open or close the rule. The grey text shows the event, for example "An object was created". |
| **Delete** | Asks `Delete the rule "Name"?` with the buttons **Delete** and **Keep**. Deleting is one undo step in Build mode. |
| **Add rule** | Adds a new rule. |
| **Draft with assistant** | Appears only when the assistant is on. See [[assistant-drafts]]. |

### The form

| Field | Meaning |
| --- | --- |
| **Name** | Free text. |
| **Event** | One of 24 events or "A person runs it (a command or button)". See [[rule-triggers]]. |
| **Class** | Only for object, attribute and table events. "Any class" means every class. A rule for a class also runs for its subclasses. |
| **Attribute** | Only for attribute and table events. "Any attribute" means all of them. |
| **Relation** | Only for connector events. "Any relation" means all relation classes. |
| **Name in the menu** | Only for command rules. The text of the menu entry or button. |
| **Where it appears** | Only for command rules: **Model menu**, **Toolbar** or **Right-click menu**. A new command rule starts with the right-click menu. See [[behaviour-commands]]. |
| **Condition (leave empty to always run)** | A formula. It sees the attributes of the object the rule is about, plus `$old`, `$new`, `$event` and `$attribute`. |

If you change the event, filters that no longer apply are dropped. If you choose a class, an attribute filter that belongs to another class is dropped too.

### Messages under the form

The form checks the rule with the same checks as the tool library check. A message is either an **error** (the rule is not saved) or a **hint** (advice only).

- Errors name the part: `When`, `If`, `Action 1`, `Command`, `Name` or `Rule`.
- Formulas are parsed. The message says why and where: `... (at character 12 of the formula)`.
- "Pick the attribute to set." appears when a **Set an attribute** action has no attribute.
- Hint: "Cancel only works for events that say "about to", before the action happens. Here it does nothing."
- Hint: "No attribute is picked, so the rule runs when any attribute changes."

### Trying a rule

**Try on the selected object** needs an open model with a selected object. Otherwise it says "Open a model and select an object to try the rule." The result tells you whether the condition is true ("The condition is true, so the rule would do this:") or not ("The condition is not true, so the rule would do nothing. These are its actions:"), then lists each action in plain English. If the condition has a problem it says "The condition fails: ..." and gives the reason.

## Examples

**Owner needed for high priority.** Event: An attribute changed. Class: Task. Attribute: Priority. Condition: `= Priority == 'High' && Owner == null`. Action: Show a message, kind Warning, text `High priority needs an owner.`

**Total effort on demand.** This is the rule `Total effort` of the BPMN lite examples. Event: A person runs it. Name in the menu: `Total effort`, appears in the Model menu. Action: Show a message with the text

```text
= 'Total effort: ' + sum(objects('Task').Effort) + ' h in ' + count(objects('Task')) + ' tasks.'
```

**Status buttons.** The Agent pipeline tool has command rules such as "Mark ready". Each one sets `Status` to a fixed value on the selected task. Its condition `= Priority != null` is there because a command rule cannot be limited to one class. See [[rule-examples]] for more.

## Good to know

- **Cascades are cut.** A rule may change something that wakes another rule. After 8 levels the engine stops with: `Rule "Name": stopped because rules triggered each other more than 8 levels deep.` A rule also never runs twice for the same object and event inside one cascade.
- **Before and after.** Events that say "is about to" run before the change. A rule there can ask or cancel, but cannot change the model. Events that say "was" run after the change and can change things. See [[rule-triggers]].
- **Dialogs are the browser's own.** Questions use the browser's built-in confirm and prompt boxes so that a "before" rule can wait for the answer.
- **Command rules cannot be limited to a class.** Use the condition to keep a command harmless on other objects. This is a known limit.
- **Empty numbers.** `ActualEffort - Effort` fails when one side is empty. Write `(ActualEffort ?? 0) - (Effort ?? 0)`. See [[formula-reference]].
- **Rule problems never block you.** A failing rule shows a warning and ends. A failing "before" rule does not cancel the action.
- **Sharing.** Two people editing two different rules never clash, because each rule is merged as a unit. See [[conflicts-and-merging]].
- **When rules are not enough.** Use [[scripts]] for loops over many objects, web requests or files.

## Related

[[rule-triggers]] · [[rule-actions]] · [[rule-examples]] · [[scripts]] · [[behaviour-commands]] · [[formula-reference]] · [[tool-validation]] · [[troubleshooting]]
