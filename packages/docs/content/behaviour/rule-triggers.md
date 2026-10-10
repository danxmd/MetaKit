---
id: rule-triggers
title: Rule triggers
category: behaviour
summary: The 24 events and the on-demand trigger that can start a rule or a script, with what each one tells the rule.
keywords: [rule trigger, rule triggers, trigger event, cancellable events, attribute.changed, object.created, about to events, event payload]
contexts: []
order: 20
---

A trigger is the **When** part of a rule. MetaKit announces 24 events. A rule picks one of them, or picks the on-demand trigger "A person runs it". [[scripts]] listen to the same events with `on(...)`, see [[script-api]].

## What it is

An event is a short message that says what just happened or is about to happen. It names the object it is about, and may carry an old value and a new value.

Events come in two kinds.

- **After events** say that something happened: "An object was created". They are announced after the change. Rules and scripts can react by changing the model further.
- **Before events** say "is about to": "An object is about to be created". They are announced before the change is made. A rule or script may **cancel** them, and the change does not happen. They cannot change the model. There are seven of them: `model.creating`, `model.deleting`, `object.creating`, `object.deleting`, `connector.creating`, `attribute.changing` and `view.changing`.

> **Note:** Events fire only where the change was made. A change that reaches you from another person through [[sync-overview]] does not fire anything in your tab. A change you make yourself does.

## Where to find it

In Build mode, open **Rules** (see [[rules]]), open a rule and look under **When**. The **Event** list is grouped: Object, Connector, Attribute, Table, Model, View, App, Selection and On demand.

## How to use it

1. Open a rule. Under **When**, open **Event**.
2. Pick the group that matches what you want to react to, then the event.
3. Use the pickers that appear (**Class**, **Attribute**, **Relation**) to narrow it. A narrower rule runs less often.
4. In **If** and in action values you can read `$old`, `$new`, `$event` and `$attribute`. See "What a rule can read".

## Every option explained

### All events

| Event (list text) | Name | Fires | Cancel | Pickers |
| --- | --- | --- | --- | --- |
| An object is about to be created | `object.creating` | Before an object is made. `$new` is `{x, y}`. | Yes | Class |
| An object was created | `object.created` | After an object is made. | No | Class |
| An object is about to be deleted | `object.deleting` | Before an object is deleted. | Yes | Class |
| An object was deleted | `object.deleted` | After a delete. The object is gone, so its attributes cannot be read. | No | Class |
| An object was moved | `object.moved` | After a move. `$old` and `$new` are `{x, y}`. | No | Class |
| An object was resized | `object.resized` | After a resize. `$old` and `$new` are `{w, h}`. | No | Class |
| An object was renamed | `object.renamed` | After the name changed. The name is the first text attribute of the class. | No | Class |
| A connector is about to be created | `connector.creating` | Before a connector is made. | Yes | Relation |
| A connector was created | `connector.created` | After a connector is made. | No | Relation |
| A connector was moved to another object | `connector.reconnected` | After an end moved. Fires once for each end that changed. `$old` and `$new` are the object ids. | No | Relation |
| An attribute is about to change | `attribute.changing` | Before a value is set. `$old` and `$new` are the values. | Yes | Class, Attribute |
| An attribute changed | `attribute.changed` | After a value is set. | No | Class, Attribute |
| A table row was added | `table.rowAdded` | After a table attribute got more rows. | No | Class, Attribute |
| A table row was removed | `table.rowRemoved` | After a table attribute got fewer rows. | No | Class, Attribute |
| A model is about to be created | `model.creating` | Before a new model is made. | Yes | none |
| A model was created | `model.created` | After it is made and opened. | No | none |
| A model was opened | `model.opened` | Each time a model is opened. | No | none |
| A model is about to be deleted | `model.deleting` | Before the open model goes to the trash. It fires only for the model that is open. | Yes | none |
| A model was deleted | `model.deleted` | Right after the check above passed, for the open model. | No | none |
| The view is about to change | `view.changing` | Before the **View** switcher changes. | Yes | none |
| The view changed | `view.changed` | After it changed. `$old` and `$new` are the view ids, empty for "All". | No | none |
| The app has started | `app.started` | Once, when the first model of a session opens. | No | none |
| The app is closing | `app.closing` | When the workspace is closed while a model is open. | No | none |
| The selection changed | `selection.changed` | Whenever the selection changes. | No | none |
| A person runs it | `command` | When someone chooses the menu entry or presses the button. | not applicable | Name in the menu, Where it appears |

### What a rule can read

| Name | Value |
| --- | --- |
| Attribute keys | The attributes of the object the rule is about, by key. Example: `Priority`. |
| `self` | The id of that object. |
| `parent` | The id of the container it sits in, or empty. |
| `$old` and `$new` | The value before and after, where the event has one. Empty otherwise. |
| `$event` | The event name as text, such as `attribute.changed`. |
| `$attribute` | The key of the attribute for attribute and table events. |

For model, view, app and selection events there is no object. `self` is empty, so attribute keys are not available. Conditions there can use `$event`, `$old` and `$new`. A rule cannot read the list of selected objects or the ends of a connector. A script can, see [[script-api]].

### How narrowing works

- **Class** matches the class and everything that extends it. A rule for "FlowNode" also hears a "Task" that extends it. See [[abstract-classes]].
- **Attribute** matches the attribute key you picked.
- **Relation** matches the relation class.
- A change to an attribute of the model itself has no class, so a class filter never matches it.

### Before events and cancelling

Several rules may listen to one before event. They run in the order they are stored. The first one that cancels stops the rest, and the person sees the reason as a warning. Use the **Cancel the action** action (see [[rule-actions]]). A cancel on an after event does nothing. The rule form hints at that.

## Examples

- Stop a delete: Event "An object is about to be deleted", Class Task, If `= Status == 'Running'`, Then **Cancel the action** with the reason `A running task cannot be deleted.`
- Keep a copy of the old value: Event "An attribute changed", Attribute Owner, Then **Set an attribute** `PreviousOwner` to `= $old`.
- A button: Event "A person runs it", Name in the menu `Mark done`. See [[behaviour-commands]].
- Review a model when it opens: Event "A model was opened", Then **Show a message** with a formula such as `= 'This model has ' + count(objects('Task')) + ' tasks.'`.

## Good to know

- **No events for merged changes.** This is by design: it stops loops between people.
- **Depth limit.** Rules that wake each other stop at 8 levels. The same rule never runs twice for the same object and event in one cascade.
- **Before rules cannot write.** An action that tries to change the model in a before event is refused with: `this rule runs before the action, so it can only cancel or ask. Use an event that says "changed" to change things.`
- **Model events and the Kit.** A model event reaches the rules of the Kit the model was made with. `model.creating` is announced on a temporary copy, so cancelling it stops the creation and shows the reason as the error.
- **Rename vs change.** Changing the name fires both `attribute.changed` and `object.renamed`. Pick one to avoid doing the work twice.
- **Selection events are frequent.** Keep selection rules light.

## Related

[[rules]] · [[rule-actions]] · [[script-api]] · [[behaviour-commands]] · [[computed-values]] · [[conflicts-and-merging]] · [[undo-redo]]
