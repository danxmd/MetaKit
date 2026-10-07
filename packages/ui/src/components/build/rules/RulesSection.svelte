<script lang="ts">
  import type { Rule, ToolLibrary } from '@metakit-app/core';
  import {
    eventLabel,
    RuleEditorModel,
    type RuleTryResult,
  } from '../../../build/rule-editor-model';
  import type { CommandResult } from '../../../shell/controller';
  import RuleForm from './RuleForm.svelte';

  let {
    tool,
    run,
    behaviourTest,
  }: {
    tool: ToolLibrary;
    run: (command: never) => CommandResult;
    /** A dry run of a rule on the selected object, or null when nothing is selected. */
    behaviourTest?: (rule: Rule) => RuleTryResult | null;
  } = $props();

  const rules = $derived(
    Object.values(tool.rules ?? {}).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  );
  let selected = $state<string | null>(null);
  let confirming = $state<string | null>(null);
  let error = $state<string | null>(null);
  const current = $derived(
    selected ? tool.rules?.[selected as Rule['id']] : undefined,
  );

  const exec = (command: Record<string, unknown>): boolean => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok;
  };

  function add() {
    const rule = new RuleEditorModel(tool).toRule();
    if (exec({ type: 'putRule', rule })) selected = rule.id;
  }

  function remove(id: string) {
    confirming = null;
    if (exec({ type: 'removeRule', id }) && selected === id) selected = null;
  }
</script>

<section class="rules" data-testid="rules-section">
  <h2>Rules</h2>
  <p class="muted">
    A rule reacts when something happens in a model: when it, if the condition
    is true, then its actions.
  </p>
  {#if rules.length === 0}<p class="muted" data-testid="rules-empty">
      No rules yet.
    </p>{/if}
  <ul>
    {#each rules as r (r.id)}
      <li class:selected={selected === r.id}>
        <div class="line">
          <label class="switch">
            <input
              type="checkbox"
              checked={r.enabled !== false}
              onchange={(e) =>
                exec({
                  type: 'putRule',
                  rule: { ...r, enabled: e.currentTarget.checked },
                })}
              aria-label="{r.label} is on"
              data-testid="rule-enabled-{r.id}"
            />
          </label>
          <button
            type="button"
            class="name"
            onclick={() => (selected = selected === r.id ? null : r.id)}
            aria-expanded={selected === r.id}
            data-testid="rule-row-{r.id}"
          >
            <strong>{r.label}</strong>
            <span class="muted">{eventLabel(r.when.event)}</span>
          </button>
          <button
            type="button"
            onclick={() => (confirming = r.id)}
            aria-label="Delete {r.label}"
            data-testid="rule-delete-{r.id}">Delete</button
          >
        </div>
        {#if confirming === r.id}
          <div class="confirm" role="alert">
            Delete the rule "{r.label}"?
            <button
              type="button"
              class="danger"
              onclick={() => remove(r.id)}
              data-testid="rule-delete-confirm">Delete</button
            >
            <button type="button" onclick={() => (confirming = null)}
              >Keep</button
            >
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  <button type="button" onclick={add} data-testid="rule-add">Add rule</button>
  {#if error}<p class="problem" role="alert" data-testid="rules-error">
      {error}
    </p>{/if}

  {#if current}
    {#key `${current.id}:${current.enabled}`}
      <div class="editor">
        <RuleForm {tool} rule={current} {run} {behaviourTest} />
      </div>
    {/key}
  {/if}
</section>

<style>
  .rules {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }
  h2 {
    margin: 0;
  }
  p {
    margin: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.3rem;
    width: 100%;
  }
  li.selected .line {
    border-color: var(--accent, currentColor);
  }
  .line {
    display: flex;
    gap: 0.4rem;
    align-items: stretch;
    border: 1px solid transparent;
    border-radius: 6px;
  }
  .name {
    flex: 1;
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    text-align: left;
  }
  .switch {
    display: flex;
    align-items: center;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .confirm {
    padding: 0.4rem 0.6rem;
    background: #fff4e6;
    border-radius: 6px;
    margin: 0.2rem 0;
  }
  .danger,
  .problem {
    color: #c92a2a;
  }
  .editor {
    width: 100%;
    border-top: 1px solid var(--line);
    padding-top: 0.8rem;
  }
</style>
