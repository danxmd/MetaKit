---
id: assistant-privacy
title: What the assistant sends
category: assistant
summary: Exactly what leaves your browser when the assistant drafts something, what never does, and how the guard and the key are protected.
keywords: [what is sent, assistant privacy, model content guard, sample request, key safety, outgoing request]
contexts: []
order: 210
---

When you ask the assistant for a draft, your browser sends one request to the service you chose. This page says what is in that request and what is not, and what stops a mistake.

## What it is

**Tool definitions, never models.** A request holds three things:

1. Your sentence.
2. A summary of the tool library you are editing.
3. The format the draft must follow.

It never holds the objects, attribute values, names or any other content of a model, even while a model is open elsewhere in the workspace.

### The summary of the tool library

| Included | Detail |
| --- | --- |
| Tool name and languages | For example `Tool: "BPMN lite". Languages: en.` |
| Classes | Id, key, kind, abstract, parent class, and every attribute with its type. Choice attributes list their options. Formula attributes list their formula. Required is marked. |
| Relation classes | Id, key, which classes they join, and their attributes. |
| Model types | Key and the classes they hold. |
| Existing rules | Name, event and class. Not their actions. |
| Existing shapes | Id, kind and name. Not their parts. |
| Existing scripts | Names only. Not their code. |

At most 80 entries of each list are included. A line `... and N more` closes a longer list.

### The format part

Depends on what you draft:

- **Rule:** the rule format with the 24 events, the action types and the formula language (see [[rule-triggers]], [[rule-actions]], [[formula-reference]]), plus an example.
- **Script:** the TypeScript declarations of the `metakit` module for your tool library (see [[script-api]]).
- **Shape:** the shape format and an example.
- **Class:** the class format.

### What is never sent

- Objects, connectors, their attribute values or positions.
- Model names, folder names, file names or paths.
- The text of your scripts, the bodies of existing rules, or the parts of existing shapes.
- Anything from other documents in the workspace.
- Your Git tokens, your profile name, the contents of the workspace folder.

> **Note:** Tool definitions can still hold business words. A class called "Merger target" or a choice list of project code names is part of the summary. If the names themselves are confidential, do not use the assistant on that tool.

## Where to find it

On the **Assistant (optional)** page, the box **What is sent** has three short paragraphs and the button **Show a sample request**. The sample is the exact text that a request for a rule would send for your open tool library, or for a small example tool when none is open. In the draft dialog, a line says "Only the tool definition and your description are sent, never a model." See [[assistant-overview]].

## How to use it

1. Open the Assistant page and press **Show a sample request**.
2. Read it from top to bottom. The part called SYSTEM holds the instructions, the summary and the format. The part called USER holds your sentence.
3. If anything in it should not leave your computer, do not turn the assistant on for this tool.

## Every option explained

### The guard

Before any request is sent, a check looks at it. If anything is wrong, nothing is sent, and you read:

`Nothing was sent. The request was stopped because ... The assistant never sends models.`

| Reason | Meaning |
| --- | --- |
| it is not a request | The object is not a request. |
| it has an unexpected field "x" | The request may only have `system`, `messages` and `maxTokens`. |
| it has the wrong shape / a message has the wrong shape | Messages must be text from the user or the assistant. |
| it contains the id of a model object | An id starting `el_`, `cn_` or `mdl_` was found. These exist only in models. |
| it looks like a model file | Both `"elements":` and `"connectors":` appear. |
| it contains the id X, which is not in the tool library | Any other id must belong to the tool library. |

The guard is a second line of defence. The code that builds requests takes only a tool library and cannot be given a model.

### The key

- Kept in your browser profile only (IndexedDB), under `assistantKeys`. Settings (on or off, provider, model) are kept apart, under `assistantSettings`.
- Never in the shared folder, a tool library, a model, a repository, a log, a test file or a package.
- Sent only in the header of the request to the service.
- Removed from any text that comes back: the key, anything shaped like `sk-...`, and header lines such as `x-api-key:` become `[key removed]`.

### The route

The request goes from the page straight to the service with no MetaKit server between. The service library loads only when you first use the assistant. It is the official library of the provider, called from the browser.

### Cost

A request is as large as the sample plus your sentence. Two requests are sent when the first draft needs a correction.

## Examples

- Your tool has a class `Task` with choice `Priority` (Low, Medium, High). The sample lists `Priority (choice: Low | Medium | High)`. It does not contain any real task.
- You draft a script. The request contains the declarations that describe `Task` and `Priority`, so that the answer uses the right names. Your existing scripts are not in it.

## Good to know

- **Network panel.** Open the browser's network panel while drafting: only requests to the service appear. The body holds no model content.
- **Shared screens.** The sample request is shown on screen. Be careful when you share your screen.
- **Browser extensions.** Extensions that can read pages could read the key. The settings page says so.
- **Agree on it in teams.** Each person uses their own key. Nobody else sees it.
- **Same rule as Git.** Tokens and keys follow the same rule: browser only. See [[git-tokens]] and [[concepts-no-server]].

## Related

[[assistant-overview]] · [[assistant-drafts]] · [[git-tokens]] · [[concepts-no-server]] · [[script-api]] · [[troubleshooting]]
