---
id: glossary
title: Glossary
category: reference
summary: Short definitions of the words MetaKit uses, each with a link to the topic that explains it.
keywords: []
contexts: []
order: 350
---

This is a quick lookup list. Each line gives one short meaning and a link for more. Words are in alphabetical order.

## What it is

A glossary of about one hundred terms from Model mode, Build mode, behaviour, teamwork, the assistant and the file formats. The words in bold are the words you see in the app or in files.

## Where to find it

Open the Documentation area and choose **Glossary** under Reference. See [[docs-help]].

## How to use it

1. Find the word. Words are in alphabetical order.
2. Read the one-line meaning.
3. Follow the link if you need more.

## Every option explained

### A to C

- **Abstract class**: a class you cannot make objects of, used as a parent for others. [[abstract-classes]]
- **Action (of a rule)**: one step in the Then part of a rule, such as setting an attribute. [[rule-actions]]
- **Action attribute**: an attribute that shows as a button and runs a rule, command or script. [[behaviour-commands]]
- **App instance**: see Instance. [[instances-and-presence]]
- **Assistant**: an optional helper that drafts rules, scripts, shapes and classes from a sentence. [[assistant-overview]]
- **Asset**: an image or other file stored with a tool library. [[git-layout]]
- **Attribute**: a named, typed value that a class, relation class or model type holds. [[attributes]]
- **Attribute panel**: the side panel where you edit the attributes of the selected object. [[attribute-panel]]
- **Attribution**: knowing which window made a change; it is not security. [[instances-and-presence]]
- **Auto-layout**: arranging objects automatically with a layout engine. [[auto-layout]]
- **Base (Git)**: the state of the repository at your last pull or commit. [[git-mode]]
- **Before event**: an event that says "is about to" and can be cancelled. [[rule-triggers]]
- **Birth**: the stamp that says a thing exists; an undo of a delete writes a new one. [[conflicts-and-merging]]
- **Branch**: a line of commits in a repository. A Git link follows one. [[git-mode]]
- **Build mode**: the part of MetaKit where method engineers build tool libraries. [[concepts-modes]]
- **Bundle**: a `.mkbundle` zip with models and their tool library. [[import-export]]
- **Cancel (a change)**: stopping what a "before" event announced. [[rule-actions]]
- **Canvas**: the drawing area where a model is shown and edited. [[canvas-navigation]]
- **Cardinality**: how many objects or connectors a rule of the model type allows. [[model-types]]
- **Change file**: a write-once `.jsonl` file with the edits of one instance. [[sync-overview]]
- **Class**: a kind of object in a tool library, such as Task. [[classes]]
- **Clash**: two people changing the same field; in folders the later wins, in Git you choose. [[conflicts-and-merging]]
- **Clipboard**: copy, paste and duplicate of objects. [[clipboard]]
- **Command**: something a person starts by hand from a menu, toolbar or button. [[behaviour-commands]]
- **Command registry**: the list of commands of the open model. [[behaviour-commands]]
- **Commit**: a saved step in a Git repository; **Commit and push** sends one. [[git-commit]]
- **Computed value**: a value calculated from a formula and never stored. [[computed-values]]
- **Condition**: the If part of a rule, a formula that must be true. [[rules]]
- **Console**: the log where scripts print and report errors. [[script-console]]
- **Constraint**: a formula that checks an object and gives a message when it fails. [[constraints]]
- **Container**: an object that holds other objects, such as a lane. [[containers-swimlanes]]
- **Context menu**: the menu on right-click. [[context-menu]]
- **CSV export**: one spreadsheet file per class and relation class. [[import-export]]

### D to H

- **Death**: the stamp that marks a thing as deleted; see Tombstone. [[conflicts-and-merging]]
- **Dependency tracking**: noting what a formula read so it recalculates only when needed. [[computed-values]]
- **Divergence**: two windows with the same files but different states, shown as a warning. [[instances-and-presence]]
- **Document**: a tool library or a model; both share one store, undo and sync. [[concepts-workspace]]
- **Draft**: a rule, script, shape or class proposed by the assistant. [[assistant-drafts]]
- **Draw list**: the list of drawing steps a shape compiles to. [[shape-properties]]
- **Event**: a message that something happened or is about to; 24 exist. [[rule-triggers]]
- **Export**: saving a model as an image, PDF, CSV, bundle or editable file. [[import-export]]
- **File System Access API**: the browser feature that lets MetaKit open your folder. [[browser-support]]
- **Folder health**: the check of the shared folder for signs of sync trouble. [[sync-status]]
- **Format version**: the number in a file that says which shape it has. [[format-versions]]
- **Formula**: a short expression starting with `=` that calculates a value. [[formula-reference]]
- **Formula attribute**: an attribute whose value is calculated. [[attribute-types]]
- **Git link**: the record in your browser that ties a tool library to a repository folder. [[git-mode]]
- **Git mode**: keeping a tool library in GitHub or GitLab. [[git-mode]]
- **Hash**: a short fingerprint of a document's state, used to compare windows. [[instances-and-presence]]
- **History**: undo, snapshots, trash, sync service versions and Git commits. [[history]]
- **Hybrid logical clock**: the stamp that orders edits the same way on every computer. [[sync-overview]]

