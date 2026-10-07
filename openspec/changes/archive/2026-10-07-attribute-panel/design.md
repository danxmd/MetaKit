# Design

- **Panel model.** `buildPanel(tool, model, selection, issues)` returns sections of fields. A field has the attribute, the control kind, the shared value or `{ mixed: true }`, a read-only flag, and issue messages. For several elements only attributes in the effective set of all of them are shown.
- **Control kinds.** `text` (single or multi-line), `number` (with unit), `switch`/`checkbox`, `date`, `date-time`, `duration` (hours, minutes, days parts), `select`, `segmented` (up to four options), `chips`, `table`, `reference`, `link`, `readonly` (formula), `button` (action, disabled until phase 5/7).
- **Edits.** A change in a control calls the host with `{ target, attr, value }` for each selected item; the host executes one batch. Text fields commit on blur or Enter so typing does not create an undo step per key; the number of undo steps for one edit is one.
- **Validation.** Issues come from `validateModel`; the panel shows those whose id and attr match. Values that do not parse (text in a number field) show a message and are not written.
- **Reference picker.** Searches the open model and other models of the workspace (the controller supplies the list); the stored value is `{ model, element }` ids, with an open link.
- **Tables.** Inline grid with add and delete row; pasting tab-separated text fills rows from the active cell, converting by column type.
- **Canvas text edit.** Double-click on an element opens a textarea in the overlay positioned over the element and edits the label attribute; commit on blur, Escape cancels.
- **Speed.** Edits go through the store and the scene updates only that element, which keeps the shape update under 50 ms; a test measures it.
