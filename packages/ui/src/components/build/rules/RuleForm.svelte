<script lang="ts">
  import { untrack } from 'svelte';
  import type {
    ClassId,
    CommandPlace,
    EventName,
    RelationId,
    Rule,
    ToolLibrary,
  } from '@metakit-app/core';
  import {
    attributesFor,
    classesFor,
    eventGroups,
    filtersFor,
    formulaProblem,
    relationsFor,
    RuleEditorModel,
    type RuleTryResult,
  } from '../../../build/rule-editor-model';
  import type { CommandResult } from '../../../shell/controller';
  import ActionList from './ActionList.svelte';

  let {
    tool,
    rule,
    run,
    behaviourTest,
  }: {
    tool: ToolLibrary;
    rule: Rule;
    run: (command: never) => CommandResult;
    /** A dry run on the selected object; null when nothing is selected. */
    behaviourTest?: (rule: Rule) => RuleTryResult | null;
  } = $props();

  // The draft is the form's own: it is saved on every committed change, and kept when a change is
  // refused so that nothing the person typed is lost. The section remounts the form per rule.
  const model = new RuleEditorModel(
    untrack(() => tool),
    untrack(() => rule),
  );
  let rev = $state(0);
  let ifText = $state(untrack(() => rule.if ?? ''));
  let error = $state<string | null>(null);
  let saved = $state(false);
  let tried = $state<{ result: RuleTryResult | null } | null>(null);

  const draft = $derived.by(() => {
    void rev;
    return model.toRule();
  });
  const messages = $derived.by(() => {
    void rev;
    model.setTool(tool);
    return model.messages();
  });
  const groups = eventGroups();
  const filters = $derived(filtersFor(draft.when.event));
  const attributeKeys = $derived(attributesFor(tool, draft.when.class));
  const ifProblem = $derived(
    formulaProblem(
      ifText.trim() !== '' && !ifText.trimStart().startsWith('=')
        ? `=${ifText}`
        : ifText,
    ),
  );

  function save() {
    error = null;
    saved = false;
    if (messages.some((m) => m.level === 'error')) return;
    const r = run({ type: 'putRule', rule: model.toRule() } as never);
    if (r.ok) saved = true;
    else error = r.error;
  }

  function changed() {
    rev += 1;
    tried = null;
    save();
  }

  function tryIt() {
    tried = { result: behaviourTest?.(model.toRule()) ?? null };
  }
</script>

