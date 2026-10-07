<script lang="ts">
  import type { AttributeDef, LookColour } from '@metakit-app/core';
  import {
    attributeLabel,
    dependOn,
    fixedColour,
    isDataColour,
    isDrivable,
    valueOptions,
    withValueColour,
  } from '../../../build/appearance-model';
  import ColourControl from './ColourControl.svelte';

  let {
    label,
    colour,
    attributes,
    testid,
    strong = false,
    onChange,
  }: {
    /** "Fill colour", "Line colour": the sentence reads "<label> depends on …". */
    label: string;
    colour: LookColour;
    attributes: readonly AttributeDef[];
    testid: string;
    strong?: boolean;
    onChange: (colour: LookColour) => void;
  } = $props();

  const choices = $derived(attributes.filter(isDrivable));
  const attr = $derived(
    isDataColour(colour)
      ? attributes.find((a) => a.key === colour.by)
      : undefined,
  );
  const options = $derived(valueOptions(attr));
  const typed = $derived(
    isDataColour(colour)
      ? Object.keys(colour.values).filter(
          (v) => !options.some((o) => o.value === v),
        )
      : [],
  );
  let adding = $state('');

  function choose(key: string) {
    if (key === '') {
      onChange(fixedColour(colour));
      return;
    }
    const next = attributes.find((a) => a.key === key);
    if (next) onChange(dependOn(colour, next));
  }
  const rowColour = (value: string): string =>
    isDataColour(colour)
      ? (colour.values[value] ?? colour.fallback)
      : '#ffffff';

  function addValue() {
    const v = adding.trim();
    if (v === '' || !isDataColour(colour)) return;
    adding = '';
    onChange(withValueColour(colour, v, colour.fallback));
  }
</script>

<div class="rule" data-testid="{testid}-rule">
  <label class="sentence">
    <span>{label} depends on</span>
    <select
      value={isDataColour(colour) ? colour.by : ''}
      data-testid="{testid}-attr"
      onchange={(e) => choose(e.currentTarget.value)}
    >
      <option value="">nothing (always the same)</option>
      {#each choices as a (a.id)}
        <option value={a.key}>{attributeLabel(a)}</option>
      {/each}
    </select>
  </label>
  {#if isDataColour(colour)}
    <table class="values" aria-label="{label} for each value">
      <tbody>
        {#each options as o (o.value)}
          <tr>
            <th scope="row">{o.label}</th>
            <td>
              <ColourControl
                value={rowColour(o.value)}
                label="{label} when {o.label}"
                testid="{testid}-value-{o.value}"
                {strong}
                onChange={(c) => onChange(withValueColour(colour, o.value, c))}
              />
            </td>
            <td></td>
          </tr>
        {/each}
        {#each typed as v (v)}
          <tr>
            <th scope="row">{v}</th>
            <td>
              <ColourControl
                value={rowColour(v)}
                label="{label} when {v}"
                testid="{testid}-value-{v}"
                {strong}
                onChange={(c) => onChange(withValueColour(colour, v, c))}
              />
            </td>
            <td>
              <button
                type="button"
                class="ghost"
                aria-label="Remove {v}"
                onclick={() => onChange(withValueColour(colour, v, null))}
                >Remove</button
              >
            </td>
          </tr>
        {/each}
        <tr class="else">
          <th scope="row">Anything else</th>
          <td>
            <ColourControl
              value={colour.fallback}
              label="{label} for anything else"
              testid="{testid}-fallback"
              {strong}
              onChange={(c) => onChange({ ...colour, fallback: c })}
            />
          </td>
          <td></td>
        </tr>
      </tbody>
    </table>
    {#if options.length === 0}
      <form
        class="add"
        onsubmit={(e) => {
          e.preventDefault();
          addValue();
        }}
      >
        <input
          bind:value={adding}
          placeholder="A value to colour, for example Urgent"
          aria-label="A value to give its own colour"
          data-testid="{testid}-new-value"
        />
        <button type="submit">Add value</button>
      </form>
    {/if}
  {/if}
</div>

<style>
  .rule {
    display: grid;
    gap: var(--gap-2);
  }
  .sentence {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2);
    align-items: center;
  }
  .sentence span {
    font-weight: 600;
  }
  .values {
    border-collapse: collapse;
    width: 100%;
  }
  th {
    text-align: left;
    font-weight: 500;
    padding: var(--gap-1) var(--gap-2) var(--gap-1) 0;
  }
  td {
    padding: var(--gap-1) 0;
  }
  .else th {
    color: var(--text-muted);
  }
  .add {
    display: flex;
    gap: var(--gap-2);
  }
  .add input {
    flex: 1;
    min-width: 0;
  }
</style>
