---
id: page-tool-libraries
title: Tool libraries page
category: pages
summary: The list of tool libraries in the workspace, where you make, add, edit, export and delete them.
keywords: [tool libraries page, new tool library, add tool library, from file, from git, edit tool library, no tool library yet]
contexts: [tool-libraries]
order: 30
---

The Tool libraries page is the home of **Build** mode. Each tool library of the workspace is a card. From here you make a new library, add one from a file or from Git, open one for editing, export it or delete it.

## What it is

A page titled **Tool libraries** with the line "Tool libraries define the notation and rules models use." At the top right are the **Add** menu and the **New tool library** button. Below are optional messages, then the cards or an empty state, then a **Deleted tool libraries** section.

## Where to find it

Choose **Build** in the [[top-bar]] when no tool library is open. **← Tool libraries** in the [[page-build-view|Build view]] brings you back, and **Go to Build** on the empty [[page-models|Models page]] leads here.

## How to use it

**Make a library from scratch**

1. Choose **New tool library**. A form opens: **Name of the new tool library**, with the hint "For example: Order process".
2. Type a name. An empty name is refused with "Give the tool library a name."
3. Choose **Create and edit**. The library is created (version `0.1.0`, no classes) and opens in the Build view.

**Add a library from a file**

1. Choose **Add**, then **From file…**.
2. Pick a `tool.json` file, for example `tools/agent-pipeline/tool.json`.
3. The library appears as a card. There is no confirmation step for this route.

**Add a library from Git**

1. Choose **Add**, then **From Git…**. The Git settings open ([[git-mode]]).
2. Connect to a repository and choose a library there.

**Edit, export or delete**

1. Choose **Edit** on a card to open the Build view.
2. Choose **…** on a card for **Export package** (saves a `.mktool` file) or **Delete**.

## Every option explained

| Control | What it does |
| --- | --- |
| **Add > From file…** | Opens the file chooser for a tool library file (`.json`). |
| **Add > From Git…** | Opens the Git settings to bring in a library from GitHub or GitLab. |
| **New tool library** | Shows or hides the naming form. |
| **Name of the new tool library** | The name of the new library. |
| **Create and edit** | Creates the library and opens it for editing. |
| **Cancel** | Closes the naming form. |
| Card heading and badge | Library name and **Version x.y.z**. |
| Card line | "No models use it yet." or "Used by n model(s)." |
| **Edit** | Opens the library in Build. |
| **… > Export package** | Downloads `name-version.mktool`. See [[import-export]]. |
| **… > Delete** | Moves the library to **Deleted tool libraries**. |
| **Deleted tool libraries (n), kept for 30 days** | Collapsible list with a **Restore** button for each. See [[trash-and-restore]]. |

**Empty state "No tool library yet".** It says "Without a tool library there is nothing to model with. There are three ways to start": **Build one** from scratch with "New tool library"; **Add a file** with Add, From file (the repository has samples such as `tools/agent-pipeline/tool.json` and `tools/bpmn-lite/tool.json`); or **Use a Git repository** with Add, From Git.

**Errors when adding a file** appear as a red message at the top:

- "That file is not a tool library: it is not valid JSON."
- "That file cannot be read: ..." for a file from a newer release of MetaKit.
- "That file is not a valid tool library." followed by a list of problems.
- "The tool library "name" is already in this workspace."

The same messages area shows warnings and sharing problems as on the Models page ([[page-models]], [[sync-status]]).

## Examples

The workspace has one card: **Agent pipeline**, **Version 1.0.0**, "Used by 2 models." Choosing **Edit** opens it in Build, where you can add a Priority attribute to **Task**. Choosing **… > Export package** saves `agent-pipeline-1.0.0.mktool`, which a colleague can add with **Import / Export** on their Models page ([[dialog-tool-import]]).

## Good to know

- **File route versus package route.** A plain `tool.json` is added directly and only when the library is not yet in the workspace. A `.mktool` package is imported on the Models page and shows a review dialog first, which also lets you update an existing library.
- **Deleting a library does not delete its models.** They stay in the list but show **Tool library not found** until you restore the library.
- **Version badge.** It shows the version typed in the Build bar of that library.
- Libraries are shared through the workspace folder like models ([[sync-overview]]).

## Related

- [[concepts-tool-library]]
- [[page-build-view]]
- [[dialog-tool-import]]
- [[import-export]]
- [[git-mode]]
