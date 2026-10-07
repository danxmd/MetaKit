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
  import { asOneStep } from '@metakit-app/assistant';
  import type { AssistantPort } from '../../assistant/assistant-service';
  import DraftWithAssistant from '../assistant/DraftWithAssistant.svelte';

  let {
    tool,
    run,
    onEditShape,
    assistant,
  }: {
    tool: ToolLibrary;
    run: (command: never) => CommandResult;
    onEditShape: (id: string) => void;
    /** The assistant; when absent there is no "Draft with assistant" button. */
    assistant?: AssistantPort | undefined;
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
  <p class="muted lead">
    A shape says how a class or a relation class is drawn. Classes pick theirs
    in the class editor.
  </p>
  {#if shapes.length === 0}<p class="muted">
      No shapes yet. Add one from a starter below, or create one from a class.
    </p>{/if}
  <ul>
    {#each shapes as s (s.id)}
      <li class="card">
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
            class="danger"
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
    <button type="button" class="primary" onclick={add} data-testid="shapes-add"
      >Add from starter</button
    >
    <DraftWithAssistant
      kind="shape"
      {tool}
      {assistant}
      onAccept={(commands) => exec(asOneStep(commands) as never)}
    />
  </div>
  {#if error}<p class="notice error" role="alert" data-testid="shapes-problem">
      {error}
    </p>{/if}
</div>

<style>
  .editor {
    display: grid;
    gap: var(--gap-3);
    max-width: 56rem;
  }
  .lead {
    margin: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--gap-2);
  }
  li {
    padding: var(--gap-2) var(--gap-3);
    display: grid;
    gap: var(--gap-2);
  }
  .line {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  .row {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
    padding-top: var(--gap-2);
  }
  .muted {
    font-size: var(--text-s);
    margin: 0;
  }
</style>
