# Design

- `toLayout(tool, assets?) → GitFile[]` and `fromLayout(files) → { tool, issues }` in `packages/storage/src/git/layout.ts`.
- File names come from keys (kebab-case); two parts whose keys give the same name get the id as a suffix. The part's id is stored inside the file, so a rename of the file does not change identity.
- Scripts are written as `scripts/<name>.ts` holding the source only; a small `scripts/<name>.json` holds the rest (id, name, enabled). Assets are carried as base64 `GitFile`s.
- `tool.json` holds the manifest, settings and the lists of part ids in order (ordered lists keep their order in the file, not in the folder).
- Output is stable JSON (2-space indent, stable key order, trailing newline) so a round trip gives no diff.
