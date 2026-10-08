<script lang="ts">
  import type {
    Block,
    DocsIndex,
    Inline,
    ListBlock,
    Topic,
  } from '@metakit-app/docs';

  let {
    index,
    topic,
    anchor = null,
    idPrefix,
    onNavigate,
    onCategory,
  }: {
    index: DocsIndex;
    topic: Topic;
    /** A heading id inside the topic to scroll to. */
    anchor?: string | null;
    /** Keeps heading ids unique when the side bar and the Documentation area both exist. */
    idPrefix: string;
    onNavigate: (id: string, anchor: string | null) => void;
    /** Shows the topics of a category, when the host has a place for them. */
    onCategory?: (id: string) => void;
  } = $props();

  const blocks = $derived(index.document(topic.id));
  const related = $derived(index.related(topic.id));
  const category = $derived(
    index.categories().find((c) => c.id === topic.category),
  );

  let root: HTMLElement | undefined = $state();

  $effect(() => {
    // The reader is its own scroll box: a new topic starts at the top, a link with an anchor
    // lands on its heading.
    void topic.id;
    const target = anchor
      ? root?.querySelector<HTMLElement>(`[id="${idPrefix}-${anchor}"]`)
      : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    } else if (root) root.scrollTop = 0;
  });

  const titleOf = (id: string) => index.get(id)?.title ?? id;
</script>

