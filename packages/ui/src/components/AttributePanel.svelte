<script lang="ts">
  import type { Json } from '@metakit-app/core';
  import type {
    Field,
    LayoutNode,
    LayoutPanel,
    PanelSection,
    UnknownAttribute,
  } from '../panel';
  import type { ReferenceServices } from '../shell/references';
  import FieldControl from './FieldControl.svelte';

  let {
    sections,
    count,
    heading,
    references,
    onEdit,
    layoutPanel = null,
    unknown = [],
    onRemoveUnknown,
    messages = [],
  }: {
    sections: PanelSection[];
    /** How many objects are selected. */
    count: number;
    heading: string;
    references: ReferenceServices;
    onEdit: (field: Field, value: Json) => void;
    /** The Kit's panel layout for the selection, rebuilt whenever a value changes; null shows the generated panel. */
    layoutPanel?: LayoutPanel | null;
    /** Stored values the class no longer defines; shown for a single selected object. */
    unknown?: UnknownAttribute[];
    onRemoveUnknown?: (entry: UnknownAttribute) => void;
    /** Constraint and formula problems of the selection that belong to no single field (see `objectMessages`). */
    messages?: string[];
  } = $props();

  // The open tab is remembered by its label so that a rebuilt panel keeps it.
  let activeLabel = $state('');
  const shownTabs = $derived(
    (layoutPanel?.tabs ?? []).filter((tab) => tab.visible),
  );
  const activeTab = $derived(
    shownTabs.find((tab) => tab.label === activeLabel) ?? shownTabs[0],
  );
  const panelId = `panel-${Math.random().toString(36).slice(2, 8)}`;

  function tabKey(event: KeyboardEvent, index: number) {
    const last = shownTabs.length - 1;
    let next = -1;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next < 0) return;
    event.preventDefault();
    activeLabel = shownTabs[next]!.label;
    (event.currentTarget as HTMLElement | null)?.parentElement
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [next]?.focus();
  }

  const hasVisible = (items: LayoutNode[]): boolean =>
    items.some((n) =>
      n.kind === 'field' ? n.visible : n.visible && hasVisible(n.items),
    );

  function valueText(value: Json): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
</script>

{#snippet nodes(items: LayoutNode[])}
  {#each items as node, i (node.kind === 'field' ? node.field.attr.id : `g${i}`)}
    {#if node.kind === 'field'}
      {#if node.visible}
        <FieldControl
          field={node.field}
          {references}
          height={node.height}
          onCommit={(value) => onEdit(node.field, value)}
        />
      {/if}
    {:else if node.visible && hasVisible(node.items)}
      <fieldset class="group" data-testid="panel-group-{node.label}">
        <legend>{node.label}</legend>
        {@render nodes(node.items)}
      </fieldset>
    {/if}
  {/each}
{/snippet}

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
    {#if messages.length > 0}
      <ul class="messages" role="alert" data-testid="panel-messages">
        {#each messages as message (message)}<li>{message}</li>{/each}
      </ul>
    {/if}
    {#if layoutPanel}
      {#if shownTabs.length > 1}
        <div class="tabs" role="tablist" aria-label="Attribute tabs">
          {#each shownTabs as tab, i (tab.label)}
            <button
              type="button"
              role="tab"
              id="{panelId}-tab-{i}"
              aria-selected={tab === activeTab}
              aria-controls="{panelId}-tabpanel"
              tabindex={tab === activeTab ? 0 : -1}
              class:on={tab === activeTab}
              data-testid="panel-tab-{tab.label}"
              onclick={() => (activeLabel = tab.label)}
              onkeydown={(e) => tabKey(e, i)}
            >
              {tab.label}
            </button>
          {/each}
        </div>
      {/if}
      {#if activeTab}
        <div
          role={shownTabs.length > 1 ? 'tabpanel' : undefined}
          id="{panelId}-tabpanel"
          aria-labelledby={shownTabs.length > 1
            ? `${panelId}-tab-${shownTabs.indexOf(activeTab)}`
            : undefined}
          class="tabpanel"
        >
          {@render nodes(activeTab.items)}
        </div>
      {:else}
        <p class="empty">There is nothing to show for this object.</p>
      {/if}
    {:else}
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
    {#if count === 1 && unknown.length > 0}
      <details class="unknown" data-testid="unknown-attributes">
        <summary>Unknown attributes ({unknown.length})</summary>
        <p class="note">
          The Kit no longer has these attributes. The values are kept until you
          remove them.
        </p>
        {#each unknown as entry (entry.id)}
          <div class="entry" data-testid="unknown-{entry.id}">
            <code>{entry.id}</code>
            <output>{valueText(entry.value)}</output>
            <button
              type="button"
              onclick={() => onRemoveUnknown?.(entry)}
              disabled={!onRemoveUnknown}>Remove value</button
            >
          </div>
        {/each}
      </details>
    {/if}
  {/if}
</aside>

<style>
  .panel {
    padding: var(--gap-4);
    overflow-y: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--gap-3);
  }
  h2 {
    font-size: var(--text-m);
    padding-bottom: var(--gap-2);
    border-bottom: 1px solid var(--line);
  }
  h3 {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin: var(--gap-2) 0 var(--gap-2);
  }
  section {
    display: grid;
    gap: var(--gap-3);
  }
  .note,
  .empty {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .empty {
    padding: var(--gap-5) var(--gap-2);
    text-align: center;
  }
  .messages {
    list-style: none;
    margin: 0;
    padding: var(--gap-2) var(--gap-3);
    display: grid;
    gap: var(--gap-1);
    border-radius: var(--radius);
    background: var(--danger-soft);
    color: var(--danger);
    font-size: var(--text-s);
  }
  .tabs {
    display: flex;
    gap: var(--gap-1);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .tabs button {
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    border-radius: 0;
    color: var(--text-muted);
  }
  .tabs button.on {
    border-bottom-color: var(--accent);
    color: var(--text-strong);
    font-weight: 600;
  }
  .tabpanel {
    display: grid;
    gap: var(--gap-3);
  }
  .group {
    display: grid;
    gap: var(--gap-3);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    margin: 0;
    padding: var(--gap-3);
    min-width: 0;
  }
  .group legend {
    font-size: 0.72rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 0 var(--gap-1);
  }
  .unknown {
    border-top: 1px solid var(--line);
    padding-top: var(--gap-2);
  }
  .unknown summary {
    cursor: pointer;
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .entry {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--gap-2);
    align-items: center;
    margin-top: var(--gap-2);
    font-size: var(--text-s);
  }
  .entry output {
    overflow-wrap: anywhere;
    color: var(--text-muted);
  }
</style>
