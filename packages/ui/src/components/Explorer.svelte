<script lang="ts">
  import type {
    HealthFinding,
    ModelEntry,
    ToolEntry,
    ToolUpdatePlan,
  } from '@metakit-app/storage';
  import { buildExplorerTree, folderPaths } from '../shell/explorer';
  import type { FindAllHit } from '../shell/find-all';
  import FindAll from './FindAll.svelte';
  import FolderTree from './FolderTree.svelte';
  import ImportExportMenu from './ImportExportMenu.svelte';
  import ToolImportDialog from './ToolImportDialog.svelte';

  let {
    workspaceName,
    models,
    trashed,
    tools,
    trashedTools,
    health,
    warnings,
    error,
    onNew,
    onAddTool,
    onNewTool,
    onEditTool,
    onOpen,
    onRename,
    onMove,
    onTrash,
    onRestore,
    onTrashTool,
    onRestoreTool,
    notes = [],
    toolImport = null,
    search,
    onOpenHit,
    onExportModel,
    onExportBundle,
    onExportCsv,
    onExportTool,
    onImport,
    onConfirmToolImport,
    onCancelToolImport,
    onClose,
  }: {
    workspaceName: string;
    models: ModelEntry[];
    trashed: ModelEntry[];
    tools: ToolEntry[];
    trashedTools: ToolEntry[];
    /** What the check of the folder found, shown as a warning. */
    health: HealthFinding[];
    warnings: string[];
    error: string | null;
    onNew: () => void;
    /** Called with the text of a tool library file the user chose. */
    onAddTool: (text: string) => void;
    /** Makes an empty tool library with this name and opens it in Build mode. */
    onNewTool: (name: string) => Promise<string | undefined>;
    onEditTool: (slug: string) => void;
    onOpen: (slug: string) => void;
    onRename: (slug: string, name: string) => void;
    onMove: (slug: string, folder: string) => void;
    onTrash: (slug: string) => void;
    onRestore: (slug: string) => void;
    onTrashTool: (slug: string) => void;
    onRestoreTool: (slug: string) => void;
    onClose: () => void;
    /** What the last import did. */
    notes?: string[];
    /** A tool library file waiting for confirmation. */
    toolImport?: ToolUpdatePlan | null;
    /** Find across all models of the workspace. */
    search: (query: string) => Promise<FindAllHit[]>;
    onOpenHit: (hit: FindAllHit) => void;
    onExportModel: (slug: string) => void;
    onExportBundle: (slugs: string[]) => void;
    onExportCsv: (slug: string) => void;
    onExportTool: (slug: string) => void;
    onImport: (files: File[]) => void;
    onConfirmToolImport: () => void;
    onCancelToolImport: () => void;
  } = $props();

  // The model and the tool library the export buttons act on.
  let exportSlug = $state('');
  let exportToolSlug = $state('');
  const chosenModel = $derived(
    models.some((m) => m.slug === exportSlug)
      ? exportSlug
      : (models[0]?.slug ?? ''),
  );
  const chosenTool = $derived(
    tools.some((t) => t.slug === exportToolSlug)
      ? exportToolSlug
      : (tools[0]?.slug ?? ''),
  );

  let fileInput: HTMLInputElement | undefined = $state();
  let toolName = $state('');
  let naming = $state(false);

  async function createTool(event: Event) {
    event.preventDefault();
    const slug = await onNewTool(toolName);
    if (slug) {
      toolName = '';
      naming = false;
      onEditTool(slug);
    }
  }

  async function chosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onAddTool(await file.text());
  }

  const tree = $derived(buildExplorerTree(models));
  const folders = $derived(folderPaths(models));
</script>

