---
id: assistant-overview
title: Assistant
category: assistant
summary: An optional helper in Build mode that drafts rules, scripts, shapes and classes from one sentence, using your own key.
keywords: [assistant, ai assistant, draft with assistant, api key, assistant settings, claude assistant]
contexts: [settings.assistant]
order: 200
---

The assistant is an optional helper in Build mode. You describe in one sentence what you want. It drafts a rule, a script, a shape or a class. You read the draft and accept it or throw it away. It is off until you turn it on, and it uses your own key from your own account.

## What it is

The assistant can draft four kinds of things.

| Kind | Example sentence | Result |
| --- | --- | --- |
| Rule | "High-priority tasks need an owner" | A When / If / Then rule. See [[rules]]. |
| Script | "Renumber tasks by position" | A TypeScript script with a menu command. See [[scripts]]. |
| Shape | "A rounded blue task box showing its name" | A shape you can pick for a class. See [[shapes-section]]. |
| Class | "A Task with a name, a priority and an owner" | A class with its attributes. See [[classes]]. |

It is a helper, not an author. A draft is a suggestion. MetaKit checks it before you see it, and nothing changes in your tool library until you press **Accept**. Accepting is one undo step. The assistant never runs a script and never touches a model.

Four promises hold:

- **Off by default.** Nothing is sent until you turn it on and add a key.
- **Your key, your bill.** The service charges your own account. MetaKit does not.
- **Tool definitions only.** Models are never sent. See [[assistant-privacy]].
- **You decide.** Drafts are checked, then shown. You accept or discard. See [[assistant-drafts]].

## Where to find it

- **Settings:** the **Assistant** button on the Models page opens the page **Assistant (optional)**. See [[page-models]].
- **Using it:** the button **Draft with assistant** sits next to **Add rule** in the Rules section, next to **Add a script** in the Scripts section, in the Shapes section, and in the class editor. See [[page-build-view]].

## How to use it

### Turn it on

1. On the Models page press **Assistant**.
2. Tick **Turn on the assistant**.
3. Paste your API key into the **API key** box and press **Save key**. The message reads "The key is saved in this browser. Test it to check that it works."
4. Press **Test the key**. A good answer reads `The key works with claude-sonnet-5-5.`
5. Read **What is sent**, and open **Show a sample request** to see exactly what a request looks like.

### Draft something

1. In Build mode open the editor for the kind of thing you want. Press **Draft with assistant**.
2. Write what you want in the box and press **Draft**.
3. Read the plain-English list under **The change** and the raw text underneath.
4. Press **Accept**, or **Discard**, or change your sentence and press **Draft again**. See [[assistant-drafts]].

### Turn it off

1. Press **Remove the key**. The key is removed from this browser.
2. Untick **Turn on the assistant**. The **Draft with assistant** buttons turn off.

## Every option explained

| Control | What it does |
| --- | --- |
| **Turn on the assistant** | The master switch. Off at first. |
| **API key** and **Save key** | Stores your key in this browser. The box is a password field. After saving, the key is not shown again. |
| **Test the key** | Sends a tiny request that holds no tool and no model content, to check that the key works. |
| **Remove the key** | Deletes the key from this browser. |
| **Model** | The name of the model to ask. Default `claude-sonnet-5-5`. Change it only if you know another model name that your account may use. |
| **Show a sample request** | Shows the exact text a request for a rule would send, built from your open tool library or from a small example tool. |
| **Draft with assistant** | Opens the draft dialog. Disabled, with the tip "Turn on the assistant and add a key in the settings first", until the assistant is on. |

### Messages you may see

| Message | Meaning |
| --- | --- |
| `Enter a key first.` | The key box is empty. |
| `Add a key in the assistant settings first.` | The assistant is on but has no key. |
| `The assistant is turned off.` | You tried to draft while it is off. |
| `The service did not accept this key. Check that it is complete and still active.` | Wrong, cut or revoked key. |
| `The service says there were too many requests or the account is out of credit. Try again in a moment.` | Rate limit or no credit. |
| `The service could not be reached. Check the internet connection.` | No connection. |
| `Describe what you want first.` | The sentence is empty. |
| `Keep the description under 2000 characters.` | The sentence is too long. |

## Examples

- "When a task is deleted, show a warning" becomes a rule with the event "An object is about to be deleted" and a **Cancel the action**, or a message.
- "A command that lists all tasks without an owner" becomes a script with `commands.register`.
- "A diamond for gateways with the type in the middle" becomes a shape.
- "A Risk with a name, a probability from 1 to 5 and an impact" becomes a class with attributes.

## Good to know

- **Key safety.** The key lives in your browser profile (IndexedDB) only. It is not in the shared folder, a tool library, a model, a repository or a log. It does not follow you to another browser or reach your teammates. Requests go from the page straight to the service. Because the page makes the request, the key is available to the page while it is open. Do not turn the assistant on in a browser you do not trust.
- **Use a limited key.** Make a key just for this, with a spending limit, and remove it when you no longer need it.
- **Cost.** A draft is one request, or two if the first needs a correction. A request is about as long as the sample.
- **One provider.** Only Claude is offered now. Others could be added later.
- **Script checks.** Scripts are compiled and type-checked with the same checker as the script editor. If the checker is not available, only syntax errors are found.
- **Browsers.** The assistant needs the same browser as the rest of MetaKit (see [[browser-support]]).

## Related

[[assistant-privacy]] · [[assistant-drafts]] · [[rules]] · [[scripts]] · [[page-build-view]] · [[troubleshooting]]
