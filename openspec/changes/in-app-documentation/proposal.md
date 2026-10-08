# Proposal

## Why

Danial asks for very detailed documentation of every page and every function, available as a side bar on each page (opening at that page's topic), with keywords linked to other topics, and a dedicated Documentation section where tutorials will be added later.

## What Changes

- New package `packages/docs` (no DOM): documentation topics are Markdown files with a small front matter, a small Markdown parser, a topic index with search, keyword auto-linking, and a checker for broken links.
- A **Help** side bar docked on the right of every page. It opens at the topic of the page the person is on (for example the Classes section in Build mode) and can follow links, go back, search and open the full Documentation section.
- A **Documentation** area in the top bar: topic tree by category, search, a reading page, and an empty **Tutorials** category ready for later.
- Content for every page, dialog, menu and function, written in plain English from the code.
- `[[topic-id]]` and `[[topic-id|label]]` links in the text; plus automatic links for each topic's keywords (first mention in a topic).

## Capabilities

### New Capabilities

- `in-app-documentation`

## Impact

- No file format changes and no new runtime dependency (the Markdown reader is small and written for this). Documentation ships with the app and works offline.
