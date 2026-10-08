<script lang="ts">
  import { describePart } from '@metakit-app/shapes';
  import type { PartPath } from '@metakit-app/shapes';
  import { propertiesFor } from '../../build/part-properties';
  import type { ShapeEditorModel } from '../../build/shape-editor-model';
  import ColourHelper from './ColourHelper.svelte';
  import FormulaInput from './FormulaInput.svelte';
  import PropertyRow from './PropertyRow.svelte';

  let { model, version }: { model: ShapeEditorModel; version: number } =
    $props();

  const part = $derived.by(() => {
    void version;
    return model.selectedPart;
  });
  const path = $derived.by(() => {
    void version;
    return model.selection;
  });
  const specs = $derived(part ? propertiesFor(part.type) : []);
  const sections = $derived.by(() => {
    const out: { name: string; items: typeof specs }[] = [];
    for (const s of specs) {
      let g = out.find((x) => x.name === s.section);
      if (!g) out.push((g = { name: s.section, items: [] }));
      g.items.push(s);
    }
    return out;
  });
  const draft = $derived.by(() => {
    void version;
    return model.draft;
  });
  const lets = $derived(Object.entries(draft.let ?? {}));

  let helper = $state<{ path: PartPath; prop: string; label: string } | null>(
    null,
  );
  let newName = $state('');
  let letProblem = $state('');

  function addLet() {
    const name = newName.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      letProblem =
        'A name uses letters, digits and underscores and starts with a letter.';
      return;
    }
    if (draft.let && Object.hasOwn(draft.let, name)) {
      letProblem = `${name} is already used.`;
      return;
    }
    letProblem = '';
    model.setLet(name, '= null');
    newName = '';
  }

  const number = (text: string) => {
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  };
</script>

<section class="panel" aria-label="Properties" data-testid="shape-properties">
  {#if part && path}
    <h3>{describePart(part)}</h3>
    {#each sections as section (section.name)}
      <fieldset>
        <legend>{section.name}</legend>
        {#each section.items as spec (spec.prop)}
          <PropertyRow
            {model}
            {version}
            {path}
            {spec}
            onHelper={(prop, label) => (helper = { path, prop, label })}
          />
        {/each}
      </fieldset>
    {/each}
  {:else}
    <p class="hint" data-testid="shape-no-selection">
      Select a part on the canvas or in the layer list to change it.
    </p>
  {/if}

  <fieldset>
    <legend>Shape</legend>
    <label class="line">
      <span>Name</span>
      <input
        type="text"
        value={draft.name ?? ''}
        data-testid="shape-name"
        onchange={(e) => model.setName(e.currentTarget.value)}
      />
    </label>
    <label class="line">
      <span>Width</span>
      <input
        type="number"
        min="1"
        value={draft.size.width}
        data-testid="shape-size-width"
        onchange={(e) => {
          const n = number(e.currentTarget.value);
          if (n !== null) model.setSize(n, draft.size.height);
        }}
      />
    </label>
    <label class="line">
      <span>Height</span>
      <input
        type="number"
        min="1"
        value={draft.size.height}
        data-testid="shape-size-height"
        onchange={(e) => {
          const n = number(e.currentTarget.value);
          if (n !== null) model.setSize(draft.size.width, n);
        }}
      />
    </label>
  </fieldset>

  <fieldset data-testid="shape-lets">
    <legend>Named values</legend>
    <p class="hint">
      A named value is worked out once and can be used in any formula of this
      shape.
    </p>
    {#each lets as [name, source] (name)}
      <div class="line">
        <span class="mono">{name}</span>
        <FormulaInput
          value={source}
          label={`Formula of ${name}`}
          testid={`shape-let-${name}`}
          complete={(p) => model.complete(p)}
          onCommit={(text) =>
            model.setLet(name, text === '' ? undefined : text)}
        />
      </div>
    {/each}
    <div class="line">
      <input
        type="text"
        placeholder="name"
        aria-label="Name of a new named value"
        bind:value={newName}
        data-testid="shape-let-name"
        onkeydown={(e) => e.key === 'Enter' && addLet()}
      />
      <button type="button" onclick={addLet} data-testid="shape-let-add">
        Add
      </button>
    </div>
    {#if letProblem}<p class="problem" role="alert">{letProblem}</p>{/if}
  </fieldset>
</section>

{#if helper}
  <ColourHelper
    {model}
    path={helper.path}
    prop={helper.prop}
    label={helper.label}
    onClose={() => (helper = null)}
  />
{/if}

<style>
  .panel {
    display: grid;
    gap: 0.5rem;
    align-content: start;
    overflow: auto;
    padding: 0.5rem 0.75rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  fieldset {
    border: 1px solid var(--line, var(--line));
    border-radius: 6px;
    margin: 0;
    padding: 0.3rem 0.6rem 0.5rem;
  }
  legend {
    font-size: 0.8rem;
    color: var(--muted, var(--text-muted));
    padding: 0 0.3rem;
  }
  .line {
    display: grid;
    grid-template-columns: 5rem 1fr;
    gap: 0.4rem;
    align-items: center;
    padding: 0.1rem 0;
    font-size: 0.85rem;
  }
  .line:has(button) {
    grid-template-columns: 1fr auto;
  }
  .mono {
    font-family: ui-monospace, monospace;
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted, var(--text-muted));
  }
  .problem {
    margin: 0;
    color: var(--danger, var(--danger));
    font-size: 0.85rem;
  }
</style>
