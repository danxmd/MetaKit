<script lang="ts">
  import {
    newId,
    type RelationShape,
    type ShapeDef,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { copyStarter, STARTER_SHAPES } from '@metakit-app/shapes';
  import type { CommandResult } from '../../shell/controller';
  import RelationShapeForm from './RelationShapeForm.svelte';

  let {
    tool,
    run,
    onEditShape,
  }: {
    tool: ToolLibrary;
    run: (command: never) => CommandResult;
    onEditShape: (id: string) => void;
  } = $props();

  let error = $state<string | null>(null);
  let starter = $state('shp_starter_task');
  let openLine = $state<string | null>(null);
  const exec = (command: Record<string, unknown>): string | null => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok ? null : r.error;
  };
  const shapes = $derived(
    Object.values(tool.shapes).sort((a, b) =>
      (a.name ?? a.id).localeCompare(b.name ?? b.id),
    ),
  );
  const starters = Object.values(STARTER_SHAPES);

  function add() {
    const copy = copyStarter(starter, newId('shape'));
    if (
      copy &&
      exec({ type: 'putShape', def: copy }) === null &&
      copy.kind === 'node'
    )
      onEditShape(copy.id);
  }
  function duplicate(s: ShapeDef) {
    const copy = {
      ...JSON.parse(JSON.stringify(s)),
      id: newId('shape'),
      name: `${s.name ?? 'Shape'} copy`,
    } as ShapeDef;
    exec({ type: 'putShape', def: copy });
  }
  const usedBy = (id: string): string[] => [
    ...Object.values(tool.classes)
      .filter((c) => c.shape === id)
      .map((c) => c.key),
    ...Object.values(tool.relations)
      .filter((r) => r.shape === id)
      .map((r) => r.key),
  ];
</script>

<div class="editor" data-testid="shapes-section">
  <h2>Shapes</h2>
  <p class="muted">
    A shape says how a class or a relation class is drawn. Classes pick theirs
    in the class editor.
  </p>
  <ul>
    {#each shapes as s (s.id)}
      <li>
        <div class="line">
          <strong>{s.name ?? s.id}</strong>
          <span class="muted"
            >{s.kind === 'node' ? 'object' : 'line'}{usedBy(s.id).length
              ? `, used by ${usedBy(s.id).join(', ')}`
              : ''}</span
          >
          <span class="spacer"></span>
          {#if s.kind === 'node'}
            <button
              type="button"
              onclick={() => onEditShape(s.id)}
              data-testid="shape-edit-{s.id}">Edit</button
            >
          {:else}
            <button
              type="button"
              onclick={() => (openLine = openLine === s.id ? null : s.id)}
              data-testid="shape-edit-{s.id}">Edit</button
            >
          {/if}
          <button type="button" onclick={() => duplicate(s)}>Duplicate</button>
          <button
            type="button"
            onclick={() => exec({ type: 'removeShape', id: s.id })}
            aria-label="Delete {s.name ?? s.id}">Delete</button
          >
        </div>
        {#if s.kind === 'relation' && openLine === s.id}
          <RelationShapeForm
            shape={s as RelationShape}
            onChange={(next) => exec({ type: 'putShape', def: next })}
          />
        {/if}
      </li>
    {/each}
  </ul>
  <div class="row">
    <select
      bind:value={starter}
      aria-label="Starter shape"
      data-testid="shapes-starter"
    >
      {#each starters as s (s.id)}<option value={s.id}>{s.name ?? s.id}</option
        >{/each}
    </select>
    <button type="button" onclick={add} data-testid="shapes-add"
      >Add from starter</button
    >
  </div>
  {#if error}<p class="problem" role="alert" data-testid="shapes-problem">
      {error}
    </p>{/if}
</div>

<style>
  .editor {
    display: grid;
    gap: 0.7rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  .line {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
  }
  .spacer {
    flex: 1;
  }
  .row {
    display: flex;
    gap: 0.5rem;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0;
  }
  .problem {
    color: #c92a2a;
  }
</style>
