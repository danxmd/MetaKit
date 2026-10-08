<script lang="ts">
  import { IMPORT_ACCEPT } from '../shell/files';
  import { menuBehaviour } from '../shell/menu-action';

  let {
    models,
    onExportModel,
    onExportBundle,
    onExportCsv,
    onImport,
  }: {
    /** The models that can be exported. */
    models: { slug: string; name: string }[];
    onExportModel: (slug: string) => void;
    onExportBundle: (slug: string) => void;
    onExportCsv: (slug: string) => void;
    onImport: (files: File[]) => void;
  } = $props();

  let input: HTMLInputElement | undefined = $state();
  let chosen = $state('');
  // Falls back to the first model while nothing valid is chosen (a model may have been deleted).
  const slug = $derived(
    models.some((m) => m.slug === chosen) ? chosen : (models[0]?.slug ?? ''),
  );

  function picked() {
    const files = [...(input?.files ?? [])];
    // Cleared so that choosing the same file again still counts as a change.
    if (input) input.value = '';
    if (files.length > 0) onImport(files);
  }
</script>

<details class="menu" use:menuBehaviour data-testid="import-export-menu">
  <summary>Import / Export</summary>
  <div class="menu-list right">
    <div class="menu-heading">Import</div>
    <button
      type="button"
      onclick={() => input?.click()}
      data-testid="import-files"
      title="Open a .mkmodel.json, .mkbundle or .mktool file"
      >Import file(s)…</button
    >
    <div class="menu-sep"></div>
    <div class="menu-heading">Export</div>
    <div class="pick" data-keep-open>
      <label>
        Model
        <select
          value={slug}
          onchange={(e) => (chosen = e.currentTarget.value)}
          disabled={models.length === 0}
          data-testid="export-model-choice"
        >
          {#each models as m (m.slug)}<option value={m.slug}>{m.name}</option
            >{/each}
        </select>
      </label>
    </div>
    <button
      type="button"
      disabled={slug === ''}
      onclick={() => onExportModel(slug)}
      data-testid="export-model-file"
      title="Save the model as an editable .mkmodel.json file"
      >Model file</button
    >
    <button
      type="button"
      disabled={slug === ''}
      onclick={() => onExportBundle(slug)}
      data-testid="export-bundle"
      title="Save the model and its tool library in one .mkbundle file"
      >Bundle (model and tool library)</button
    >
    <button
      type="button"
      disabled={slug === ''}
      onclick={() => onExportCsv(slug)}
      data-testid="export-csv"
      title="Save the model as CSV files for a spreadsheet">CSV files</button
    >
  </div>
</details>
<input
  bind:this={input}
  type="file"
  multiple
  accept={IMPORT_ACCEPT}
  class="visually-hidden"
  tabindex="-1"
  aria-label="Files to import"
  onchange={picked}
  data-testid="import-input"
/>

<style>
  .pick {
    padding: var(--gap-1) var(--gap-2) var(--gap-2);
  }
  .pick label {
    display: grid;
    gap: var(--gap-1);
  }
  .pick select {
    width: 100%;
  }
</style>
