# Phase 10: beta with project teams (both lanes, weeks 19 to 22)

Phase 10 puts MetaKit in front of real users and ends with the version 1.0 release. Two or three project teams use it on real projects while the gaps they find are fixed.

**Before starting:** Danial picks the beta teams and the three tools to port.

## 10.1 Port three real tools

Deliver, with Danial choosing which tools:

- three modelling tools that exist in ADOxx today, rebuilt in Build mode (notation, panels, rules, scripts);
- a list of every gap found, each turned into a fix or a rule action, or recorded as a known limit.

Done when: the three tools are usable by their teams.

## 10.2 Documentation and onboarding

Deliver:

- a user guide for modellers;
- a tool-builder guide covering classes, Shapes, panels, formulas, rules and scripts;
- a script API reference generated from the TypeScript declarations;
- two tutorials (build a small tool; collaborate in a shared folder);
- a starter gallery of tools in the app;
- a first-run screen that explains the folder setup and the browser requirement.

Done when: a new user gets from the start page to a first model using only the in-app guidance.

## 10.3 Hardening

Deliver:

- an accessibility pass (keyboard use, focus, contrast, screen-reader labels on panels and dialogs);
- a security review of the script sandbox, permissions, and token and key storage;
- re-checks of the performance budget and the sync tests on the latest build;
- GitHub issue templates for bugs and feature requests, and a triage routine.

Done when: no open bug is rated severe.

## 10.4 Release 1.0

Deliver:

- version 1.0 tagged and deployed to GitHub Pages;
- release notes;
- the file format versions frozen for 1.0, with migrations tested from every earlier format version.

Done when: a project team completes a project with MetaKit.

## After 1.0

Direct OneDrive/SharePoint and Google Drive connectors if teams need them, named checkpoints (1.1), tabular view, shared catalogs.
