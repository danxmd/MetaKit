# MetaKit (modern ADOxx) — Implementation Plan

Owner: Danial Mohammadi Amlashi · As of 7 October 2026 · Live version: https://claude.ai/code/artifact/2f34f2bb-675b-4662-be8a-14916126ec8c

## Executive summary

Build one lightweight browser app, **MetaKit**, where a method engineer builds a modelling tool and a modeller uses it, side by side, on plain files in a shared folder. It keeps the ADOxx meta-model of classes, relation classes, attributes and model types, and drops simulation, analysis, ADOxx import, the database and user management.

Six architecture bets carry the plan:

1. **A folder is the workspace.** Tool libraries and models are readable JSON files plus SVG assets, in a folder synced by OneDrive, SharePoint, Google Drive or Dropbox. Tool libraries can also live in a GitHub or GitLab repository. Whoever can open the folder or repository can work with it: no server, no database, no accounts.
2. **Conflict-free sharing through any sync service.** Each running app writes only its own small change files and never edits them afterwards; every app merges them the same way (last writer wins per field). Sync clients therefore never see two writers on one file.
3. **A purpose-built canvas.** A Canvas 2D renderer with a spatial index and cached shape drawings targets 60 fps while dragging, in models of 5,000 objects. The same drawing instructions export to SVG, PNG and PDF.
4. **Shapes instead of GraphRep.** Notations are declarative shape templates made in a visual editor; any property can be bound to attribute values with a one-line formula.
5. **Three levels of behaviour instead of AdoScript.** Formulas for computed values and checks, no-code "When / If / Then" rules, and TypeScript scripts in a sandbox. An optional AI assistant drafts all three from a plain description.
6. **One browser app, two modes, nothing to install.** A static web app for Chrome or Edge: Build mode edits a tool library, Model mode uses it, and it keeps working offline after the first visit.

Claude Code writes the code in small, spec-driven steps, and you review each one. Assuming about 6 hours a week of your time, a usable version (tool building, modelling and folder sync) lands around week 12 and version 1.0 around week 22. The Decisions section records your answers and six follow-up questions.

## ADOxx today: the baseline to cover

