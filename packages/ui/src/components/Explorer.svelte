<script lang="ts">
  import type {
    HealthFinding,
    ModelEntry,
    ToolEntry,
  } from '@metakit-app/storage';
  import { buildExplorerTree, folderPaths } from '../shell/explorer';
  import FolderTree from './FolderTree.svelte';

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
    onOpen,
    onRename,
    onMove,
    onTrash,
    onRestore,
    onTrashTool,
    onRestoreTool,
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
    onOpen: (slug: string) => void;
    onRename: (slug: string, name: string) => void;
    onMove: (slug: string, folder: string) => void;
    onTrash: (slug: string) => void;
    onRestore: (slug: string) => void;
    onTrashTool: (slug: string) => void;
    onRestoreTool: (slug: string) => void;
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
        {models.length} model{models.length === 1 ? '' : 's'}, {tools.length} tool
        librar{tools.length === 1 ? 'y' : 'ies'}
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
  {#if error === null && tools.length === 0}
    <p class="notice" data-testid="no-tools">
      This workspace has no tool library yet. Choose "Add tool library" and pick
      a tool library file, for example <code>tools/bpmn-lite/tool.json</code> from
      the MetaKit repository.
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
  .tools ul {
    list-style: none;
    padding-left: 1rem;
  }
</style>
