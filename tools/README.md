# tools

Hand-written tool libraries used as fixtures for tests and CI. Each folder holds:

- `tool.json`: the tool library, in the same form the app keeps in its snapshots;
- `*.mkmodel.json`: a sample model in the editable format.

| Folder      | Classes                                                                   | Sample model                 |
| ----------- | ------------------------------------------------------------------------- | ---------------------------- |
| `bpmn-lite` | Task, Gateway, Start event, End event, Lane; relation class Sequence flow | `order-process.mkmodel.json` |
| `er-lite`   | Entity, Attribute, Relationship; relation classes Has, Participates in    | `library.mkmodel.json`       |

Check them with `metakit validate tools/bpmn-lite` (see `apps/cli`).