### I to M

- **Identity file**: the small `tool.json` or `model.json` that says what a folder is. [[file-formats]]
- **Import**: bringing a model, bundle, tool package or tool file into the workspace. [[import-export]]
- **IndexedDB**: the browser database that holds tokens, keys, permissions and your profile. [[file-formats]]
- **Instance**: one open window (tab) of MetaKit. [[instances-and-presence]]
- **Instance id**: the 8-character name of an instance, used as its folder under `_state`. [[instances-and-presence]]
- **Key**: the human name of a class or attribute, used in formulas and scripts. [[keys-and-renaming]]
- **Label**: the text people see for a class or attribute, which can be translated. [[keys-and-renaming]]
- **Last writer wins**: the merge rule: the later stamp of a field is kept. [[conflicts-and-merging]]
- **Layer**: a named group of shapes that can be shown or hidden. [[shape-layers]]
- **Merge**: combining the work of several people into one state. [[sync-overview]]
- **Migration**: a step that brings an old file up to the current format. [[format-versions]]
- **mkmodel**: the editable model file, `.mkmodel.json`. [[file-formats]]
- **mktool**: the tool package file, a zip. [[file-formats]]
- **Model**: a diagram and its data, made with a tool library. [[concepts-model]]
- **Model mode**: the part of MetaKit where modellers build models. [[concepts-modes]]
- **Model type**: a kind of model in a tool library, with its classes and views. [[model-types]]
- **Model toolbar**: the bar above the canvas with Commands, Undo, Fit and more. [[model-toolbar]]

### N to R

- **Newer-version refusal**: MetaKit will not open a file from a newer release. [[format-versions]]
- **Object**: one thing on the canvas, made from a class. [[placing-objects]]
- **Palette**: the list of classes you can place. [[palette]]
- **Panel layout**: how the attribute panel of a class is arranged. [[panel-layout]]
- **Permission**: a power (web or files) a tool asks for and each browser allows. [[script-permissions]]
- **Presence**: showing who has a model open and what they select. [[instances-and-presence]]
- **Problems panel**: the list of checks that failed in a model. [[problems-panel]]
- **Pull**: bringing the work of others from the repository into your tool library. [[git-pull-conflicts]]
- **QuickJS**: the small JavaScript engine in WebAssembly that runs scripts. [[scripts]]
- **Reference**: an attribute that points to other objects or models. [[references]]
- **Register**: one field with a value and a stamp, the unit of merging. [[sync-overview]]
- **Relation class**: a kind of connector in a tool library. [[relations]]
- **Release**: a tagged version of a tool library in Git. [[git-releases]]
- **Repository**: the Git project on GitHub or GitLab that holds a tool library. [[git-mode]]
- **Rule**: a no-code reaction written as When, If and Then. [[rules]]
- **Rule engine**: the part that runs rules inside the model's steps. [[rules]]

### S to Z

- **Sandbox**: the sealed box in which scripts run. [[scripts]]
- **Script**: a TypeScript program in a tool library. [[scripts]]
- **Script API**: the functions of the `metakit` module. [[script-api]]
- **Selection**: the objects you have picked on the canvas. [[selecting]]
- **Sequence number**: the six digits in the name of a change file. [[file-formats]]
- **Shape**: how a class or relation class is drawn. [[shapes-section]]
- **Slug**: the folder name of a tool or model, which never changes. [[file-formats]]
- **Snapshot**: the merged state of a document at one moment. [[history]]
- **Stamp**: a time and counter that order an edit. [[sync-overview]]
- **Swimlane**: a container shaped as a lane. [[containers-swimlanes]]
- **Sync service**: OneDrive, SharePoint, Google Drive or Dropbox, which copies the folder. [[sync-overview]]
- **Tag (Git)**: a name on a commit; MetaKit shows tags as releases. [[git-releases]]
- **Token**: a secret that lets MetaKit use your GitHub or GitLab repository. [[git-tokens]]
- **Tombstone**: a delete mark that stays in the files for 30 days. [[history]]
- **Tool library**: a modelling language: classes, relation classes, shapes, rules and scripts. [[concepts-tool-library]]
- **Trash**: where deleted models and tool libraries wait 30 days. [[trash-and-restore]]
- **Trigger**: the event that starts a rule. [[rule-triggers]]
- **TypeScript**: the language of scripts. [[script-editor]]
- **Undo step**: one group of changes that Undo takes back together. [[undo-redo]]
- **View**: a subset of a model type's classes shown in the palette. [[model-types]]
- **Workspace**: the shared folder that holds tool libraries and models. [[concepts-workspace]]
- **Write-once file**: a file created once and never changed. [[sync-overview]]

## Examples

- You read "tombstone" in a Git message. Look it up: a delete mark. Then read [[history]].
- A colleague says "clash". Look it up: two edits to one field. Then read [[conflicts-and-merging]].

## Good to know

- **Not for auto-links.** Words in this list are not linked automatically from other topics. The topics link to each other with their own keywords.
- **Missing a word?** Use the search in the Documentation area. See [[docs-help]].

## Related

[[welcome]] · [[quick-tour]] · [[docs-help]] · [[troubleshooting]]
