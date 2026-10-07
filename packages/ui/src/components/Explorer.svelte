<script lang="ts">
  import type { ModelEntry } from '@metakit-app/storage';
  import { buildExplorerTree, folderPaths } from '../shell/explorer';
  import FolderTree from './FolderTree.svelte';

  let {
    workspaceName,
    models,
    trashed,
    toolCount,
    warnings,
    error,
    onNew,
    onAddTool,
    onOpen,
    onRename,
    onMove,
    onTrash,
    onRestore,
    onClose,
  }: {
    workspaceName: string;
    models: ModelEntry[];
    trashed: ModelEntry[];
    toolCount: number;
    warnings: string[];
    error: string | null;
    onNew: () => void;
    /** Called with the text of a tool library file the user chose. */
    onAddTool: (text: string) => void;
    onOpen: (slug: string) => void;
    onRename: (slug: string, name: string) => void;
    onMove: (slug: string, folder: string) => void;
    onTrash: (slug: string) => void;
    onRestore: (slug: string) => void;
    onClose: () => void;
  } = $props();

  let fileInput: HTMLInputElement | undefined = $state();

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
        {models.length} model{models.length === 1 ? '' : 's'}, {toolCount} tool librar{toolCount ===
        1
          ? 'y'
          : 'ies'}
      </p>
    </div>
    <div class="buttons">
      <button class="primary" onclick={onNew} data-testid="new-model"
        >New model</button
      >
      <button onclick={() => fileInput?.click()} data-testid="add-tool"
        >Add tool library</button
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

  {#if error}<p role="alert" class="notice error" data-testid="explorer-error">
      {error}
    </p>{/if}
  {#if error === null && toolCount === 0}
    <p class="notice" data-testid="no-tools">
      This workspace has no tool library yet. Choose "Add tool library" and pick
      a tool library file, for example <code>tools/bpmn-lite/tool.json</code> from
      the MetaKit repository.
    </p>
  {/if}
  {#each warnings as warning (warning)}<p class="notice">{warning}</p>{/each}

  {#if models.length === 0}
    <p class="empty" data-testid="no-models">
      There are no models yet. Choose "New model" to start one.
    </p>
  {:else}
    <FolderTree node={tree} {folders} {onOpen} {onRename} {onMove} {onTrash} />
  {/if}

  {#if trashed.length > 0}
    <details class="trash">
      <summary>Deleted models ({trashed.length})</summary>
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
</style>
