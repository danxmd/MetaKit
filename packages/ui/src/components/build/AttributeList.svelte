<script lang="ts">
  import {
    ATTRIBUTE_TYPES,
    type AttributeDef,
    type AttributeType,
    type KeyOwner,
    type ToolLibrary,
  } from '@metakit-app/core';
  import {
    ATTRIBUTE_TYPE_LABELS,
    blankAttribute,
    labelIn,
    uniqueKey,
  } from '../../build/attributes';
  import type { CommandResult } from '../../shell/controller';
  import AttributeForm from './AttributeForm.svelte';

  let {
    owner,
    attributes,
    tool,
    run,
    /** Keys that cannot be used because a parent or child class has them. */
    taken = [],
    usages,
  }: {
    owner: KeyOwner;
    attributes: AttributeDef[];
    tool: ToolLibrary;
    run: (command: never) => CommandResult;
    taken?: string[];
    /** Where an attribute is read, shown before it is deleted. */
    usages: (id: string) => string[];
  } = $props();

  const language = $derived(tool.manifest.languages[0] ?? 'en');
  let open = $state<string | null>(null);
  let newType = $state<AttributeType>('text');
  let error = $state<string | null>(null);
  let confirming = $state<string | null>(null);

  const exec = (command: Record<string, unknown>): string | null => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok ? null : r.error;
  };

  function add() {
    const key = uniqueKey(newType === 'formula' ? 'Calculated' : 'Attribute', [
      ...taken,
      ...attributes.map((a) => a.key),
    ]);
    const def = blankAttribute(newType, key);
    if (exec({ type: 'putAttribute', owner, def }) === null) open = def.id;
  }

  function move(id: string, to: number) {
    exec({ type: 'moveAttribute', owner, id, to });
  }

  function remove(id: string) {
    confirming = null;
    exec({ type: 'removeAttribute', owner, id });
    if (open === id) open = null;
  }
</script>

<section class="attributes card" data-testid="attributes">
  <h3>Attributes</h3>
  <p class="muted help">
    Attributes hold the values of an object. Open one to change its type,
    choices or default; reorder with the arrows.
  </p>
  {#if attributes.length === 0}<p class="empty muted">
      No attributes yet. Pick a type below and add the first one.
    </p>{/if}
  <ul>
    {#each attributes as a, i (a.id)}
      <li>
        <div class="line">
          <button
            class="name"
            type="button"
            onclick={() => (open = open === a.id ? null : a.id)}
            aria-expanded={open === a.id}
            data-testid="attr-{a.key}"
          >
            <strong>{a.key}</strong>
            <span class="muted">{labelIn(a.labels, language, '')}</span>
            <span class="type"
              >{ATTRIBUTE_TYPE_LABELS[a.type]}{a.required
                ? ', required'
                : ''}</span
            >
          </button>
          <button
            type="button"
            disabled={i === 0}
            onclick={() => move(a.id, i - 1)}
            class="icon ghost"
            title="Move up"
            aria-label="Move {a.key} up">↑</button
          >
          <button
            type="button"
            disabled={i === attributes.length - 1}
            onclick={() => move(a.id, i + 1)}
            class="icon ghost"
            title="Move down"
            aria-label="Move {a.key} down">↓</button
          >
          <button
            type="button"
            class="ghost danger"
            onclick={() => (confirming = a.id)}
            aria-label="Delete {a.key}">Delete</button
          >
        </div>
        {#if confirming === a.id}
          <div class="notice warning confirm" role="alert">
            Delete "{a.key}"? Values stored in models are kept and shown as
            unknown attributes.
            {#if usages(a.id).length > 0}
              It is used in {usages(a.id).join(', ')}.
            {/if}
            <button
              type="button"
              class="danger"
              onclick={() => remove(a.id)}
              data-testid="attr-confirm-delete">Delete</button
            >
            <button type="button" onclick={() => (confirming = null)}
              >Keep</button
            >
          </div>
        {/if}
        {#if open === a.id}
          <AttributeForm
            def={a}
            {tool}
            onPut={(def) => exec({ type: 'putAttribute', owner, def })}
            onRename={(key) =>
              exec({
                type: 'renameKey',
                scope: { kind: 'attribute', owner, id: a.id },
                newKey: key,
              })}
          />
        {/if}
      </li>
    {/each}
  </ul>
  <div class="add">
    <select
      bind:value={newType}
      aria-label="Type of the new attribute"
      data-testid="attr-new-type"
    >
      {#each ATTRIBUTE_TYPES as t (t)}<option value={t}
          >{ATTRIBUTE_TYPE_LABELS[t]}</option
        >{/each}
    </select>
    <button type="button" class="primary" onclick={add} data-testid="attr-add"
      >Add attribute</button
    >
  </div>
  {#if error}<p
      class="notice error"
      role="alert"
      data-testid="attr-list-problem"
    >
      {error}
    </p>{/if}
</section>

<style>
  .attributes {
    padding: var(--gap-4);
    display: grid;
    gap: var(--gap-3);
  }
  .help,
  .empty {
    margin: 0;
    font-size: var(--text-s);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--gap-2);
  }
  li {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-2);
    padding: var(--gap-1);
    display: grid;
    gap: var(--gap-2);
  }
  .line {
    display: flex;
    gap: var(--gap-1);
    align-items: stretch;
  }
  .name {
    flex: 1;
    display: flex;
    gap: var(--gap-3);
    align-items: baseline;
    text-align: left;
    border-color: transparent;
    background: transparent;
  }
  .type,
  .name .muted {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .type {
    margin-left: auto;
  }
  .add {
    display: flex;
    gap: var(--gap-2);
  }
  .ghost.danger {
    border-color: transparent;
  }
  .confirm {
    margin: 0 var(--gap-1);
  }
</style>
