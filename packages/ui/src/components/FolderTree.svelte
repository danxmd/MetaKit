<script lang="ts">
  import type { ModelEntry, KitEntry } from '@metakit-app/storage';
  import type { FolderNode } from '../shell/explorer';
  import { menuBehaviour } from '../shell/menu-action';
  import FolderTree from './FolderTree.svelte';

  let {
    node,
    depth = 0,
    folders,
    kits = [],
    onOpen,
    onRename,
    onMove,
    onTrash,
  }: {
    node: FolderNode;
    depth?: number;
    folders: string[];
    /** Used to show which Kit and version each model uses. */
    kits?: KitEntry[];
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

  const kitOf = (model: ModelEntry) => kits.find((t) => t.id === model.kit);
</script>

<ul class="tree" class:top={depth === 0} role={depth === 0 ? 'tree' : 'group'}>
  {#each node.models as model (model.slug)}
    <li
      class="row"
      role="treeitem"
      aria-selected="false"
      data-testid="model-{model.slug}"
    >
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
          <button type="button" onclick={() => (editing = null)}>Cancel</button>
          <button type="submit" class="primary">Save</button>
        </form>
      {:else}
        <button class="name" onclick={() => onOpen(model.slug)}
          >{model.name}</button
        >
        <span class="meta muted">
          {#if kitOf(model)}{kitOf(model)!.name}
            <span class="badge">{kitOf(model)!.version}</span>{:else}Kit not
            found{/if}
        </span>
        <details
          class="menu more"
          use:menuBehaviour
          data-testid="model-actions-{model.slug}"
        >
          <summary aria-label="Actions for {model.name}">…</summary>
          <div class="menu-list right">
            <button
              type="button"
              onclick={() => begin(model, 'rename')}
              aria-label="Rename {model.name}">Rename</button
            >
            <button
              type="button"
              onclick={() => begin(model, 'move')}
              aria-label="Move {model.name} to a folder">Move to folder…</button
            >
            <div class="menu-sep"></div>
            <button
              type="button"
              onclick={() => onTrash(model.slug)}
              aria-label="Delete {model.name}">Delete</button
            >
          </div>
        </details>
      {/if}
    </li>
  {/each}
  {#each node.folders as folder (folder.path)}
    <li
      class="folder"
      role="treeitem"
      aria-expanded="true"
      aria-selected="false"
    >
      <details open>
        <summary data-testid="folder-{folder.path}">{folder.name}</summary>
        <FolderTree
          node={folder}
          depth={depth + 1}
          {folders}
          {kits}
          {onOpen}
          {onRename}
          {onMove}
          {onTrash}
        />
      </details>
    </li>
  {/each}
</ul>

<style>
  .tree {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tree.top {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-s);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--gap-3);
    padding: var(--gap-2) var(--gap-3);
    border-top: 1px solid var(--line);
  }
  .tree > :first-child {
    border-top: 0;
  }
  .row:hover {
    background: var(--hover-bg);
  }
  .name {
    border: 0;
    background: none;
    padding: var(--gap-1) 0;
    text-align: left;
    color: var(--text-strong);
    font-size: var(--text-m);
    font-weight: 600;
    min-height: 0;
  }
  .name:hover:not(:disabled) {
    background: none;
    color: var(--accent);
  }
  .meta {
    flex: 1;
    font-size: var(--text-s);
    text-align: right;
  }
  .edit {
    display: flex;
    flex: 1;
    gap: var(--gap-2);
  }
  .edit input {
    flex: 1;
  }
  details.more > summary::after {
    content: none;
  }
  .folder {
    border-top: 1px solid var(--line);
  }
  .folder > details > summary {
    cursor: pointer;
    padding: var(--gap-2) var(--gap-3);
    font-size: var(--text-s);
    font-weight: 650;
    color: var(--text-muted);
    background: var(--surface-2);
  }
  .folder > details > :global(.tree) {
    padding-left: var(--gap-4);
  }
</style>
