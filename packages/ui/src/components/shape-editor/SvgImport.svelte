<script lang="ts">
  import type { SvgImportMode, SvgImportResult } from '@metakit-app/shapes';

  let {
    onImport,
  }: {
    /** Adds the drawing to the shape and says what could not be converted. */
    onImport: (text: string, mode: SvgImportMode) => SvgImportResult;
  } = $props();

  let mode = $state<SvgImportMode>('parts');
  let status = $state('');
  let skipped = $state<string[]>([]);

  async function chosen(e: Event & { currentTarget: HTMLInputElement }) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    // Cleared so the same file can be chosen again with the other setting.
    input.value = '';
    const result = onImport(text, mode);
    skipped = result.skipped;
    status =
      result.parts.length === 0
        ? 'Nothing was imported.'
        : mode === 'image'
          ? 'Added the drawing as one image.'
          : `Added ${result.parts.length} ${result.parts.length === 1 ? 'part' : 'parts'}.`;
  }
</script>

<section class="import" aria-label="SVG import" data-testid="shape-svg">
  <h3>Import SVG</h3>
  <fieldset>
    <legend>Import as</legend>
    <label>
      <input
        type="radio"
        name="svg-mode"
        value="parts"
        bind:group={mode}
        data-testid="shape-svg-mode-parts"
      />
      Separate parts
    </label>
    <label>
      <input
        type="radio"
        name="svg-mode"
        value="image"
        bind:group={mode}
        data-testid="shape-svg-mode-image"
      />
      One image
    </label>
  </fieldset>
  <label class="file">
    <span>SVG file</span>
    <input
      type="file"
      accept=".svg,image/svg+xml"
      onchange={chosen}
      data-testid="shape-svg-file"
    />
  </label>
  <p class="status" role="status" data-testid="shape-svg-status">{status}</p>
  {#if skipped.length > 0}
    <div data-testid="shape-svg-skipped">
      <p class="status">Not imported:</p>
      <ul>
        {#each skipped as s (s)}<li>{s}</li>{/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .import {
    display: grid;
    gap: 0.4rem;
    align-content: start;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.15rem;
    font-size: 0.85rem;
  }
  legend {
    padding: 0;
    color: var(--muted, var(--text-muted));
  }
  .file {
    display: grid;
    gap: 0.2rem;
    font-size: 0.85rem;
  }
  .file input {
    max-width: 100%;
  }
  .status {
    margin: 0;
    font-size: 0.85rem;
  }
  ul {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.8rem;
    color: var(--muted, var(--text-muted));
  }
</style>
