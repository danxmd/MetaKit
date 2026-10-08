<script lang="ts">
  import type { DocsIndex, SearchHit } from '@metakit-app/docs';

  let {
    index,
    onOpen,
    onQuery,
    placeholder = 'Search the documentation',
    testid = 'docs-search',
  }: {
    index: DocsIndex | null;
    onOpen: (id: string) => void;
    /** Tells the host whether results are showing, so it can hide the reader behind them. */
    onQuery?: (query: string) => void;
    placeholder?: string;
    testid?: string;
  } = $props();

  const titles = $derived(
    new Map((index?.categories() ?? []).map((c) => [c.id, c.title])),
  );
  let query = $state('');
  let active = $state(0);

  const hits = $derived<SearchHit[]>(
    index && query.trim() ? index.search(query).slice(0, 30) : [],
  );

  $effect(() => {
    onQuery?.(query.trim());
  });
  $effect(() => {
    void hits;
    active = 0;
  });

  function open(id: string) {
    query = '';
    onOpen(id);
  }

  function key(event: KeyboardEvent) {
    if (event.key === 'Escape' && query) {
      query = '';
      event.stopPropagation();
    } else if (event.key === 'ArrowDown' && hits.length) {
      event.preventDefault();
      active = Math.min(hits.length - 1, active + 1);
    } else if (event.key === 'ArrowUp' && hits.length) {
      event.preventDefault();
      active = Math.max(0, active - 1);
    } else if (event.key === 'Enter' && hits[active]) {
      open(hits[active]!.topic.id);
    }
  }
</script>

<div class="docs-search" class:active={query.trim() !== ""}>
<div class="search">
  <input
    type="search"
    bind:value={query}
    {placeholder}
    aria-label="Search the documentation"
    onkeydown={key}
    data-testid="{testid}-input"
  />
</div>
{#if query.trim()}
  <div class="results" data-testid="{testid}-results">
    {#if !index}
      <p class="muted pad">Loading…</p>
    {:else if hits.length === 0}
      <p class="muted pad" data-testid="{testid}-empty">
        No topic matches “{query.trim()}”.
      </p>
    {:else}
      {#each hits as hit, i (hit.topic.id)}
        <button
          type="button"
          class="hit"
          class:on={i === active}
          onclick={() => open(hit.topic.id)}
          data-testid="{testid}-hit"
          data-topic={hit.topic.id}
        >
          <span class="hit-title">{hit.topic.title}</span>
          <span class="hit-cat muted">{titles.get(hit.topic.category) ?? hit.topic.category}</span>
          <span class="hit-snippet muted">{hit.snippet}</span>
        </button>
      {/each}
    {/if}
  </div>
{/if}
</div>

<style>
  .docs-search {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding-top: var(--gap-2);
  }
  .docs-search.active {
    flex: 1;
  }
  .search {
    padding: 0 var(--gap-3) var(--gap-2);
  }
  .search input {
    width: 100%;
  }
  .results {
    overflow: auto;
    display: grid;
    align-content: start;
    /* Rows size to their text; without this a two-line title is squeezed onto the next row. */
    grid-auto-rows: max-content;
    gap: 2px;
    padding: 0 var(--gap-2) var(--gap-3);
    min-height: 0;
  }
  .pad {
    padding: var(--gap-2) var(--gap-3);
  }
  .hit {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 var(--gap-2);
    text-align: left;
    height: auto;
    min-height: max-content;
    padding: var(--gap-2) var(--gap-3);
    border-color: transparent;
    background: none;
  }
  .hit.on,
  .hit:hover {
    background: var(--hover-bg);
  }
  .hit-title {
    font-weight: 600;
    color: var(--text-strong);
  }
  .hit-cat {
    font-size: var(--text-s);
    align-self: center;
  }
  .hit-snippet {
    grid-column: 1 / -1;
    font-size: var(--text-s);
    font-weight: 400;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
  }
</style>
