<script lang="ts">
  import {
    type AttributeDef,
    type ClassId,
    type ModelTypeId,
    type TableColumn,
    type Kit,
  } from '@metakit-app/core';
  import {
    ATTRIBUTE_TYPE_LABELS,
    optionsToText,
    toggled,
    textToOptions,
  } from '../../build/attributes';
  import { formulaProblem } from '../../build/formula-check';
  import KeyField from './KeyField.svelte';
  import LabelsField from './LabelsField.svelte';

  let {
    def,
    kit,
    onPut,
    onRename,
  }: {
    def: AttributeDef;
    kit: Kit;
    /** Saves the changed definition; returns an error text when it is refused. */
    onPut: (def: AttributeDef) => string | null;
    onRename: (key: string) => string | null;
  } = $props();

  const languages = $derived(kit.manifest.languages);
  const lang = $derived(languages[0] ?? 'en');
  let problem = $state<string | null>(null);

  /** Applies a change to a copy of the definition and saves it. */
  function change(patch: Record<string, unknown>) {
    const next: Record<string, unknown> = { ...def, ...patch };
    for (const [k, v] of Object.entries(patch))
      if (v === undefined || v === '') delete next[k];
    problem = onPut(next as unknown as AttributeDef);
  }
  const num = (text: string): number | undefined =>
    text.trim() === '' || Number.isNaN(Number(text)) ? undefined : Number(text);

  const classes = $derived(
    Object.values(kit.classes).sort((a, b) => a.key.localeCompare(b.key)),
  );
  const modelTypes = $derived(
    Object.values(kit.modelTypes).sort((a, b) => a.key.localeCompare(b.key)),
  );

  const toggle = toggled;

  function setColumn(i: number, patch: Partial<TableColumn>) {
    if (def.type !== 'table') return;
    change({
      columns: def.columns.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });
  }
  function addColumn() {
    if (def.type !== 'table') return;
    const n = def.columns.length + 1;
    change({
      columns: [
        ...def.columns,
        {
          id: `col_${Date.now().toString(36)}${n}`,
          key: `Column${n}`,
          type: 'text',
        },
      ],
    });
  }
</script>

