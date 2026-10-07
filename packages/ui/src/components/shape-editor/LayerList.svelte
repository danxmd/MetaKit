<script lang="ts">
  import type { Part } from '@metakit-app/core';
  import { describePart, pathKey, type PartPath } from '@metakit-app/shapes';
  import type { ShapeEditorModel } from '../../build/shape-editor-model';

  let { model, version }: { model: ShapeEditorModel; version: number } =
    $props();

  interface Entry {
    path: PartPath;
    part: Part;
    depth: number;
    /** Position among its siblings, front first. */
    last: boolean;
    first: boolean;
  }

  // The front part is listed first, as in most drawing tools.
  function flatten(parts: Part[], prefix: number[], depth: number): Entry[] {
    const out: Entry[] = [];
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i]!;
      out.push({
        path: [...prefix, i],
        part,
        depth,
        first: i === parts.length - 1,
        last: i === 0,
      });
      if (part.type === 'group')
        out.push(...flatten(part.parts, [...prefix, i], depth + 1));
    }
    return out;
  }

  const entries = $derived.by(() => {
    void version;
    return flatten(model.draft.parts, [], 0);
  });
  const selectedKeys = $derived.by(() => {
    void version;
    return new Set(model.selectedPaths.map(pathKey));
  });
  const canGroup = $derived(selectedKeys.size > 0);
  const canUngroup = $derived.by(() => {
    void version;
    return model.selectedPart?.type === 'group';
  });

  function pick(e: MouseEvent, path: PartPath) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) model.toggleSelect(path);
    else model.select(path);
  }
</script>

<section class="layers" aria-label="Layers" data-testid="shape-layers">
  <div class="head">
    <h3>Layers</h3>
    <button
      type="button"
      disabled={!canGroup}
      onclick={() => model.groupSelected()}
      data-testid="shape-group"
    >
      Group
    </button>
    <button
      type="button"
      disabled={!canUngroup}
      onclick={() => model.ungroupSelected()}
      data-testid="shape-ungroup"
    >
      Ungroup
    </button>
  </div>
  {#if entries.length === 0}
    <p class="hint" data-testid="shape-layers-empty">
      Nothing drawn yet. Add a part with the buttons above.
    </p>
  {:else}
    <ul>
      {#each entries as e (pathKey(e.path))}
        {@const key = pathKey(e.path)}
        {@const name = describePart(e.part)}
        <li
          class:selected={selectedKeys.has(key)}
          style:padding-left={`${e.depth * 14}px`}
        >
          <input
            type="checkbox"
            checked={model.isVisibleFixed(e.path)}
            aria-label={`Show ${name}`}
            title="Show or hide"
            data-testid={`shape-layer-visible-${key}`}
            onchange={(ev) =>
              model.setVisible(e.path, ev.currentTarget.checked)}
          />
          <button
            type="button"
            class="name"
            aria-pressed={selectedKeys.has(key)}
            data-testid={`shape-layer-${key}`}
            onclick={(ev) => pick(ev, e.path)}
          >
            {name}
          </button>
          <button
            type="button"
            disabled={e.first}
            aria-label={`Bring ${name} forward`}
            title="Move up"
            data-testid={`shape-layer-up-${key}`}
            onclick={() => model.reorder(e.path, 'up')}
          >
            Up
          </button>
          <button
            type="button"
            disabled={e.last}
            aria-label={`Send ${name} back`}
            title="Move down"
            data-testid={`shape-layer-down-${key}`}
            onclick={() => model.reorder(e.path, 'down')}
          >
            Down
          </button>
          <button
            type="button"
            aria-label={`Delete ${name}`}
            title="Delete"
            data-testid={`shape-layer-delete-${key}`}
            onclick={() => model.remove(e.path)}
          >
            Delete
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .layers {
    display: grid;
    gap: 0.4rem;
    align-content: start;
    min-height: 0;
  }
  .head {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
    flex: 1;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    overflow: auto;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 6px;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  li.selected {
    background: var(--hover, #e9ecef);
  }
  .name {
    flex: 1;
    text-align: left;
    border-color: transparent;
    background: transparent;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  li button:not(.name) {
    padding: 0.1rem 0.35rem;
    font-size: 0.75rem;
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted, #6b7280);
  }
</style>
