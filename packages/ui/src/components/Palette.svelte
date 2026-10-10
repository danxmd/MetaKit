<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EditorTool, PreviewTarget } from '@metakit-app/canvas';
  import type { ClassId, RelationId, Kit } from '@metakit-app/core';
  import { labelOf, type Palette } from '../shell/palette';
  import {
    previewOfClass,
    previewOfRelation,
    type PreviewInfo,
  } from '../shell/palette-preview';
  import PalettePreview from './PalettePreview.svelte';
  import ShapePreview from './ShapePreview.svelte';

  let {
    kit,
    palette,
    activeTool,
    onSelect,
    onPlace,
    onConnect,
    onDragClass,
    onHover,
    language = 'en',
  }: {
    kit: Kit;
    palette: Palette;
    activeTool: EditorTool;
    onSelect: () => void;
    onPlace: (cls: ClassId) => void;
    onConnect: (relation: RelationId) => void;
    onDragClass: (event: DragEvent, cls: ClassId) => void;
    /** Tells the hint line which entry is hovered or focused, and null when none is. */
    onHover?: (target: PreviewTarget | null) => void;
    language?: string;
  } = $props();

  /** The entry the card is about, and where the card goes. */
  let shown = $state<{
    target: PreviewTarget;
    info: PreviewInfo;
    left: number;
    top: number;
    owner: string;
  } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const CARD_ID = 'palette-preview-card';
  // Wide enough for the card (16rem) and tall enough to keep most of it on screen.
  const CARD_HEIGHT = 340;

  function open(
    event: Event,
    owner: string,
    target: PreviewTarget,
    info: () => PreviewInfo,
    delay: number,
  ) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    clearTimeout(timer);
    const show = () => {
      const top = Math.max(
        8,
        Math.min(box.top - 8, window.innerHeight - CARD_HEIGHT - 8),
      );
      shown = { target, info: info(), left: box.right + 10, top, owner };
      onHover?.(target);
    };
    if (delay === 0) show();
    else timer = setTimeout(show, delay);
  }

  function close() {
    clearTimeout(timer);
    shown = null;
    onHover?.(null);
  }

  const forClass = (
    event: Event,
    cls: (typeof palette.classes)[number],
    delay: number,
  ) =>
    open(
      event,
      cls.id,
      { class: cls.id },
      () => previewOfClass(kit, cls, language),
      delay,
    );
  const forRelation = (
    event: Event,
    rel: (typeof palette.relations)[number],
    delay: number,
  ) =>
    open(
      event,
      rel.id,
      { relation: rel.id },
      () => previewOfRelation(kit, rel, language),
      delay,
    );

  onDestroy(() => clearTimeout(timer));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<nav class="palette" aria-label="Palette" data-testid="palette">
  <button
    class="entry select"
    class:on={activeTool.type === 'select'}
    onclick={onSelect}
    data-testid="tool-select"
  >
    <span class="thumb arrow" aria-hidden="true">↖</span>
    <span class="name">Select</span>
  </button>

  <h3>Objects</h3>
  {#each palette.classes as cls (cls.id)}
    <button
      class="entry"
      class:on={activeTool.type === 'place' && activeTool.class === cls.id}
      draggable="true"
      ondragstart={(e) => {
        close();
        onDragClass(e, cls.id);
      }}
      onclick={() => onPlace(cls.id)}
      onpointerenter={(e) => forClass(e, cls, 150)}
      onpointerleave={close}
      onfocus={(e) => forClass(e, cls, 0)}
      onblur={close}
      aria-describedby={shown?.owner === cls.id ? CARD_ID : undefined}
      data-testid="palette-class-{cls.key}"
    >
      <span class="thumb">
        <ShapePreview
          {kit}
          target={{ class: cls.id }}
          width={34}
          height={22}
          text={false}
        />
      </span>
      <span class="name">{labelOf(cls, language)}</span>
    </button>
  {/each}

  <h3 data-tour="model-relations">Relations</h3>
  {#each palette.relations as rel (rel.id)}
    <button
      class="entry"
      class:on={activeTool.type === 'connect' && activeTool.relation === rel.id}
      onclick={() => onConnect(rel.id)}
      onpointerenter={(e) => forRelation(e, rel, 150)}
      onpointerleave={close}
      onfocus={(e) => forRelation(e, rel, 0)}
      onblur={close}
      aria-describedby={shown?.owner === rel.id ? CARD_ID : undefined}
      data-testid="palette-relation-{rel.key}"
    >
      <span class="thumb">
        <ShapePreview
          {kit}
          target={{ relation: rel.id }}
          width={34}
          height={22}
          text={false}
          padding={2}
        />
      </span>
      <span class="name">{labelOf(rel, language)}</span>
    </button>
  {/each}

  {#if palette.classes.length === 0}
    <p class="hint">This view lists no objects.</p>
  {/if}
</nav>

{#if shown}
  <PalettePreview
    {kit}
    target={shown.target}
    info={shown.info}
    id={CARD_ID}
    left={shown.left}
    top={shown.top}
  />
{/if}

<style>
  .palette {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--gap-3);
    overflow-y: auto;
    background: var(--surface-2);
    border-right: 1px solid var(--line);
  }
  h3 {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin: var(--gap-4) var(--gap-1) var(--gap-1);
  }
  .entry {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    width: 100%;
    text-align: left;
    background: transparent;
    border-color: transparent;
    padding: 0.2rem var(--gap-2);
    min-height: 2.1rem;
  }
  .entry:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  .entry.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .thumb {
    flex: none;
    width: 34px;
    height: 22px;
    display: grid;
    place-items: center;
    background: var(--canvas-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-s);
    overflow: hidden;
  }
  .thumb.arrow {
    font-size: 1rem;
    background: transparent;
    border-color: transparent;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
</style>
