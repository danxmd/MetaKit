<script lang="ts">
  import { onDestroy } from 'svelte';
  import { groupHits, type FindAllHit } from '../shell/find-all';

  let {
    search,
    onOpen,
    delay = 200,
  }: {
    search: (query: string) => Promise<FindAllHit[]>;
    onOpen: (hit: FindAllHit) => void;
    /** Milliseconds to wait after the last key before searching. */
    delay?: number;
  } = $props();

  let query = $state('');
  let hits = $state<FindAllHit[]>([]);
  let searching = $state(false);
  let failed = $state(false);
  /** The query the shown hits belong to; empty before the first search. */
  let searched = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticket = 0;
  let root: HTMLElement | undefined = $state();

  const groups = $derived(groupHits(hits));

  function typing() {
    clearTimeout(timer);
    const text = query.trim();
    if (text === '') {
      ticket++;
      hits = [];
      searched = '';
      searching = false;
      failed = false;
      return;
    }
    timer = setTimeout(() => run(text), delay);
  }

  async function run(text: string) {
    const mine = ++ticket;
    searching = true;
    failed = false;
    try {
      const found = await search(text);
      // A slower, older search must not overwrite a newer answer.
      if (mine !== ticket) return;
      hits = found;
      searched = text;
    } catch {
      if (mine !== ticket) return;
      hits = [];
      failed = true;
    } finally {
      if (mine === ticket) searching = false;
    }
  }

  function buttons(): HTMLButtonElement[] {
    return root
      ? [...root.querySelectorAll<HTMLButtonElement>('button[data-hit]')]
      : [];
  }

  function fromInput(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons()[0]?.focus();
    } else if (event.key === 'Enter') {
      // Search now instead of waiting out the delay.
      clearTimeout(timer);
      const text = query.trim();
      if (text !== '') run(text);
    }
  }

  function fromList(event: KeyboardEvent) {
    const all = buttons();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      all[Math.min(all.length - 1, at + 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (at === 0) root?.querySelector<HTMLInputElement>('input')?.focus();
      else all[at - 1]?.focus();
    }
  }

  function matchedIn(hit: FindAllHit): string {
    switch (hit.matched) {
      case 'label':
        return 'name';
      case 'class':
        return 'class';
      case 'attribute-key':
        return `attribute ${hit.field}`;
      default:
        return hit.field;
    }
  }

  onDestroy(() => {
    clearTimeout(timer);
    ticket++;
  });
</script>

<div
  class="find-all"
  bind:this={root}
  data-testid="find-all"
  data-tour="models-search"
>
  <input
    type="search"
    placeholder="Search all models"
    aria-label="Search all models"
    data-testid="find-all-input"
    bind:value={query}
    oninput={typing}
    onkeydown={fromInput}
  />
  {#if searching}
    <p class="hint" role="status">Searching…</p>
  {:else if failed}
    <p class="hint problem" role="alert">The search failed. Try again.</p>
  {:else if searched !== '' && hits.length === 0}
    <p class="hint" data-testid="find-all-none">
      Nothing found for “{searched}”.
    </p>
  {/if}
  {#if hits.length > 0}
    <div class="results" onkeydown={fromList} role="presentation">
      {#each groups as group (group.slug)}
        <h4 data-testid="find-all-model">
          {group.modelName} ({group.items.length})
        </h4>
        <ul>
          {#each group.items as { n, hit } (n)}
            <li>
              <button
                type="button"
                data-hit={n}
                data-testid="find-all-hit-{n}"
                onclick={() => onOpen(hit)}
              >
                <span class="title">{hit.title}</span>
                {#if hit.className && hit.className !== hit.title}
                  <span class="class">{hit.className}</span>
                {/if}
                {#if hit.matched !== 'label'}
                  <span class="snippet">{matchedIn(hit)}: {hit.snippet}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  {/if}
</div>

<style>
  .find-all {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }
  input[type='search'] {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.25rem;
  }
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .problem {
    color: var(--danger);
  }
  .results {
    max-height: 22rem;
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--gap-1) var(--gap-2);
  }
  h4 {
    margin: 0.5rem 0 0.15rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  button {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.1rem 0.5rem;
    width: 100%;
    text-align: left;
    background: none;
    border-color: transparent;
    padding: 0.25rem 0.4rem;
    border-radius: var(--radius-s);
  }
  button:hover,
  button:focus-visible {
    background: var(--hover-bg);
  }
  .class,
  .snippet {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  .snippet {
    flex-basis: 100%;
    overflow-wrap: anywhere;
  }
</style>
