<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ImageCache } from '@metakit-app/canvas';
  import type { ClassId, RelationId, ToolLibrary } from '@metakit-app/core';
  import { baseInfo, defaultRelationLook } from '@metakit-app/shapes';
  import {
    MARKER_SHAPES,
    appearanceOfClass,
    appearanceOfRelation,
    classThumbnail,
    fixedColour,
    lookReplacingDrawing,
    relationLookFromShape,
    saveNodeLook,
    saveRelationLook,
  } from '../../../build/appearance-model';
  import type { CommandResult } from '../../../shell/controller';
  import { paintCompiled } from '../../shape-editor/paint';

  let {
    tool,
    owner,
    run,
    onEditAppearance,
    onEditShape,
    children,
  }: {
    tool: ToolLibrary;
    owner:
      { kind: 'class'; id: ClassId } | { kind: 'relation'; id: RelationId };
    run: (command: never) => CommandResult;
    onEditAppearance: (id: string) => void;
    onEditShape: (shapeId: string) => void;
    /** Further choices, shown under "More ways to set the look". */
    children?: Snippet;
  } = $props();

  const images = new ImageCache();
  const isClass = $derived(owner.kind === 'class');
  const noun = $derived(isClass ? 'concept' : 'relation');
  const classState = $derived(
    owner.kind === 'class' ? appearanceOfClass(tool, owner.id) : null,
  );
  const relationState = $derived(
    owner.kind === 'relation' ? appearanceOfRelation(tool, owner.id) : null,
  );
  const appearance = $derived(classState ?? relationState!);
  const def = $derived(
    owner.kind === 'class' ? tool.classes[owner.id] : tool.relations[owner.id],
  );
  let error = $state<string | null>(null);

  const thumb = $derived(
    owner.kind === 'class' ? classThumbnail(tool, owner.id) : null,
  );
  const zoom = $derived(
    thumb ? Math.min(1, 150 / thumb.width, 80 / thumb.height) : 1,
  );
  const line = $derived.by(() => {
    if (relationState?.kind === 'look') return relationState.look;
    if (relationState?.kind === 'drawn')
      return relationLookFromShape(relationState.shape);
    return defaultRelationLook();
  });

  const title = $derived.by(() => {
    if (appearance.kind === 'drawn') return 'Drawn by hand';
    if (appearance.kind === 'none') return 'Automatic look';
    if (classState?.kind === 'look')
      return baseInfo(classState.look.base).label;
    return 'Simple look';
  });

  function replace() {
    if (!def) return;
    if (!confirm('This replaces the drawing. You can undo it.')) return;
    const result =
      owner.kind === 'class' && classState?.kind === 'drawn'
        ? run(
            saveNodeLook(
              tool,
              owner.id,
              lookReplacingDrawing(tool.classes[owner.id]!, classState.shape),
            ) as never,
          )
        : owner.kind === 'relation' && relationState?.kind === 'drawn'
          ? run(
              saveRelationLook(
                tool,
                owner.id,
                relationLookFromShape(relationState.shape),
              ) as never,
            )
          : null;
    if (!result) return;
    error = result.ok ? null : result.error;
    if (result.ok) onEditAppearance(owner.id);
  }
</script>

<div class="card-appearance" data-testid="appearance-card">
  <div class="thumb" aria-hidden="true">
    {#if thumb}
      <canvas
        data-testid="appearance-thumb"
        use:paintCompiled={{
          compiled: thumb.compiled,
          width: Math.round(thumb.width * zoom),
          height: Math.round(thumb.height * zoom),
          zoom,
          images,
        }}
      ></canvas>
    {:else}
      <svg
        viewBox="0 0 160 40"
        width="160"
        height="40"
        data-testid="appearance-thumb"
      >
        <path
          d="M4,20 H{MARKER_SHAPES[line.end].d ? 140 : 156}"
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
            transform="translate(156 20)"
            fill={MARKER_SHAPES[line.end].fill === 'solid'
              ? fixedColour(line.colour)
              : MARKER_SHAPES[line.end].fill === 'hollow'
                ? 'var(--surface)'
                : 'none'}
            stroke={fixedColour(line.colour)}
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        {/if}
      </svg>
    {/if}
  </div>
  <div class="info">
    <strong data-testid="appearance-kind">{title}</strong>
    {#if appearance.kind === 'drawn'}
      <p class="muted" data-testid="appearance-drawn">
        This look was drawn by hand.
      </p>
      <div class="buttons">
        <button
          type="button"
          onclick={() => onEditShape(appearance.shape.id)}
          data-testid="{isClass ? 'class' : 'relation'}-edit-shape"
          >Edit as drawing</button
        >
        <button
          type="button"
          class="primary"
          onclick={replace}
          data-testid="{isClass ? 'class' : 'relation'}-replace-look"
          >Replace with a simple look</button
        >
      </div>
    {:else}
      <p class="muted">
        {appearance.kind === 'none'
          ? `Choose how this ${noun} looks. Until then it uses a plain default.`
          : `Pick a form, colours and text for this ${noun}. No drawing needed.`}
      </p>
      <div class="buttons">
        <button
          type="button"
          class="primary"
          onclick={() => onEditAppearance(owner.id)}
          data-testid="{isClass ? 'class' : 'relation'}-edit-appearance"
          >Edit appearance</button
        >
      </div>
    {/if}
    {#if error}<p class="notice error" role="alert">{error}</p>{/if}
  </div>
</div>
{#if children}
  <details class="more" data-testid="appearance-more">
    <summary>More ways to set the look</summary>
    <div class="more-body">{@render children()}</div>
  </details>
{/if}

<style>
  .card-appearance {
    display: flex;
    gap: var(--gap-4);
    align-items: center;
    flex-wrap: wrap;
  }
  .thumb {
    display: grid;
    place-items: center;
    min-width: 11rem;
    min-height: 5.5rem;
    padding: var(--gap-2);
    background-color: var(--canvas-bg);
    background-image:
      linear-gradient(var(--canvas-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
    background-size: 10px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .info {
    display: grid;
    gap: var(--gap-2);
    justify-items: start;
    flex: 1;
    min-width: 14rem;
  }
  .info p {
    margin: 0;
    font-size: var(--text-s);
  }
  .buttons {
    display: flex;
    gap: var(--gap-2);
    flex-wrap: wrap;
  }
  .more {
    margin-top: var(--gap-2);
  }
  summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .more-body {
    padding-top: var(--gap-2);
  }
</style>
