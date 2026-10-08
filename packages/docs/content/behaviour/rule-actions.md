---
id: rule-actions
title: Rule actions
category: behaviour
summary: The eleven things a rule can do in its Then part, with every field and the errors you may see.
keywords: [rule action, rule actions, then actions, set an attribute action, cancel the action, ask a yes or no question, formula value]
contexts: []
order: 30
---

The **Then** part of a [[rules|rule]] is a list of actions. They run from top to bottom. Each action changes the model, talks to the person, or starts something else.

## What it is

There are eleven actions. Every change an action makes goes through the same command system as a change you make by hand. That is why it can be undone, and why it is the same for rules and [[scripts]].

| Add menu text | Stored as | In short |
| --- | --- | --- |
| Set an attribute | `setAttribute` | Writes a value into an attribute. |
| Create an object | `createObject` | Adds an object of a class. |
| Create a connector | `createConnector` | Joins two objects with a relation class. |
| Delete an object | `delete` | Deletes an object. |
| Show a message | `message` | Shows information, a warning or an error. |
| Ask a yes or no question | `ask` | Asks, then runs one of two lists of actions. |
| Ask to pick an answer | `choose` | Asks for one of several answers and stores it. |
| Cancel the action | `cancel` | Stops the change that a "before" event announced. |
| Open a model | `openModel` | Opens another model of the workspace. |
| Run a command | `runCommand` | Starts a command from a rule or script. |
| Run a script | `runScript` | Starts a script of the tool library. |

## Where to find it

Open a rule in Build mode (see [[rules]]). Under **Then**, the list **Add an action...** adds a new action at the end. Each action has a type list at the top, the buttons **↑** and **↓** to move it, and **Remove**. Changing the type of an action replaces it with a blank action of the new type.

## How to use it

1. Choose a type from **Add an action...**.
2. Fill in its fields (see below).
3. Add more actions. Order matters: a later action sees the results of earlier ones, including formulas.
4. Read the messages under the form. An error such as `Action 2: ...` must be fixed before the rule saves.
5. Use **Try on the selected object** to read what each action would do. The dry run writes the steps in plain English, for example `Set Status of the object to "Done".`

### Values, targets and formulas

Most text fields accept two kinds of input.

- Plain text, such as `High`. It is used as it is. In a **Set an attribute** action the text is turned into a number for a number or integer attribute (`3` becomes 3), and into a flag for a yes/no attribute (`true` or `false`).
- A formula that starts with `=`, such as `= Effort * 2`. It is calculated when the action runs, for the object the rule is about. See [[formula-reference]].

Fields that name an object (**On**, **From**, **To**, **Object**) take one of: nothing (this object), `self` (this object), an object id, or a formula that gives an id. The leading `=` is optional in these fields.

## Every option explained

### Set an attribute

| Field | Meaning |
| --- | --- |
| **Attribute** | The key of the attribute to write. The list holds the settable attributes of the rule's class. Calculated attributes and buttons are left out, because nothing can be written into them. |
| **To** | A value or a formula. |
| **On** | Which object. Empty means this object. |

Errors: `there is no attribute "X" to set.` and `the object to change does not exist.` and `there is no object to change.` (a command rule run with nothing selected). A value the attribute does not accept is refused with the reason from the model check.

Setting an attribute wakes `attribute.changing` and `attribute.changed`, so one rule can wake another. See [[rule-triggers]].

### Create an object

| Field | Meaning |
| --- | --- |
| **Class** | The class of the new object. |
| **Fill in an attribute** | Adds a pair: an attribute key and a value or formula. Press the button again for more pairs. **✕** removes a pair. |
| **Right by** and **Down by** | Where to put the object, as a distance from the object the rule is about. Both start at 40. |

Error: `the class has no attribute "X" to fill in.` The new object becomes the default end of a following **Create a connector**.

### Create a connector

| Field | Meaning |
| --- | --- |
| **Relation** | The relation class. |
| **From** | Start object. Empty means this object. |
| **To** | End object. Empty means the object made just before by **Create an object**, or else this object. |

Error: `a connector needs two objects to join.` The model refuses a connector the relation class does not allow, and the rule then shows that reason.

### Delete an object

**Object** names the object to delete. Empty means this object. Deleting wakes `object.deleting` and `object.deleted`.

### Show a message

| Field | Meaning |
| --- | --- |
| **Kind** | **Information**, **Warning** or **Error**. |
| **Text** | Text or a formula. |

Messages appear in the list "Messages from rules and scripts" in Model mode. The last five stay until you dismiss them.

### Ask a yes or no question

**Question** is the text. Two lists follow: **If the answer is yes** and **If the answer is no**. Each holds actions, and may hold more questions, up to four levels deep (`Questions are nested too deeply.`). The question uses the browser's own confirm box. In the dry run, both branches are described.

### Ask to pick an answer

| Field | Meaning |
| --- | --- |
| **Question** | The text. |
| **Choices** | Answers separated by commas. |
| **Put the answer in** | The attribute that gets the chosen answer. |

The browser shows a box listing the choices as numbers. You type the number or the exact text. If the person cancels, the rule ends. In a "before" event the answer does not change anything. It only decides whether the action goes on, and cancel stops it with the text `Cancelled.`

### Cancel the action

**Reason shown to the person** is text or a formula. Empty gives `Cancelled by a rule.` The reason appears as a warning. Cancel works only for the seven "before" events. For any other event it quietly ends the rule, and the form shows a hint.

### Open a model

**Model** is the name or folder name of a model in the workspace. If none matches: `There is no model called "X".`

### Run a command

**Command** is the label or id of a command from a rule or a script. Commands are described in [[behaviour-commands]]. Script commands have ids that start with `script:`.

### Run a script

**Script** starts a script of the tool library. The engine finds a script by its id (it starts with `scr_`), and the editor does not show ids. If you type a name, the result is `The script X does not exist.` A dependable alternative: make the script register a command, then use **Run a command** with the command's label.

## Examples

**Create a follow-up task.** Event: An object was created, Class Review. Actions: **Create an object** of class Task with **Fill in an attribute** `Name` = `= 'Fix: ' + Name`; then **Create a connector** with relation Feeds. The connector joins this object to the new object.

**Ask before a risky change.** Event: An attribute is about to change, Attribute Status. If `= $new == 'Done' && Owner == null`. Actions: **Ask a yes or no question** `Nobody owns this. Mark it done anyway?` with **If the answer is no** containing **Cancel the action** with reason `Not marked done.`

**Pick a status.** Event: A person runs it. Action: **Ask to pick an answer** `New status?`, choices `Ready, Running, Done`, put the answer in `Status`.

## Good to know

- **Stop at the first problem.** If an action fails, the rest of the rule is skipped and a warning appears: `Rule "Name": reason`. What earlier actions did stays, and one **Undo** removes it all.
- **Before events cannot write.** Use "changed" events for changes. See [[rule-triggers]].
- **Loops.** A rule that sets the attribute it listens to does not wake itself again inside the same cascade. Rules that wake each other stop at 8 levels.
- **Same security as the rest.** Actions can only do what the model commands allow. They cannot read files or use the network. For that you need [[scripts]] and [[script-permissions]].
- **Dry run limits.** The dry run shows what would happen. It does not ask questions or change anything.

## Related

[[rules]] · [[rule-triggers]] · [[rule-examples]] · [[behaviour-commands]] · [[scripts]] · [[formula-reference]] · [[undo-redo]] · [[troubleshooting]]
