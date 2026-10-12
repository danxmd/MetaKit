<script lang="ts">
  import type {
    HealthFinding,
    ModelEntry,
    KitEntry,
  } from '@metakit-app/storage';
  import { buildExplorerTree, folderPaths } from '../shell/explorer';
  import type { FindAllHit } from '../shell/find-all';
  import FindAll from './FindAll.svelte';
  import FolderTree from './FolderTree.svelte';
  import ImportExportMenu from './ImportExportMenu.svelte';
  import PageFrame from './PageFrame.svelte';
  import WorkspaceNotices from './WorkspaceNotices.svelte';

  let {
    models,
    trashed,
    kits,
    health,
    warnings,
    error,
    notes = [],
    onNew,
    onGoBuild,
    onOpen,
    onRename,
    onMove,
    onTrash,
    onRestore,
    search,
    onOpenHit,
    onExportModel,
    onExportBundle,
    onExportCsv,
    onImport,
  }: {
    models: ModelEntry[];
    trashed: ModelEntry[];
    kits: KitEntry[];
    health: HealthFinding[];
    warnings: string[];
    error: string | null;
    notes?: string[];
    onNew: () => void;
    /** Switches to Build mode, where Kits are made and added. */
    onGoBuild: () => void;
    onOpen: (slug: string) => void;
    onRename: (slug: string, name: string) => void;
    onMove: (slug: string, folder: string) => void;
    onTrash: (slug: string) => void;
    onRestore: (slug: string) => void;
    /** Find across all models of the workspace. */
    search: (query: string) => Promise<FindAllHit[]>;
    onOpenHit: (hit: FindAllHit) => void;
    onExportModel: (slug: string) => void;
    onExportBundle: (slug: string) => void;
    onExportCsv: (slug: string) => void;
    onImport: (files: File[]) => void;
  } = $props();

  const tree = $derived(buildExplorerTree(models));
  const folders = $derived(folderPaths(models));
</script>

<PageFrame
  title="Models"
  help="Models are made with a Kit. Open one to draw and edit it."
  testid="models-page"
>
  {#snippet actions()}
    <ImportExportMenu
      {models}
      {onExportModel}
      {onExportBundle}
      {onExportCsv}
      {onImport}
    />
    <button
      class="primary"
      onclick={onNew}
      data-testid="new-model"
      data-tour="models-new">New model</button
    >
  {/snippet}

  <WorkspaceNotices {error} {warnings} {notes} {health} />

  {#if models.length === 0}
    <section class="card empty" data-testid="no-models">
      {#if kits.length === 0}
        <h2>No models yet</h2>
        <p class="muted">
          A model is made with a Kit, which says which kinds of objects and
          connections it can have. This workspace has no Kit of its own yet:
          pick a built-in one in New model, or build your own in Build.
        </p>
        <div class="row">
          <button class="primary" onclick={onNew} data-testid="new-model-empty"
            >New model</button
          >
          <button onclick={onGoBuild} data-testid="go-build">Go to Build</button
          >
        </div>
      {:else}
        <h2>No models yet</h2>
        <p class="muted">
          Create one from a Kit, or import a model file with Import / Export.
        </p>
        <div class="row">
          <button class="primary" onclick={onNew} data-testid="new-model-empty"
            >New model</button
          >
        </div>
      {/if}
    </section>
  {:else}
    <FindAll {search} onOpen={onOpenHit} />
    <FolderTree
      node={tree}
      {folders}
      {kits}
      {onOpen}
      {onRename}
      {onMove}
      {onTrash}
    />
  {/if}

  {#if trashed.length > 0}
    <details class="trash" data-testid="trash" data-tour="models-trash">
      <summary>Deleted ({trashed.length}), kept for 30 days</summary>
      <ul>
        {#each trashed as model (model.slug)}
          <li>
            <span>{model.name}</span>
            <button
              onclick={() => onRestore(model.slug)}
              aria-label="Restore {model.name}">Restore</button
            >
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</PageFrame>

<style>
  .empty {
    padding: var(--gap-6);
    display: grid;
    gap: var(--gap-3);
    justify-items: start;
  }
  .row {
    display: flex;
    gap: var(--gap-2);
  }
  .trash {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .trash summary {
    cursor: pointer;
  }
  .trash ul {
    list-style: none;
    margin: var(--gap-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--gap-1);
  }
  .trash li {
    display: flex;
    align-items: center;
    gap: var(--gap-3);
  }
</style>
