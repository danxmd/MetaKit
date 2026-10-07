<script lang="ts">
  import type { Json } from '@metakit-app/core';
  import type { PanelSection, Field } from '../panel';
  import type { ReferenceServices } from '../shell/references';
  import FieldControl from './FieldControl.svelte';

  let {
    sections,
    count,
    heading,
    references,
    onEdit,
  }: {
    sections: PanelSection[];
    /** How many objects are selected. */
    count: number;
    heading: string;
    references: ReferenceServices;
    onEdit: (field: Field, value: Json) => void;
  } = $props();
</script>

<aside class="panel" aria-label="Attributes" data-testid="attribute-panel">
  {#if count === 0}
    <p class="empty">Select an object to see its attributes.</p>
  {:else}
    <h2>{heading}</h2>
    {#if count > 1}
      <p class="note">
        {count} objects selected. Only attributes they all have are shown; a dash
        means the values differ.
      </p>
    {/if}
    {#each sections as section, i (section.title ?? `_${i}`)}
      <section>
        {#if section.title}<h3>{section.title}</h3>{/if}
        {#each section.fields as field (field.attr.id)}
          <FieldControl
            {field}
            {references}
            onCommit={(value) => onEdit(field, value)}
          />
        {/each}
      </section>
    {/each}
    {#if sections.length === 0}
      <p class="empty">These objects have no attributes in common.</p>
    {/if}
  {/if}
</aside>

<style>
  .panel {
    padding: 0.75rem 0.9rem;
    overflow-y: auto;
    height: 100%;
    box-sizing: border-box;
  }
  h2 {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }
  h3 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin: 1rem 0 0.4rem;
  }
  .note,
  .empty {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
