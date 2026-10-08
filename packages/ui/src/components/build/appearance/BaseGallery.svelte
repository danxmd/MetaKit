<script lang="ts">
  import { ImageCache } from '@metakit-app/canvas';
  import type { AttributeDef, LookBase, NodeLook } from '@metakit-app/core';
  import { LOOK_BASES } from '@metakit-app/shapes';
  import { compileTile, withBase } from '../../../build/appearance-model';
  import { paintCompiled } from '../../shape-editor/paint';

  let {
    look,
    attributes,
    className,
    onPick,
  }: {
    look: NodeLook;
    attributes: readonly AttributeDef[];
    className: string;
    onPick: (base: LookBase) => void;
  } = $props();

  const images = new ImageCache();
  const THUMB_W = 84;
  const THUMB_H = 52;

  // Each form drawn with the colours and text chosen so far, so the choice is easy to judge.
  const items = $derived(
    LOOK_BASES.map((b) => {
      const sample: NodeLook = { ...withBase(look, b.id), size: { ...b.size } };
      const pic = compileTile(
        sample,
        attributes,
        { attribute: null, label: '', values: {} },
        className,
      );
      const zoom = Math.min(THUMB_W / pic.width, THUMB_H / pic.height, 1);
      return { info: b, pic, zoom };
    }),
  );
</script>

<section class="gallery" aria-labelledby="form-heading">
  <h3 id="form-heading">Form</h3>
  <ul>
    {#each items as it (it.info.id)}
      <li>
        <button
          type="button"
          class="base"
          aria-pressed={look.base === it.info.id}
          data-testid="base-{it.info.id}"
          onclick={() => onPick(it.info.id)}
        >
          <span class="thumb">
            <canvas
              aria-hidden="true"
              use:paintCompiled={{
                compiled: it.pic.compiled,
                width: Math.round(it.pic.width * it.zoom),
                height: Math.round(it.pic.height * it.zoom),
                zoom: it.zoom,
                images,
              }}
            ></canvas>
          </span>
          <span class="text">
            <strong>{it.info.label}</strong>
            <span class="hint">{it.info.hint}</span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .gallery {
    display: grid;
    gap: var(--gap-2);
    align-content: start;
  }
  h3 {
    margin: 0;
    font-size: var(--text-m);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--gap-1);
  }
  .base {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    gap: var(--gap-2);
    align-items: center;
    width: 100%;
    text-align: left;
    padding: var(--gap-1) var(--gap-2);
    background: var(--surface);
  }
  .base[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .thumb {
    display: grid;
    place-items: center;
    height: 3.5rem;
    background: var(--canvas-bg);
    border-radius: var(--radius-s);
  }
  .text {
    display: grid;
    gap: 1px;
  }
  .hint {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
</style>
