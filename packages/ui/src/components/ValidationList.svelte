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
    gap: 0.4rem;
    align-content: start;
    min-height: 0;
    padding: 0.5rem 0.75rem;
    overflow: auto;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .summary,
  .empty {
    color: var(--muted, #6b7280);
    font-size: 0.85rem;
  }
  .empty {
    margin: 0;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.8rem;
  }
  .controls input[type='search'] {
    flex: 1;
    min-width: 8rem;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  h4 {
    margin: 0.5rem 0 0.2rem;
    font-size: 0.85rem;
  }
  h4.error,
  .issue.error .mark {
    color: var(--danger, #c92a2a);
  }
  h4.warning,
  .issue.warning .mark {
    color: #e8590c;
  }
  h4.info,
  .issue.info .mark {
    color: var(--accent, #364fc7);
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
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    background: none;
    border-color: transparent;
    padding: 0.25rem 0.4rem;
  }
  .issue:hover,
  .issue:focus-visible {
    background: var(--hover, #e9ecef);
  }
  .text {
    display: grid;
    min-width: 0;
  }
  .class {
    margin-left: 0.4rem;
    color: var(--muted, #6b7280);
    font-size: 0.8rem;
  }
  .message {
    overflow-wrap: anywhere;
    font-size: 0.9rem;
  }
  .code {
    font-family: ui-monospace, monospace;
    font-size: 0.7rem;
    color: var(--muted, #6b7280);
    border: 1px solid var(--line, #dee2e6);
    border-radius: 999px;
    padding: 0 0.4rem;
    white-space: nowrap;
  }
</style>
