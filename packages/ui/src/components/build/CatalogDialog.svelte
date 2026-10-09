<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createEmptyTool,
    createToolStore,
    type ClassId,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { DocsLayer, pushDocsContext } from '../../docs/context';
  import { ATTRIBUTE_TYPE_LABELS } from '../../build/attributes';
  import {
    CATALOG_CLASSES,
    CATALOG_TOPICS,
    catalogClass,
    catalogCommands,
    catalogRelationsFor,
    catalogResultText,
    relationsOfClass,
    type CatalogAddResult,
    type CatalogClass,
    type CatalogTopicId,
  } from '../../build/catalog/catalog';
  import ShapePreview from '../ShapePreview.svelte';

  let {
    tool,
    onAdd,
    onClose,
  }: {
    tool: ToolLibrary;
    /** Runs the batch; true when it was applied. */
    onAdd: (result: CatalogAddResult, message: string) => boolean;
    onClose: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  onMount(() => dialog?.showModal());
  $effect(() => pushDocsContext('build.catalog', DocsLayer.dialog));

  // Thumbnails draw the catalog classes from a throwaway tool library that holds all of them.
  const preview = (() => {
    const store = createToolStore(createEmptyTool({ name: 'Catalog' }));
    const result = catalogCommands(
      store.state,
      CATALOG_CLASSES.map((c) => c.key),
      { withRelations: false },
    );
    store.execute(result.batch);
    return {
      tool: store.state,
      ids: new Map(result.added.classes.map((c) => [c.key, c.id])),
    };
  })();
  const previewId = (key: string) => preview.ids.get(key) as ClassId;

  let topic = $state<CatalogTopicId>('general');
  let query = $state('');
  let picks = $state<string[]>([]);
  let focused = $state<string>(CATALOG_CLASSES[0]!.key);
  let withRelations = $state(true);
  let error = $state<string | null>(null);

  const present = $derived(
    new Set(Object.values(tool.classes).map((c) => c.key)),
  );
  const topicLabel = (id: CatalogTopicId) =>
    CATALOG_TOPICS.find((t) => t.id === id)?.label ?? id;
  const labelOf = (key: string) => catalogClass(key)?.labels.en ?? key;

  const searching = $derived(query.trim() !== '');
  const shown = $derived.by((): CatalogClass[] => {
    const q = query.trim().toLowerCase();
    if (q === '') return CATALOG_CLASSES.filter((c) => c.topic === topic);
    return CATALOG_CLASSES.filter(
      (c) =>
        c.labels.en.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q) ||
        c.help.toLowerCase().includes(q),
    );
  });
  const relations = $derived(
    withRelations ? catalogRelationsFor(picks, tool) : [],
  );
  const detail = $derived(catalogClass(focused));

  function toggle(key: string, on: boolean) {
    picks = on ? [...picks, key] : picks.filter((k) => k !== key);
    focused = key;
  }

  function chooseTopic(id: CatalogTopicId) {
    topic = id;
    query = '';
    const first = CATALOG_CLASSES.find((c) => c.topic === id);
    if (first) focused = first.key;
  }

  function tabKeys(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = CATALOG_TOPICS.findIndex((t) => t.id === topic);
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next =
      CATALOG_TOPICS[
        (i + step + CATALOG_TOPICS.length) % CATALOG_TOPICS.length
      ]!;
    chooseTopic(next.id);
    dialog
      ?.querySelector<HTMLButtonElement>(`[data-topic="${next.id}"]`)
      ?.focus();
  }

  function add() {
    const result = catalogCommands(tool, picks, { withRelations });
    if (result.batch.commands.length === 0) {
      error = `Nothing to add. ${catalogResultText(result)}`;
      return;
    }
    if (onAdd(result, catalogResultText(result))) dialog?.close();
    else error = 'The classes could not be added.';
  }

  const endText = (end: string[]) =>
    end.length === 0 ? 'any class' : end.map(labelOf).join(', ');
</script>

