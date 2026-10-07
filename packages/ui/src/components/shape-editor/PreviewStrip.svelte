<script lang="ts">
  import type { ImageCache } from '@metakit-app/canvas';
  import type { AttributeDef, Json } from '@metakit-app/core';
  import { optionValue } from '@metakit-app/core';
  import type { ShapeEditorModel } from '../../build/shape-editor-model';
  import { paintCompiled } from './paint';

  let {
    model,
    version,
    images,
  }: {
    model: ShapeEditorModel;
    version: number;
    images: ImageCache;
  } = $props();

  const previews = $derived.by(() => {
    void version;
    return model.previewScales.map((s) => model.compilePreview(s));
  });
  const attributes = $derived.by(() => {
    void version;
    return model.attributes;
  });
  const samples = $derived.by(() => {
    void version;
    return model.samples;
  });
  const messages = $derived(previews[1]?.compiled.messages ?? []);

  function spoken(p: (typeof previews)[number]): string {
    const lines = p.compiled.ops.flatMap((o) =>
      o.op === 'text' ? o.lines.map((l) => l.text) : [],
    );
    return `Preview at ${p.scale}x${lines.length ? `: ${lines.join(', ')}` : ''}`;
  }

  const textOf = (v: Json | undefined) =>
    v === null || v === undefined
      ? ''
      : Array.isArray(v)
        ? v.join(', ')
        : String(v);

  function setNumber(a: AttributeDef, text: string) {
    const n = Number(text);
    model.setSample(a.id, text.trim() === '' || !Number.isFinite(n) ? null : n);
  }

  function setText(a: AttributeDef, text: string) {
    if (a.type === 'multi-choice')
      model.setSample(
        a.id,
        text
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t !== ''),
      );
    else model.setSample(a.id, text === '' && a.type !== 'text' ? null : text);
  }
</script>

<section class="strip" aria-label="Preview" data-testid="shape-preview">
  <h3>Preview</h3>
  <div class="sizes">
    {#each previews as p (p.scale)}
      <figure role="img" aria-label={spoken(p)}>
        <canvas
          aria-hidden="true"
          data-testid={`shape-preview-${p.scale}`}
          use:paintCompiled={{
            compiled: p.compiled,
            width: p.width,
            height: p.height,
            images,
          }}
        ></canvas>
        <figcaption>{p.scale}x ({p.width} by {p.height})</figcaption>
      </figure>
    {/each}
  </div>

  {#if messages.length > 0}
    <ul class="problems" data-testid="shape-messages" aria-label="Problems">
      {#each messages as m (m)}<li>{m}</li>{/each}
    </ul>
  {/if}

  {#if attributes.length > 0}
    <fieldset class="samples">
      <legend>Sample values</legend>
      {#each attributes as a (a.id)}
        {@const v = samples[a.id]}
        <label>
          <span>{a.key}</span>
          {#if a.type === 'choice'}
            <select
              value={textOf(v)}
              data-testid={`shape-sample-${a.key}`}
              onchange={(e) => model.setSample(a.id, e.currentTarget.value)}
            >
              {#each a.options as o (optionValue(o))}
                <option value={optionValue(o)}>{optionValue(o)}</option>
              {/each}
            </select>
          {:else if a.type === 'boolean'}
            <input
              type="checkbox"
              checked={v === true}
              data-testid={`shape-sample-${a.key}`}
              onchange={(e) => model.setSample(a.id, e.currentTarget.checked)}
            />
          {:else if a.type === 'integer' || a.type === 'number'}
            <input
              type="number"
              value={textOf(v)}
              data-testid={`shape-sample-${a.key}`}
              onchange={(e) => setNumber(a, e.currentTarget.value)}
            />
          {:else if a.type === 'table'}
            <span class="hint" data-testid={`shape-sample-${a.key}`}>
              {Array.isArray(v) ? v.length : 0} sample rows
            </span>
          {:else}
            <input
              type="text"
              value={textOf(v)}
              placeholder={a.type === 'reference' ? 'element id or empty' : ''}
              data-testid={`shape-sample-${a.key}`}
              onchange={(e) => setText(a, e.currentTarget.value)}
            />
          {/if}
        </label>
      {/each}
    </fieldset>
  {:else}
    <p class="hint">
      This class has no attributes yet, so there are no sample values to change.
    </p>
  {/if}
</section>

<style>
  .strip {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .sizes {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  figure {
    margin: 0;
    display: grid;
    gap: 0.2rem;
  }
  canvas {
    background: #fff;
    border: 1px dashed var(--line, #dee2e6);
  }
  figcaption {
    font-size: 0.75rem;
    color: var(--muted, #6b7280);
  }
  .samples {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    border: 1px solid var(--line, #dee2e6);
    border-radius: 6px;
    padding: 0.3rem 0.6rem 0.5rem;
  }
  legend {
    font-size: 0.8rem;
    color: var(--muted, #6b7280);
  }
  label {
    display: grid;
    gap: 0.15rem;
    font-size: 0.8rem;
  }
  label input[type='text'],
  label input[type='number'],
  label select {
    width: 9rem;
  }
  .problems {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.8rem;
    color: var(--danger, #c92a2a);
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted, #6b7280);
  }
</style>
