<script lang="ts">
  import {
    effectiveAttributes,
    effectiveRelationAttributes,
    newId,
    type Constraint,
    type KeyOwner,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { formulaProblem, messageProblem } from '../../build/formula-check';
  import type { CommandResult } from '../../shell/controller';

  let {
    owner,
    constraints,
    tool,
    run,
  }: {
    owner: KeyOwner;
    constraints: Constraint[];
    tool: ToolLibrary;
    run: (command: never) => CommandResult;
  } = $props();

  // A new constraint stays here until it has a formula and a message, so the tool library never
  // holds a half-written one.
  let drafts = $state<Constraint[]>([]);
  let error = $state<string | null>(null);

  const names = $derived.by(() => {
    try {
      if (owner.kind === 'class')
        return effectiveAttributes(tool, owner.id).map((a) => a.key);
      if (owner.kind === 'relation')
        return [
          'from',
          'to',
          ...effectiveRelationAttributes(tool, owner.id).map((a) => a.key),
        ];
      return (tool.modelTypes[owner.id]?.attributes ?? []).map((a) => a.key);
    } catch {
      return [];
    }
  });

  const rows = $derived([...constraints, ...drafts]);
  const isDraft = (k: Constraint) => drafts.some((d) => d.id === k.id);

  function exec(command: Record<string, unknown>): boolean {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok;
  }

  function add() {
    drafts = [
      ...drafts,
      { id: `con_${newId('attribute').slice(4)}`, formula: '', message: '' },
    ];
  }

  function change(k: Constraint, patch: Partial<Constraint>) {
    const next: Constraint = { ...k, ...patch };
    if (next.severity === undefined || next.severity === 'error')
      delete next.severity;
    if (isDraft(k)) {
      drafts = drafts.map((d) => (d.id === k.id ? next : d));
      if (next.formula.trim() === '' || next.message.trim() === '') return;
      if (exec({ type: 'putConstraint', owner, constraint: next }))
        drafts = drafts.filter((d) => d.id !== k.id);
      return;
    }
    exec({ type: 'putConstraint', owner, constraint: next });
  }

  function remove(k: Constraint) {
    if (isDraft(k)) drafts = drafts.filter((d) => d.id !== k.id);
    else exec({ type: 'removeConstraint', owner, id: k.id });
  }
</script>

<section class="constraints" data-testid="constraints-editor">
  <h3>Constraints</h3>
  <p class="muted">
    A constraint is a formula that is true when an object is fine. When it is
    not, validation shows the message{names.length
      ? `. You can use ${names.join(', ')}`
      : ''}.
  </p>
  {#each rows as k (k.id)}
    {@const fProblem = formulaProblem(k.formula, { required: !isDraft(k) })}
    {@const mProblem = messageProblem(k.message)}
    <div class="constraint" data-testid="constraint-{k.id}">
      <label>
        Formula
        <input
          value={k.formula}
          placeholder="Effort > 0"
          spellcheck="false"
          onchange={(e) => change(k, { formula: e.currentTarget.value })}
          data-testid="constraint-formula"
        />
      </label>
      {#if fProblem && k.formula.trim() !== ''}<p
          class="problem"
          role="alert"
          data-testid="constraint-formula-problem"
        >
          {fProblem}
        </p>{/if}
      <label>
        Message
        <input
          value={k.message}
          placeholder="Effort must be above zero"
          onchange={(e) => change(k, { message: e.currentTarget.value })}
          data-testid="constraint-message"
        />
      </label>
      {#if mProblem}<p class="problem" role="alert">{mProblem}</p>{/if}
      <div class="row">
        <label class="inline">
          Severity
          <select
            value={k.severity ?? 'error'}
            onchange={(e) =>
              change(k, {
                severity: e.currentTarget.value as 'error' | 'warning',
              })}
            data-testid="constraint-severity"
          >
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
        </label>
        <button
          type="button"
          onclick={() => remove(k)}
          data-testid="constraint-remove">Remove</button
        >
      </div>
    </div>
  {/each}
  <button type="button" onclick={add} data-testid="constraint-add"
    >Add constraint</button
  >
  {#if error}<p class="problem" role="alert" data-testid="constraint-problem">
      {error}
    </p>{/if}
</section>

<style>
  .constraints {
    display: grid;
    gap: 0.6rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .constraint {
    display: grid;
    gap: 0.4rem;
    padding: 0.6rem 0.8rem;
    background: #f8f9fa;
    border-radius: 6px;
  }
  label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.9rem;
  }
  label.inline {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .row {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0;
  }
  .problem {
    color: #c92a2a;
    margin: 0;
    font-size: 0.85rem;
  }
  button {
    justify-self: start;
  }
</style>
