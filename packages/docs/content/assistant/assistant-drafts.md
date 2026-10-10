---
id: assistant-drafts
title: Drafts and accepting them
category: assistant
summary: The draft dialog, how every draft is checked before you see it, and how accepting one works as a single undo step.
keywords: [drafts, draft dialog, accept a draft, discard a draft, draft checks, draft again, plain english change]
contexts: []
order: 220
---

A draft is the assistant's answer: a rule, a script, a shape or a class that is not in your Kit yet. You read it in a dialog. You accept it, throw it away, or ask again with better words.

## What it is

Every draft goes through four steps before you see it.

1. **Ask.** Your sentence and the Kit summary go to the service (see [[assistant-privacy]]).
2. **Read.** MetaKit extracts the JSON, or the TypeScript, from the reply. A reply without one gives the problem `The reply contains no script.` or a JSON error.
3. **Check.** The draft is checked in the same way as if you had typed it in the editor.
   - A **rule**: the structure, the event names, the action types, that classes and relation classes exist, and every formula (it must parse, call only known functions and use only names that are attributes here).
   - A **class**: the structure of the class and its attributes, the parent class, constraints.
   - A **shape**: the shape structure and its formulas.
   - A **script**: it may only import from `metakit`; it must compile; then the TypeScript checker looks for wrong class and attribute names. If the checker is not available, only the compile check runs.
4. **Retry once.** If the checks find problems, the problems are sent back to the assistant with a request to fix them. This is the second request. Whatever comes back is shown, with any remaining problems.

You see the result in plain English, and the raw text beside it.

## Where to find it

Press **Draft with assistant** in the Rules section, the Scripts section, the Shapes section or the class editor of Build mode. A dialog opens: **Draft a rule with the assistant** (or script, shape, class). See [[assistant-overview]].

## How to use it

1. Write what you want in the box **What should the rule do?** (or script, shape, class). The grey example shows the style: `High-priority tasks need an owner`.
2. Press **Draft**. The button shows **Drafting...** while it works.
3. Read **The change**. It lists what would be added, in plain words.
4. Read the raw text below it. It is read only. Its label is **JSON (read only)** or **TypeScript (read only)**.
5. If a red box says **The draft still has problems**, read the list. **Accept** is off. Change your sentence and press **Draft again**.
6. If all is well, press **Accept**. The dialog closes and the new part is in your Kit. A new rule or script is opened in its list.
7. Press **Discard** to close without any change.
8. Check the result. Use **Undo** if you do not like it.

## Every option explained

| Part | Meaning |
| --- | --- |
| **What should the ... do?** | Your sentence. At most 2000 characters. |
| **Draft** / **Draft again** | Sends the request. Off while empty or while working. |
| **The change** | The draft in plain English. |
| Raw box | The JSON or script text exactly as it will be stored. |
| **The draft still has problems after a second try:** | The checks that failed. |
| **Discard** | Closes and forgets the draft. |
| **Accept** | Applies the draft. Off if there is no draft or if it still has problems. |

### What The change looks like

For a rule:

```text
Add the rule "High-priority tasks need an owner".
When an attribute is changed for Task (attribute Priority).
If Priority == 'High' && Owner == null.
Then: Show a warning: the result of = 'Task "' + Name + '" is high priority but has no owner.'.
```

For a script: the name and size, which events it reacts to, which commands it adds, and warnings such as "It contacts web services: turn on that permission for the Kit in the Scripts section." For a shape: its size and parts, and "Choose it for a class in the class editor to use it." For a class: the key, a parent if any, the attributes with types and choices, and checks.

### What Accept does

- It turns the draft into the usual Kit commands (`putRule`, `putScript`, `putShape` or `putClass`), with new ids.
- If a name or key is already taken, a free one is chosen: a script `Renumber tasks` becomes `Renumber tasks 2`, and the class key gets a number.
- All of it is one undo step in Build mode.
- The Kit store checks the commands as it checks anything. A draft that slipped through is refused and nothing changes.

### Things Accept does not do

- It does not turn on permissions for a script. You tick them yourself. See [[script-permissions]].
- It does not attach a shape to a class. You choose the shape in the class editor.
- It does not run the script, and it does not change any model.

## Examples

- "A Task with a name, a priority and an owner" gives the lines `Add the class "Task".` and `Attributes: Name (text, required); Priority (choice, choices Low, Medium, High); Owner (text).`
- "Use the attribute Foobar" gives a rule with the problem `... the name "Foobar", which is not an attribute here. Attributes: ...`. **Accept** stays off.
- "Renumber tasks by position" gives a script with a command. The list says `It adds the commands: Renumber tasks.`

## Good to know

- **Read before you accept.** A draft is a suggestion. A rule that passes every check can still do the wrong thing.
- **Two attempts.** Drafting costs one request, or two when a fix is needed.
- **Errors from the service** appear in red at the top of the dialog, without the key. See [[assistant-overview]] for the texts.

## Related

[[assistant-overview]] · [[assistant-privacy]] · [[rules]] · [[scripts]] · [[classes]] · [[shapes-section]] · [[undo-redo]]
