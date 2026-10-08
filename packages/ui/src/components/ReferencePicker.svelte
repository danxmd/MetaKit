<script lang="ts">
  import type { Json, ReferenceAttribute } from '@metakit-app/core';
  import type {
    ReferenceHit,
    ReferenceServices,
    ReferenceValue,
  } from '../shell/references';

  let {
    attr,
    value,
    readOnly,
    services,
    onChange,
  }: {
    attr: ReferenceAttribute;
    value: Json | undefined;
    readOnly: boolean;
    services: ReferenceServices;
    onChange: (value: Json) => void;
  } = $props();

  let query = $state('');
  let hits = $state<ReferenceHit[]>([]);
  let searching = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const refs = $derived(
    Array.isArray(value) ? (value as unknown as ReferenceValue[]) : [],
  );
  const full = $derived(attr.max !== undefined && refs.length >= attr.max);

  function typing() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      searching = true;
      hits = await services.search(query, attr);
      searching = false;
    }, 120);
  }

  function choose(hit: ReferenceHit) {
    query = '';
    hits = [];
    if (refs.some((r) => r.element === hit.element)) return;
    onChange([
      ...refs,
      { element: hit.element, model: hit.model },
    ] as unknown as Json);
  }

  function remove(index: number) {
    onChange(refs.filter((_, i) => i !== index) as unknown as Json);
  }
</script>

<div class="refs" data-testid="reference-{attr.key}">
  <ul>
    {#each refs as ref, i (ref.element)}
      {@const found = services.resolve(ref)}
      <li>
        {#if found}
          <span class="title">{found.title}</span>
          <span class="where">{found.modelName}</span>
          <button type="button" onclick={() => services.open(ref)}>Open</button>
        {:else}
          <span class="gone">Not found (it may have been deleted)</span>
        {/if}
        {#if !readOnly}
          <button
            type="button"
            onclick={() => remove(i)}
            aria-label="Remove reference">×</button
          >
        {/if}
      </li>
    {/each}
  </ul>
  {#if !readOnly && !full}
    <input
      type="search"
      placeholder="Search elements in all models"
      bind:value={query}
      oninput={typing}
      onfocus={typing}
      aria-label="Search for an element to refer to"
    />
    {#if searching}<p class="hint">Searching…</p>{/if}
    {#if hits.length > 0}
      <ul class="hits" role="listbox">
        {#each hits as hit (hit.model + hit.element)}
          <li role="option" aria-selected="false">
            <button type="button" onclick={() => choose(hit)}>
              {hit.title}<span class="where"> · {hit.modelName}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .refs {
    display: grid;
    gap: var(--gap-1);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--gap-1);
  }
  li {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
    padding: 0.15rem var(--gap-2);
    background: var(--surface-3);
    border-radius: var(--radius-s);
    font-size: var(--text-s);
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .where {
    color: var(--text-muted);
    font-size: 0.75rem;
  }
  .gone {
    color: var(--danger);
    font-size: var(--text-s);
  }
  .hits {
    border: 1px solid var(--line);
    border-radius: var(--radius-s);
    background: var(--surface);
    max-height: 10rem;
    overflow: auto;
  }
  .hits li {
    padding: 0;
    background: none;
  }
  .hits button {
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
  }
  .hits button:hover {
    background: var(--hover-bg);
  }
  .hint {
    color: var(--text-muted);
    font-size: var(--text-s);
    margin: 0;
  }
  input[type='search'] {
    width: 100%;
  }
</style>
