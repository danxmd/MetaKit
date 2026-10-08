<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    help,
    children,
    actions,
  }: {
    title: string;
    help?: string;
    children: Snippet;
    /** Buttons shown on the right of the heading. */
    actions?: Snippet;
  } = $props();
</script>

<section class="card section">
  <header>
    <h3>{title}</h3>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </header>
  {#if help}<p class="help muted">{help}</p>{/if}
  <div class="body">{@render children()}</div>
</section>

<style>
  .section {
    padding: var(--gap-4);
    display: grid;
    gap: var(--gap-3);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-3);
  }
  .actions {
    display: flex;
    gap: var(--gap-2);
  }
  .help {
    margin: 0;
    font-size: var(--text-s);
  }
  .body {
    display: grid;
    gap: var(--gap-3);
  }
</style>
