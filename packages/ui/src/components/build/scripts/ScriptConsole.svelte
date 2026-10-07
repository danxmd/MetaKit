<script lang="ts">
  import { tick } from 'svelte';
  import type { ConsoleLine } from '@metakit-app/behaviour';
  import { consoleRows } from '../../../build/scripts-model';

  let {
    lines,
    onClear,
  }: { lines: readonly ConsoleLine[]; onClear: () => void } = $props();

  let problemsOnly = $state(false);
  let list: HTMLElement | undefined = $state();
  const rows = $derived(consoleRows(lines, problemsOnly ? 'problems' : 'all'));

  // Stay at the newest line, unless the person scrolled up to read.
  $effect(() => {
    void rows.length;
    const el = list;
    if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atEnd) void tick().then(() => (el.scrollTop = el.scrollHeight));
  });
</script>

<section
  class="console"
  aria-label="Script console"
  data-testid="script-console"
>
  <header>
    <h3>Console</h3>
    <label class="check">
      <input
        type="checkbox"
        bind:checked={problemsOnly}
        data-testid="console-problems-only"
      />
      Problems only
    </label>
    <span class="spacer"></span>
    <button
      type="button"
      onclick={onClear}
      disabled={lines.length === 0}
      data-testid="console-clear">Clear</button
    >
  </header>
  <ol bind:this={list} aria-live="polite" data-testid="console-lines">
    {#each rows as row (row.id)}
      <li class={row.level} data-testid="console-line">
        <time>{row.time}</time>
        {#if row.origin}<span class="origin">{row.origin}</span>{/if}
        <span class="text">{row.text}</span>
      </li>
    {:else}
      <li class="empty">
        Nothing yet. What scripts print with <code>console.log</code> and the errors
        they cause show up here.
      </li>
    {/each}
  </ol>
</section>

<style>
  .console {
    border: 1px solid var(--line);
    border-radius: 6px;
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 8rem;
  }
  header {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.3rem 0.6rem;
    border-bottom: 1px solid var(--line);
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
  .check {
    font-size: 0.85rem;
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0.3rem 0;
    max-height: 12rem;
    overflow: auto;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.82rem;
  }
  li {
    display: flex;
    gap: 0.6rem;
    padding: 0.1rem 0.6rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  li.error {
    color: #c92a2a;
    background: #fff5f5;
  }
  li.warn {
    color: #8a5a00;
    background: #fff9db;
  }
  li.empty {
    color: var(--muted);
    font-family: inherit;
  }
  time {
    color: var(--muted);
    flex: none;
  }
  .origin {
    flex: none;
    font-weight: 600;
  }
</style>
