<script lang="ts">
  import type { ModelEntry } from '@metakit-app/storage';
  import type { FolderNode } from '../shell/explorer';
  import FolderTree from './FolderTree.svelte';

  let {
    node,
    depth = 0,
    folders,
    onOpen,
    onRename,
    onMove,
    onTrash,
  }: {
    node: FolderNode;
    depth?: number;
    folders: string[];
    onOpen: (slug: string) => void;
    onRename: (slug: string, name: string) => void;
    onMove: (slug: string, folder: string) => void;
    onTrash: (slug: string) => void;
  } = $props();

  let editing = $state<{
    slug: string;
    kind: 'rename' | 'move';
    text: string;
  } | null>(null);

  function begin(model: ModelEntry, kind: 'rename' | 'move') {
    editing = {
      slug: model.slug,
      kind,
      text: kind === 'rename' ? model.name : (model.folder ?? ''),
    };
  }

  function commit() {
    if (!editing) return;
    const { slug, kind, text } = editing;
    editing = null;
    if (kind === 'rename') onRename(slug, text);
    else onMove(slug, text);
  }
</script>

<ul class="tree" role={depth === 0 ? 'tree' : 'group'}>
  {#each node.folders as folder (folder.path)}
    <li role="treeitem" aria-expanded="true" aria-selected="false">
      <details open>
        <summary data-testid="folder-{folder.path}">{folder.name}</summary>
        <FolderTree
          node={folder}
          depth={depth + 1}
          {folders}
          {onOpen}
          {onRename}
          {onMove}
          {onTrash}
        />
      </details>
    </li>
  {/each}
  {#each node.models as model (model.slug)}
    <li role="treeitem" aria-selected="false" data-testid="model-{model.slug}">
      {#if editing && editing.slug === model.slug}
        <form
          class="edit"
          onsubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <input
            bind:value={editing.text}
            list={editing.kind === 'move' ? 'move-folders' : undefined}
            aria-label={editing.kind === 'rename' ? 'New name' : 'Folder'}
            placeholder={editing.kind === 'move'
              ? 'Folder, or empty for the top level'
              : ''}
          />
          <datalist id="move-folders">
            {#each folders as f (f)}<option value={f}></option>{/each}
          </datalist>
          <button type="submit" class="primary">Save</button>
          <button type="button" onclick={() => (editing = null)}>Cancel</button>
        </form>
      {:else}
        <div class="model">
          <button class="name" onclick={() => onOpen(model.slug)}
            >{model.name}</button
          >
          <span class="actions">
            <button
              onclick={() => begin(model, 'rename')}
              aria-label="Rename {model.name}">Rename</button
            >
            <button
              onclick={() => begin(model, 'move')}
              aria-label="Move {model.name} to a folder">Move</button
            >
            <button
              onclick={() => onTrash(model.slug)}
              aria-label="Delete {model.name}">Delete</button
            >
          </span>
        </div>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .tree {
    list-style: none;
    margin: 0;
    padding-left: 1rem;
  }
  .tree:first-child {
    padding-left: 0;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    padding: 0.2rem 0;
  }
  .model {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.15rem 0;
  }
  .name {
    border: none;
    background: none;
    padding: 0.15rem 0.3rem;
    text-align: left;
    color: var(--accent);
    cursor: pointer;
    font-size: 1rem;
  }
  .name:hover {
    text-decoration: underline;
  }
  .actions {
    display: none;
    gap: 0.25rem;
  }
  .model:hover .actions,
  .model:focus-within .actions {
    display: inline-flex;
  }
  .actions button {
    font-size: 0.8rem;
    padding: 0.1rem 0.4rem;
  }
  .edit {
    display: flex;
    gap: 0.4rem;
    padding: 0.2rem 0;
  }
</style>
