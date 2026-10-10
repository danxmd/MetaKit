---
id: page-kits
title: Kits page
category: pages
summary: The Kits of the workspace and the built-in ones, where you make, copy, add, edit, export and delete them.
keywords: [new kit, add kit, from file, from git, edit kit, no kit yet, in this workspace, new kit dialog, start from]
contexts: [kits]
order: 30
---

The Kits page is the home of **Build** mode. It shows two kinds of Kit apart: the ones that belong to **this workspace**, which your team edits, and the **built-in** ones that come with MetaKit, which are read-only. From here you make a new Kit (empty or as a copy), use a built-in one, add one from a file or from Git, open one for editing, export it or delete it.

## What it is

A page titled **Kits** with the line "Kits define the notation and rules models use." At the top right are the **Add** menu and the **New Kit** button. Below are optional messages, then two sections:

- **In this workspace**: a card for each Kit of the workspace, or an empty state.
- **Built-in Kits**: a card for each built-in Kit ([[built-in-kits]]). These cards look different on purpose: a grey, dashed card with the badge **Built-in · read-only**.

At the bottom is the **Deleted Kits** section.

## Where to find it

Choose **Build** in the [[top-bar]] when no Kit is open. **← Kits** in the [[page-build-view|Build view]] brings you back, and **Go to Build** on the empty [[page-models|Models page]] leads here.

## How to use it

**Make a Kit from scratch**

1. Choose **New Kit**. The **New Kit** dialog opens.
2. Type a **Name**, for example "Order process". An empty name is refused with "Give the Kit a name."
3. Leave **Start from** at **Empty**.
4. Choose **Create and edit**. The Kit is created (version `0.1.0`, no classes) and opens in the Build view.

**Copy a Kit and extend it**

1. Choose **Copy and extend…** on a built-in card, or **… > Copy and extend…** on a card of this workspace. You can also choose **New Kit** and pick the Kit under **Start from**.
2. Type a **Name** for the copy. A line under the list says what the copy starts with.
3. Choose **Create and edit**. The copy opens in the Build view with everything the original has: classes, relation classes, model types, looks, panels, rules and scripts. Its version is `1.0.0` and its card says **Based on** with the name and version of the original. The original does not change.

**Use a built-in Kit as it is**

1. Choose **Use in this workspace** on a built-in card.
2. The Kit appears under **In this workspace**, unchanged, and the built-in card now says **✓ In this workspace**. You can now make models with it, and edit it like your own.

**Add a Kit from a file**

1. Choose **Add**, then **From file…**.
2. Pick a Kit file (`.json`), for example `kits/agent-pipeline/kit.json` from the MetaKit repository.
3. The Kit appears as a card. There is no confirmation step for this route.

**Add a Kit from Git**

1. Choose **Add**, then **From Git…**. The Git settings open ([[git-mode]]).
2. Connect to a repository and choose a Kit there.

**Edit, export or delete**

1. Choose **Edit** on a card to open the Build view.
2. Choose **…** on a card for **Export package** (saves a `.mktool` file) or **Delete**.

## Every option explained

| Control | What it does |
| --- | --- |
| **Add > From file…** | Opens the file chooser for a Kit file (`.json`). |
| **Add > From Git…** | Opens the Git settings to bring in a Kit from GitHub or GitLab. |
| **New Kit** | Opens the **New Kit** dialog. |
| **Name** (dialog) | The name of the new Kit. |
| **Start from** (dialog) | **Empty**, a Kit of this workspace, or a built-in Kit. Anything but Empty makes a copy. |
| **Create and edit** (dialog) | Creates the Kit and opens it for editing. |
| **Cancel** (dialog) | Closes the dialog and creates nothing. `Escape` does the same. |
| Card heading and badge | Kit name and **Version x.y.z**. |
| **Based on …** | Shown on a copy: the name and version of the Kit it was copied from. A Kit added unchanged from the built-in set says "Added from the built-in set." |
| Card line | "No models use it yet." or "Used by n model(s)." |
| **Edit** | Opens the Kit in Build. |
| **… > Copy and extend…** | Opens the dialog with this Kit chosen under **Start from**. |
| **… > Export package** | Downloads `name-version.mktool`. See [[import-export]]. |
| **… > Delete** | Moves the Kit to **Deleted Kits**. |
| **Deleted Kits (n), kept for 30 days** | Collapsible list with a **Restore** button for each. See [[trash-and-restore]]. |

**Built-in cards**

| Control | What it does |
| --- | --- |
| **Built-in · read-only** | Built-in Kits cannot be edited where they are. |
| **What is inside** | Opens to list the classes and relation classes of the Kit. |
| **Use in this workspace** | Adds the Kit unchanged, keeping its id and version. Afterwards the card says **✓ In this workspace**. |
| **Copy and extend…** | Opens the **New Kit** dialog with this Kit chosen. |

**Empty state "No Kit in this workspace yet".** It says "Without one there is nothing to model with" and lists four ways to start: **use a built-in one**, **copy one and extend it**, **build one from scratch** with "New Kit", or **bring one in** with Add, from a file or a Git repository.

**Errors when adding a file** appear as a red message at the top:

- "That file is not a Kit: it is not valid JSON."
- "That file cannot be read: ..." for a file from a newer release of MetaKit.
- "That file is not a valid Kit." followed by a list of problems.
- "The Kit "name" is already in this workspace."

The same messages area shows warnings and sharing problems as on the Models page ([[page-models]], [[sync-status]]).

## Examples

Anna wants her own version of the agent Kit. On the Kits page she chooses **Copy and extend…** on the built-in **Agent pipeline**, names the copy "Our agents" and chooses **Create and edit**. The copy opens in Build, where she adds a **Reviewer** class. Back on the page, the card **Our agents** says **Based on Agent pipeline 1.0.0**, and the built-in card still offers **Use in this workspace**.

The workspace has one card: **Agent pipeline**, **Version 1.0.0**, "Used by 2 models." Choosing **Edit** opens it in Build, where you can add a Priority attribute to **Task**. Choosing **… > Export package** saves `agent-pipeline-1.0.0.mktool`, which a colleague can add with **Import / Export** on their Models page ([[dialog-kit-import]]).

## Good to know

- **File route versus package route.** A plain Kit file (`.json`) is added directly and only when the Kit is not yet in the workspace. A `.mktool` package is imported on the Models page and shows a review dialog first, which also lets you update an existing Kit.
- **Deleting a Kit does not delete its models.** They stay in the list but show **Kit not found** until you restore the Kit.
- **Version badge.** It shows the version typed in the Build bar of that Kit.
- Kits are shared through the workspace folder like models ([[sync-overview]]). Built-in Kits are part of MetaKit itself; only the ones you use or copy are written to the folder.
- **A copy does not follow its original.** If a built-in Kit gets a newer version in a later release of MetaKit, your copy keeps what it had.

## Related

- [[concepts-kit]]
- [[built-in-kits]]
- [[page-build-view]]
- [[dialog-kit-import]]
- [[import-export]]
- [[git-mode]]