<!-- A click on the backdrop lands on the dialog element itself. -->
<dialog
  bind:this={dialog}
  class="catalog"
  aria-labelledby="catalog-title"
  onclose={onClose}
  onclick={(e) => {
    if (e.target === dialog) dialog?.close();
  }}
  data-testid="catalog-dialog"
>
  <header class="top">
    <h2 id="catalog-title">Add from catalog</h2>
    <input
      type="search"
      bind:value={query}
      placeholder="Search all topics"
      aria-label="Search the catalog"
      onkeydown={(e) => {
        // A search box would only clear itself; Escape cancels the dialog as everywhere else.
        if (e.key === 'Escape') {
          e.preventDefault();
          dialog?.close();
        }
      }}
      data-testid="catalog-search"
    />
  </header>

  <div
    class="tabs"
    role="tablist"
    aria-label="Topics"
    tabindex="-1"
    onkeydown={tabKeys}
  >
    {#each CATALOG_TOPICS as t (t.id)}
      <button
        type="button"
        role="tab"
        id="catalog-tab-{t.id}"
        aria-selected={!searching && topic === t.id}
        aria-controls="catalog-list"
        tabindex={topic === t.id ? 0 : -1}
        class:on={!searching && topic === t.id}
        data-topic={t.id}
        onclick={() => chooseTopic(t.id)}
        data-testid="catalog-tab-{t.id}">{t.label}</button
      >
    {/each}
  </div>

  <div class="middle">
    <div
      class="list"
      id="catalog-list"
      role={searching ? 'region' : 'tabpanel'}
      aria-label={searching ? 'Search results' : topicLabel(topic)}
    >
      {#if searching}
        <p class="muted hint" data-testid="catalog-results">
          {shown.length === 0
            ? 'No class matches this search.'
            : `${shown.length} ${shown.length === 1 ? 'class matches' : 'classes match'} across all topics.`}
        </p>
      {/if}
      {#each shown as entry (entry.key)}
        {@const taken = present.has(entry.key)}
        <label
          class="row"
          class:focused={focused === entry.key}
          class:taken
          onpointerenter={() => (focused = entry.key)}
          onfocusin={() => (focused = entry.key)}
        >
          <input
            type="checkbox"
            checked={taken || picks.includes(entry.key)}
            disabled={taken}
            onchange={(e) => toggle(entry.key, e.currentTarget.checked)}
            data-testid="catalog-item-{entry.key}"
          />
          <span class="thumb">
            <ShapePreview
              tool={preview.tool}
              target={{ class: previewId(entry.key) }}
              width={40}
              height={28}
              text={false}
            />
          </span>
          <span class="name">
            <span>{entry.labels.en}</span>
            <small class="muted"
              >{taken
                ? 'Already in this tool library'
                : searching
                  ? topicLabel(entry.topic)
                  : entry.key !== entry.labels.en
                    ? entry.key
                    : ''}</small
            >
          </span>
        </label>
      {/each}
    </div>

    <aside
      class="detail"
      aria-label="About this class"
      data-testid="catalog-detail"
    >
      {#if detail}
        <div class="big">
          <ShapePreview
            tool={preview.tool}
            target={{ class: previewId(detail.key) }}
            width={180}
            height={100}
          />
        </div>
        <h3>{detail.labels.en} <code>{detail.key}</code></h3>
        <p>{detail.help}</p>
        <h4>Attributes</h4>
        <ul class="attrs">
          {#each detail.attributes as a (a.key)}
            <li>
              <code>{a.key}</code>
              <span class="muted">{ATTRIBUTE_TYPE_LABELS[a.type]}</span>
            </li>
          {/each}
        </ul>
        <h4>Relation classes</h4>
        <ul class="rels">
          {#each relationsOfClass(detail.key) as r (r.key)}
            <li>
              <strong>{r.labels.en}</strong>
              <span class="muted"
                >from {endText(r.from)} to {endText(r.to)}</span
              >
            </li>
          {/each}
        </ul>
      {/if}
    </aside>
  </div>

  {#if error}<p class="notice error" role="alert">{error}</p>{/if}

  <footer class="bottom">
    <label class="with">
      <input
        type="checkbox"
        bind:checked={withRelations}
        data-testid="catalog-relations"
      />
      Add the relation classes between them
    </label>
    <span class="count muted" data-testid="catalog-count"
      >{picks.length}
      {picks.length === 1 ? 'class' : 'classes'}{withRelations &&
      relations.length > 0
        ? ` and ${relations.length} relation ${relations.length === 1 ? 'class' : 'classes'}`
        : ''} picked</span
    >
    <span class="spacer"></span>
    <button
      type="button"
      onclick={() => dialog?.close()}
      data-testid="catalog-cancel">Cancel</button
    >
    <button
      type="button"
      class="primary"
      disabled={picks.length === 0}
      onclick={add}
      data-testid="catalog-add">Add</button
    >
  </footer>
</dialog>

<style>
  dialog.catalog {
    width: min(60rem, calc(100vw - 2rem));
    max-width: min(60rem, calc(100vw - 2rem));
    height: min(40rem, calc(100dvh - 3rem));
    padding: 0;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto auto;
    overflow: hidden;
  }
  dialog.catalog:not([open]) {
    display: none;
  }
  .top {
    display: flex;
    align-items: center;
    gap: var(--gap-3);
    padding: var(--gap-4) var(--gap-4) var(--gap-2);
  }
  h2 {
    margin: 0;
    font-size: var(--text-l);
    flex: 1;
  }
  .top input {
    width: 16rem;
    max-width: 50%;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-1);
    padding: 0 var(--gap-4) var(--gap-2);
    border-bottom: 1px solid var(--line);
  }
  .tabs button {
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius);
    padding: var(--gap-1) var(--gap-2);
    font-size: var(--text-s);
  }
  .tabs button:hover {
    background: var(--hover-bg);
    color: var(--text);
  }
  .tabs button.on {
    background: var(--accent-soft);
    color: var(--text-strong);
    border-color: var(--accent);
  }
  .middle {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    min-height: 0;
  }
  .list {
    overflow: auto;
    padding: var(--gap-2);
    border-right: 1px solid var(--line);
    display: grid;
    align-content: start;
    gap: 2px;
  }
  .hint {
    margin: var(--gap-1) var(--gap-2);
    font-size: var(--text-s);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    padding: var(--gap-1) var(--gap-2);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .row:hover,
  .row.focused {
    background: var(--hover-bg);
  }
  .row.taken {
    cursor: default;
    opacity: 0.7;
  }
  .thumb {
    display: inline-flex;
    padding: 2px;
    border-radius: var(--radius-s);
    background: var(--canvas-bg);
    border: 1px solid var(--line);
  }
  .name {
    display: grid;
    min-width: 0;
  }
  .name small {
    font-size: var(--text-s);
  }
  .detail {
    overflow: auto;
    padding: var(--gap-3) var(--gap-4);
    background: var(--surface-2);
  }
  .big {
    display: flex;
    justify-content: center;
    padding: var(--gap-2);
    border-radius: var(--radius);
    background: var(--canvas-bg);
    border: 1px solid var(--line);
  }
  h3 {
    margin: var(--gap-3) 0 var(--gap-1);
    font-size: var(--text-m);
  }
  h3 code {
    font-weight: normal;
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  h4 {
    margin: var(--gap-3) 0 var(--gap-1);
    font-size: var(--text-s);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .detail p {
    margin: 0;
  }
  .attrs,
  .rels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: var(--text-s);
  }
  .attrs li {
    display: flex;
    justify-content: space-between;
    gap: var(--gap-2);
  }
  .rels li {
    display: grid;
  }
  .notice {
    margin: var(--gap-2) var(--gap-4) 0;
  }
  .bottom {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--gap-3);
    padding: var(--gap-3) var(--gap-4);
    border-top: 1px solid var(--line);
  }
  .with {
    display: flex;
    align-items: center;
    gap: var(--gap-1);
  }
  .count {
    font-size: var(--text-s);
  }
  .spacer {
    flex: 1;
  }
</style>