<form class="form" onsubmit={(e) => e.preventDefault()} data-testid="rule-form">
  <label>
    Name
    <input
      value={draft.label}
      onchange={(e) => {
        model.setLabel(e.currentTarget.value);
        changed();
      }}
      data-testid="rule-label"
    />
  </label>

  <fieldset>
    <legend>When</legend>
    <label>
      Event
      <select
        value={draft.when.event}
        onchange={(e) => {
          model.setEvent(e.currentTarget.value as EventName | 'command');
          changed();
        }}
        data-testid="rule-event"
      >
        {#each groups as g (g.label)}
          <optgroup label={g.label}>
            {#each g.events as ev (ev.event)}<option value={ev.event}
                >{ev.label}</option
              >{/each}
          </optgroup>
        {/each}
      </select>
    </label>
    {#if filters.class}
      <label>
        Class
        <select
          value={draft.when.class ?? ''}
          onchange={(e) => {
            model.setClass((e.currentTarget.value || undefined) as ClassId);
            changed();
          }}
          data-testid="rule-class"
        >
          <option value="">Any class</option>
          {#each classesFor(tool) as c (c.id)}<option value={c.id}
              >{c.key}</option
            >{/each}
        </select>
      </label>
    {/if}
    {#if filters.attribute}
      <label>
        Attribute
        <select
          value={draft.when.attribute ?? ''}
          onchange={(e) => {
            model.setAttribute(e.currentTarget.value || undefined);
            changed();
          }}
          data-testid="rule-attribute"
        >
          <option value="">Any attribute</option>
          {#each attributeKeys as k (k)}<option value={k}>{k}</option>{/each}
        </select>
      </label>
    {/if}
    {#if filters.relation}
      <label>
        Relation
        <select
          value={draft.when.relation ?? ''}
          onchange={(e) => {
            model.setRelation(
              (e.currentTarget.value || undefined) as RelationId,
            );
            changed();
          }}
          data-testid="rule-relation"
        >
          <option value="">Any relation</option>
          {#each relationsFor(tool) as r (r.id)}<option value={r.id}
              >{r.key}</option
            >{/each}
        </select>
      </label>
    {/if}
    {#if draft.when.event === 'command'}
      <label>
        Name in the menu
        <input
          value={draft.command?.label ?? ''}
          onchange={(e) => {
            model.setCommand(
              e.currentTarget.value,
              draft.command?.place ?? 'context',
            );
            changed();
          }}
          data-testid="rule-command-label"
        />
      </label>
      <label>
        Where it appears
        <select
          value={draft.command?.place ?? 'context'}
          onchange={(e) => {
            model.setCommand(
              draft.command?.label ?? draft.label,
              e.currentTarget.value as CommandPlace,
            );
            changed();
          }}
          data-testid="rule-command-place"
        >
          <option value="model">Model menu</option>
          <option value="toolbar">Toolbar</option>
          <option value="context">Right-click menu</option>
        </select>
      </label>
    {/if}
  </fieldset>

  <fieldset>
    <legend>If</legend>
    <label>
      Condition (leave empty to always run)
      <input
        value={ifText}
        placeholder="= Priority == 'High' && Owner == null"
        oninput={(e) => (ifText = e.currentTarget.value)}
        onchange={(e) => {
          model.setCondition(e.currentTarget.value);
          ifText = model.toRule().if ?? '';
          changed();
        }}
        aria-invalid={ifProblem ? 'true' : undefined}
        data-testid="rule-if"
      />
    </label>
    {#if ifProblem}<p class="problem" role="alert" data-testid="rule-if-error">
        {ifProblem}
      </p>{/if}
  </fieldset>

  <fieldset>
    <legend>Then</legend>
    <ActionList
      {model}
      {tool}
      actions={draft.then}
      classId={draft.when.class}
      {changed}
    />
  </fieldset>

  {#if messages.length > 0}
    <ul class="messages" data-testid="rule-messages">
      {#each messages as m, i (i)}
        <li class={m.level} data-testid="rule-message">
          <strong>{m.where}:</strong>
          {m.text}
        </li>
      {/each}
    </ul>
  {/if}
  {#if error}<p class="problem" role="alert" data-testid="rule-error">
      {error}
    </p>{/if}
  {#if saved && !error}<p class="ok" data-testid="rule-saved">Saved.</p>{/if}

  <div class="try">
    <button type="button" onclick={tryIt} data-testid="rule-test"
      >Try on the selected object</button
    >
    {#if tried}
      <div class="result" data-testid="rule-test-result">
        {#if tried.result === null}
          <p>Open a model and select an object to try the rule.</p>
        {:else}
          <p data-testid="rule-test-condition">
            {#if tried.result.condition.error}
              The condition fails: {tried.result.condition.error}
            {:else if tried.result.condition.value}
              The condition is true, so the rule would do this:
            {:else}
              The condition is not true, so the rule would do nothing. These are
              its actions:
            {/if}
          </p>
          <ol>
            {#each tried.result.steps as s, i (i)}<li
                data-testid="rule-test-step"
              >
                {s}
              </li>{/each}
          </ol>
        {/if}
      </div>
    {/if}
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: 0.8rem;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 6px;
    display: grid;
    gap: 0.5rem;
    padding: 0.6rem;
  }
  legend {
    font-weight: 600;
    padding: 0 0.3rem;
  }
  label {
    display: grid;
    gap: 0.15rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .problem {
    color: var(--danger);
    margin: 0;
  }
  .hint {
    color: var(--muted);
  }
  .ok {
    color: var(--success);
    margin: 0;
  }
  .messages {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.2rem;
  }
  .try {
    display: grid;
    gap: 0.4rem;
    justify-items: start;
  }
  .result p {
    margin: 0 0 0.3rem;
  }
  .result ol {
    margin: 0;
    padding-left: 1.2rem;
    white-space: pre-wrap;
  }
</style>
