---
id: quick-tour
title: Quick tour
category: start
summary: Ten steps from opening a folder to your first model, using the Agent pipeline sample Kit.
keywords: [quick tour, first model, first steps, getting started, walkthrough, try metakit]
contexts: []
order: 80
---

This tour takes about fifteen minutes. You open a folder, add the sample **Agent pipeline** Kit, draw a few objects and connect them. You need Chrome or Edge on a desktop ([[browser-support]]) and a copy of the sample file `tools/agent-pipeline/tool.json` from the MetaKit repository.

## What it is

A guided path through the whole product. Each step names the exact buttons you click and links to the topic that explains it in full.

## Where to find it

Start at the [[page-start|Start page]]. The tour ends in the [[page-model-view|Model view]].

## How to use it

1. **Say who you are.** On your very first visit a dialog "Who are you?" opens over the Start page. Type a **Display name**, pick a **Colour** and choose **Continue** ([[profile]]). Then choose **Open workspace folder**, pick a new, empty folder (make one called `MetaKit work` if you like) and allow the browser's permission question.
2. **Create the workspace.** MetaKit says "This folder is not a workspace yet". Keep or change the **Workspace name** and choose **Create workspace**.
3. **See the empty state.** You land on the **Models** page. It says there are no models yet and that a model needs a Kit, the language it is drawn in. Choose **Go to Build**.
4. **Add a built-in Kit.** The **Kits** page shows **In this workspace** (still empty) and **Built-in Kits**. On the **Agent pipeline** card choose **Use in this workspace**. A card **Agent pipeline** with **Version 1.0.0** and "No models use it yet." appears under **In this workspace** ([[page-kits]], [[built-in-kits]]).
5. **Look inside (optional).** Choose **Edit** on the card. The Build view lists the **Classes**: Actor, Agent, Human, Task, Artifact, Gate and Stage. Click **Task** to see its attributes such as Status and Priority. Then use **← Kits** to go back ([[page-build-view]]).
6. **Make a model.** Choose **Model** in the top bar, then **New model** ([[dialog-new-model]]). Pick **Kit** "Agent pipeline (1.0.0)", **Model type** "Pipeline", type the **Name** `My first pipeline` and choose **Create**. The model opens.
7. **Place objects.** In the palette on the left, under **Objects**, click **Task**, then click on the canvas. Do the same for **Agent**. Press `Escape` to stop placing ([[placing-objects]]).
8. **Connect them.** In the palette under **Relations**, click **Performs**. Click the Agent, then click the Task. A line appears. A hint line tells you what each click does ([[connecting-objects]], [[interaction-hints]]).
9. **Fill in attributes.** Click the Task. The attribute panel on the right shows its fields. Set **Status** to "Running" and **Estimated effort** to 4 ([[attribute-panel]]). Watch the toolbar: **Saving…** turns into **Saved**.
10. **Check and share.** Open the **Check** menu and choose **Problems** to see whether the model has issues ([[problems-panel]]). Open **File** and choose **Export as image or PDF…** ([[export-image]]). Finally choose **← Models**: your model is in the list, ready to share with anyone who opens the same folder.

## Every option explained

What you have used:

| Step | Feature | Learn more |
| --- | --- | --- |
| 1 to 2 | Workspace folder | [[concepts-workspace]] |
| 3 to 5 | Kits, Build mode | [[concepts-kit]], [[concepts-modes]] |
| 6 | New model | [[dialog-new-model]] |
| 7 to 8 | Palette, canvas | [[palette]], [[selecting]] |
| 9 | Attributes, saving | [[attribute-panel]], [[sync-overview]] |
| 10 | Check, export | [[problems-panel]], [[import-export]] |

## Examples

After step 8 your canvas holds an **Agent** and a **Task** joined by **Performs**. Adding a **Gate** and an **Artifact** and joining them with **Produces** and **Approves** gives you the start of the review pipeline in the sample model `code-review.mkmodel.json`.

## Good to know

- **Undo.** If you slip, press `Ctrl+Z` in the model ([[undo-redo]]).
- **Delete and restore.** Deleting a model only hides it for 30 days ([[trash-and-restore]]).
- **The sample is a file you copy.** MetaKit does not ship Kits inside the app. The Kits page names two samples in the repository, `tools/agent-pipeline/tool.json` and `tools/bpmn-lite/tool.json`.
- **Next steps.** Make your own language: add a **New Kit** in Build. Work with others: see [[sync-overview]]. Ask the Help bar ([[docs-help]]) at any page.

## Related

- [[welcome]]
- [[page-start]]
- [[page-models]]
- [[page-model-view]]
- [[tutorials-index]]
