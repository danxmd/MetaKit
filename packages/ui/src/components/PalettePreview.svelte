<script lang="ts">
  import type { PreviewTarget } from '@metakit-app/canvas';
  import type { ToolLibrary } from '@metakit-app/core';
  import type { PreviewInfo } from '../shell/palette-preview';
  import ShapePreview from './ShapePreview.svelte';

  let {
    tool,
    target,
    info,
    id,
    left,
    top,
  }: {
    tool: ToolLibrary;
    target: PreviewTarget;
    info: PreviewInfo;
    /** The id the palette entry points to with aria-describedby. */
    id: string;
    /** Screen position of the card's top left corner. */
    left: number;
    top: number;
  } = $props();
</script>

<!-- The card never takes pointer events, so it cannot get between the pointer and a palette entry. -->
<div
  class="card preview"
  role="tooltip"
  {id}
  style="left:{left}px;top:{top}px"
  data-testid="palette-preview"
  data-kind={info.kind}
>
  <div class="drawing">
    <ShapePreview
      {tool}
      {target}
      width={204}
      height={info.kind === 'relation' ? 56 : 100}
    />
  </div>
  <header>
    <h3>{info.title}</h3>
    <span class="badge accent" data-testid="palette-preview-kind"
      >{info.kindLabel}</span
    >
  </header>
  {#if info.sentence}
    <p class="ends" data-testid="palette-preview-ends">{info.sentence}</p>
  {/if}
  {#if info.help}
    <p class="help" data-testid="palette-preview-help">{info.help}</p>
  {/if}
  {#if info.attributes.length > 0}
    <h4>Attributes</h4>
    <ul class="attributes" data-testid="palette-preview-attributes">
      {#each info.attributes as attr (attr.key)}
        <li>
          <span class="name"
            >{attr.label}{#if attr.required}<span
                class="req"
                title="Required"
                aria-label="required">*</span
              >{/if}</span
          >
          <span class="type">{attr.type}</span>
        </li>
      {/each}
    </ul>
    {#if info.moreAttributes > 0}
      <p class="more">and {info.moreAttributes} more</p>
    {/if}
  {:else}
    <p class="more">No attributes.</p>
  {/if}
</div>

<style>
  .preview {
    position: fixed;
    z-index: 60;
    width: 17rem;
    padding: var(--gap-3);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap-2);
    pointer-events: none;
    box-shadow: var(--shadow);
  }
  .drawing {
    display: grid;
    place-items: center;
    background: var(--canvas-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-s);
    padding: var(--gap-2);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-2);
  }
  h3 {
    font-size: var(--text-m);
  }
  h4 {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin-top: var(--gap-1);
  }
  .ends {
    font-size: var(--text-s);
    font-weight: 600;
    color: var(--text-strong);
  }
  .help {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .attributes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: var(--text-s);
  }
  .attributes li {
    display: flex;
    justify-content: space-between;
    gap: var(--gap-3);
  }
  .req {
    color: var(--danger);
    margin-left: 2px;
  }
  .type {
    color: var(--text-faint);
  }
  .more {
    font-size: 0.75rem;
    color: var(--text-faint);
  }
</style>
