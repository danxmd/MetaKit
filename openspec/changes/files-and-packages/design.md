# Design

- **Zip.** `zipFiles` sorts names and fixes timestamps so exports are reproducible; `unzipFiles` refuses more than 2,000 entries, more than 100 MB, absolute paths and `..`.
- **Bundle.** `bundle.json` (format 1: name, created, tool id and version, models with folders), `tool/tool.json`, `models/*.mkmodel.json`. Import adds the tool when the workspace lacks it, else reports a version difference.
- **Tool package.** `package.json` (format 1), `tool.json`, room for `scripts/` and `assets/`. Import migrates older tool formats and refuses newer ones. Ids in the package are authoritative, so an update keeps existing models working.
- **Update plan.** `planToolUpdate(existing, incoming)` lists added, removed and changed classes, relation classes, model types, attributes, shapes, panels, rules and the version, in plain English, and warns about models that use what is removed.
- **CSV.** One file per class with id, position, parent and attribute columns, one per relation class for connectors; formula attributes are left out because they are derived.
