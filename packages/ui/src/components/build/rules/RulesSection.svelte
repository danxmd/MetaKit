<script lang="ts">
  import type { Rule, Kit } from '@metakit-app/core';
  import {
    eventLabel,
    RuleEditorModel,
    type RuleTryResult,
  } from '../../../build/rule-editor-model';
  import type { CommandResult } from '../../../shell/controller';
  import RuleForm from './RuleForm.svelte';
  import { asOneStep } from '@metakit-app/assistant';
  import type { AssistantPort } from '../../../assistant/assistant-service';
  import DraftWithAssistant from '../../assistant/DraftWithAssistant.svelte';
  import { useBuildUndo } from '../../../build/undo-context';

  let {
    kit,
    run,
    behaviourTest,
    assistant,
  }: {
    kit: Kit;
    run: (command: never) => CommandResult;
    /** A dry run of a rule on the selected object, or null when nothing is selected. */
    behaviourTest?: (rule: Rule) => RuleTryResult | null;
    /** The assistant; when absent there is no "Draft with assistant" button. */
    assistant?: AssistantPort | undefined;
  } = $props();

  const rules = $derived(
    Object.values(kit.rules ?? {}).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  );
  let selected = $state<string | null>(null);
  const offerUndo = useBuildUndo();
  let error = $state<string | null>(null);
  const current = $derived(
    selected ? kit.rules?.[selected as Rule['id']] : undefined,
  );

  const exec = (command: Record<string, unknown>): boolean => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok;
  };

  function add() {
    const rule = new RuleEditorModel(kit).toRule();
    if (exec({ type: 'putRule', rule })) selected = rule.id;
  }

  function remove(rule: Rule) {
    if (!exec({ type: 'removeRule', id: rule.id })) return;
    if (selected === rule.id) selected = null;
    offerUndo(`Deleted rule ${rule.label}`);
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
      <li class="card" class:selected={selected === r.id}>
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
            data-tour="rules-row"
          >
            <strong>{r.label}</strong>
            <span class="muted">{eventLabel(r.when.event)}</span>
          </button>
          <button
            type="button"
            class="ghost danger"
            onclick={() => remove(r)}
            aria-label="Delete {r.label}"
            data-testid="rule-delete-{r.id}">Delete</button
          >
        </div>
      </li>
    {/each}
  </ul>
  <div class="add" data-tour="rules-add">
    <button type="button" class="primary" onclick={add} data-testid="rule-add"
      >Add rule</button
    >
    <DraftWithAssistant
      kind="rule"
      {kit}
      {assistant}
      onAccept={(commands) => {
        const first = commands[0];
        if (exec(asOneStep(commands) as never) && first?.type === 'putRule')
          selected = first.rule.id;
      }}
    />
  </div>
  {#if error}<p class="problem" role="alert" data-testid="rules-error">
      {error}
    </p>{/if}

  {#if current}
    {#key `${current.id}:${current.enabled}`}
      <div class="editor">
        <RuleForm {kit} rule={current} {run} {behaviourTest} />
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
  .add {
    display: flex;
    gap: 0.5rem;
    align-items: center;
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
  li {
    padding: var(--gap-1) var(--gap-2);
  }
  li.selected {
    border-color: var(--accent);
  }
  .line {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .name {
    flex: 1;
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    text-align: left;
    border-color: transparent;
    background: transparent;
  }
  .switch {
    display: flex;
    align-items: center;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .ghost.danger {
    border-color: transparent;
  }
  .danger,
  .problem {
    color: var(--danger);
  }
  .editor {
    width: 100%;
    border-top: 1px solid var(--line);
    padding-top: 0.8rem;
  }
</style>
