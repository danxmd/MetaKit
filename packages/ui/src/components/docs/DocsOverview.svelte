<script lang="ts">
  import type { DocsIndex } from '@metakit-app/docs';

  let {
    index,
    onNavigate,
    note,
  }: {
    index: DocsIndex;
    onNavigate: (id: string) => void;
    /** Shown above the list, such as "This page has no topic yet". */
    note?: string;
  } = $props();

  const groups = $derived(index.categories().filter((g) => g.topics.length));
</script>

<div class="overview" data-testid="docs-overview">
  <h1>Documentation</h1>
  {#if note}<p class="muted">{note}</p>{/if}
  {#each groups as group (group.id)}
    <section>
      <h2>{group.title}</h2>
      <ul>
        {#each group.topics as t (t.id)}
          <li>
            <a
              href="#help-{t.id}"
              onclick={(e) => {
                e.preventDefault();
                onNavigate(t.id);
              }}>{t.title}</a
            >
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .overview {
    height: 100%;
    overflow: auto;
    padding: var(--gap-4) var(--gap-4) var(--gap-6);
  }
  h1 {
    margin: 0 0 var(--gap-2);
  }
  h2 {
    font-size: var(--text-m);
    margin: var(--gap-4) 0 var(--gap-1);
    color: var(--text-strong);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  a {
    color: var(--accent);
  }
</style>
