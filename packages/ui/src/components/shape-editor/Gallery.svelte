<script lang="ts">
  import type { NodeShape } from '@metakit-app/core';
  import type { ImageCache } from '@metakit-app/canvas';
  import {
    compileNode,
    makeScope,
    STARTER_SHAPES,
    type Compiled,
  } from '@metakit-app/shapes';
  import { paintCompiled } from './paint';

  let {
    images,
    onPick,
  }: {
    images: ImageCache;
    /** Adds a copy of the starter shape with this id. */
    onPick: (id: string) => void;
  } = $props();

  const THUMB = { w: 72, h: 48 };

  const starters = Object.values(STARTER_SHAPES).filter(
    (s): s is NodeShape => s.kind === 'node',
  );

  function thumb(shape: NodeShape): { compiled: Compiled; zoom: number } {
    const scope = makeScope(
      [],
      {},
      {
        label: 'Label',
        className: 'Class',
        w: shape.size.width,
        h: shape.size.height,
        fill: '#E7F5FF',
      },
    );
    const compiled = compileNode(shape, {
      w: shape.size.width,
      h: shape.size.height,
      scope,
    });
    const zoom = Math.min(
      THUMB.w / shape.size.width,
      THUMB.h / shape.size.height,
    );
    return { compiled, zoom };
  }
</script>

<section
  class="gallery"
  aria-label="Starter shapes"
  data-testid="shape-gallery"
>
  <h3>Starter shapes</h3>
  <ul>
    {#each starters as s (s.id)}
      {@const t = thumb(s)}
      <li>
        <button
          type="button"
          aria-label={`Add ${s.name ?? s.id}`}
          title={`Add ${s.name ?? s.id}`}
          data-testid={`shape-gallery-${s.id}`}
          onclick={() => onPick(s.id)}
        >
          <canvas
            aria-hidden="true"
            use:paintCompiled={{
              compiled: t.compiled,
              width: THUMB.w,
              height: THUMB.h,
              zoom: t.zoom,
              images,
            }}
          ></canvas>
          <span>{s.name ?? s.id}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .gallery {
    display: grid;
    gap: 0.4rem;
    align-content: start;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }
  button {
    display: grid;
    gap: 0.2rem;
    justify-items: center;
    width: 100%;
    padding: 0.3rem;
    font-size: 0.75rem;
  }
  canvas {
    background: var(--canvas-bg);
    border: 1px solid var(--line, var(--line));
    border-radius: 4px;
  }
</style>