ADOxx 1.8.0 is a closed-source Windows program (macOS and Linux only through Wine), free for research and teaching only, and it keeps everything in an SQLite or SQL Server database ([install](https://adoxx.org/documentation/01_getting_started/04_start_adoxx.html), [licence](https://adoxx.org/assets/EndUserLicenceAgreement_ADOxx.pdf)). Its meta-model is sound and stays; its languages, storage and admin layer are what we replace. The table maps each ADOxx feature to the new platform.

| ADOxx feature | What it does | New platform |
| --- | --- | --- |
| [Application library](https://adoxx.org/documentation/10_modelling_language/01_application_library.html) (dynamic BP + static WE library) | Holds the whole meta-model; dynamic = graph models, static = tree models such as org charts | One **tool library** per tool. The dynamic/static split is dropped: a model type simply lists its classes |
| [Classes](https://adoxx.org/documentation/10_modelling_language/10_classes.html), single inheritance, abstract classes, predefined roots (`__D-construct__`, `__D_container__`, `__D_swimlane__`, `__D_aggregation__`) | Concepts and their behaviour | Keep classes, single inheritance, abstract classes. Predefined roots become three kinds a class picks: **node**, **container**, **swimlane** |
| Relation classes (FROM/TO, always drawn, no inheritance) | Typed connectors | Keep, including FROM/TO lists that may name abstract classes |
| Record classes, `RECORD` attributes | Tables inside an attribute | Keep as a **table** attribute with a column schema |
| Attribute profiles (`PROFREF`) | Shared reusable values outside models | After 1.0, as **shared catalogs** |
| Class vs instance [attributes](https://adoxx.org/documentation/10_modelling_language/20_attributes.html) | Configuration vs per-object values | Keep; class attributes become tool settings |
| 17 [attribute types](https://adoxx.org/documentation/10_modelling_language/21_attribute_types.html) | INTEGER to PROGRAMCALL | Drop `DISTRIBUTION` (simulation) and `HTTP` (marked unstable). Merge `STRING`/`LONGSTRING`/`CLOB` into text with a length limit. `PROGRAMCALL` becomes an action button |
| [Facets](https://adoxx.org/documentation/10_modelling_language/22_attribute_facets.html) (regex, numeric domain, help text, row limits) | Attribute constraints | Keep as constraints on the attribute |
| [Special attributes](https://adoxx.org/documentation/10_modelling_language/23_special_attributes.html): cardinalities, allowed objects, model pointer | Structural rules, container rules, navigation | Keep. Cardinalities become validation warnings, never hard blocks, because two people can break them concurrently |
| [Model types](https://adoxx.org/documentation/10_modelling_language/30_model_types.html) and modes | Which classes a model may use; switchable views | Keep; modes are called **views** |
| `INTERREF` | Links to a model or an object in another model | Keep as a **reference** attribute, followed with Ctrl+click |
| [GraphRep](https://adoxx.org/adoscript_reference/31_graphrep/index.html), about 60 commands, units in cm/mm, origin at the centre | Notation | Replace with **Shapes** (section on notation) |
| [AttrRep](https://adoxx.org/adoscript_reference/30_attrrep/index.html): notebook, chapters, groups, hidden/enabled/mandatory | Attribute dialog layout | Replace with generated **attribute panels** plus optional layout |
| [AdoScript](https://adoxx.org/adoscript_reference/01_adoscript/) and LEO: about 400 message-port calls, [73 events](https://adoxx.org/adoscript_reference/50_events/index.html), menu items, `EXPRESSION` attributes | Behaviour and automation | Replace with **formulas, rules and scripts** (section on behaviour) |
| [Library attributes](https://adoxx.org/documentation/70_adoxx_components/20_Library_Management/Library_attributes.html): grid, layers, layout algorithm, numbering, page layouts | Tool-wide settings | Keep grid, layers, numbering as tool settings; page layouts become export templates later |
| Formats: ABL (binary), [ALL](https://adoxx.org/documentation/75_adoxx_development_languages/6_adoxx_library_language_all.html) (text), [ADL](https://adoxx.org/documentation/75_adoxx_development_languages/5_adoxx_model_language_adl.html) (text), XML; image export incl. SVG | Exchange | Own JSON formats; ADOxx files are not imported |
| Modelling Toolkit: graphical and tabular views, explorer with model groups, versions, find, layout algorithms, printing | Day-to-day modelling | Keep graphical view, explorer (= folders), find, auto-layout; tabular view in a later phase; named checkpoints in version 1.1 |
| [AQL](https://adoxx.org/documentation/75_adoxx_development_languages/01_AQL.html) queries, simulation, evaluation, acquisition | Analysis components | **Dropped**, as requested. A simple search and filter remains |
| [Development Toolkit](https://adoxx.org/documentation/70_adoxx_components/index.html): users, rights, components, DB file store | Administration | **Dropped**. Library management becomes Build mode |

## Product scope

Version 1 is one browser app with two modes: **Build** for making a modelling tool and **Model** for using it. It is sized for models of up to 5,000 objects and about 10 people working in one shared folder.

**In scope**

- **Build mode:** classes, relation classes, attributes with constraints, model types and views, containers and swimlanes, references across models, Shapes (notation), attribute panels, formulas, rules, scripts, custom commands (menu, toolbar, context menu), tool packaging and versioning, label translations.
- **Model mode:** explorer with folders, new model of a chosen type, a palette filtered by model type and view, place / connect / move / resize, bend points, containers and swimlanes, inline text editing, attribute panel, multi-select, align and distribute, copy and paste across models, undo and redo, find, validation list, minimap, zoom, grid and snap, auto-layout.
- **Collaboration:** several people on the same tool library and the same models through a shared folder, with indicators of who is editing what. Tool libraries can also be versioned in GitHub or GitLab (Git mode).
- **Exchange:** tool packages, editable model files, images (SVG, PNG, PDF) and CSV.
- **Assistant (optional):** drafts classes, shapes, rules and scripts from a description, using your own AI API key.

**Out of scope**

- Simulation, AQL analysis queries, evaluation and acquisition.
- Importing ADOxx libraries and models.
- Any server, database, user account or rights system.
- Keystroke-level live collaboration: changes arrive as fast as the sync service carries them, usually seconds.
- Scripts that start programs on the user's computer, which a browser does not allow (follow-up question 21).
- Editing on phones and tablets; print page layouts (PDF export replaces printing).

**Decided on 7 October**

- First users are project teams building their own modelling methods.
- Browser only. Opening a local synced folder needs Chrome, Edge or another Chromium browser on a desktop computer, because [Firefox and Safari lack the folder picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). Those browsers can still open Git workspaces, and cloud drives once direct connectors exist.
- Open source; tool libraries carry their own licence. Independent of OMiLAB for now.
- Claude Code writes the code; you review and test it.
- English user interface first; tool libraries can carry labels in several languages, as ADOxx's per-language `name_xx` does today.

**Why not build on an existing platform?** The closest open-source option, Eclipse [Sirius Web](https://eclipse.dev/sirius/sirius-web.html), runs on a Spring Boot server with PostgreSQL and GraphQL. That is the opposite of the serverless, file-based tool you described, so we borrow its ideas (domain plus view definitions, low-code configuration) rather than its stack.

## Architecture

Each person runs the whole app in their own browser; the only thing instances share is the folder or repository. A UI-free core holds the meta-model, the model store and the behaviour engines, and the storage layer turns every change into small files that only that browser writes.

```text
App instance (one per browser; static files from GitHub Pages, cached for offline use)
├─ Interface (Svelte 5)      Model mode: explorer, palette, canvas, panels
│                            Build mode: class, shape, rule, script editors
├─ Canvas engine (60 fps)    Renderer (Canvas 2D, culling) · Interaction (tools, hit-testing) · Exporters (SVG, PNG, PDF)
├─ Core (UI-free TS)         Meta-model · Model store (commands, undo) · Shape compiler
│                            Rule engine (formulas, rules) · Script sandbox (QuickJS) · Validation
├─ Storage and sync          Change files (write-once, own folder) · CRDT merge · Snapshots and presence
└─ Storage adapters          Local folder (File System Access API) · Git (GitHub, GitLab APIs) · Cloud drives (after 1.0)
          │  writes its own files, reads everyone's
          ▼
Shared folder or repository  Synced: OneDrive, SharePoint, Google Drive, Dropbox · Git: GitHub, GitLab (tool libraries)
          ▲
          └─ other browsers: same app, same folder; changes arrive in seconds
```

Read it top-down: the interface and canvas call the core, the core persists through storage and sync, and only the thin storage adapter differs between a synced folder, a Git repository and, later, a direct cloud connection.

Six rules keep it simple and fast:

1. **Everything is a document.** A tool library and a model are both documents with the same store, undo, sync and history.
2. **Commands are the only way to change state.** Clicks, rules and scripts all call one command API, so undo, change files and events live in one place.
3. **Drawing is derived, never stored.** Element state runs through the shape compiler into cached draw lists, keyed by the attribute values each shape reads.
4. **The core runs without a UI.** The same code powers a Node.js command-line tool for batch export or for checking models in CI.
5. **Tool changes hot-reload.** Saving a class, shape or rule in Build mode recompiles it and refreshes open models within a second.
6. **Nothing runs on a server.** GitHub Pages serves the app as static files, the browser keeps a copy for offline use, and storage calls go straight from the browser to the folder or service.

## Meta-model and file formats

A workspace is a plain folder; every tool library and every model is a subfolder holding readable JSON. Elements carry stable random IDs, so renaming a class, attribute or model never breaks a reference.

**Meta-model.** It keeps ADOxx's concepts with fewer special cases:

- **Tool library**: manifest (id, name, version, languages), settings (grid, layers, numbering), and the parts below.
- **Class**: key, labels per language, kind (`node`, `container` or `swimlane`), optional parent class, abstract flag, attributes, shape, panel layout, help text.
- **Relation class**: allowed FROM and TO classes (abstract classes allowed), attributes, line shape. Unlike ADOxx, relation classes may inherit.
- **Model type**: allowed classes and relation classes, views (named subsets), cardinalities, model-level attributes and a canvas background shape.
- **Behaviour**: formulas, rules, scripts and commands, all owned by the tool library.

Every class and attribute has a fixed ID plus a **key** such as `Priority` that formulas and scripts use. Changing a label is free; changing a key triggers an automatic rewrite of the formulas and rules that use it.

**Attribute types**

| New type | Replaces in ADOxx | Options |
| --- | --- | --- |
| text | STRING, LONGSTRING, CLOB | single or multi-line, max length, pattern, rich text later |
| integer | INTEGER | min, max |
| number | DOUBLE | min, max, decimals, unit |
| boolean | yes/no enumerations | shown as a checkbox or switch |
| date, date-time | DATE, DATETIME | stored as ISO 8601 |
| duration | TIME | stored as ISO 8601 duration |
| choice | ENUMERATION | options with labels per language |
| multi-choice | ENUMERATIONLIST | as above |
| formula | EXPRESSION | read-only, recalculated on change |
| table | RECORD | column schema, row limit |
| reference | INTERREF | target model types and classes, max count |
| action | PROGRAMCALL | a button that runs a rule or script |
| link | new | URL or a file inside the workspace |
| catalog reference | PROFREF / ATTRPROFREF | later phase |

**Workspace folder**

```text
research-group/                      shared folder = workspace
  workspace.json                     name, format version
  tools/
    bpmn-lite/                       one tool library
      tool.json                      manifest: id, name, version
      assets/gear.3fa2c1.svg         icons, named by content hash
      _state/
        7f3a/                        written only by app instance 7f3a
          snapshot.json              its merged state, rewritten every few minutes
          000183.jsonl               change files: written once, never edited
          000184.jsonl
        c21b/
          snapshot.json
          000057.jsonl
  models/
    order-to-cash-9xk2/              one model; folder name never changes
      model.json                     manifest: id, tool, model type
      _state/
        7f3a/
          snapshot.json
          000412.jsonl
  _presence/
    7f3a.json                        who is editing what, refreshed every 10 s
```

Explorer folders (ADOxx's model groups) are a field on the model, not real directories. Renaming or moving a model therefore never moves files, which avoids the sync races that directory moves cause.

**A class as stored** (the complete definition of one class):

```json
{
  "id": "cls_task",
  "key": "Task",
  "kind": "node",
  "labels": { "en": "Task", "de": "Aufgabe" },
  "extends": "cls_activity",
  "abstract": false,
  "shape": "shp_task",
  "attributes": [
    { "id": "att_name", "key": "Name", "type": "text", "default": "New task", "required": true },
    { "id": "att_priority", "key": "Priority", "type": "choice", "options": ["Low", "Medium", "High"], "default": "Medium" },
    { "id": "att_owner", "key": "Owner", "type": "reference", "target": { "modelTypes": ["mt_org"], "classes": ["cls_role"] }, "max": 1 },
    { "id": "att_effort", "key": "Effort", "type": "number", "min": 0, "decimals": 1, "unit": "h" },
    { "id": "att_cost", "key": "Cost", "type": "formula", "formula": "Effort * 85" }
  ]
}
```

**Tool changes and existing models.** Models record the tool ID and the version they were last saved with. A removed attribute keeps its values in the model, shown in a collapsed Unknown attributes group; a removed class renders as a grey placeholder box. Nothing is deleted until someone chooses to clean up, and a tool can ship a migration script for renames and type changes.

## Collaboration through a shared folder

Each app instance writes only its own files and never edits a change file after writing it, so a sync service never sees two writers on one file and never creates a conflicted copy. Merging happens inside the app, by the same rule in every browser, so everyone ends up with the same model.

**How a change travels**

1. Every edit gets a hybrid logical clock: wall time plus a counter, with the instance ID breaking ties.
2. At most every 2 seconds while someone edits, the instance writes the new edits as one numbered change file in its own folder, such as `_state/7f3a/000184.jsonl`. Write-once files suit sync clients and cloud APIs alike, since [neither can append to a file](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0) safely.
3. Chrome's FileSystemObserver reports new files from other instances; a scan every 2 seconds is the fallback. The app reads only files it has not seen and merges them: for each element field, the edit with the highest clock wins.
4. Deletes are kept as tombstones and win over concurrent edits of the same element. Connectors whose end was deleted are hidden.
5. Ordered things (table rows, z-order, choice options) use fractional position keys, so two people inserting at the same spot both keep their rows.
6. Every few minutes the instance rewrites its `snapshot.json` (its full merged state plus how far it has read every other instance) and deletes its own change files already folded in. An instance that missed those files reads the snapshot instead; snapshots merge field by field too, so any mix of files loads to the same state.
7. Each instance refreshes `_presence/<id>.json` every 10 seconds with a display name, colour, open model and selection. Others see who is where and get a soft warning before editing the same script.

Three lines of a change file, exactly as stored:

```json
{"t":"2026-10-07T09:14:03.512Z/0001","by":"7f3a","el":"el_a1","f":"x","v":340}
{"t":"2026-10-07T09:14:03.512Z/0002","by":"7f3a","el":"el_a1","f":"y","v":120}
{"t":"2026-10-07T09:14:07.020Z/0000","by":"7f3a","el":"el_a1","f":"attr.att_priority","v":"High"}
```

Drags are written once, on mouse-up, so a long drag costs one line per moved field rather than one per frame.

**What people experience**

- Two people move different objects: both moves survive.
- Two people move the same object: the later move wins and the other person sees it jump once.
- Two people edit the same text attribute: the later save wins. Same-field clashes are rare in modelling; the app flags them in a small notice.
- Two people each add the one allowed Start event: the model shows a cardinality warning, never a broken merge.
- Someone works offline for a week: their change files merge when they reconnect.

There are no accounts. On first visit a person picks a display name and colour, kept in that browser together with a random instance ID. Change lines carry the instance ID, so history can say which browser changed what, but this is attribution, not security: anyone with folder access can change anything, as you specified.

**Where a workspace can live**

| Place | How the app reaches it | Browsers | Setup | Live editing | When |
| --- | --- | --- | --- | --- | --- |
| Synced folder: OneDrive, SharePoint (synced through OneDrive), Google Drive for desktop, Dropbox, Nextcloud | File System Access API; FileSystemObserver for changes | Chrome, Edge and other Chromium browsers on desktop | Pick the folder once; [Chrome 122 and later can remember it](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) | Yes, within seconds | Usable version |
| Git repository: GitHub, GitLab | Their REST APIs, called from the browser | All modern browsers | GitHub: a fine-grained access token; GitLab: [sign-in with PKCE](https://docs.gitlab.com/api/oauth2) or a token | No: commit and pull | Version 1.0, tool libraries |
| OneDrive or SharePoint, direct | Microsoft Graph via MSAL.js | All modern browsers | App registration; admin consent in most organisations; sign-in again every 24 hours | Yes, by polling | After 1.0, if needed |
| Google Drive, direct | Drive API and Google Picker | All modern browsers | Google's restricted-scope verification to see whole folders | Yes, by polling | After 1.0, if needed |

The synced folder covers every service you named without registering anything with Microsoft or Google, because their own sync clients carry the files. Direct connections matter only for Firefox and Safari users or machines without a sync client, and they cost setup: Microsoft's [default consent policy blocks](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies) user consent to `Files.ReadWrite.All` and `Sites.ReadWrite.All`, [browser sign-ins expire after 24 hours](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), and Google's non-sensitive `drive.file` scope [grants access file by file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), while the full `drive` scope is restricted.

**Git mode for tool libraries**

In Git mode a tool library is stored as one readable file per part, so diffs and reviews on GitHub or GitLab make sense:

```text
bpmn-lite/                     repository root
  tool.json
  classes/task.json
  classes/gateway.json
  relations/sequence-flow.json
  model-types/process.json
  shapes/task.json
  panels/task.json
  rules/high-priority-owner.json
  scripts/renumber-tasks.ts
  assets/gear.3fa2c1.svg
```

- Edits stay in the browser until you choose **Commit and push**, which writes every changed file as one commit ([GitHub tree API](https://docs.github.com/en/enterprise-server@3.18/rest/git/trees), [GitLab commit actions](https://docs.gitlab.com/ee/api/commits.html)).
- **Pull** merges incoming commits field by field against the common base version; only a clash on the same field asks you to choose.
- Branches, pull requests and releases stay in GitHub or GitLab. A tagged release becomes a tool version that models can follow.
- The app calls the REST APIs instead of running Git in the browser, because cloning from github.com in a browser [needs a proxy server](https://isomorphic-git.org/docs/en/quickstart), while GitHub's REST API [accepts browser requests](https://docs.github.com/en/enterprise-cloud@latest/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests).
- GitHub's OAuth sign-in [requires a client secret](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) and so a small server; a fine-grained token limited to one repository avoids that. Tokens stay in that browser, never in the folder or repository.

Models stay in synced folders, where several people edit live; Git mode for models is follow-up question 23.

**Options considered**

| Option | For | Against | Verdict |
| --- | --- | --- | --- |
| Per-instance write-once change files, own merge code (last writer wins per field) | No sync conflicts; works over sync clients and cloud APIs; readable JSON lines | We own about 1,500 lines of merge code; text merges as whole values | **Chosen** for live folders |
| The same files carrying [Yjs](https://yjs.dev) or [Loro](https://loro.dev/blog/v1.0) updates | Proven CRDT libraries, character-level text merge | Binary files, an extra dependency | Fallback, or for script text if beta users need it |
| One JSON file per element, edited in place | Readable, Git-friendly | Conflicted copies when two people touch one element | Used in Git mode only |
| One file per model, rewritten on save | Simplest | Any concurrent edit creates a conflicted copy | Rejected |
| Git as the sync layer | Real history, branches, reviews | Not live; harder for non-developers | **Chosen** for tool libraries (Git mode) |
| Live peer-to-peer channel (WebRTC) | Sub-second updates, live cursors | Needs a signalling server, which breaks the no-server rule | Later, optional |

How fast changes arrive depends on the sync service and is measured in phase 0 on OneDrive, SharePoint, Google Drive for desktop and Dropbox. Folder and file names avoid leading dots, so every sync tool shows and carries them.

## Canvas engine and performance

A purpose-built Canvas 2D engine keeps dragging at a constant cost: while you drag, only the moved objects, their connectors and the handles redraw, and the rest of the model is a cached bitmap. Model size then affects drag speed only through hit-testing, which an R-tree keeps fast.

**How it stays fast**

- **Three stacked canvases.** Background (grid, swimlanes, model background), static scene (everything not being touched) and an active layer (dragged or selected items, their connectors, handles, snap guides). Text editing and tooltips use a thin HTML overlay.
- **Cached draw lists.** The shape compiler turns each element into a list of `Path2D` objects and text runs. The list is cached and rebuilt only when the shape, the size, or an attribute the shape actually reads changes.
- **Spatial index.** An R-tree ([rbush](https://github.com/mourner/rbush)) answers hit-tests, rubber-band selection, viewport culling and snapping candidates.
- **Cheap pan and zoom.** During the gesture the cached bitmap is transformed; the scene re-renders sharp when the gesture ends.
- **Level of detail.** Far zoomed out, text smaller than 4 px and fine decorations are skipped.
- **Heavy work elsewhere.** Validation and auto-layout ([ELK.js](https://github.com/kieler/elkjs)) run in a Web Worker; orthogonal connector routing runs on drop, not every frame.
- **One drawing, many outputs.** The same draw lists replay into Canvas 2D on screen and into SVG and PDF on export, so exports look exactly like the screen.

**Performance targets** (checked by an automated benchmark on a generated model in every build)

| Interaction | Target | Test model |
| --- | --- | --- |
| Drag 1 to 50 objects | 60 fps (16 ms per frame) | 5,000 objects, 7,000 connectors |
| Pan and zoom | 60 fps | same |
| Open a model | under 1 s | same |
| Attribute edit shows in the shape | under 50 ms | any |
| Tool change shows in open models | under 1 s | any |
| Export SVG or PNG | under 2 s | same |
| First load / app download | under 2 s / under 1.5 MB compressed | script engine loaded only when needed |

**Rendering options considered**

| Option | Draws with | Licence | Verdict |
| --- | --- | --- | --- |
| Own engine | Canvas 2D | ours | **Recommended**: full control over dynamic shapes and caching; about 5,000 lines |
| maxGraph (mxGraph's successor) | SVG | Apache 2.0 | Mature, but SVG nodes slow down past a few thousand shapes and its shape model fights ours |
| JointJS | SVG | MPL 2.0 core, paid JointJS+ | Same SVG limits |
| GoJS | Canvas | commercial | Fast and complete, but paid and closed |
| React Flow / Svelte Flow | HTML elements | MIT | Good for node editors, not thousands of custom shapes |
| tldraw SDK | HTML / SVG | [free with a watermark](https://tldraw.dev/legal/tldraw-license); paid licence removes it | Watermark rules it out for a free tool |
| PixiJS | WebGL | MIT | Fastest raw drawing, but text and crisp vectors are harder: plan B if Canvas 2D misses the targets |

The first project phase builds a two-week prototype of the engine and measures it against these targets in Chrome and Edge on Windows and macOS before anything else depends on it.

## Notation: Shapes replace GraphRep

A **Shape** is a list of drawing parts (rectangle, ellipse, path, text, image, group) in which any property is either a fixed value or a formula over the element's attributes. Method engineers build shapes in a visual editor; the JSON below is only what gets stored.

**Design rules**

- Pixels with the origin top-left, plus percentages and offsets (`"100% - 22"`), so shapes stretch without GraphRep's `TABLE` construct.
- A value starting with `=` is a formula, written in the same formula language used for computed attributes and rules.
- Any part can carry `visible`, `onClick` and `tooltip`; `let` names a value once per element so parts can share it.
- `repeat` draws a part once per table row or list value, laid out by `stack` or `grid`.
- `outline` (rectangle, ellipse, polygon or auto) decides where connectors attach.
- Relation shapes set the line (colour, width, dash, routing), the start and end markers, and labels at the start, middle or end.
- Containers get a header and a body; swimlanes add an orientation; a model type can draw a background (title block, legend).

**A complete node shape**: a task whose border colour follows `Priority`, with a gear for service tasks and a clickable owner icon.

```json
{
  "id": "shp_task",
  "size": { "width": 140, "height": 70, "resizable": true, "minWidth": 80, "minHeight": 40 },
  "outline": "rect",
  "let": {
    "accent": "= Priority == 'High' ? '#D93025' : Priority == 'Medium' ? '#F29900' : '#5F6368'"
  },
  "parts": [
    { "type": "rect", "x": 0, "y": 0, "width": "100%", "height": "100%", "radius": 10, "fill": "#FFFFFF", "stroke": "= accent", "strokeWidth": 2 },
    { "type": "rect", "x": 0, "y": 0, "width": 6, "height": "100%", "radius": 3, "fill": "= accent" },
    { "type": "text", "x": 14, "y": 8, "width": "100% - 28", "height": "100% - 26", "text": "= Name", "wrap": true, "fit": "shrink", "align": "center", "valign": "middle", "font": { "size": 13, "weight": 600 } },
    { "type": "image", "src": "assets/gear.3fa2c1.svg", "x": "100% - 22", "y": 4, "width": 18, "height": 18, "visible": "= TaskType == 'Service'" },
    { "type": "image", "src": "assets/person.9b81d0.svg", "x": 6, "y": "100% - 20", "width": 14, "height": 14, "visible": "= Owner != null", "tooltip": "= 'Owner: ' + Owner.Name", "onClick": "= open(Owner)" },
    { "type": "text", "x": 14, "y": "100% - 18", "width": "100% - 28", "height": 14, "text": "= Effort ? Effort + ' h' : ''", "align": "right", "font": { "size": 10 }, "fill": "#5F6368" }
  ]
}
```

**A complete relation shape**: dashed when the flow has a condition, which is printed mid-line.

```json
{
  "id": "shp_sequence_flow",
  "line": { "stroke": "#202124", "strokeWidth": 1.5, "dash": "= Condition ? [6, 4] : []", "routing": "orthogonal", "corners": 6 },
  "startMarker": { "type": "none" },
  "endMarker": { "type": "arrow", "fill": "#202124" },
  "labels": [
    { "at": "middle", "offset": { "x": 0, "y": -10 }, "text": "= Condition", "font": { "size": 11 }, "background": "#FFFFFF" }
  ]
}
```

**The shape editor (no code needed)**

- Draw parts on a canvas, reorder them in a layer list, set properties in a panel.
- Each property has an *fx* switch that turns a fixed value into a formula, with autocomplete for attribute keys.
- A **Colour by attribute** helper builds the mapping (High = red, Medium = amber) without typing a formula, like conditional formatting in Excel.
- A preview strip renders the shape with sample values ("Priority = High, TaskType = Service") and at three sizes, so stretching problems show at once.
- **Import SVG** turns artwork from Inkscape or Figma into parts or a single image; a gallery offers starter shapes (BPMN task, gateway, event, UML class, ER entity).

**GraphRep to Shapes**

| GraphRep | Shapes |
| --- | --- |
| RECTANGLE, ROUNDRECT, ELLIPSE, POLYGON, POLYLINE, ARC, PIE, BEZIER, path commands, COMPOUND | `rect`, `ellipse`, `polygon` and `path` parts (SVG path syntax) |
| PEN, FILL, GRADIENT\_RECT, SHADOW, FONT | `stroke`, `fill` (colour or gradient), `shadow`, `font` |
| TEXT, TEXTBOX, ATTR, ATTRBOX | `text` part with a formula, wrapping and fit options |
| AVAL, SET | `let` values and direct attribute keys in formulas |
| IF / ELSIF / ELSE | `visible` formulas, or `variants` chosen by a formula |
| FOR, WHILE | `repeat` over a list |
| TABLE, STRETCH, MAP | percentages, `stack` and `grid` layouts, group `transform` |
| CLIP\_\* | `clip` on a group |
| BITMAP, METAFILE | `image` part (SVG, PNG, WebP) |
| HOTSPOT, clickable ATTR | `onClick` and `tooltip` on any part |
| Relation START / MIDDLE / END / EDGE | `line`, `startMarker`, `endMarker`, `labels` |
| GRAPHREP sizing, layer, swimlane | `size`, `layer`, class kind `swimlane` |
| EXECUTE | `use` to embed a shared sub-shape |

**Alternatives considered.** SVG templates with bindings (Vue-style) are familiar to web developers but cannot wrap text or define a connector outline cleanly, so SVG is supported as an import instead. Shapes written as code are the most powerful but not low-code; a script-drawn custom part can be added later if the declarative parts fall short.

## Behaviour: formulas, rules and scripts replace AdoScript

AdoScript's work splits into three levels that share one API: **formulas** for computed values and checks, **rules** for no-code "When / If / Then" automation, and **scripts** in TypeScript for everything else. A method engineer climbs only as far as a task needs, and a rule can call a script when it outgrows the form.

**Level 1: Formulas**

- Used for formula attributes (ADOxx `EXPRESSION`), shape properties, default values, constraints with a message, panel visibility and rule conditions.
- Syntax is a safe subset of JavaScript expressions: no assignments or loops, plus helpers such as `count(objects("Task"))`, `sum(...)`, `incoming("SequenceFlow")`, `parent`, `children()`, `today()`. Excel-style aliases (`IF`, `SUM`, `AND`) also work.
- Our own parser and evaluator (about 1,000 lines) keep formulas synchronous, fast and side-effect free. Dependencies are tracked like a spreadsheet, so only affected formulas recalculate.
- LEO functions map directly: `aval` becomes the attribute key, `asum` is `sum`, `rcount` counts table rows, `allobjs` is `objects()`, `cond` is `? :`.

**Level 2: Rules (no code)**

A rule is a trigger, a condition and a list of actions, edited as a form: *When* \[Task\] \[attribute Priority changes\] *If* \[Priority is High and Owner is empty\] *Then* \[set Status to "Needs owner"\] \[show a warning\]. Actions cover set attribute, create or delete objects and connectors, show a message, ask the user, cancel (on "before" triggers), open a model, run a command and run a script. Stored, that rule is:

```json
{
  "id": "rule_high_priority_owner",
  "label": "High-priority tasks need an owner",
  "when": { "event": "attribute.changed", "class": "Task", "attribute": "Priority" },
  "if": "= Priority == 'High' && Owner == null",
  "then": [
    { "action": "setAttribute", "attribute": "Status", "value": "Needs owner" },
    { "action": "message", "kind": "warning", "text": "= 'Task \"' + Name + '\" is high priority but has no owner.'" }
  ]
}
```

**Level 3: Scripts (TypeScript)**

- For loops over models, model-to-model transformations, custom import and export formats, and multi-step dialogs.
- Edited in [CodeMirror 6](https://codemirror.net) with TypeScript autocomplete. Types are generated from the tool's own meta-model, so `task.attrs.Priority` autocompletes to `"Low" | "Medium" | "High"`.
- The API replaces ADOxx's message ports with a handful of modules: `model` (query, create, connect, delete), `tool` (meta-model), `ui` (message, confirm, prompt, choose, form, progress), `files` (inside the workspace, plus save-as), `http`, `commands` and `on` for events.
- Scripts run in [QuickJS compiled to WebAssembly](https://github.com/justjake/quickjs-emscripten) (about 500 KB), with a time limit and a memory limit. It runs synchronously, so a "before" handler can cancel an action. Its README says it has not been audited and is still below version 1.0, so we pin a version and wrap it.
- **Permissions:** a tool declares whether its scripts need network access or files outside the workspace. The app asks once per tool in each browser; without permission a script can only touch models and show dialogs. In a browser, scripts can call only web services that accept browser requests, reach other files only through open and save dialogs, and never start programs on the computer (follow-up question 21).

A complete script that numbers tasks top to bottom and adds a menu command:

```ts
import { on, model, ui, commands } from "metakit";

function renumberTasks(): void {
  const tasks = model.objects("Task").sort((a, b) => a.y - b.y || a.x - b.x);
  tasks.forEach((task, index) => {
    task.attrs.Number = index + 1;
  });
}

on("object.created", { class: "Task" }, () => renumberTasks());
on("object.moved", { class: "Task" }, () => renumberTasks());

commands.register({
  id: "renumber-tasks",
  label: "Renumber tasks",
  menu: "Model",
  run: () => {
    renumberTasks();
    ui.message(`Renumbered ${model.objects("Task").length} tasks.`);
  },
});
```

**Events.** ADOxx's [73 events](https://adoxx.org/adoscript_reference/50_events/index.html) collapse to 24; simulation, database, user and window-management events are dropped.

| New event | ADOxx events it covers | Can cancel |
| --- | --- | --- |
| `app.started`, `app.closing` | AppInitialized, AppExit | no |
| `model.creating`, `model.created` | BeforeCreateModel, CreateModel | first one |
| `model.opened`, `model.deleting`, `model.deleted` | OpenModel, BeforeDeleteModel, DeleteModel | `model.deleting` |
| `object.creating`, `object.created` | CreateInstance, AfterCreateModelingNode | first one |
| `object.deleting`, `object.deleted` | BeforeDeleteInstance, DeleteInstance | first one |
| `object.moved`, `object.resized`, `object.renamed` | RenameInstance; moves are new | no |
| `connector.creating`, `connector.created`, `connector.reconnected` | BeforeCreateRelationInstance, CreateRelationInstance, AfterCreateModelingConnector, ChangeRelationInstanceFrom/ToEndpoint | first one |
| `attribute.changing`, `attribute.changed` | SetAttributeValue, AfterEditAttributeValue | first one |
| `table.rowAdded`, `table.rowRemoved` | AfterCreateRecordRow, AfterDeleteRecordRow | no |
| `view.changing`, `view.changed` | BeforeExtSetVariant, AfterExtSetVariant | first one |
| `selection.changed` | UpdateActions | no |

There is no save step, since every change is written at once; checks that ADOxx ran in BeforeSaveModel become validation rules.

**One rule for collaboration:** rules and scripts run only in the browser where a change was made. Changes merged in from others never re-trigger them, otherwise every open instance would repeat the same automation.

**Alternatives considered.** Blockly-style blocks are approachable but clumsy beyond simple logic. Node graphs (Node-RED style) are powerful but a large UI to build. Python through Pyodide is familiar to researchers but adds several megabytes and a slow first start. Lua is small but unfamiliar. Forms for rules plus TypeScript with autocomplete covers both ends with the least to build.

**Assistant (optional).** Off by default. Given a plain description ("high-priority tasks need an owner"), it drafts a rule, script, shape or class and shows it as a change you accept or discard. It uses your own API key, kept only in that browser and never written to the shared folder or repository, and it sends tool definitions but never models. Claude is the first provider: Anthropic's TypeScript SDK supports calls straight from a browser through its [`dangerouslyAllowBrowser` option](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript), which suits a bring-your-own-key app. Other providers can be added behind the same interface.

## Attribute panels replace AttrRep

The attribute panel is generated from the attribute definitions, so a new class gets a working panel with no configuration. An optional layout adds tabs, groups, order and conditions, which covers everything AttrRep does today.

**Default controls by type:** text field or text area; number field with unit; switch for booleans; date and duration pickers; dropdown for choices (a segmented control for up to four options); chips for multi-choice; read-only value with its formula on hover; inline grid for tables, with paste from Excel; searchable cross-model picker for references, with an open link; button for actions; URL or file picker for links.

**A complete layout** for the task class:

```json
{
  "class": "cls_task",
  "tabs": [
    {
      "label": "General",
      "items": [
        { "attribute": "Name" },
        { "attribute": "Priority", "control": "segmented" },
        {
          "group": "Responsibility",
          "items": [
            { "attribute": "Owner" },
            { "attribute": "Status", "readOnly": "= Owner == null" }
          ]
        }
      ]
    },
    {
      "label": "Effort",
      "visible": "= TaskType != 'Manual'",
      "items": [
        { "attribute": "Effort" },
        { "attribute": "Cost" },
        { "attribute": "Steps", "control": "table", "height": 200 }
      ]
    }
  ],
  "showRelations": true
}
```

| AttrRep | New panel layout |
| --- | --- |
| NOTEBOOK, `with-relations` | the panel, `showRelations` |
| CHAPTER | `tabs` |
| GROUP / ENDGROUP | `group` |
| ATTR `hidden`, `enabled`, `mandatory`, `write-protected` | `visible`, `readOnly`, `required` (fixed or formula) |
| `ctrltype`, `dialog` | `control` and the built-in pickers |
| `lines`, `width` | `height`, column widths |

Beyond AttrRep: editing one attribute across many selected objects at once (mixed values show as a dash), constraint messages shown inline as you type, help text on hover, and double-click editing of text attributes directly on the canvas. The later tabular view reuses the same definitions, so a table of all tasks needs no extra setup.

## Import and export

There are three everyday exchange formats: tool packages, editable model files and images. Everything except images can be re-imported without loss; ADOxx files are not imported, as decided.

| What | Format | Behaviour |
| --- | --- | --- |
| Tool package | `.mktool`: a zip of the tool's definitions, shapes, rules, scripts and assets | Versioned (1.4.0). Importing either adds a new tool or updates an existing one; IDs are kept, so existing models follow the update |
| Tool library in Git | One readable file per class, shape, panel, rule and script | Opened directly in Git mode; tagged releases become tool versions |
| Model file | `.mkmodel.json`: readable JSON using keys instead of IDs | Hand-editable and Git-friendly; names the tool and version; unknown keys survive re-import |
| Model bundle | `.mkbundle`: a zip of several models plus their tool | Shares a whole case study in one file |
| Image | SVG (text stays text), PNG (1x to 4x, optional transparency), PDF (vector, page size, fit to page) | Whole model or selection; drawn from the same draw lists as the screen |
| Data | CSV, one file per class | For spreadsheets and reports |

**A complete model file:**

```json
{
  "format": "metakit-model/1",
  "id": "mdl_9xk2",
  "title": "Order to cash",
  "tool": { "id": "tool_bpmn_lite", "version": "1.3.0" },
  "modelType": "Process",
  "folder": "Sales",
  "attributes": { "Owner": "Finance team" },
  "elements": [
    { "id": "el_a1", "class": "Task", "x": 120, "y": 80, "w": 140, "h": 70, "attributes": { "Name": "Check order", "Priority": "High", "Effort": 2 } },
    { "id": "el_a2", "class": "Task", "x": 360, "y": 80, "w": 140, "h": 70, "attributes": { "Name": "Send invoice", "Priority": "Medium", "Effort": 0.5 } }
  ],
  "connectors": [
    { "id": "cn_b1", "relation": "SequenceFlow", "from": "el_a1", "to": "el_a2", "points": [], "attributes": { "Condition": "" } }
  ]
}
```

## Tech stack

TypeScript everywhere, a static web app with Svelte 5 panels and our own canvas engine, and no server. Every heavy dependency has a named fallback.

| Layer | Choice | Why | Fallback |
| --- | --- | --- | --- |
| Language | TypeScript, strict | One language for UI, core, formula tooling and user scripts | — |
| Delivery | Static web app (PWA) on GitHub Pages; a service worker keeps it for offline use | No server, nothing to install, updates on reload | Any static host: Netlify, Cloudflare Pages, a university web server |
| Local folders | File System Access API plus [FileSystemObserver](https://groups.google.com/a/chromium.org/g/blink-dev/c/6oOaFmia2dc/m/gx0KgpQqBQAJ) (Chrome 133 and later, desktop) | Reads and writes the synced folder directly | Scan every 2 s where the observer is missing |
| Git mode | GitHub REST API (Git trees and commits), GitLab REST API (commit actions) | Multi-file commits from the browser without a proxy | isomorphic-git behind a small CORS proxy |
| Cloud drives (after 1.0) | Microsoft Graph with MSAL.js; Google Drive API with Google Identity Services and Picker | Direct access in any browser, without sync clients | — |
| UI panels | Svelte 5 | Small runtime, simple components | React or SolidJS |
| Canvas | Own Canvas 2D engine plus rbush | See the canvas section | PixiJS (WebGL) |
| Auto-layout | ELK.js in a Web Worker | Layered, orthogonal and force layouts | dagre |
| Formulas | Own parser and evaluator | Safe, synchronous, dependency tracking | jsep with our evaluator |
| Scripts | quickjs-emscripten, loaded on demand; sucrase compiles TypeScript on save | Isolation, time and memory limits, synchronous cancel | SES compartments (faster, no hard time limit) |
| Code editor | CodeMirror 6 with the TypeScript language service in a worker | Lighter than Monaco | Monaco |
| Sync | Own last-writer-wins CRDT, hybrid logical clocks, write-once JSON-lines files | See the collaboration section | Yjs or Loro |
| Browser storage | IndexedDB for folder handles, instance ID, tokens, API keys and unsent changes | Survives reloads; never shared | — |
| Assistant | Anthropic TypeScript SDK in browser mode with the user's own key | No server needed | Other providers behind the same interface |
| PDF export | svg2pdf.js with jsPDF | Vector PDF from the SVG export | — |
| Tests | Vitest, fast-check for randomised merge tests, Playwright for end-to-end and screenshot tests, a canvas benchmark | Speed and merge correctness checked in every build | — |
| Build and release | pnpm monorepo, GitHub Actions, deploy to GitHub Pages on each release tag | — | — |

**Repository layout**

```text
metakit/
  CLAUDE.md        architecture rules and conventions for Claude Code
  openspec/        specs and change proposals, one per feature
  packages/
    core/          meta-model, model store, commands, undo, validation (no UI)
    sync/          change files, merge, snapshots, presence
    storage/       adapters: local folder, GitHub, GitLab (later OneDrive, Google Drive)
    formula/       formula parser, evaluator, dependency tracking
    shapes/        shape compiler and draw lists
    canvas/        renderer, interaction tools, exporters
    behaviour/     rule engine, script sandbox, script API and type generator
    assistant/     AI drafting of rules, scripts, shapes and classes
    ui/            Svelte app: Model mode and Build mode
  apps/
    web/           the static web app
    cli/           headless export and validation (Node.js)
  tools/           sample tool libraries used as test fixtures
  bench/           canvas and merge benchmarks
```

## How Claude Code builds it

Claude Code writes the code; you set direction, approve specs, review and test. Every change must pass automated checks before it reaches you, so your time goes to judgement rather than to catching regressions.

1. **Spec.** Each feature starts as an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change proposal with acceptance criteria; OpenSpec supports Claude Code directly. You approve the spec before any code is written.
2. **Build.** Claude Code implements it on a branch, following `CLAUDE.md`: the architecture rules from this plan, package boundaries, the performance budget, and "never change a file format without a migration". Two lanes run at once in separate worktrees: canvas and interface, and data and behaviour.
3. **Check.** GitHub Actions runs type checks, unit tests, randomised merge tests (many simulated people editing at once must end with identical models), Playwright end-to-end and screenshot tests, the 5,000-object canvas benchmark, and a size budget for the app download. A failing check goes back to Claude Code, not to you.
4. **Review.** You review the pull request and try a preview build of the branch; small fixes go back as review comments.
5. **Milestone test.** At each milestone you use the app on a real task, and once you watch a non-programmer build a small tool.

Some work needs a person: judging how dragging and editing feel, testing sync on two real machines over OneDrive, SharePoint and Google Drive, any later app registration with Microsoft or Google, and working with the beta teams.

## Roadmap

Claude Code builds in two parallel lanes, and your reviews set the pace. Assuming about 6 hours a week of your time, a usable version (tool building, modelling, folder sync) lands around week 12 and version 1.0 around week 22. Treat the dates as ±50% until phase 0 shows how fast the review cycle runs.

| Phase | Lane | Weeks |
| --- | --- | --- |
| 0 Setup and spikes | both | 1–2 |
| 1 Core and local folder | B (data, sync, behaviour) | 3–5 |
| 2 Canvas and modelling editor | A (canvas, notation, interface) | 3–7 |
| 3 Folder sync | B | 6–9 |
| 4 Build mode and Shapes | A | 8–12 |
| 5 Formulas and rules | B | 10–13 |
| 6 Exports and packages | A | 13–14 |
| 7 Scripts and sandbox | B | 14–17 |
| 8 Git mode | A | 15–17 |
| 9 AI assistant | A | 18 |
| 10 Beta with project teams | both | 19–22 |

Gates: tech go/no-go at week 2 · usable v0.5 at week 12 · version 1.0 at week 22.

Lane A owns everything drawn on screen, lane B everything stored and executed; they meet at the core's command API, which phase 1 fixes first.

| Phase | Delivers | Done when |
| --- | --- | --- |
| 0 Setup and spikes | Repository, `CLAUDE.md`, OpenSpec, CI and preview builds; canvas prototype with 5,000 objects in Chrome and Edge; write-once change files tested over OneDrive, SharePoint, Google Drive for desktop and Dropbox with three browsers; formula parser and QuickJS cancel prototypes; GitHub and GitLab API calls from the browser | Benchmarks meet the targets or plan B is chosen; follow-up questions answered |
| 1 Core and local folder | Meta-model types, model store, command API, undo, basic validation, local-folder adapter, CLI skeleton | Models round-trip without loss; core unit tests pass |
| 2 Canvas and modelling editor | Place, connect, move, resize, bend points, selection, undo, zoom and pan, minimap, generated attribute panels, inline text editing, using a hand-written tool | A 5,000-object model drags at 60 fps; a small process model can be built end to end |
| 3 Folder sync | Change files, clocks, merge, snapshots, clean-up, presence, change detection, sync status line | Randomised merge tests pass; two people edit one model over OneDrive and SharePoint without losing changes |
| 4 Build mode and Shapes | Class, relation, model type and view editors; shape compiler and shape editor; panel layouts; containers and swimlanes; hot reload | A non-programmer builds a small ER tool in under an hour |
| 5 Formulas and rules | Formula engine with dependency tracking, constraints, rule editor, the 24 events, command registration | The rule examples in this plan run unchanged |
| 6 Exports and packages | SVG, PNG, PDF; tool packages, model files and bundles; CSV; auto-layout; find; validation list | Screenshot tests show exports identical to the screen |
| 7 Scripts and sandbox | QuickJS host, script API, generated types, editor with autocomplete, permissions, console | Three behaviours from existing ADOxx tools are rebuilt as rules or scripts |
| 8 Git mode | One-file-per-part layout, GitHub and GitLab adapters, commit and push, pull with field-level merge | A tool library round-trips through GitHub and GitLab, with a change merged from each side |
| 9 AI assistant | Drafts of rules, scripts, shapes and classes; accept or discard; key handling | The examples in this plan can be drafted from one-sentence descriptions |
| 10 Beta with project teams | Two or three teams use it on real projects; documentation, tutorials, fixes | A project team completes a project with it |
| After 1.0 | Direct OneDrive/SharePoint and Google Drive connectors if needed; named checkpoints (1.1); tabular view; shared catalogs | — |

## Risks and mitigations

The two risks that could change the architecture, sync behaviour across real sync clients and canvas speed in the browser, are both tested in the first two weeks, before anything depends on them.

| Risk | What could happen | Mitigation |
| --- | --- | --- |
| Sync services behave differently | Long delays, partial syncs, or online-only files (OneDrive and Google Drive files on demand) that the browser cannot read in time | Test matrix in phase 0; a status line ("last change from Anna, 12 s ago"); a setup check that warns when the folder is online-only |
| Canvas too slow in the browser | Large models miss 60 fps | Benchmark in phase 0 and in every build; PixiJS (WebGL) as plan B |
| Local folders need Chromium | Firefox and Safari users cannot open a synced folder | Say so on the start page; Git workspaces work in every browser; direct cloud connectors after 1.0 if teams need them |
| Merge bugs | Two browsers show different models | Randomised tests that replay concurrent edits on simulated instances and require identical results; each presence file carries a state hash so divergence is detected live |
| Change files pile up | Slow opening after months of use | Snapshots and clean-up, tested with a simulated year of edits |
| Malicious script in a shared tool | Anyone with folder access can change a script | Sandbox, no network access by default, permission prompts, re-approval when a tool asks for new permissions |
| No access control | Someone deletes a tool or model by mistake | Deleted items go to a 30-day trash; snapshots allow restore; sync services keep file history; Git history covers tool libraries |
| Tokens or API keys leak | A GitHub token or AI key ends up in the shared folder | Kept only in the browser's IndexedDB, never written to the workspace; fine-grained tokens limited to one repository |
| Claude Code drifts from the architecture | Shortcuts that break speed, file formats or package boundaries | Rules in `CLAUDE.md`, specs approved before coding, CI budgets that fail the build, your review of every pull request |
| Rules too weak | Tool builders fall back to scripts for common jobs | Rebuild three real tools in the beta and add rule actions for every gap found |
| QuickJS wrapper changes | Breaking API changes before its 1.0 | Pin the version behind our own interface; SES compartments as fallback |
| Scope creep toward full ADOxx | Analysis or simulation requests delay version 1 | The out-of-scope list is explicit; add extension points later rather than features now |

## Decisions and follow-up questions

You answered all 20 questions on 7 October, and the sections above now follow your answers. Two answers needed a reading: "claude code" means Claude Code writes the code and you review it, and "projects" means the first users are project teams.

| # | Question | Default I would take | Your answer |
| --- | --- | --- | --- |
| 1 | Who builds this, how many people, and from when? | The plan assumes two full-time developers | claude code |
| 2 | Open source or closed? | Open source (Apache 2.0) for the app; tool libraries carry their own licence | open |
| 3 | Who are the first users: courses, research projects, companies? | Teaching and research first | projects |
| 4 | Desktop app first, or is a Chrome/Edge-only browser app enough? | Desktop first (Tauri), browser build second | browser only |
| 5 | Is "changes arrive within seconds" fine, or do you need live cursors? | Seconds; a live channel later as an option, since it needs a server | yeah its fine |
| 6 | Which sync services must work (for example your university's OneDrive or Nextcloud)? | Test OneDrive, Dropbox, Nextcloud, Syncthing and Git | oneDrive, Sharepoint, google docs, anything similar. |
| 7 | Svelte or React for the panels? | Svelte 5 (lighter); React if contributors are more likely to know it | what ever you say |
| 8 | Formula syntax: JavaScript-style (`a ? b : c`) or Excel-style (`IF(a, b, c)`) as the main form? | JavaScript-style with Excel aliases accepted | JavaScript-style with Excel aliases accepted |
| 9 | Product name? "MetaKit" is a placeholder | A name without "ADOxx", which belongs to OMiLAB and BOC | yeah i like metakit |
| 10 | Is ADOxx import a must-have, and which libraries matter most? Can you share sample ABL, ALL, ADL or XML files? | After the core, as phase 6 | no i dont want to import the current adoxx libraries |
| 11 | Relationship with OMiLAB: collaborate, or stay independent? | Ask them early; it affects naming and publishing importers | i will ask them. for now keep it seperate |
| 12 | Keep ADOxx's separate static (tree) models? | No: tree models become ordinary models using containers | no |
| 13 | Relation classes with inheritance? Relations with more than two ends? | Inheritance yes; more than two ends no | Inheritance yes; more than two ends no |
| 14 | Shared catalogs (ADOxx attribute profiles) in version 1? | Later | later |
| 15 | Model versions: named versions inside the app, or snapshots and Git? | Named checkpoints in version 1.1 | Named checkpoints in version 1.1 |
| 16 | Tabular view of models in version 1? | Version 1.1 | later |
| 17 | Is last-writer-wins acceptable for long texts, or do descriptions and scripts need character-level merging? | Last writer wins; character-level merging for scripts only if beta users hit it | Last writer wins; character-level merging for scripts only if beta users hit it |
| 18 | A Git mode for tool libraries, storing one readable file per class and shape? | Not in version 1; export covers Git use | i like the idea of git mode. It should work with gitlab and github |
| 19 | May scripts call external programs and the network, as AdoScript can? | Yes on desktop, behind a permission prompt | yes |
| 20 | An AI assistant that drafts rules, scripts and shapes from a description, using your own API key? | Optional, off by default, sends tool definitions but never models | yeah this |

**Follow-up questions**

Your answers raised six new questions. Only 24 and 25 are needed before phase 0 starts; the rest can wait until their phase.

| # | Question | Default I would take | Your answer |
| --- | --- | --- | --- |
| 21 | You chose a browser-only app (question 4) and scripts that call external programs and the network (question 19). A browser cannot start programs and can only call web services that accept browser requests. Is that acceptable? | Yes for version 1; a small optional helper app later, only if a real tool needs it |  |
| 22 | Is a synced folder enough for OneDrive, SharePoint and Google Drive in version 1? Direct connections need app registration, admin consent in most organisations and a sign-in every 24 hours (Microsoft), or verification by Google | Synced folder in version 1; direct connectors after 1.0, only for teams without sync clients or using Firefox and Safari |  |
| 23 | Git mode for tool libraries only, or for models too? | Tool libraries only; models stay in synced folders for live editing |  |
| 24 | How many hours a week can you review and test? | The roadmap assumes about 6 |  |
| 25 | Where should the code and the app live? | A public GitHub repository under your account; the app on GitHub Pages |  |
| 26 | "MetaKit" is also the name of a [dormant embedded database](https://en.wikipedia.org/wiki/Metakit) (last release 2015), and `metakit` is taken on npm. Keep it? | Keep MetaKit; publish packages under a scope such as `@metakit-app/` | Keep the MetaKit name; packages go under `@metakit-app/` |

## Sources

Pages opened for this plan, as of 7 October 2026.

**ADOxx**

- [ADOxx home and 1.8.0 download](https://www.adoxx.org/)
- [Starting ADOxx and its database](https://adoxx.org/documentation/01_getting_started/04_start_adoxx.html) · [Installing on macOS via Wine](https://adoxx.org/documentation/01_getting_started/02_install_mac.html) · [End user licence agreement](https://adoxx.org/assets/EndUserLicenceAgreement_ADOxx.pdf)
- Modelling language: [application library](https://adoxx.org/documentation/10_modelling_language/01_application_library.html), [classes](https://adoxx.org/documentation/10_modelling_language/10_classes.html), [attributes](https://adoxx.org/documentation/10_modelling_language/20_attributes.html), [attribute types](https://adoxx.org/documentation/10_modelling_language/21_attribute_types.html), [facets](https://adoxx.org/documentation/10_modelling_language/22_attribute_facets.html), [special attributes](https://adoxx.org/documentation/10_modelling_language/23_special_attributes.html), [model types](https://adoxx.org/documentation/10_modelling_language/30_model_types.html)
- [Library attributes](https://adoxx.org/documentation/70_adoxx_components/20_Library_Management/Library_attributes.html) · [ADOxx components](https://adoxx.org/documentation/70_adoxx_components/index.html)
- [GraphRep reference](https://adoxx.org/adoscript_reference/31_graphrep/index.html) · [AttrRep reference](https://adoxx.org/adoscript_reference/30_attrrep/index.html)
- [AdoScript reference](https://adoxx.org/adoscript_reference/01_adoscript/) · [Message ports](https://adoxx.org/adoscript_reference/20_message_ports/index.html) · [Events](https://adoxx.org/adoscript_reference/50_events/index.html) · [Expressions](https://adoxx.org/documentation/20_mechanisms_and_algorithms/3_external_coupling_of_functionality/5_expression_adoscript.html)
- [ALL library language](https://adoxx.org/documentation/75_adoxx_development_languages/6_adoxx_library_language_all.html) · [ADL model language](https://adoxx.org/documentation/75_adoxx_development_languages/5_adoxx_model_language_adl.html) · [AQL](https://adoxx.org/documentation/75_adoxx_development_languages/01_AQL.html)
- [ADOxx starter libraries](https://adoxx.org/documentation/80_special_cases/adoxx_libraries.html) · [Bee-Up](https://bee-up.omilab.org/activities/bee-up/)

**Technology**

- [FileSystemObserver: intent to ship in Chrome 133](https://groups.google.com/a/chromium.org/g/blink-dev/c/6oOaFmia2dc/m/gx0KgpQqBQAJ)
- [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten)
- [tldraw SDK licence](https://tldraw.dev/legal/tldraw-license)
- [Eclipse Sirius Web](https://eclipse.dev/sirius/sirius-web.html)

**Browser, storage and services** (opened on 7 October 2026 for the revision)

- File System Access: [showDirectoryPicker on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) · [persistent permissions in Chrome 122](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)
- Microsoft: [auth code flow with PKCE for single-page apps](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) · [OneDrive permissions](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference) · [app consent policies](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies) · [delta](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0) · [upload file content](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- Google: [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) · [token model for web apps](https://developers.google.com/identity/oauth2/web/guides/use-token-model) · [Picker folder selection](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setselectfolderenabled) · [listing changes](https://developers.google.com/workspace/drive/api/guides/manage-changes)
- GitHub: [CORS on the REST API](https://docs.github.com/en/enterprise-cloud@latest/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests) · [authorising OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) · [PKCE announcement](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/) · [Git trees API](https://docs.github.com/en/enterprise-server@3.18/rest/git/trees)
- GitLab: [OAuth 2 with PKCE](https://docs.gitlab.com/api/oauth2) · [Commits API](https://docs.gitlab.com/ee/api/commits.html) · [isomorphic-git and the CORS proxy](https://isomorphic-git.org/docs/en/quickstart)
- [Anthropic TypeScript SDK, browser use](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript) · [OpenSpec](https://github.com/Fission-AI/OpenSpec) · [Metakit on Wikipedia](https://en.wikipedia.org/wiki/Metakit)

Not verified: the ADOxx 1.8.0 release date, a published XML schema for ADOxx exports, what OMiLAB's OLIVE framework offers, Graph `delta` on a single SharePoint folder, whether Google's `drive.file` scope reaches files inside a picked folder, and GitLab REST calls with a token from a browser. Phase 0 tests the last three.