{#snippet inlines(nodes: Inline[])}
  {#each nodes as node, i (i)}
    {#if node.type === 'text'}{node.text}
    {:else if node.type === 'strong'}<strong>{@render inlines(node.children)}</strong>
    {:else if node.type === 'em'}<em>{@render inlines(node.children)}</em>
    {:else if node.type === 'code'}<code>{node.text}</code>
    {:else if node.type === 'link'}<a
        href={node.href}
        target="_blank"
        rel="noopener noreferrer"
        class="external">{@render inlines(node.children)}</a
      >
    {:else if node.type === 'topic'}
      {#if index.has(node.id)}<a
          href="#help-{node.id}"
          class="topic-link"
          class:auto={node.auto}
          data-topic={node.id}
          onclick={(e) => {
            e.preventDefault();
            onNavigate(node.id, node.anchor);
          }}>{node.label ?? titleOf(node.id)}</a
        >{:else}<span class="broken">{node.label ?? node.id}</span>{/if}
    {/if}
  {/each}
{/snippet}

{#snippet list(l: ListBlock)}
  <svelte:element this={l.ordered ? 'ol' : 'ul'}>
    {#each l.items as item, i (i)}
      <li>
        {@render inlines(item.content)}
        {#if item.sub}{@render list(item.sub)}{/if}
      </li>
    {/each}
  </svelte:element>
{/snippet}

{#snippet blockList(items: Block[])}
  {#each items as block, i (i)}
    {#if block.type === 'heading'}
      <svelte:element
        this={`h${block.level}`}
        id="{idPrefix}-{block.id}"
        tabindex="-1"
        class="heading">{@render inlines(block.children)}</svelte:element
      >
    {:else if block.type === 'paragraph'}
      <p>{@render inlines(block.children)}</p>
    {:else if block.type === 'list'}
      {@render list(block)}
    {:else if block.type === 'table'}
      <div class="table-wrap">
        <table>
          <thead
            ><tr
              >{#each block.header as cell, c (c)}<th
                  >{@render inlines(cell)}</th
                >{/each}</tr
            ></thead
          >
          <tbody>
            {#each block.rows as row, r (r)}
              <tr
                >{#each row as cell, c (c)}<td>{@render inlines(cell)}</td
                  >{/each}</tr
              >
            {/each}
          </tbody>
        </table>
      </div>
    {:else if block.type === 'code'}
      <pre><code>{block.text}</code></pre>
    {:else if block.type === 'callout'}
      <aside class="callout {block.kind}" data-kind={block.kind}>
        <strong class="callout-label"
          >{block.kind === 'tip'
            ? 'Tip'
            : block.kind === 'note'
              ? 'Note'
              : 'Warning'}</strong
        >
        <div class="callout-body">{@render blockList(block.children)}</div>
      </aside>
    {:else if block.type === 'quote'}
      <blockquote>{@render blockList(block.children)}</blockquote>
    {:else if block.type === 'rule'}
      <hr />
    {/if}
  {/each}
{/snippet}

<article class="reader" bind:this={root} data-testid="docs-reader" data-topic={topic.id}>
  <nav class="crumbs" aria-label="Where you are">
    {#if onCategory}
      <button
        type="button"
        class="crumb"
        onclick={() => onCategory?.(topic.category)}
        >{category?.title ?? topic.category}</button
      >
    {:else}<span>{category?.title ?? topic.category}</span>{/if}
    <span aria-hidden="true">›</span>
    <span class="here">{topic.title}</span>
  </nav>
  <h1 class="title" data-testid="docs-title">{topic.title}</h1>
  {#if topic.summary}<p class="summary">{topic.summary}</p>{/if}

  {@render blockList(blocks)}

  {#if related.length > 0}
    <section class="related" aria-labelledby="{idPrefix}-related">
      <h2 id="{idPrefix}-related">Related topics</h2>
      <ul>
        {#each related as r (r.id)}
          <li>
            <a
              href="#help-{r.id}"
              onclick={(e) => {
                e.preventDefault();
                onNavigate(r.id, null);
              }}>{r.title}</a
            >
            <span class="muted">{r.summary}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</article>

<style>
  .reader {
    height: 100%;
    overflow: auto;
    padding: var(--gap-4) var(--gap-4) var(--gap-6);
    line-height: 1.55;
    font-size: var(--text-m);
    overflow-wrap: anywhere;
  }
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-2);
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .crumb {
    border: 0;
    background: none;
    padding: 0;
    min-height: 0;
    color: var(--text-muted);
    cursor: pointer;
  }
  .crumb:hover:not(:disabled) {
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }
  .here {
    color: var(--text);
  }
  .title {
    margin: var(--gap-2) 0 var(--gap-1);
  }
  .summary {
    color: var(--text-muted);
    margin: 0 0 var(--gap-4);
  }
  .heading {
    margin: var(--gap-5) 0 var(--gap-2);
    scroll-margin-top: var(--gap-3);
  }
  .heading:focus {
    outline: none;
  }
  h4.heading {
    font-size: var(--text-m);
  }
  p {
    margin: 0 0 var(--gap-3);
  }
  ul,
  ol {
    margin: 0 0 var(--gap-3);
    padding-left: 1.4rem;
  }
  li {
    margin: 0.15rem 0;
  }
  li > ul,
  li > ol {
    margin: 0.2rem 0 0.2rem;
  }
  a {
    color: var(--accent);
  }
  a.topic-link {
    text-decoration: underline;
    text-decoration-style: solid;
    text-underline-offset: 2px;
  }
  /* Links the reader adds by itself are quieter than the ones an author wrote. */
  a.topic-link.auto {
    text-decoration-style: dotted;
  }
  .broken {
    color: var(--danger);
  }
  .table-wrap {
    overflow-x: auto;
    margin: 0 0 var(--gap-3);
  }
  table {
    border-collapse: collapse;
    font-size: var(--text-s);
    min-width: 100%;
  }
  th,
  td {
    border: 1px solid var(--line);
    padding: var(--gap-1) var(--gap-2);
    text-align: left;
    vertical-align: top;
  }
  th {
    background: var(--surface-2);
    color: var(--text-strong);
  }
  pre {
    margin: 0 0 var(--gap-3);
    padding: var(--gap-3);
    overflow-x: auto;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-size: var(--text-s);
  }
  pre code {
    background: none;
    padding: 0;
  }
  blockquote {
    margin: 0 0 var(--gap-3);
    padding-left: var(--gap-3);
    border-left: 3px solid var(--line-strong);
    color: var(--text-muted);
  }
  .callout {
    display: grid;
    gap: var(--gap-1);
    margin: 0 0 var(--gap-3);
    padding: var(--gap-2) var(--gap-3);
    border-radius: var(--radius);
    border: 1px solid var(--line);
    border-left-width: 4px;
  }
  .callout :global(p:last-child) {
    margin-bottom: 0;
  }
  .callout :global(p) {
    margin-bottom: var(--gap-2);
  }
  .callout.tip {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .callout.note {
    background: var(--info-soft);
    border-color: var(--line-strong);
    border-left-color: var(--text-muted);
  }
  .callout.warning {
    background: var(--warning-soft);
    border-color: var(--warning);
  }
  .callout-label {
    font-size: var(--text-s);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-strong);
  }
  hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: var(--gap-4) 0;
  }
  .related {
    margin-top: var(--gap-6);
    padding-top: var(--gap-3);
    border-top: 1px solid var(--line);
  }
  .related h2 {
    font-size: var(--text-m);
    margin: 0 0 var(--gap-2);
  }
  .related ul {
    list-style: none;
    padding: 0;
    display: grid;
    gap: var(--gap-2);
  }
  .related .muted {
    display: block;
    font-size: var(--text-s);
  }
</style>