<main class="explorer">
  <header>
    <div>
      <h1>{workspaceName}</h1>
      <p class="muted">
        {models.length} model{models.length === 1 ? '' : 's'}, {tools.length} tool
        librar{tools.length === 1 ? 'y' : 'ies'}
      </p>
    </div>
    <div class="buttons">
      <button class="primary" onclick={onNew} data-testid="new-model"
        >New model</button
      >
      <button onclick={() => (naming = !naming)} data-testid="new-tool"
        >New tool library</button
      >
      <button onclick={() => fileInput?.click()} data-testid="add-tool"
        >Add tool library file</button
      >
      <input
        bind:this={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onchange={chosen}
        data-testid="tool-file"
      />
      <button onclick={onClose}>Close workspace</button>
    </div>
  </header>

  <section class="files" aria-label="Import and export">
    <label
      >Model to export
      <select bind:value={exportSlug} data-testid="export-model-choice">
        {#each models as m (m.slug)}<option
            value={m.slug}
            selected={m.slug === chosenModel}>{m.name}</option
          >{/each}
      </select></label
    >
    <ImportExportMenu
      hasModel={chosenModel !== ''}
      onExportModel={() => onExportModel(chosenModel)}
      onExportBundle={() => onExportBundle([chosenModel])}
      onExportCsv={() => onExportCsv(chosenModel)}
      {onImport}
    />
    <label
      >Tool library to export
      <select bind:value={exportToolSlug} data-testid="export-tool-choice">
        {#each tools as t (t.slug)}<option
            value={t.slug}
            selected={t.slug === chosenTool}>{t.name}</option
          >{/each}
      </select></label
    >
    <button
      disabled={chosenTool === ''}
      onclick={() => onExportTool(chosenTool)}
      data-testid="export-tool">Export tool library</button
    >
  </section>
  <FindAll {search} onOpen={onOpenHit} />
  {#each notes as note (note)}<p class="notice" data-testid="import-note">
      {note}
    </p>{/each}
  {#if toolImport}
    <ToolImportDialog
      plan={toolImport}
      onConfirm={onConfirmToolImport}
      onCancel={onCancelToolImport}
    />
  {/if}

  {#if naming}
    <form class="naming" onsubmit={createTool}>
      <input
        bind:value={toolName}
        placeholder="Name of the tool library"
        aria-label="Name of the new tool library"
        data-testid="new-tool-name"
      />
      <button class="primary" type="submit" data-testid="new-tool-create"
        >Create and edit</button
      >
    </form>
  {/if}
  {#if error}<p role="alert" class="notice error" data-testid="explorer-error">
      {error}
    </p>{/if}
  {#if error === null && tools.length === 0}
    <p class="notice" data-testid="no-tools">
      This workspace has no tool library yet. Choose "New tool library" to build
      one, or "Add tool library file" and pick a file, for example <code
        >tools/bpmn-lite/tool.json</code
      > from the MetaKit repository.
    </p>
  {/if}
  {#each warnings as warning (warning)}<p class="notice">{warning}</p>{/each}
  {#if health.length > 0}
    <section class="notice health" data-testid="health">
      <strong>The folder may not be set up well for sharing</strong>
      <ul>
        {#each health as finding (finding.kind + (finding.path ?? ''))}
          <li>{finding.message}</li>
        {/each}
      </ul>
      <p class="small">
        MetaKit can only see what the files show, not whether your sync program
        is running. Check its icon, and see the test protocol in the repository
        (<code>docs/phase-3-test-protocol.md</code>) for how to test it.
      </p>
    </section>
  {/if}

  {#if models.length === 0}
    <p class="empty" data-testid="no-models">
      There are no models yet. Choose "New model" to start one.
    </p>
  {:else}
    <FolderTree node={tree} {folders} {onOpen} {onRename} {onMove} {onTrash} />
  {/if}

  {#if tools.length > 0}
    <details class="tools">
      <summary>Tool libraries ({tools.length})</summary>
      <ul>
        {#each tools as tool (tool.slug)}
          <li>
            {tool.name} <span class="muted">{tool.version}</span>
            <button
              onclick={() => onEditTool(tool.slug)}
              aria-label="Edit {tool.name}"
              data-testid="edit-tool-{tool.slug}">Edit</button
            >
            <button
              onclick={() => onTrashTool(tool.slug)}
              aria-label="Delete {tool.name}">Delete</button
            >
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  {#if trashed.length > 0 || trashedTools.length > 0}
    <details class="trash" data-testid="trash">
      <summary
        >Deleted ({trashed.length + trashedTools.length}), kept for 30 days</summary
      >
      <ul>
        {#each trashedTools as tool (tool.slug)}
          <li>
            {tool.name} <span class="muted">(tool library)</span>
            <button
              onclick={() => onRestoreTool(tool.slug)}
              aria-label="Restore {tool.name}">Restore</button
            >
          </li>
        {/each}
      </ul>
      <ul>
        {#each trashed as model (model.slug)}
          <li>
            {model.name}
            <button
              onclick={() => onRestore(model.slug)}
              aria-label="Restore {model.name}">Restore</button
            >
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</main>

<style>
  .explorer {
    max-width: 46rem;
    margin: 2.5rem auto;
    padding: 0 1rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }
  h1 {
    margin: 0;
  }
  .muted {
    color: var(--muted);
    margin: 0.2rem 0 1rem;
  }
  .buttons {
    display: flex;
    gap: 0.5rem;
  }
  .empty {
    padding: 2rem 0;
    color: var(--muted);
  }
  .trash {
    margin-top: 2rem;
    color: var(--muted);
  }
  .trash ul {
    list-style: none;
    padding-left: 1rem;
  }
  .notice {
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    background: #fff4e6;
  }
  .notice.error {
    background: #fff5f5;
    white-space: pre-wrap;
  }
  .health ul {
    margin: 0.3rem 0;
    padding-left: 1.2rem;
  }
  .small {
    font-size: 0.85rem;
    margin: 0.3rem 0 0;
  }
  .tools {
    margin-top: 1.5rem;
    color: var(--muted);
  }
  .naming {
    display: flex;
    gap: 0.5rem;
    margin: 0.6rem 0;
  }
  .naming input {
    flex: 1;
  }
  .tools ul {
    list-style: none;
    padding-left: 1rem;
  }
</style>
