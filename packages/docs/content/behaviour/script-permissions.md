---
id: script-permissions
title: Script permissions
category: behaviour
summary: How a tool library asks to use files or the web, and how each browser says yes or no.
keywords: [script permissions, permission dialog, network permission, files permission, asks for more, tool permissions]
contexts: [dialog.permission]
order: 70
---

Scripts can always change the model and show dialogs. Two more powers need a permission: contacting web services (`network`) and reading or writing files (`files`). The permission dialog is where you decide.

## What it is

A permission needs two keys, and a script works only when both are turned.

1. **The tool declares it.** The method engineer ticks a box in the Scripts section of Build mode. The declaration is stored in the tool library, as `permissions` in its manifest (tool format 4, see [[format-versions]]).
2. **Each browser allows it.** The first time a model of the tool opens in a browser, that browser asks the person. The answer is kept in the browser's own database (IndexedDB). It is never written to the workspace folder, to a Git repository or to a tool package.

The second key is personal. Another person who opens the same tool is asked on their own. A "yes" on one computer never gives permission on another.

> **Warning:** Allow a permission only for tools you trust. A script with `network` can send data from the model to an internet address. A script with `files` can read and add files in the workspace folder.

## Where to find it

- **Declaring:** Build mode, **Scripts**, the box **What the scripts of this tool may do**. It says: "Scripts can always change models and show dialogs. Say here what else they need. Each person is asked once, in their own browser, and again if you add something later." It has two check boxes: **Contact web services on the internet** and **Read and write files in the workspace, and open or save files**.
- **Allowing:** a dialog titled `"Tool name" asks for more` appears when a model of that tool opens.

## How to use it

As the method engineer:

1. Open the tool in Build mode and choose **Scripts** (see [[scripts]]).
2. Tick the box for what your scripts need. Tick nothing if they only use the model.
3. Tell your team that they will see a question on first use.

As a modeller, when the dialog appears:

1. Read what it lists. Each line is in plain English.
2. Press **Allow** to allow everything listed, or **Not now** to refuse. **Escape** also refuses.
3. The model opens either way. With "no", the tool works, but scripts that need the power fail with a clear message.

## Every option explained

### The dialog

| Part | Text |
| --- | --- |
| Title | `"Tool name" asks for more` |
| Intro | "The scripts of this tool can always change the models you open with it and show dialogs. It also wants to:" |
| Network line | "Contact web services on the internet. Scripts can send and receive data from addresses they choose, but only from services that accept requests from web pages." |
| Files line | "Read and write files in your workspace folder, and open or save files you pick in a dialog. Scripts cannot start programs on your computer." |
| Footer | "Allow this only for tools you trust. Your answer is kept in this browser only, and you are asked again if the tool later wants something else. If you say no, the tool still opens; its scripts just cannot do this." |
| Buttons | **Not now** and **Allow** |

### When you are asked again

| Situation | What happens |
| --- | --- |
| First time the tool wants `network` or `files` | The dialog lists what it wants. |
| You said yes | No more questions for those permissions. |
| You said no | Not asked again for the same permission. |
| The tool later declares a permission it did not before | Asked again, naming only the new one. |
| Two models of one tool open at once | One dialog only. |

### What the scripts see when a key is missing

| Missing | Message in the console |
| --- | --- |
| Not declared | `This script tries to use files, but the tool does not say it needs to. Add the "files" permission to the tool in Build mode.` (for the web: `contact web services` and `"network"`) |
| Not allowed here | `This script tries to use files, but you have not allowed that for this tool in this browser. Open the tool's permissions and allow it.` |

## Examples

- The ER lite example **Export SQL schema...** is meant to need the `files` permission. A tool that only checks gateways needs none, so no dialog appears.
- A tool that posts a summary to a web address declares `network`. Each modeller sees the dialog once.

## Good to know

- **Limits even with permission.** File paths stay inside the workspace folder. Names that start with `_` belong to MetaKit and are refused. Scripts can add new files but cannot replace an existing one. Web calls carry no cookies and no credentials. Only services that accept requests from web pages answer. See [[script-api]].
- **No screen to take a "yes" back.** Clearing the site data of MetaKit in the browser resets the decisions, and also the saved Git tokens, the assistant key and the remembered folder. See [[git-tokens]].
- **Tools from others.** A tool library from a package or a Git repository may declare permissions. The dialog tells you before anything runs. See [[import-export]].
- **Secrets.** Do not put passwords or keys into scripts. They are shared with the tool library. See [[concepts-no-server]].
- **Not a security boundary between people.** Anyone with access to the folder can change a tool's scripts. The dialog protects you from surprises. It does not protect against someone you already share a folder with.

## Related

[[scripts]] · [[script-api]] · [[script-console]] · [[tool-settings]] · [[concepts-tool-library]] · [[troubleshooting]]
