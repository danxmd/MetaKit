<script lang="ts">
  import type { Json, TableAttribute } from '@metakit-app/core';
  import { optionValue } from '@metakit-app/core';
  import { parseNumberText, parseTablePaste, tableWithPaste } from '../panel';

  let {
    attr,
    rows,
    readOnly,
    onChange,
  }: {
    attr: TableAttribute;
    rows: Record<string, Json>[];
    readOnly: boolean;
    onChange: (rows: Record<string, Json>[]) => void;
  } = $props();

  let problems = $state<string[]>([]);

  const atLimit = $derived(
    attr.maxRows !== undefined && rows.length >= attr.maxRows,
  );

  function label(column: TableAttribute['columns'][number]): string {
    return column.labels?.['en'] ?? column.key;
  }

  function setCell(row: number, columnId: string, value: Json | undefined) {
    const next = rows.map((r) => ({ ...r }));
    const target = next[row];
    if (!target) return;
    if (value === undefined || value === null || value === '')
      delete target[columnId];
    else target[columnId] = value;
    onChange(next);
  }

  function typed(
    row: number,
    column: TableAttribute['columns'][number],
    text: string,
    input: HTMLInputElement,
  ) {
    if (column.type === 'integer' || column.type === 'number') {
      if (text.trim() === '') return setCell(row, column.id, undefined);
      const n = parseNumberText(text);
      if (n === null || (column.type === 'integer' && !Number.isInteger(n))) {
        input.setCustomValidity(
          `"${text}" is not a ${column.type === 'integer' ? 'whole number' : 'number'}.`,
        );
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      return setCell(row, column.id, n);
    }
    setCell(row, column.id, text);
  }

  function addRow() {
    if (atLimit) return;
    onChange([...rows, {}]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function paste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    // A single value pastes into the field as usual; spreadsheet cells and rows fill the grid.
    if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-row][data-col]',
    );
    if (!cell) return;
    event.preventDefault();
    const row = Number(cell.dataset['row']);
    const col = Number(cell.dataset['col']);
    const result = parseTablePaste(attr, text, col);
    problems = result.problems;
    if (result.rows.length > 0)
      onChange(tableWithPaste(rows, row, result.rows, attr.maxRows));
  }
</script>

<div
  class="grid"
  data-testid="table-{attr.key}"
  onpaste={paste}
  role="group"
  aria-label={attr.key}
>
  <table>
    <thead>
      <tr>
        {#each attr.columns as column (column.id)}<th>{label(column)}</th
          >{/each}
        {#if !readOnly}<th class="narrow"></th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, r (r)}
        <tr>
          {#each attr.columns as column, c (column.id)}
            <td data-row={r} data-col={c}>
              {#if column.type === 'boolean'}
                <input
                  type="checkbox"
                  checked={row[column.id] === true}
                  disabled={readOnly}
                  aria-label={label(column)}
                  onchange={(e) =>
                    setCell(r, column.id, e.currentTarget.checked)}
                />
              {:else if column.type === 'choice'}
                <select
                  disabled={readOnly}
                  aria-label={label(column)}
                  value={typeof row[column.id] === 'string'
                    ? row[column.id]
                    : ''}
                  onchange={(e) => setCell(r, column.id, e.currentTarget.value)}
                >
                  <option value="">–</option>
                  {#each column.options ?? [] as option (optionValue(option))}
                    <option value={optionValue(option)}>
                      {typeof option === 'string'
                        ? option
                        : (option.labels?.['en'] ?? option.value)}
                    </option>
                  {/each}
                </select>
              {:else}
                <input
                  type={column.type === 'date' ? 'date' : 'text'}
                  inputmode={column.type === 'integer'
                    ? 'numeric'
                    : column.type === 'number'
                      ? 'decimal'
                      : undefined}
                  value={row[column.id] === undefined || row[column.id] === null
                    ? ''
                    : String(row[column.id])}
                  readonly={readOnly}
                  aria-label={label(column)}
                  onchange={(e) =>
                    typed(r, column, e.currentTarget.value, e.currentTarget)}
                />
              {/if}
            </td>
          {/each}
          {#if !readOnly}
            <td class="narrow">
              <button
                type="button"
                onclick={() => removeRow(r)}
                aria-label="Delete row {r + 1}">×</button
              >
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  {#if !readOnly}
    <button type="button" class="add" disabled={atLimit} onclick={addRow}
      >Add row</button
    >
  {/if}
  {#each problems as problem (problem)}<p class="problem">{problem}</p>{/each}
</div>

<style>
  .grid {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th {
    text-align: left;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--muted);
    padding: 0.1rem 0.25rem;
  }
  td {
    padding: 0.1rem;
  }
  td input:not([type='checkbox']),
  td select {
    width: 100%;
    min-width: 4rem;
    box-sizing: border-box;
  }
  .narrow {
    width: 1.5rem;
  }
  .add {
    margin-top: 0.3rem;
    font-size: 0.85rem;
  }
  .problem {
    color: var(--danger);
    font-size: 0.8rem;
    margin: 0.2rem 0 0;
  }
</style>
