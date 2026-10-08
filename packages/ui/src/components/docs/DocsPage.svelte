<script lang="ts">
  import { onMount } from 'svelte';
  import type { DocsIndex } from '@metakit-app/docs';
  import { DocsNav, OVERVIEW, type NavState } from '../../docs/context';
  import { loadDocsIndex } from '../../docs/load';
  import DocsOverview from './DocsOverview.svelte';
  import DocsReader from './DocsReader.svelte';
  import DocsSearch from './DocsSearch.svelte';

  let {
    request = null,
  }: {
    /**
     * Asks the page to show a topic (null: the overview). A new object asks again, even for the
     * same topic; without a request the page stays where the person left it.
     */
    request?: { topic: string | null } | null;
  } = $props();

  // The Documentation area keeps its own history, apart from the side bar's.
  const nav = new DocsNav();
  let navState = $state<NavState>({
    current: null,
    canBack: false,
    canForward: false,
    following: false,
  });
  let index = $state<DocsIndex | null>(null);
  let failed = $state(false);
  let searching = $state(false);
  let collapsed = $state<Record<string, boolean>>({});

  onMount(() => {
    const stop = nav.subscribe((s) => (navState = s));
    loadDocsIndex().then(
      (loaded) => (index = loaded),
      () => (failed = true),
    );
    return stop;
  });

  $effect(() => {
    // Runs again when "Open in Documentation" asks for a topic.
    if (request) nav.navigate(request.topic ?? OVERVIEW);
    else if (!nav.get().current) nav.navigate(OVERVIEW);
  });

  const topic = $derived(
    index && navState.current && navState.current.id !== OVERVIEW
      ? index.get(navState.current.id)
      : undefined,
  );
  const groups = $derived(index?.categories() ?? []);

  $effect(() => {
    // The group of the topic being read is always open in the tree.
    if (topic && collapsed[topic.category])
      collapsed = { ...collapsed, [topic.category]: false };
  });

  function go(id: string, anchor: string | null = null) {
    nav.navigate(id, anchor);
  }

  const toggle = (id: string) => (collapsed = { ...collapsed, [id]: !collapsed[id] });
</script>

<main class="docs" data-testid="docs-page">
  <aside class="tree" aria-label="Topics">
    <DocsSearch
      {index}
      testid="docs-page-search"
      onOpen={(id) => go(id)}
      onQuery={(q) => (searching = q !== '')}
    />
    {#if !searching}
      <nav class="groups" data-testid="docs-tree">
        {#if failed}
          <p class="notice error" role="alert">
            The documentation could not be loaded.
          </p>
        {:else if !index}
          <p class="muted pad">Loading…</p>
        {/if}
        {#each groups as group (group.id)}
          {@const placeholder = group.topics.length <= 1 && group.id === 'tutorials'}
          {#if group.topics.length > 0}
            <section class="group" data-category={group.id}>
              <button
                type="button"
                class="group-head"
                aria-expanded={!collapsed[group.id]}
                onclick={() => toggle(group.id)}
                data-testid="docs-group-{group.id}"
              >
                <span class="caret" aria-hidden="true"
                  >{collapsed[group.id] ? '▸' : '▾'}</span
                >
                <span class="group-title">{group.title}</span>
                <span class="count">{placeholder ? 0 : group.topics.length}</span>
              </button>
              {#if !collapsed[group.id]}
                {#if placeholder}
                  <div class="card empty" data-testid="docs-tutorials-empty">
                    <strong>Tutorials are coming here</strong>
                    <span class="muted"
                      >Step by step guides will be added to this list.</span
                    >
                    <button
                      type="button"
                      class="ghost"
                      onclick={() => go(group.topics[0]!.id)}>Read more</button
                    >
                  </div>
                {:else}
                  <ul>
                    {#each group.topics as t (t.id)}
                      <li>
                        <button
                          type="button"
                          class="topic"
                          class:on={topic?.id === t.id}
                          aria-current={topic?.id === t.id ? 'page' : undefined}
                          onclick={() => go(t.id)}
                          data-testid="docs-tree-topic"
                          data-topic={t.id}>{t.title}</button
                        >
                      </li>
                    {/each}
                  </ul>
                {/if}
              {/if}
            </section>
          {/if}
        {/each}
      </nav>
    {/if}
  </aside>

  <section class="reading">
    <div class="toolbar">
      <button
        type="button"
        class="icon"
        disabled={!navState.canBack}
        onclick={() => nav.back()}
        aria-label="Back"
        title="Back"
        data-testid="docs-page-back">←</button
      >
      <button
        type="button"
        class="icon"
        disabled={!navState.canForward}
        onclick={() => nav.forward()}
        aria-label="Forward"
        title="Forward"
        data-testid="docs-page-forward">→</button
      >
      <button
        type="button"
        class="ghost"
        disabled={navState.current?.id === OVERVIEW}
        onclick={() => go(OVERVIEW)}>All topics</button
      >
    </div>
    <div class="page-body">
      {#if failed}
        <p class="notice error pad" role="alert">
          The documentation could not be loaded. Check your connection and try
          again.
        </p>
      {:else if !index}
        <p class="muted pad" data-testid="docs-loading">Loading…</p>
      {:else if topic}
        <DocsReader
          {index}
          {topic}
          anchor={navState.current?.anchor ?? null}
          idPrefix="docs"
          onNavigate={go}
          onCategory={(id) => (collapsed = { ...collapsed, [id]: false })}
        />
      {:else}
        <DocsOverview
          {index}
          onNavigate={(id) => go(id)}
          note={navState.current && navState.current.id !== OVERVIEW
            ? 'That topic does not exist.'
            : undefined}
        />
      {/if}
    </div>
  </section>
</main>

<style>
  .docs {
    height: 100%;
    display: grid;
    grid-template-columns: minmax(14rem, 19rem) minmax(0, 1fr);
    background: var(--app-bg);
  }
  .tree {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--surface);
    border-right: 1px solid var(--line);
  }
  .groups {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 var(--gap-2) var(--gap-5);
  }
  .group-head {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    width: 100%;
    border: 0;
    background: none;
    text-align: left;
    padding: var(--gap-2) var(--gap-2);
    margin-top: var(--gap-1);
    color: var(--text-strong);
    font-weight: 600;
  }
  .group-head:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  .group-title {
    flex: 1;
  }
  .caret {
    width: 1em;
    color: var(--text-muted);
  }
  .count {
    font-size: var(--text-s);
    font-weight: 400;
    color: var(--text-muted);
    background: var(--surface-3);
    border-radius: 999px;
    padding: 0 0.5rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0 0 0 var(--gap-4);
    display: grid;
  }
  .topic {
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
    font-weight: 400;
    padding: 0.3rem var(--gap-2);
    color: var(--text);
  }
  .topic:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  .topic.on {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
  .empty {
    display: grid;
    gap: var(--gap-1);
    margin: var(--gap-1) var(--gap-2) var(--gap-2) var(--gap-4);
    padding: var(--gap-3);
    justify-items: start;
    background: var(--surface-2);
    border-style: dashed;
  }
  .pad {
    padding: var(--gap-3) var(--gap-4);
  }
  .reading {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .toolbar {
    flex: none;
    display: flex;
    gap: var(--gap-1);
    align-items: center;
    padding: var(--gap-2) var(--gap-4);
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }
  .page-body {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: 52rem;
    margin: 0 auto;
    background: var(--surface);
  }

  @media (max-width: 760px) {
    .docs {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 40%) minmax(0, 1fr);
    }
    .tree {
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
  }
</style>
