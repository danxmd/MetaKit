<script lang="ts">
  import type {
    Model,
    Severity,
    ToolLibrary,
    ValidationIssue,
  } from '@metakit-app/core';
  import {
    SEVERITIES,
    countBySeverity,
    filterIssues,
    groupIssues,
    rowsOf,
    summarise,
  } from '../shell/validation-list';

  let {
    issues,
    model,
    tool,
    onSelect,
    filter = '',
    language = 'en',
  }: {
    issues: ValidationIssue[];
    model: Model;
    tool: ToolLibrary;
    /** The id of the element or connector to show, or `'model'` for a problem of the whole model. */
    onSelect: (target: string) => void;
    /** Text the filter box starts with. */
    filter?: string;
    language?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let query = $state(filter);
  let shown = $state<Record<Severity, boolean>>({
    error: true,
    warning: true,
    info: true,
  });
  let list: HTMLElement | undefined = $state();

  const counts = $derived(countBySeverity(issues));
  const rows = $derived(rowsOf(issues, model, tool, language));
  const visible = $derived(
    filterIssues(rows, query, new Set(SEVERITIES.filter((s) => shown[s]))),
  );
  const groups = $derived(groupIssues(visible));

  const LABELS: Record<Severity, string> = {
    error: 'Errors',
    warning: 'Warnings',
    info: 'Notes',
  };
  const MARKS: Record<Severity, string> = {
    error: '✖',
    warning: '▲',
    info: 'ℹ',
  };

  function move(event: KeyboardEvent) {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key) || !list) return;
    const buttons = [
      ...list.querySelectorAll<HTMLButtonElement>('button[data-issue]'),
    ];
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'ArrowDown'
        ? Math.min(buttons.length - 1, at + 1)
        : event.key === 'ArrowUp'
          ? Math.max(0, at - 1)
          : event.key === 'Home'
            ? 0
            : buttons.length - 1;
    event.preventDefault();
    buttons[next]?.focus();
  }

  function fromBox(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      list?.querySelector<HTMLButtonElement>('button[data-issue]')?.focus();
    }
  }
</script>

<section class="validation" data-testid="validation-list" aria-label="Problems">
  <header>
    <h3>Problems</h3>
    <span class="summary" data-testid="validation-summary"
      >{summarise(counts)}</span
    >
  </header>

  {#if issues.length === 0}
    <p class="empty" data-testid="validation-empty">No problems found.</p>
  {:else}
    <div class="controls">
      <input
        type="search"
        placeholder="Filter problems"
        aria-label="Filter problems"
        data-testid="validation-filter"
        bind:value={query}
        onkeydown={fromBox}
      />
      {#each SEVERITIES as severity (severity)}
        <label class="toggle {severity}">
          <input
            type="checkbox"
            bind:checked={shown[severity]}
            data-testid="validation-toggle-{severity}"
          />
          {LABELS[severity]} ({counts[severity]})
        </label>
      {/each}
    </div>

    {#if visible.length === 0}
      <p class="empty" data-testid="validation-none">
        No problems match the filter.
      </p>
    {/if}

    <div class="groups" bind:this={list} onkeydown={move} role="presentation">
      {#each groups as group (group.severity)}
        <h4
          class={group.severity}
          data-testid="validation-group-{group.severity}"
        >
          {group.title} ({group.rows.length})
        </h4>
        <ul>
          {#each group.rows as row (row.key)}
            <li>
              <button
                type="button"
                data-issue={row.issue.id}
                data-testid="validation-issue"
                class="issue {group.severity}"
                onclick={() => onSelect(row.issue.id)}
              >
                <span class="mark" aria-hidden="true"
                  >{MARKS[group.severity]}</span
                >
                <span class="text">
                  <span class="who">
                    <strong>{row.target.name}</strong>
                    {#if row.target.className && row.target.className !== row.target.name}
                      <span class="class">{row.target.className}</span>
                    {/if}
                  </span>
                  <span class="message">{row.issue.message}</span>
                </span>
                <span class="code">{row.issue.code}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  {/if}
</section>

<style>
  .validation {
    display: grid;
    gap: var(--gap-2);
    align-content: start;
    min-height: 0;
    padding: var(--gap-3) var(--gap-4);
    overflow: auto;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: var(--gap-3);
  }
  h3 {
    font-size: var(--text-m);
  }
  .summary,
  .empty {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .empty {
    margin: 0;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-2) var(--gap-3);
  }
  .controls input[type='search'] {
    flex: 1;
    min-width: 8rem;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--gap-1);
  }
  h4 {
    margin: var(--gap-2) 0 var(--gap-1);
    font-size: var(--text-s);
  }
  h4.error,
  .issue.error .mark {
    color: var(--danger);
  }
  h4.warning,
  .issue.warning .mark {
    color: var(--warning);
  }
  h4.info,
  .issue.info .mark {
    color: var(--accent);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .issue {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--gap-2);
    width: 100%;
    text-align: left;
    background: none;
    border-color: transparent;
    padding: var(--gap-1) var(--gap-2);
  }
  .issue:hover,
  .issue:focus-visible {
    background: var(--hover-bg);
  }
  .text {
    display: grid;
    min-width: 0;
  }
  .class {
    margin-left: var(--gap-2);
    color: var(--text-muted);
    font-size: 0.75rem;
  }
  .message {
    overflow-wrap: anywhere;
    font-size: var(--text-s);
    font-weight: 400;
  }
  .code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0 0.4rem;
    white-space: nowrap;
  }
</style>
