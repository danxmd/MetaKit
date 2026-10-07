<script lang="ts">
  import { IMPORT_ACCEPT } from '../shell/files';

  let {
    onExportModel,
    onExportBundle,
    onExportCsv,
    onImport,
    hasModel = true,
  }: {
    onExportModel: () => void;
    onExportBundle: () => void;
    onExportCsv: () => void;
    onImport: (files: File[]) => void;
    /** Turn the export buttons off while no model is chosen. */
    hasModel?: boolean;
  } = $props();

  let input: HTMLInputElement | undefined = $state();

  function chosen() {
    const files = [...(input?.files ?? [])];
    // Cleared so that choosing the same file again still counts as a change.
    if (input) input.value = '';
    if (files.length > 0) onImport(files);
  }
</script>

<div
  class="menu"
  role="group"
  aria-label="Import and export"
  data-testid="import-export-menu"
>
  <button
    type="button"
    disabled={!hasModel}
    onclick={onExportModel}
    data-testid="export-model-file"
    title="Save the model as an editable .mkmodel.json file"
  >
    Export model file
  </button>
  <button
    type="button"
    disabled={!hasModel}
    onclick={onExportBundle}
    data-testid="export-bundle"
    title="Save the model and its tool library in one .mkbundle file"
  >
    Export bundle
  </button>
  <button
    type="button"
    disabled={!hasModel}
    onclick={onExportCsv}
    data-testid="export-csv"
    title="Save the model as CSV files for a spreadsheet"
  >
    Export CSV
  </button>
  <button
    type="button"
    onclick={() => input?.click()}
    data-testid="import-files"
    title="Open a .mkmodel.json, .mkbundle or .mktool file"
  >
    Import file(s)
  </button>
  <input
    bind:this={input}
    type="file"
    multiple
    accept={IMPORT_ACCEPT}
    class="visually-hidden"
    tabindex="-1"
    aria-label="Files to import"
    onchange={chosen}
    data-testid="import-input"
  />
</div>

<style>
  .menu {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
