<script lang="ts">
  import {
    effectiveAttributes,
    effectiveRelationAttributes,
    newId,
    type Constraint,
    type KeyOwner,
    type Kit,
  } from '@metakit-app/core';
  import { formulaProblem, messageProblem } from '../../build/formula-check';
  import type { CommandResult } from '../../shell/controller';

  let {
    owner,
    constraints,
    kit,
    run,
  }: {
    owner: KeyOwner;
    constraints: Constraint[];
    kit: Kit;
    run: (command: never) => CommandResult;
  } = $props();

  // A new constraint stays here until it has a formula and a message, so the Kit never
  // holds a half-written one.
  let drafts = $state<Constraint[]>([]);
  let error = $state<string | null>(null);

  const names = $derived.by(() => {
    try {
      if (owner.kind === 'class')
        return effectiveAttributes(kit, owner.id).map((a) => a.key);
      if (owner.kind === 'relation')
        return [
          'from',
          'to',
          ...effectiveRelationAttributes(kit, owner.id).map((a) => a.key),
        ];
      return (kit.modelTypes[owner.id]?.attributes ?? []).map((a) => a.key);
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

<section class="constraints card" data-testid="constraints-editor">
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
      {#if mProblem}<p class="notice error" role="alert">{mProblem}</p>{/if}
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
          class="danger"
          onclick={() => remove(k)}
          data-testid="constraint-remove">Remove</button
        >
      </div>
    </div>
  {/each}
  <button type="button" onclick={add} data-testid="constraint-add"
    >Add constraint</button
  >
  {#if error}<p
      class="notice error"
      role="alert"
      data-testid="constraint-problem"
    >
      {error}
    </p>{/if}
</section>

<style>
  .constraints {
    display: grid;
    gap: var(--gap-3);
    padding: var(--gap-4);
  }
  .constraint {
    display: grid;
    gap: var(--gap-2);
    padding: var(--gap-3);
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  label.inline {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .row {
    display: flex;
    gap: var(--gap-3);
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .muted {
    font-size: var(--text-s);
    margin: 0;
  }
  .notice {
    margin: 0;
  }
  button {
    justify-self: start;
  }
</style>
