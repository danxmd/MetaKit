<script lang="ts">
  import { untrack } from 'svelte';
  import { ImageCache } from '@metakit-app/canvas';
  import {
    newId,
    type RelationShape,
    type ShapeDef,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { copyStarter, STARTER_SHAPES } from '@metakit-app/shapes';
  import {
    MARKER_SHAPES,
    compileShape,
    fixedColour,
    relationLookFromShape,
    withoutLook,
  } from '../../build/appearance-model';
  import { paintCompiled } from '../shape-editor/paint';
  import type { CommandResult } from '../../shell/controller';
  import RelationShapeForm from './RelationShapeForm.svelte';
  import { asOneStep } from '@metakit-app/assistant';
  import type { AssistantPort } from '../../assistant/assistant-service';
  import DraftWithAssistant from '../assistant/DraftWithAssistant.svelte';

  let {
    tool,
    run,
    onEditShape,
    onEditAppearance,
    open = null,
    assistant,
  }: {
    tool: ToolLibrary;
    run: (command: never) => CommandResult;
    onEditShape: (id: string) => void;
    /** Opens the Appearance editor of the class or relation class with this id. */
    onEditAppearance: (ownerId: string) => void;
    /** A line shape whose form starts open. */
    open?: string | null;
    /** The assistant; when absent there is no "Draft with assistant" button. */
    assistant?: AssistantPort | undefined;
  } = $props();

  let error = $state<string | null>(null);
  let starter = $state('shp_starter_task');
  let openLine = $state<string | null>(untrack(() => open));
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
  const images = new ImageCache();
  const thumb = (s: ShapeDef) => {
    if (s.kind !== 'node') return null;
    const pic = compileShape(
      s,
      [],
      { attribute: null, label: '', values: {} },
      s.name ?? 'Shape',
    );
    const zoom = Math.min(1, 96 / pic.width, 48 / pic.height);
    return { pic, zoom };
  };
  /** The class or relation class whose Appearance editor can edit a look: only when one uses it. */
  const ownerOf = (id: string): string | undefined => {
    const users = [
      ...Object.values(tool.classes).filter((c) => c.shape === id),
      ...Object.values(tool.relations).filter((r) => r.shape === id),
    ];
    return users.length === 1 ? users[0]!.id : undefined;
  };
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
      {@const t = thumb(s)}
      {@const line = s.kind === 'relation' ? relationLookFromShape(s) : null}
      {@const owner = s.look ? ownerOf(s.id) : undefined}
      <li class="card" data-testid="shape-row-{s.id}">
        <div class="line">
          <span class="thumb" aria-hidden="true">
            {#if t}
              <canvas
                use:paintCompiled={{
                  compiled: t.pic.compiled,
                  width: Math.round(t.pic.width * t.zoom),
                  height: Math.round(t.pic.height * t.zoom),
                  zoom: t.zoom,
                  images,
                }}
              ></canvas>
            {:else if line}
              <svg viewBox="0 0 96 24" width="96" height="24">
                <path
                  d="M4,12 H{line.end === 'none' ? 92 : 84}"
                  fill="none"
                  stroke={fixedColour(line.colour)}
                  stroke-width={line.width}
                  stroke-dasharray={line.style === 'dashed'
                    ? '7 4'
                    : line.style === 'dotted'
                      ? '2 4'
                      : undefined}
                />
                {#if line.end !== 'none'}
                  <path
                    d={MARKER_SHAPES[line.end].d}
                    transform="translate(92 12)"
                    fill={MARKER_SHAPES[line.end].fill === 'solid'
                      ? fixedColour(line.colour)
                      : 'none'}
                    stroke={fixedColour(line.colour)}
                    stroke-width="1.2"
                  />
                {/if}
              </svg>
            {/if}
          </span>
          <span class="names">
            <strong>{s.name ?? s.id}</strong>
            <span class="muted"
              >{s.kind === 'node' ? 'object' : 'line'}{usedBy(s.id).length
                ? `, used by ${usedBy(s.id).join(', ')}`
                : ', not used yet'}</span
            >
          </span>
          <span
            class="badge"
            class:accent={s.look !== undefined}
            data-testid="shape-kind-{s.id}"
            >{s.look ? 'Simple look' : 'Hand drawn'}</span
          >
          <span class="spacer"></span>
          {#if owner}
            <button
              type="button"
              class="primary"
              onclick={() => onEditAppearance(owner)}
              data-testid="shape-appearance-{s.id}">Edit appearance</button
            >
          {/if}
          {#if s.kind === 'node'}
            <button
              type="button"
              onclick={() => onEditShape(s.id)}
              data-testid="shape-edit-{s.id}"
              >{s.look ? 'Edit as drawing' : 'Edit'}</button
            >
          {:else}
            <button
              type="button"
              onclick={() => {
                if (openLine === s.id) openLine = null;
                else if (!s.look) openLine = s.id;
                else onEditShape(s.id);
              }}
              data-testid="shape-edit-{s.id}"
              >{s.look ? 'Edit as drawing' : 'Edit'}</button
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
            onChange={(next) =>
              exec({ type: 'putShape', def: withoutLook(next) })}
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
  .thumb {
    display: grid;
    place-items: center;
    width: 7rem;
    height: 3.5rem;
    flex: none;
    background: var(--canvas-bg);
    border-radius: var(--radius-s);
  }
  .names {
    display: grid;
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
