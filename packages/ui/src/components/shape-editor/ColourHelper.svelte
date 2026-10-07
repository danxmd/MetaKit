<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { PartPath } from '@metakit-app/shapes';
  import type { ShapeEditorModel } from '../../build/shape-editor-model';

  let {
    model,
    path,
    prop,
    label,
    onClose,
  }: {
    model: ShapeEditorModel;
    path: PartPath;
    /** The property that gets the formula, such as `fill` or `stroke`. */
    prop: string;
    label: string;
    onClose: () => void;
  } = $props();

  const PALETTE = [
    '#D93025',
    '#F29900',
    '#188038',
    '#1A73E8',
    '#8E24AA',
    '#5F6368',
  ];

  // The dialog is opened for one property and discarded after, so it reads its inputs once.
  const attributes = untrack(() => model.mappableAttributes());
  const existing = untrack(() => model.colourMapOf(path, prop));

  let attribute = $state(existing?.attribute ?? attributes[0]?.key ?? '');
  let fallback = $state(existing?.fallback ?? '#868E96');
  let rows = $state<{ value: string | boolean; colour: string }[]>([]);
  let problem = $state('');
  let dialog: HTMLDialogElement | undefined = $state();

  function load(key: string) {
    const known = existing?.attribute === key ? existing.mapping : [];
    rows = model.valuesOf(key).map((value, i) => ({
      value,
      colour:
        known.find((m) => m.value === value)?.colour ??
        (existing?.attribute === key ? '' : PALETTE[i % PALETTE.length]!),
    }));
  }

  onMount(() => {
    load(attribute);
    dialog?.showModal();
  });

  function apply() {
    const mapping = rows
      .filter((r) => r.colour.trim() !== '')
      .map((r) => ({ value: r.value, colour: r.colour.trim() }));
    if (attribute === '' || mapping.length === 0) {
      problem = 'Give at least one value a colour.';
      return;
    }
    model.applyColourMap(path, prop, attribute, mapping, fallback.trim());
    onClose();
  }

  const asHex = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');
</script>

<dialog
  bind:this={dialog}
  aria-label={`Colour ${label} by attribute`}
  data-testid="shape-colour-helper"
  onclose={onClose}
>
  <form
    method="dialog"
    onsubmit={(e) => {
      e.preventDefault();
      apply();
    }}
  >
    <h2>Colour {label.toLowerCase()} by attribute</h2>
    {#if attributes.length === 0}
      <p class="notice" data-testid="shape-colour-none">
        This class has no choice or yes/no attribute to colour by. Add one in
        Build mode first.
      </p>
    {:else}
      <label>
        Attribute
        <select
          bind:value={attribute}
          onchange={() => load(attribute)}
          data-testid="shape-colour-attribute"
        >
          {#each attributes as a (a.id)}
            <option value={a.key}>{a.key}</option>
          {/each}
        </select>
      </label>
      <table>
        <thead>
          <tr><th>Value</th><th>Colour</th></tr>
        </thead>
        <tbody>
          {#each rows as row (String(row.value))}
            <tr>
              <td>{String(row.value)}</td>
              <td class="colour">
                <input
                  type="color"
                  value={asHex(row.colour)}
                  aria-label={`Pick the colour for ${String(row.value)}`}
                  oninput={(e) => (row.colour = e.currentTarget.value)}
                />
                <input
                  type="text"
                  bind:value={row.colour}
                  placeholder="no colour"
                  aria-label={`Colour for ${String(row.value)}`}
                  data-testid={`shape-colour-value-${String(row.value)}`}
                />
              </td>
            </tr>
          {/each}
          <tr>
            <td>Anything else</td>
            <td class="colour">
              <input
                type="color"
                value={asHex(fallback)}
                aria-label="Pick the colour for everything else"
                oninput={(e) => (fallback = e.currentTarget.value)}
              />
              <input
                type="text"
                bind:value={fallback}
                aria-label="Colour for everything else"
                data-testid="shape-colour-fallback"
              />
            </td>
          </tr>
        </tbody>
      </table>
    {/if}
    {#if problem}<p class="notice" role="alert">{problem}</p>{/if}
    <div class="actions">
      <button
        type="button"
        onclick={() => dialog?.close()}
        data-testid="shape-colour-cancel"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="primary"
        disabled={attributes.length === 0}
        data-testid="shape-colour-apply"
      >
        Apply
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: 1px solid var(--line, #dee2e6);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    min-width: 22rem;
  }
  form {
    display: grid;
    gap: 0.8rem;
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  table {
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-size: 0.8rem;
    color: var(--muted, #6b7280);
  }
  td {
    padding: 0.2rem 0.5rem 0.2rem 0;
  }
  .colour {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .colour input[type='text'] {
    width: 7rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .notice {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    background: #fff4e6;
  }
</style>
