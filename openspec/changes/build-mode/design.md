# Design

- **Same store.** A Kit is opened as a document with the Kit command API and its own undo. Editors only issue commands (`putClass`, `putRelation`, `putModelType`, new `renameKey`, `moveAttribute`), never write state.
- **Key rename.** `renameKey` takes a scope (`class`, `relation`, `attribute` of a class or relation, `modelType`) and a new key, checks it is a valid name and unique where looked up, then rewrites every formula string that reads the old key: formula attributes, shape properties and `let`, panel layout conditions. Rewriting parses each formula and replaces name tokens, so strings and longer names are untouched. Unparseable formulas are left alone and reported.
- **Usage search.** `findKeyUsages(tool, scope, key)` returns where a key is read; the editors show it before deleting.
- **Hot reload.** The shell holds the Kit store of the open model's Kit; a Kit change event rebuilds the model scene's Kit-dependent caches in one animation frame (target under 1 s, measured in an e2e test).
- **Unknown data.** `unknownAttributes(tool, model, element)` lists stored values whose attribute ids no longer exist; the attribute panel shows them in a collapsed group with a "Remove" action that runs a command. A class id missing from the Kit draws as a grey placeholder with the id's last part and `?`.
- **Editors** are plain Svelte forms over small view-model functions (`packages/ui/src/build`), unit-tested without the DOM.
- **Recreating the samples.** A test builds `bpmn-lite` and `er-lite` equivalents through the same commands the editors use and compares the result with the sample files (modulo ids).
