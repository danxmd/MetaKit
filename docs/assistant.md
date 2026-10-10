# The assistant

The assistant is an optional helper in Build mode. You describe what you want in one sentence, and it drafts a rule, a script, a shape or a class. You read the draft and accept or discard it. It is off until you turn it on.

## What it does

- **Rule:** "High-priority tasks need an owner" becomes a When / If / Then rule.
- **Script:** "Renumber tasks by position" becomes a TypeScript script with a menu command.
- **Shape:** "A rounded blue task box showing its name" becomes a shape you can pick for a class.
- **Class:** "A Task with a name, a priority and an owner" becomes a class with its attributes.

Every draft is checked before you see it: the format, the formulas, and for scripts the compiler and the type check. If the first draft has problems, the assistant is asked once to fix them. If the second draft still has problems, you see the draft and the list of problems, and **Accept** stays off. The proposed change is also written in plain English, next to the raw JSON or TypeScript.

Accepting applies the draft through the same commands as any edit in Build mode, so it is one undo step (Ctrl+Z removes it). The assistant never runs a script and never touches a model.

## Turning it on

1. Open the assistant settings.
2. Turn on **Turn on the assistant**.
3. Paste your API key and choose **Save key**, then **Test the key**.
4. In the rule, script, shape and class editors, use **Draft with assistant**.

To stop, remove the key (**Remove the key**) and turn the switch off.

## Key and cost

- You use your own key from your own account with the service (Claude by default, model `claude-sonnet-5-5`). The service bills you; MetaKit does not.
- Use a key made for this purpose with a **spending limit**, and remove it when you no longer need it.
- The key is kept only in this browser profile (IndexedDB). It is not in the shared folder, in a Kit, in a model, in a repository or in a log. Other people on the team do not get it, and it does not follow you to another browser.
- The request goes from the page straight to the service. There is no MetaKit server in between. That means the key is available to the page while it is open. Do not turn the assistant on in a browser you do not trust.
- A draft is one request, or two if the first needs a correction. A request holds roughly the size of the sample on the settings page.

## What is sent

**The Kit definition, never models.** One request holds:

- your sentence;
- a summary of the Kit you are editing: class, relation class and model type names, attribute names and types, choice options, and the names of existing rules, shapes and scripts;
- the format the draft must follow (the rule format with its 24 events and action types, the shape format, the class format, or the script declarations for your Kit).

It never holds the objects, attribute values, names or any other content of a model, even while a model is open. A guard checks every request before it is sent and stops it if it carries the id of a model object or anything shaped like a model file. The settings page shows a sample of the exact text.

## Limits

- A draft is a suggestion. Read it before you accept.
- Script type checks use the same checker as the script editor. If it is not available, a script is only compiled, which finds syntax errors but not a wrong class name.
- One provider (Claude) for now. Others can be added behind the same interface later.

## Manual check list

Run these by hand in Chrome or Edge with a real key (do not paste a key into tests or fixtures).

1. Settings: the assistant is off on a fresh profile. Turn it on; the key box appears; the sample request is visible and names no model content.
2. Save a key, then **Test the key**: a success message appears; the key is not shown again. Reload the page: the key is still saved, the box is not filled.
3. With a wrong key, **Test the key** says the key was not accepted, and the message does not contain the key.
4. Open a Kit, then a rule editor: **Draft with assistant** is enabled. Draft "High-priority tasks need an owner" on the sample Kit: the change is listed in plain English and Accept is on. Accept: the rule appears. Undo: it is gone.
5. Repeat for a script ("Renumber tasks by position"), a shape ("A rounded blue task box showing its name") and a class ("A Task with a name, a priority and an owner").
6. Draft something impossible ("Use the attribute Foobar"): problems are listed and Accept is off. Discard closes the dialog and changes nothing.
7. With the browser's network panel open while drafting: only requests to the service appear, and the request body holds no model content (open a model with a recognisable name and search the body for it).
8. Remove the key and turn the switch off: **Draft with assistant** is disabled or gone, and the key is gone from the browser's IndexedDB (`metakit` database, `kv` store: no `assistantKeys` entry with a value).
9. Firefox or Safari: the app shows its usual message; the assistant does not need to work there.
