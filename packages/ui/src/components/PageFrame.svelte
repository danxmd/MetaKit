<script lang="ts">
  import SupportFooter from './SupportFooter.svelte';
  import type { Snippet } from 'svelte';

  let {
    title,
    help,
    testid,
    actions,
    children,
  }: {
    title: string;
    help: string;
    testid: string;
    /** The buttons and menus of the page, to the right of the title. */
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<main class="page" data-testid={testid}>
  <div class="column">
    <header>
      <div class="titles">
        <h1>{title}</h1>
        <p class="muted">{help}</p>
      </div>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </header>
    {@render children()}
  </div>
  <SupportFooter />
</main>

<style>
  .page {
    height: 100%;
    overflow: auto;
  }
  .column {
    max-width: 56rem;
    margin: 0 auto;
    padding: var(--gap-6) var(--gap-4) 4rem;
    display: grid;
    gap: var(--gap-5);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--gap-4);
    flex-wrap: wrap;
  }
  .titles {
    display: grid;
    gap: var(--gap-1);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    flex-wrap: wrap;
  }
</style>
