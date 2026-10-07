<script lang="ts">
  import type { ClassDef, ElementId, RelationDef } from '@metakit-app/core';
  import type { RelationSuggestion } from '../shell/suggestions';

  /**
   * Smart modelling: what the hovered concept can be connected to, grouped by relation. A row adds
   * a new concept next to it and connects it, or starts connecting to one that is already there.
   */
  let {
    name,
    className,
    groups,
    left,
    top,
    onAdd,
    onPick,
    onHighlight,
    onEnter,
    onLeave,
  }: {
    name: string;
    className: string;
    groups: RelationSuggestion[];
    left: number;
    top: number;
    onAdd: (
      relation: RelationDef,
      direction: 'out' | 'in',
      cls: ClassDef,
    ) => void;
    onPick: (
      relation: RelationDef,
      direction: 'out' | 'in',
      cls: ClassDef,
      existing: ElementId[],
    ) => void;
    onHighlight: (ids: ElementId[] | null) => void;
    onEnter: () => void;
    onLeave: () => void;
  } = $props();
</script>

<div
  class="card suggestions"
  style="left:{left}px;top:{top}px"
  role="dialog"
  aria-label="Connect {name}"
  tabindex="-1"
  onpointerenter={onEnter}
  onpointerleave={() => {
    onHighlight(null);
    onLeave();
  }}
  data-testid="suggestion-card"
>
  <header>
    <strong>Connect {name}</strong>
    <span class="muted">{className}</span>
  </header>
  {#if groups.length === 0}
    <p class="muted empty" data-testid="suggestion-empty">
      Nothing can be connected to a {className} in this model type.
    </p>
  {/if}
  {#each groups as group (group.relation.id)}
    <section data-testid="suggestion-group-{group.relation.key}">
      <h4>{group.relation.key}</h4>
      {#each [...group.out.map( (t) => ({ t, d: 'out' as const }) ), ...group.in.map( (t) => ({ t, d: 'in' as const }) )] as row (row.d + row.t.class.id)}
        <div
          class="row"
          role="group"
          aria-label="{group.relation.key} {row.d === 'out'
            ? 'to'
            : 'from'} {row.t.class.key}"
          onpointerenter={() => onHighlight(row.t.existing)}
          onpointerleave={() => onHighlight(null)}
        >
          <span class="dir" aria-hidden="true"
            >{row.d === 'out' ? '→' : '←'}</span
          >
          <span class="target">{row.t.class.key}</span>
          <button
            class="ghost"
            onclick={() => onAdd(group.relation, row.d, row.t.class)}
            data-testid="suggestion-new-{group.relation.key}-{row.d}-{row.t
              .class.key}"
            title="Add a new {row.t.class.key} and connect it">New</button
          >
          <button
            class="ghost"
            disabled={row.t.existing.length === 0}
            onclick={() =>
              onPick(group.relation, row.d, row.t.class, row.t.existing)}
            data-testid="suggestion-existing-{group.relation.key}-{row.d}-{row.t
              .class.key}"
            title="Connect to one that is already in the model"
            >Existing ({row.t.existing.length})</button
          >
        </div>
      {/each}
    </section>
  {/each}
</div>

<style>
  .suggestions {
    position: absolute;
    z-index: 30;
    width: 18rem;
    max-height: min(24rem, 70%);
    overflow: auto;
    padding: var(--gap-3);
    display: grid;
    gap: var(--gap-2);
    box-shadow: var(--shadow);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--gap-2);
  }
  h4 {
    margin: 0;
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  section {
    display: grid;
    gap: 2px;
    border-top: 1px solid var(--line);
    padding-top: var(--gap-2);
  }
  .row {
    display: grid;
    grid-template-columns: 1.2rem 1fr auto auto;
    align-items: center;
    gap: var(--gap-1);
    padding: 1px 2px;
    border-radius: var(--radius-s);
  }
  .row:hover {
    background: var(--hover-bg);
  }
  .dir {
    color: var(--accent);
    text-align: center;
  }
  .target {
    font-size: var(--text-s);
    font-weight: 500;
  }
  .row button {
    min-height: 1.6rem;
    padding: 0 0.5rem;
  }
  .empty {
    font-size: var(--text-s);
  }
</style>
