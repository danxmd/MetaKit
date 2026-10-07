<script lang="ts">
  import { ImageCache } from '@metakit-app/canvas';
  import type { AttributeDef, NodeLook } from '@metakit-app/core';
  import {
    compileTile,
    previewGroups,
    type PreviewTile,
  } from '../../../build/appearance-model';
  import { paintCompiled } from '../../shape-editor/paint';

  let {
    look,
    attributes,
    className,
  }: {
    look: NodeLook;
    attributes: readonly AttributeDef[];
    className: string;
  } = $props();

  const images = new ImageCache();
  const groups = $derived(previewGroups(look, attributes));
  // The tile shown big: the one the author clicked, else the first.
  let picked = $state<string | null>(null);
  const idOf = (g: number, t: number) => `${g}:${t}`;
  const big = $derived.by((): PreviewTile => {
    const [g, t] = (picked ?? '0:0').split(':').map(Number) as [number, number];
    return groups[g]?.tiles[t] ?? groups[0]!.tiles[0]!;
  });

  const BIG_W = 460;
  const BIG_H = 230;
  const bigPicture = $derived(compileTile(look, attributes, big, className));
  const bigZoom = $derived(
    Math.min(
      2,
      (BIG_W - 48) / bigPicture.width,
      (BIG_H - 48) / bigPicture.height,
    ),
  );
  const TILE = 112;
  const tileZoom = (w: number, h: number) =>
    Math.min(1, (TILE - 16) / w, 64 / h);
  const messages = $derived(bigPicture.compiled.messages);
</script>

<section class="preview" aria-label="Preview">
  <div
    class="surface"
    role="img"
    aria-label="Preview of the look{big.attribute ? `, ${big.label}` : ''}"
    data-testid="appearance-surface"
  >
    <canvas
      aria-hidden="true"
      data-testid="appearance-preview"
      use:paintCompiled={{
        compiled: bigPicture.compiled,
        width: Math.round(bigPicture.width * bigZoom),
        height: Math.round(bigPicture.height * bigZoom),
        zoom: bigZoom,
        images,
      }}
    ></canvas>
  </div>
  {#if messages.length > 0}
    <p class="problems" role="alert" data-testid="appearance-messages">
      {messages.join(' ')}
    </p>
  {/if}
  <div class="groups" data-testid="appearance-tiles">
    {#each groups as g, gi (g.title)}
      <div class="group" role="group" aria-label={g.title}>
        {#if groups.length > 1 || g.tiles[0]?.attribute}
          <h4>{g.title}</h4>
        {/if}
        <div class="tiles">
          {#each g.tiles as t, ti (t.label)}
            {@const pic = compileTile(look, attributes, t, className)}
            {@const z = tileZoom(pic.width, pic.height)}
            <button
              type="button"
              class="tile"
              aria-pressed={idOf(gi, ti) === (picked ?? '0:0')}
              data-testid="appearance-tile"
              onclick={() => (picked = idOf(gi, ti))}
            >
              <span class="pic">
                <canvas
                  aria-hidden="true"
                  use:paintCompiled={{
                    compiled: pic.compiled,
                    width: Math.round(pic.width * z),
                    height: Math.round(pic.height * z),
                    zoom: z,
                    images,
                  }}
                ></canvas>
              </span>
              <span class="cap">{t.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .preview {
    display: grid;
    gap: var(--gap-3);
    min-width: 0;
  }
  .surface {
    display: grid;
    place-items: center;
    min-height: 14rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background-color: var(--canvas-bg);
    background-image:
      linear-gradient(var(--canvas-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
    background-size: 20px 20px;
    padding: var(--gap-4);
  }
  .problems {
    margin: 0;
    color: var(--danger);
    font-size: var(--text-s);
  }
  .groups {
    display: grid;
    gap: var(--gap-3);
  }
  h4 {
    margin: 0 0 var(--gap-1);
    font-size: var(--text-s);
    color: var(--text-muted);
    font-weight: 600;
  }
  .tiles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2);
  }
  .tile {
    display: grid;
    gap: var(--gap-1);
    justify-items: center;
    width: 7rem;
    padding: var(--gap-2);
    background: var(--surface);
  }
  .tile[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .pic {
    display: grid;
    place-items: center;
    height: 4.5rem;
    width: 100%;
    background: var(--canvas-bg);
    border-radius: var(--radius-s);
  }
  .cap {
    font-size: var(--text-s);
    color: var(--text);
    text-align: center;
    overflow-wrap: anywhere;
  }
</style>
