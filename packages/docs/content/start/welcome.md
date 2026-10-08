---
id: welcome
title: Welcome to MetaKit
category: start
summary: MetaKit lets you build your own modelling language and draw models with it, all inside your browser.
keywords: [metakit, what is metakit, product overview, documentation map, method engineer, modeller]
contexts: []
order: 10
---

MetaKit is a tool for two kinds of people. **Method engineers** design a modelling language: which kinds of things exist, how they connect and how they look. **Modellers** use that language to draw real models. Both work in the same app, in your browser, on plain files in a folder you choose.

## What it is

MetaKit is a modern rebuild of the ideas behind ADOxx, without simulation, analysis, database or user management. It has two areas:

- **Build** is where a method engineer makes a [[concepts-tool-library|tool library]]: classes, relation classes, attributes, shapes, panel layouts, rules and scripts.
- **Model** is where a modeller opens a [[concepts-model|model]], places objects from a palette, connects them and fills in their attributes.

Everything lives in a [[concepts-workspace|workspace folder]] on your computer. If you keep that folder in OneDrive, SharePoint, Google Drive or Dropbox, your team shares it through that service and can work in it at the same time. See [[sync-overview]] for how that works.

## Where to find it

The first page you see is the [[page-start|Start page]]. Once a workspace is open, the [[top-bar]] lets you switch between **Model** and **Build**. The documentation you are reading is always one click away: see [[docs-help]].

## How to use it

If you are new, take this path:

1. Read [[concepts-workspace]], [[concepts-tool-library]], [[concepts-model]] and [[concepts-modes]]. Together they take about five minutes.
2. Check that your browser works: [[browser-support]].
3. Follow the [[quick-tour]]. It takes you from an empty folder to a first model in ten steps.
4. Look up details in the topics below whenever you need them.

## The map of the documentation

The topics are grouped in categories. The same groups appear in the **Documentation** area.

| Category | What you find there | Start with |
| --- | --- | --- |
| **Getting started** | What MetaKit is, key ideas, supported browsers, the quick tour. | [[quick-tour]] |
| **Pages and dialogs** | Every page outside the editors: Start page, Models page, Tool libraries page, top bar, settings, dialogs. | [[page-start]], [[page-models]], [[page-tool-libraries]] |
| **Model mode** | Drawing: palette, canvas, selecting, connecting, attributes, find, problems, auto-layout, export. | [[page-model-view]] |
| **Build mode** | Making tool libraries: classes, attributes, relation classes, model types, appearance, shapes, settings. | [[page-build-view]] |
| **Behaviour** | Rules, scripts and the commands they add to menus. | [[rules]], [[scripts]] |
| **Sync, Git and history** | Working together in a shared folder, conflicts, history, Git mode for tool libraries. | [[sync-overview]], [[git-mode]] |
| **Assistant** | The optional AI helper that drafts parts of a tool library. | [[assistant-overview]] |
| **Reference** | Formula language, file formats, limits, troubleshooting, glossary. | [[formula-reference]], [[troubleshooting]], [[glossary]] |
| **Tutorials** | Step-by-step lessons. This category is still empty and will fill over time. | [[tutorials-index]] |

## Examples

Throughout the documentation one sample tool library appears again and again: **Agent pipeline** (the folder `tools/agent-pipeline` in the MetaKit repository). It describes work done by AI agents and humans. Its classes are **Agent**, **Human**, **Task**, **Artifact**, **Gate** and **Stage**, and its relation classes include **Performs** (an agent performs a task) and **Produces** (a task produces an artifact). Its sample model `code-review.mkmodel.json` shows a small review pipeline.

## Good to know

- MetaKit has no server, no database and no accounts. See [[concepts-no-server]].
- MetaKit works in Chrome and Edge on a desktop computer. Other browsers show a message instead. See [[browser-support]].
- The documentation ships with the app and works offline.
- If something does not work, go to [[troubleshooting]]. Words you do not know are explained in the [[glossary]].

## Related

- [[quick-tour]]
- [[concepts-modes]]
- [[docs-help]]
- [[glossary]]
