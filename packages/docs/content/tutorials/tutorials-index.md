---
id: tutorials-index
title: Tutorials
category: tutorials
summary: The step-by-step tutorials that exist, the ones that are planned, and what to read until then.
keywords: [step-by-step tutorials, planned tutorials, tutorial list, tutorial index, learning path]
contexts: []
order: 360
---

> **Note:** Two tutorials are written so far: [[data-ai-architecture]] and [[ai-use-case-portfolio]]. The other tutorials in the list below are **planned** and not available today.

Tutorials are guided, hands-on lessons. You follow numbered steps and end with something that works. They are different from the reference pages, which describe every control.

## What it is

The Tutorials category of the Documentation area lists every tutorial that is written. Each one appears under this category and in the search, and it links to the reference pages for each step.

## Where to find it

Open the Documentation area from the top bar and choose **Tutorials** in the topic tree. See [[docs-help]] for how the Documentation area and the Help side bar work.

## How to use it

Start with a written tutorial, or, until the one you need exists:

1. Start with the [[quick-tour]] for a first walk through the app.
2. Read [[concepts-modes]] to see the difference between Model mode and Build mode.
3. Try the sample tool libraries from the repository folder `tools/`. [[rule-examples]] and [[script-examples]] walk through the rules and scripts that come with them.
4. Use the reference topics for each page as you work. The Help side bar opens at the topic of the page you are on.

## Every option explained

### Written tutorials

| Tutorial | What you do | Reference pages it uses |
| --- | --- | --- |
| [[data-ai-architecture]] | Draw a data platform from a source system to a consumer, see the personal-data warning and list the lineage of a dataset. | [[connecting-objects]], [[problems-panel]], [[behaviour-commands]] |
| [[ai-use-case-portfolio]] | Add the AI use-case portfolio tool, model use cases, score them, see their quadrant colours and rank them. | [[computed-values]], [[constraints]], [[menu-commands]] |

### Planned tutorials

All of these are **planned**, not written.

| Planned tutorial | What you would do | Reference pages it would use |
| --- | --- | --- |
| Build your first tool | Make a tool library with two classes, a relation class and a model type; give them shapes; try it. | [[classes]], [[relations]], [[model-types]], [[appearance-editor]] |
| Model a process | Make a model, place and connect objects, edit attributes, check problems, export an image. | [[page-model-view]], [[palette]], [[connecting-objects]], [[export-image]] |
| Add behaviour | Add a rule that warns about a missing owner, then a script that checks a whole model. | [[rules]], [[scripts]] |
| Work together over OneDrive | Share a workspace folder, open it on two computers, see presence, and settle a clash. | [[sync-overview]], [[instances-and-presence]], [[conflicts-and-merging]] |
| Publish through Git | Put a tool library in a repository, commit, pull, and tag a version. | [[git-mode]], [[git-commit]], [[git-releases]] |

### How tutorials will look

Each tutorial is planned to have:

- a goal in one sentence,
- what you need before you start,
- numbered steps, each with the exact label of the control,
- a check at the end that tells you it worked,
- links to the reference page for every control it uses.

## Examples

The Agent pipeline tool in the repository is a good example of a finished tool library: classes for agents, humans, tasks, artifacts and gates, a "Check pipeline" script and status commands. Reading how it is built is what a tutorial on "Add behaviour" would walk through.

## Good to know

- **Suggest one.** Tutorials are written when the project owner approves them. Tell the project owner which one you need first.
- **Offline.** All documentation ships inside the app and works without a connection. Tutorials will too.

## Related

[[data-ai-architecture]] · [[welcome]] · [[quick-tour]] · [[docs-help]] · [[concepts-modes]] · [[glossary]]
