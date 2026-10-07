<script lang="ts">
  import { isFormula } from '@metakit-app/core';
  import type { PartPath } from '@metakit-app/shapes';
  import type { PropertySpec } from '../../build/part-properties';
  import type { ShapeEditorModel } from '../../build/shape-editor-model';
  import FormulaInput from './FormulaInput.svelte';

  let {
    model,
    version,
    path,
    spec,
    onHelper,
  }: {
    model: ShapeEditorModel;
    version: number;
    path: PartPath;
    spec: PropertySpec;
    /** Opens the "Colour by attribute" helper for this property. */
    onHelper: (prop: string, label: string) => void;
  } = $props();

  const id = $derived(spec.prop.replace(/\./g, '-'));
  const raw = $derived.by(() => {
    void version;
    return model.getProp(spec.prop, path);
  });
  const formula = $derived(isFormula(raw) || spec.kind === 'formula');
  const fixed = $derived(raw === undefined ? spec.fallback : raw);
  const isSet = $derived(raw !== undefined);

  function set(value: unknown) {
    model.setProp(spec.prop, value, path);
  }

  function commitNumber(text: string) {
    if (text.trim() === '') return set(undefined);
    const n = Number(text);
    if (Number.isFinite(n)) set(n);
  }

  function commitDim(text: string) {
    const t = text.trim();
    if (t === '') return set(undefined);
    set(/^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t);
  }

  function commitText(text: string) {
    set(text === '' && spec.prop !== 'text' ? undefined : text);
  }

  function toggleFx() {
    if (formula) model.toFixed(spec.prop, spec.fallback, path);
    else model.toFormula(spec.prop, spec.fallback, path);
  }

  const swatch = (v: unknown) =>
    typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000';
</script>

<div class="row" data-testid={`shape-row-${id}`}>
  <span class="label" id={`lbl-${id}`}>{spec.label}</span>
  <div class="control">
    {#if formula}
      <FormulaInput
        value={typeof raw === 'string' ? raw : ''}
        label={`${spec.label} formula`}
        testid={`shape-prop-${id}`}
        complete={(p) => model.complete(p)}
        onCommit={(text) => set(text === '' ? undefined : text)}
      />
    {:else if spec.kind === 'number'}
      <input
        type="number"
        value={isSet ? String(raw) : ''}
        placeholder={String(spec.fallback)}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        aria-labelledby={`lbl-${id}`}
        data-testid={`shape-prop-${id}`}
        onchange={(e) => commitNumber(e.currentTarget.value)}
      />
    {:else if spec.kind === 'dim'}
      <input
        type="text"
        value={isSet ? String(raw) : ''}
        placeholder={String(spec.fallback)}
        aria-labelledby={`lbl-${id}`}
        data-testid={`shape-prop-${id}`}
        onchange={(e) => commitDim(e.currentTarget.value)}
      />
    {:else if spec.kind === 'colour'}
      <input
        type="color"
        value={swatch(fixed)}
        aria-label={`Pick ${spec.label.toLowerCase()}`}
        data-testid={`shape-prop-${id}-swatch`}
        onchange={(e) => set(e.currentTarget.value.toUpperCase())}
      />
      <input
        type="text"
        value={isSet ? String(raw) : ''}
        placeholder={isSet ? '' : 'none'}
        aria-labelledby={`lbl-${id}`}
        data-testid={`shape-prop-${id}`}
        onchange={(e) => {
          const t = e.currentTarget.value.trim();
          set(t === '' ? undefined : t);
        }}
      />
    {:else if spec.kind === 'bool'}
      <input
        type="checkbox"
        checked={fixed !== false}
        aria-labelledby={`lbl-${id}`}
        data-testid={`shape-prop-${id}`}
        onchange={(e) => set(e.currentTarget.checked)}
      />
    {:else if spec.kind === 'choice'}
      <select
        value={String(fixed)}
        aria-labelledby={`lbl-${id}`}
        data-testid={`shape-prop-${id}`}
        onchange={(e) => set(e.currentTarget.value)}
      >
        {#each spec.choices ?? [] as c (c.value)}
          <option value={c.value}>{c.label}</option>
        {/each}
      </select>
    {:else}
      <input
        type="text"
        value={isSet ? String(raw) : ''}
        placeholder={spec.fallback === '' ? '' : String(spec.fallback)}
        aria-labelledby={`lbl-${id}`}
        data-testid={`shape-prop-${id}`}
        onchange={(e) => commitText(e.currentTarget.value)}
      />
    {/if}
  </div>
  {#if spec.fx && spec.kind !== 'formula'}
    <button
      type="button"
      class="fx"
      aria-pressed={formula}
      aria-label={`Use a formula for ${spec.label}`}
      title="Use a formula"
      data-testid={`shape-fx-${id}`}
      onclick={toggleFx}
    >
      fx
    </button>
  {/if}
  {#if spec.helper === 'colour'}
    <button
      type="button"
      class="helper"
      aria-label={`Colour ${spec.label.toLowerCase()} by attribute`}
      title="Colour by attribute"
      data-testid={`shape-colour-open-${id}`}
      onclick={() => onHelper(spec.prop, spec.label)}
    >
      Colour by attribute...
    </button>
  {/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr) auto;
    gap: 0.4rem;
    align-items: center;
    padding: 0.15rem 0;
  }
  .label {
    font-size: 0.85rem;
    color: var(--muted, #6b7280);
  }
  .control {
    display: flex;
    gap: 0.3rem;
    min-width: 0;
  }
  .control input[type='text'],
  .control input[type='number'],
  .control select {
    min-width: 0;
    flex: 1;
    box-sizing: border-box;
  }
  .control input[type='color'] {
    width: 2rem;
    padding: 0;
    flex: none;
  }
  .helper {
    grid-column: 2 / -1;
    justify-self: start;
    font-size: 0.8rem;
    padding: 0.1rem 0.5rem;
  }
  .fx {
    font-style: italic;
    font-family: serif;
    padding: 0.15rem 0.5rem;
  }
  .fx[aria-pressed='true'] {
    background: var(--accent, #364fc7);
    border-color: var(--accent, #364fc7);
    color: #fff;
  }
</style>
