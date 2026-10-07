<script lang="ts">
  import type { LabelDef, MarkerType, RelationShape } from '@metakit-app/core';
  import { withPatch } from '../../build/attributes';

  let {
    shape,
    onChange,
  }: {
    shape: RelationShape;
    onChange: (shape: RelationShape) => string | null;
  } = $props();

  let error = $state<string | null>(null);
  const MARKERS: [MarkerType, string][] = [
    ['none', 'None'],
    ['arrow', 'Filled arrow'],
    ['open-arrow', 'Open arrow'],
    ['triangle', 'Hollow triangle'],
    ['diamond', 'Diamond'],
    ['circle', 'Circle'],
    ['cross', 'Cross'],
    ['bar', 'Bar'],
  ];
  const save = (next: RelationShape) => (error = onChange(next));
  const line = (changes: Record<string, unknown>) =>
    save({ ...shape, line: withPatch(shape.line, changes) });
  const marker = (
    which: 'startMarker' | 'endMarker',
    changes: Record<string, unknown>,
  ) => {
    const current = shape[which] ?? { type: 'none' as MarkerType };
    const next = withPatch(current, changes);
    save({ ...shape, [which]: next } as RelationShape);
  };
  const dashText = $derived(
    Array.isArray(shape.line.dash)
      ? shape.line.dash.join(', ')
      : (shape.line.dash ?? ''),
  );
  function setDash(text: string) {
    const t = text.trim();
    if (t === '') return line({ dash: undefined });
    if (t.startsWith('=')) return line({ dash: t });
    const nums = t.split(/[ ,]+/).map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
      error =
        'Dash lengths are numbers such as 6, 4, or a formula starting with =.';
      return;
    }
    line({ dash: nums });
  }
  const labels = $derived(shape.labels ?? []);
  function setLabel(i: number, changes: Record<string, unknown>) {
    save({
      ...shape,
      labels: labels.map((l, j) => (j === i ? withPatch(l, changes) : l)),
    });
  }
</script>

<div class="form" data-testid="relation-shape-form">
  <label
    >Name <input
      value={shape.name ?? ''}
      onchange={(e) =>
        save(withPatch(shape, { name: e.currentTarget.value || undefined }))}
      data-testid="rshape-name"
    /></label
  >
  <div class="row">
    <label
      >Colour (or a formula starting with =)<input
        value={String(shape.line.stroke ?? '#6b7a90')}
        onchange={(e) => line({ stroke: e.currentTarget.value })}
        data-testid="rshape-stroke"
      /></label
    >
    <label
      >Width <input
        type="number"
        min="0.5"
        step="0.5"
        value={typeof shape.line.strokeWidth === 'number'
          ? shape.line.strokeWidth
          : 1.5}
        onchange={(e) =>
          line({ strokeWidth: Number(e.currentTarget.value) || 1.5 })}
      /></label
    >
    <label
      >Dashes <input
        value={dashText}
        onchange={(e) => setDash(e.currentTarget.value)}
        placeholder="6, 4"
        data-testid="rshape-dash"
      /></label
    >
  </div>
  <div class="row">
    <label
      >Route
      <select
        value={shape.line.routing ?? 'orthogonal'}
        onchange={(e) => line({ routing: e.currentTarget.value })}
        data-testid="rshape-routing"
      >
        <option value="orthogonal">Right angles</option><option value="straight"
          >Straight</option
        ><option value="curved">Curved</option>
      </select>
    </label>
    <label
      >Round corners by <input
        type="number"
        min="0"
        value={shape.line.corners ?? 0}
        onchange={(e) =>
          line({ corners: Number(e.currentTarget.value) || undefined })}
      /></label
    >
  </div>
  <div class="row">
    {#each [['startMarker', 'Start'], ['endMarker', 'End']] as [which, title] (which)}
      <label
        >{title} marker
        <select
          value={String(
            (shape[which as 'startMarker'] ?? { type: 'none' }).type,
          )}
          onchange={(e) =>
            marker(which as 'startMarker', { type: e.currentTarget.value })}
          data-testid="rshape-{which}"
        >
          {#each MARKERS as [value, text] (value)}<option {value}>{text}</option
            >{/each}
        </select>
      </label>
    {/each}
  </div>
  <div>
    <strong>Labels</strong>
    {#each labels as l, i (i)}
      <div class="row">
        <select
          value={l.at}
          onchange={(e) => setLabel(i, { at: e.currentTarget.value })}
          aria-label="Where the label sits"
        >
          <option value="start">At the start</option><option value="middle"
            >In the middle</option
          ><option value="end">At the end</option>
        </select>
        <input
          value={String(l.text)}
          onchange={(e) => setLabel(i, { text: e.currentTarget.value })}
          placeholder="Text, or = Condition"
          aria-label="Label text"
        />
        <button
          type="button"
          onclick={() =>
            save({ ...shape, labels: labels.filter((_, j) => j !== i) })}
          >Remove</button
        >
      </div>
    {/each}
    <button
      type="button"
      onclick={() =>
        save({
          ...shape,
          labels: [
            ...labels,
            {
              at: 'middle',
              text: '= ""',
              offset: { x: 0, y: -10 },
            } as LabelDef,
          ],
        })}
      data-testid="rshape-add-label">Add label</button
    >
  </div>
  {#if error}<p class="problem" role="alert">{error}</p>{/if}
</div>

<style>
  .form {
    display: grid;
    gap: 0.7rem;
  }
  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: end;
  }
  label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.9rem;
  }
  .problem {
    color: #c92a2a;
    margin: 0;
  }
</style>