<div class="form" data-testid="attribute-form-{def.key}">
  <KeyField value={def.key} {onRename} testid="attr-key" />
  <p class="muted">Type: {ATTRIBUTE_TYPE_LABELS[def.type]}</p>
  <LabelsField
    title="Label"
    labels={def.labels}
    {languages}
    onChange={(labels) =>
      change({ labels: Object.keys(labels).length ? labels : undefined })}
    testid="attr-label"
  />
  <LabelsField
    title="Help text"
    labels={def.help}
    {languages}
    multiline
    onChange={(help) =>
      change({ help: Object.keys(help).length ? help : undefined })}
    testid="attr-help"
  />
  <div class="row">
    <label class="inline">
      <input
        type="checkbox"
        checked={def.required === true}
        onchange={(e) =>
          change({ required: e.currentTarget.checked || undefined })}
        data-testid="attr-required"
      />
      Required
    </label>
    <label class="inline">
      Group
      <input
        value={def.group ?? ''}
        onchange={(e) =>
          change({ group: e.currentTarget.value.trim() || undefined })}
        placeholder="Panel group"
      />
    </label>
  </div>

  {#if def.type === 'text'}
    <div class="row">
      <label class="inline">
        <input
          type="checkbox"
          checked={def.multiline === true}
          onchange={(e) =>
            change({ multiline: e.currentTarget.checked || undefined })}
        />
        Several lines
      </label>
      <label class="inline"
        >Longest <input
          type="number"
          min="1"
          value={def.maxLength ?? ''}
          onchange={(e) => change({ maxLength: num(e.currentTarget.value) })}
        /></label
      >
    </div>
    <label
      >Pattern (regular expression)<input
        value={def.pattern ?? ''}
        onchange={(e) =>
          change({ pattern: e.currentTarget.value || undefined })}
      /></label
    >
    <label
      >Default<input
        value={def.default ?? ''}
        onchange={(e) =>
          change({ default: e.currentTarget.value || undefined })}
      /></label
    >
  {:else if def.type === 'integer' || def.type === 'number'}
    <div class="row">
      <label class="inline"
        >Smallest <input
          type="number"
          value={def.min ?? ''}
          onchange={(e) => change({ min: num(e.currentTarget.value) })}
        /></label
      >
      <label class="inline"
        >Largest <input
          type="number"
          value={def.max ?? ''}
          onchange={(e) => change({ max: num(e.currentTarget.value) })}
        /></label
      >
      <label class="inline"
        >Default <input
          type="number"
          value={def.default ?? ''}
          onchange={(e) => change({ default: num(e.currentTarget.value) })}
        /></label
      >
    </div>
    {#if def.type === 'number'}
      <div class="row">
        <label class="inline"
          >Decimals <input
            type="number"
            min="0"
            max="10"
            value={def.decimals ?? ''}
            onchange={(e) => change({ decimals: num(e.currentTarget.value) })}
          /></label
        >
        <label class="inline"
          >Unit <input
            value={def.unit ?? ''}
            onchange={(e) =>
              change({ unit: e.currentTarget.value || undefined })}
            placeholder="h, kg, EUR"
          /></label
        >
      </div>
    {/if}
  {:else if def.type === 'boolean'}
    <div class="row">
      <label class="inline"
        >Shown as
        <select
          value={def.display ?? 'checkbox'}
          onchange={(e) => change({ display: e.currentTarget.value })}
        >
          <option value="checkbox">Checkbox</option>
          <option value="switch">Switch</option>
        </select>
      </label>
      <label class="inline"
        ><input
          type="checkbox"
          checked={def.default === true}
          onchange={(e) =>
            change({ default: e.currentTarget.checked || undefined })}
        /> Yes by default</label
      >
    </div>
  {:else if def.type === 'date' || def.type === 'date-time' || def.type === 'duration'}
    <label
      >Default ({def.type === 'date'
        ? '2026-10-07'
        : def.type === 'date-time'
          ? '2026-10-07T09:30:00Z'
          : 'PT90M'})<input
        value={def.default ?? ''}
        onchange={(e) =>
          change({ default: e.currentTarget.value || undefined })}
      /></label
    >
  {:else if def.type === 'choice' || def.type === 'multi-choice'}
    <label>
      Options, one per line. Add <code>| Label</code> to give one a label in {lang}.
      <textarea
        rows="4"
        value={optionsToText(def.options, lang)}
        onchange={(e) =>
          change({
            options: textToOptions(e.currentTarget.value, lang, def.options),
          })}
        data-testid="attr-options"></textarea>
    </label>
    {#if def.type === 'choice'}
      <label
        >Default<input
          value={def.default ?? ''}
          onchange={(e) =>
            change({ default: e.currentTarget.value || undefined })}
        /></label
      >
    {:else}
      <div class="row">
        <label class="inline"
          >At least <input
            type="number"
            min="0"
            value={def.min ?? ''}
            onchange={(e) => change({ min: num(e.currentTarget.value) })}
          /></label
        >
        <label class="inline"
          >At most <input
            type="number"
            min="0"
            value={def.max ?? ''}
            onchange={(e) => change({ max: num(e.currentTarget.value) })}
          /></label
        >
      </div>
    {/if}
  {:else if def.type === 'formula'}
    <label>
      Formula (for example <code>Effort * 85</code>)
      <input
        value={def.formula}
        onchange={(e) => change({ formula: e.currentTarget.value })}
        data-testid="attr-formula"
        spellcheck="false"
      />
    </label>
    <label class="inline"
      >Result is
      <select
        value={def.result ?? ''}
        onchange={(e) => change({ result: e.currentTarget.value || undefined })}
      >
        <option value="">Any</option><option value="text">Text</option><option
          value="number">Number</option
        ><option value="boolean">Yes or no</option><option value="date"
          >Date</option
        >
      </select>
    </label>
  {:else if def.type === 'table'}
    <div class="columns">
      <strong>Columns</strong>
      {#each def.columns as col, i (col.id)}
        <div class="row">
          <input
            value={col.key}
            onchange={(e) =>
              setColumn(i, { key: e.currentTarget.value.trim() })}
            aria-label="Column key"
          />
          <select
            value={col.type}
            onchange={(e) =>
              setColumn(i, {
                type: e.currentTarget.value as TableColumn['type'],
              })}
            aria-label="Column type"
          >
            <option value="text">Text</option><option value="integer"
              >Whole number</option
            ><option value="number">Number</option><option value="boolean"
              >Yes or no</option
            ><option value="date">Date</option><option value="choice"
              >Choice</option
            >
          </select>
          <button
            type="button"
            disabled={def.columns.length === 1}
            onclick={() =>
              change({ columns: def.columns.filter((_, j) => j !== i) })}
            aria-label="Remove column {col.key}">Remove</button
          >
        </div>
      {/each}
      <button type="button" onclick={addColumn}>Add column</button>
      <label class="inline"
        >Most rows <input
          type="number"
          min="1"
          value={def.maxRows ?? ''}
          onchange={(e) => change({ maxRows: num(e.currentTarget.value) })}
        /></label
      >
    </div>
  {:else if def.type === 'reference'}
    <fieldset>
      <legend>Can point to classes</legend>
      {#each classes as c (c.id)}
        <label class="inline"
          ><input
            type="checkbox"
            checked={def.target.classes?.includes(c.id) ?? false}
            onchange={(e) =>
              change({
                target: {
                  ...def.target,
                  classes: toggle<ClassId>(
                    def.target.classes,
                    c.id,
                    e.currentTarget.checked,
                  ),
                },
              })}
          />
          {c.key}</label
        >
      {/each}
    </fieldset>
    <fieldset>
      <legend>In models of type</legend>
      {#each modelTypes as m (m.id)}
        <label class="inline"
          ><input
            type="checkbox"
            checked={def.target.modelTypes?.includes(m.id) ?? false}
            onchange={(e) =>
              change({
                target: {
                  ...def.target,
                  modelTypes: toggle<ModelTypeId>(
                    def.target.modelTypes,
                    m.id,
                    e.currentTarget.checked,
                  ),
                },
              })}
          />
          {m.key}</label
        >
      {/each}
    </fieldset>
    <label class="inline"
      >At most <input
        type="number"
        min="1"
        value={def.max ?? ''}
        onchange={(e) => change({ max: num(e.currentTarget.value) })}
      /> references</label
    >
  {:else if def.type === 'action'}
    <div class="row">
      <label class="inline"
        >Runs a
        <select
          value={def.run.kind}
          onchange={(e) =>
            change({ run: { ...def.run, kind: e.currentTarget.value } })}
        >
          <option value="command">command</option><option value="rule"
            >rule</option
          ><option value="script">script</option>
        </select>
      </label>
      <label class="inline"
        >Name <input
          value={def.run.ref}
          onchange={(e) =>
            change({ run: { ...def.run, ref: e.currentTarget.value } })}
        /></label
      >
    </div>
  {:else if def.type === 'link'}
    <label class="inline"
      >Points to
      <select
        value={def.target ?? 'any'}
        onchange={(e) => change({ target: e.currentTarget.value })}
      >
        <option value="any">A web address or a file</option><option value="url"
          >A web address</option
        ><option value="file">A file in the workspace</option>
      </select>
    </label>
  {/if}
  {#if def.type !== 'formula' && def.type !== 'table' && def.type !== 'action'}
    {@const defaultProblem = formulaProblem(def.defaultFormula ?? '')}
    <label>
      Default formula (for new objects, for example <code>today()</code>)
      <input
        value={def.defaultFormula ?? ''}
        placeholder="= today()"
        spellcheck="false"
        onchange={(e) => {
          const text = e.currentTarget.value.trim();
          change({
            defaultFormula:
              text === ''
                ? undefined
                : text.startsWith('=')
                  ? text
                  : `= ${text}`,
          });
        }}
        data-testid="attr-default-formula"
      />
    </label>
    {#if defaultProblem}<p
        class="problem"
        role="alert"
        data-testid="attr-default-formula-problem"
      >
        {defaultProblem}
      </p>{/if}
  {/if}
  {#if problem}<p class="problem" role="alert" data-testid="attr-problem">
      {problem}
    </p>{/if}
</div>

<style>
  .form {
    display: grid;
    gap: 0.6rem;
    padding: 0.6rem 0.8rem;
    background: var(--surface-2);
    border-radius: 6px;
  }
  label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.9rem;
  }
  label.inline {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: center;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 6px;
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  .muted {
    color: var(--muted);
    margin: 0;
    font-size: 0.85rem;
  }
  .problem {
    color: var(--danger);
    margin: 0;
  }
  input[type='number'] {
    width: 6rem;
  }
</style>
