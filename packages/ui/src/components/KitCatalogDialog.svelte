<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Kit } from '@metakit-app/core';
  import { DocsLayer, pushDocsContext } from '../docs/context';
  import {
    BUILT_IN_DOMAINS,
    builtInSamples,
    searchBuiltIns,
    type BuiltInDomain,
    type BuiltInKit,
  } from '../build/built-in';
  import {
    cachedSamplePicture,
    type SamplePicture,
  } from '../build/kit-pictures';

  type Category = BuiltInDomain | 'all';

  let {
    builtIns,
    inWorkspace,
    initialDomain = 'all',
    mode = 'browse',
    onUse,
    onCopy,
    onChoose,
    onClose,
  }: {
    builtIns: readonly BuiltInKit[];
    /** True when the workspace already has the Kit. */
    inWorkspace: (kit: BuiltInKit) => boolean;
    initialDomain?: Category;
    /** `browse` offers Use and Copy and extend; `choose` picks a Kit for the dialog underneath. */
    mode?: 'browse' | 'choose';
    onUse?: (kit: BuiltInKit) => void;
    onCopy?: (kit: BuiltInKit) => void;
    onChoose?: (kit: BuiltInKit) => void;
    onClose: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();
  let opener: HTMLElement | null = null;
  onMount(() => {
    opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
  });
  $effect(() => pushDocsContext('dialog.kit-catalogue', DocsLayer.dialog));

  // svelte-ignore state_referenced_locally
  let category = $state<Category>(initialDomain);
  let query = $state('');
  let chosenId = $state<string | null>(null);
  let sampleIndex = $state(0);
  let full = $state(false);

  const searching = $derived(query.trim() !== '');
  const shown = $derived(
    searching
      ? searchBuiltIns(builtIns, query)
      : builtIns.filter((b) => category === 'all' || b.domain === category),
  );
  const chosen = $derived(
    shown.find((b) => b.id === chosenId) ?? shown[0] ?? null,
  );
  const domainLabel = (id: BuiltInDomain) =>
    BUILT_IN_DOMAINS.find((d) => d.id === id)?.label ?? id;
  const countIn = (c: Category) =>
    c === 'all'
      ? builtIns.length
      : builtIns.filter((b) => b.domain === c).length;
  const categories: { id: Category; label: string }[] = [
    { id: 'all', label: 'All Kits' },
    ...BUILT_IN_DOMAINS,
  ];

  /** What has been read for each Kit; read when its row comes into view or it is chosen. */
  interface Loaded {
    kit: Kit;
    pictures: (SamplePicture | null)[];
  }
  let loaded = $state<Record<string, Loaded | 'loading' | 'failed'>>({});

  async function ensure(b: BuiltInKit) {
    if (loaded[b.id]) return;
    loaded[b.id] = 'loading';
    try {
      const kit = JSON.parse(await b.load()) as Kit;
      const samples = await builtInSamples(b);
      const pictures = samples.map((s) => {
        try {
          return cachedSamplePicture(kit, s.name, s.text);
        } catch {
          // One sample that cannot be drawn must not hide the others.
          return null;
        }
      });
      loaded[b.id] = { kit, pictures };
    } catch {
      loaded[b.id] = 'failed';
    }
  }
  const dataOf = (b: BuiltInKit): Loaded | null => {
    const l = loaded[b.id];
    return l && typeof l === 'object' ? l : null;
  };

  $effect(() => {
    if (chosen) void ensure(chosen);
  });

  /** Loads a row's Kit once the row scrolls into view. */
  function whenVisible(node: HTMLElement, kit: BuiltInKit) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        void ensure(kit);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  function choose(b: BuiltInKit) {
    chosenId = b.id;
    sampleIndex = 0;
    full = false;
  }

  function chooseCategory(c: Category) {
    category = c;
    query = '';
    const first = builtIns.find((b) => c === 'all' || b.domain === c);
    if (first) choose(first);
  }

  function categoryKeys(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = categories.findIndex((c) => c.id === category);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    const next =
      categories[(i + step + categories.length) % categories.length]!;
    chooseCategory(next.id);
    dialog
      ?.querySelector<HTMLButtonElement>(`[data-category="${next.id}"]`)
      ?.focus();
  }

  async function listKeys(e: KeyboardEvent) {
    if (!chosen) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      dialog?.querySelector<HTMLButtonElement>('.actions button')?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = shown.findIndex((b) => b.id === chosen.id);
    const next = shown[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    choose(next);
    await tick();
    list?.querySelector<HTMLButtonElement>(`[data-kit="${next.id}"]`)?.focus();
  }

  function close() {
    dialog?.close();
  }

  const label = (x: { key: string; labels?: Record<string, string> }) =>
    x.labels?.['en'] ?? x.key;
  const sorted = (xs: string[]) => [...xs].sort((a, b) => a.localeCompare(b));

  const detail = $derived.by(() => {
    const data = chosen ? dataOf(chosen) : null;
    if (!data) return null;
    const { kit } = data;
    return {
      modelTypes: sorted(Object.values(kit.modelTypes).map(label)),
      classes: sorted(
        Object.values(kit.classes)
          .filter((c) => !c.abstract)
          .map(label),
      ),
      relations: sorted(Object.values(kit.relations).map(label)),
    };
  });
  const pictures = $derived(chosen ? (dataOf(chosen)?.pictures ?? []) : []);
  const picture = $derived(pictures[sampleIndex] ?? pictures[0] ?? null);
</script>

<!-- A click on the backdrop lands on the dialog element itself. -->
<dialog
  bind:this={dialog}
  class="kit-catalog"
  aria-labelledby="kit-catalog-title"
  onclose={() => {
    onClose();
    opener?.focus();
  }}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
  data-testid="kit-catalog"
>
  <header class="top">
    <h2 id="kit-catalog-title">
      {mode === 'choose' ? 'Choose a built-in Kit' : 'Built-in Kits'}
    </h2>
    <input
      type="search"
      bind:value={query}
      placeholder="Search all Kits"
      aria-label="Search the built-in Kits"
      onkeydown={(e) => {
        // A search box would only clear itself; Escape closes the dialog as everywhere else.
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
      data-testid="built-in-search"
    />
    <button
      type="button"
      class="ghost close"
      aria-label="Close"
      onclick={close}
      data-testid="kit-catalog-close">✕</button
    >
  </header>

  <div class="body">
    <div
      class="categories"
      role="tablist"
      aria-label="Categories"
      aria-orientation="vertical"
      tabindex="-1"
      onkeydown={categoryKeys}
    >
      {#each categories as c (c.id)}
        <button
          type="button"
          role="tab"
          class:on={!searching && category === c.id}
          aria-selected={!searching && category === c.id}
          aria-controls="kit-catalog-list"
          tabindex={category === c.id ? 0 : -1}
          data-category={c.id}
          onclick={() => chooseCategory(c.id)}
          data-testid="catalog-domain-{c.id}"
          ><span>{c.label}</span><span class="count">{countIn(c.id)}</span
          ></button
        >
      {/each}
    </div>

    <div
      class="list"
      id="kit-catalog-list"
      bind:this={list}
      role="listbox"
      aria-label={searching
        ? 'Search results'
        : (categories.find((c) => c.id === category)?.label ?? '')}
      tabindex="-1"
      onkeydown={listKeys}
    >
      {#if searching}
        <p class="muted hint" data-testid="catalog-results">
          {shown.length === 0
            ? ''
            : `${shown.length} ${shown.length === 1 ? 'Kit matches' : 'Kits match'} across all categories.`}
        </p>
      {/if}
      {#each shown as b (b.id)}
        {@const data = dataOf(b)}
        {@const thumb = data?.pictures[0]}
        <button
          type="button"
          role="option"
          class="row"
          aria-selected={chosen?.id === b.id}
          tabindex={chosen?.id === b.id ? 0 : -1}
          data-kit={b.id}
          use:whenVisible={b}
          onclick={() => choose(b)}
          data-testid="built-in-{b.id}"
        >
          <span class="thumb">
            {#if thumb}
              <img src={thumb.url} alt="" loading="lazy" />
            {:else if loaded[b.id] === 'failed'}
              <span class="muted">–</span>
            {/if}
          </span>
          <span class="text">
            <strong>{b.name}</strong>
            <small class="muted"
              >{searching
                ? `${domainLabel(b.domain)} · `
                : ''}{b.description}</small
            >
            {#if inWorkspace(b)}
              <small class="in-use" data-testid="built-in-added-{b.id}"
                >✓ In this workspace</small
              >
            {/if}
          </span>
        </button>
      {:else}
        <p class="muted hint" data-testid="built-in-none">
          No built-in Kit matches.
        </p>
      {/each}
    </div>

    <section
      class="preview"
      aria-label="Preview"
      aria-live="polite"
      data-testid="catalog-preview"
    >
      {#if chosen}
        {#if pictures.length > 1}
          <div class="samples" role="tablist" aria-label="Sample models">
            {#each pictures as p, i (i)}
              <button
                type="button"
                role="tab"
                aria-selected={sampleIndex === i}
                class:on={sampleIndex === i}
                onclick={() => {
                  sampleIndex = i;
                  full = false;
                }}
                data-testid="catalog-sample-{i}"
                >{p?.modelType || `Sample ${i + 1}`}</button
              >
            {/each}
          </div>
        {/if}
        <div class="paper" class:full>
          {#if picture}
            <img
              src={picture.url}
              alt="Sample model “{picture.name}” made with {chosen.name}"
              style:width={full ? `${picture.width}px` : null}
              data-testid="catalog-picture"
            />
          {:else if loaded[chosen.id] === 'failed' || (dataOf(chosen) && !picture)}
            <p class="muted">No preview for this Kit.</p>
          {:else}
            <p class="muted">Drawing the sample model…</p>
          {/if}
        </div>
        {#if picture}
          <div class="picture-bar">
            <span class="muted">Sample: {picture.name}</span>
            <button
              type="button"
              class="ghost"
              onclick={() => (full = !full)}
              data-testid="catalog-full-size"
              >{full ? 'Fit to the box' : 'Open full size'}</button
            >
          </div>
        {/if}

        <div class="about">
          <h3>
            {chosen.name} <span class="muted version">{chosen.version}</span>
          </h3>
          <p>{chosen.description}</p>
          {#if detail}
            <dl>
              <dt>Model types</dt>
              <dd>{detail.modelTypes.join(', ')}</dd>
              <dt>Classes</dt>
              <dd>{detail.classes.join(', ')}</dd>
              {#if detail.relations.length > 0}
                <dt>Relation classes</dt>
                <dd>{detail.relations.join(', ')}</dd>
              {/if}
            </dl>
          {/if}
        </div>

        <div class="actions">
          {#if mode === 'choose'}
            <button
              type="button"
              class="primary"
              onclick={() => {
                onChoose?.(chosen);
                close();
              }}
              data-testid="catalog-choose">Choose</button
            >
          {:else}
            {#if inWorkspace(chosen)}
              <span class="in-use">✓ In this workspace</span>
            {:else}
              <button
                type="button"
                class="primary"
                onclick={() => onUse?.(chosen)}
                data-testid="use-built-in-{chosen.id}"
                >Use in this workspace</button
              >
            {/if}
            <button
              type="button"
              onclick={() => {
                onCopy?.(chosen);
                close();
              }}
              data-testid="copy-built-in-{chosen.id}">Copy and extend…</button
            >
          {/if}
        </div>
      {/if}
    </section>
  </div>
</dialog>

<style>
  dialog.kit-catalog {
    width: min(75rem, calc(100vw - 2rem));
    max-width: min(75rem, calc(100vw - 2rem));
    height: min(47.5rem, calc(100dvh - 3rem));
    padding: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }
  dialog.kit-catalog:not([open]) {
    display: none;
  }
  .top {
    display: flex;
    align-items: center;
    gap: var(--gap-3);
    padding: var(--gap-3) var(--gap-4);
    border-bottom: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    font-size: var(--text-l);
    flex: 1;
  }
  .top input {
    width: 18rem;
    max-width: 50%;
  }
  .close {
    padding: 2px 8px;
  }
  .body {
    display: grid;
    grid-template-columns: 12.5rem 20rem minmax(0, 1fr);
    min-height: 0;
  }
  .categories {
    display: grid;
    align-content: start;
    gap: 2px;
    padding: var(--gap-3) var(--gap-2);
    border-right: 1px solid var(--line);
    background: var(--surface-2);
  }
  .categories button {
    display: flex;
    justify-content: space-between;
    gap: var(--gap-2);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text);
    border-radius: var(--radius);
    padding: var(--gap-1) var(--gap-2);
    text-align: left;
  }
  .categories button:hover {
    background: var(--hover-bg);
  }
  .categories button.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text-strong);
  }
  .count {
    color: var(--text-muted);
    font-size: var(--text-s);
    font-variant-numeric: tabular-nums;
  }
  /* A column of rows that keep their height and scroll, rather than grid rows squeezed to fit. */
  .list {
    overflow: auto;
    padding: var(--gap-2);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hint {
    margin: var(--gap-1) var(--gap-2);
    font-size: var(--text-s);
  }
  .row {
    flex: none;
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: var(--gap-2);
    align-items: start;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text);
    border-radius: var(--radius);
    padding: var(--gap-2);
  }
  .row:hover {
    background: var(--hover-bg);
  }
  .row[aria-selected='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 6rem;
    height: 4rem;
    border-radius: var(--radius-s);
    border: 1px solid var(--line);
    /* Pictures keep the white of an export, so Kit colours stay true in every look. */
    background: #ffffff;
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .text small {
    font-size: var(--text-s);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .in-use {
    color: var(--success);
    font-size: var(--text-s);
  }
  .preview {
    overflow: auto;
    padding: var(--gap-3) var(--gap-4);
    display: grid;
    align-content: start;
    gap: var(--gap-2);
  }
  .samples {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .samples button {
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius);
    padding: 3px 8px;
    font-size: var(--text-s);
  }
  .samples button.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text-strong);
  }
  .paper {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20rem;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: #ffffff;
    overflow: hidden;
  }
  .paper img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .paper.full {
    display: block;
    overflow: auto;
  }
  .paper.full img {
    max-width: none;
    max-height: none;
  }
  .paper p {
    color: #555;
  }
  .picture-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-s);
  }
  .about h3 {
    margin: var(--gap-2) 0 var(--gap-1);
    font-size: var(--text-m);
  }
  .version {
    font-weight: normal;
    font-size: var(--text-s);
  }
  .about p {
    margin: 0 0 var(--gap-2);
  }
  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--gap-1) var(--gap-3);
    margin: 0;
    font-size: var(--text-s);
  }
  dt {
    color: var(--text-muted);
  }
  dd {
    margin: 0;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    padding-top: var(--gap-2);
    border-top: 1px solid var(--line);
  }
  @media (max-width: 56rem) {
    .body {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      grid-template-rows: auto minmax(0, 1fr);
    }
    .categories {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
  }
</style>
