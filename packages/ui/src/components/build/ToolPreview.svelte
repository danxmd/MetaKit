<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import {
    CanvasView,
    Editor,
    Scene,
    type EditorTool,
  } from '@metakit-app/canvas';
  import {
    createEmptyModel,
    createModelStore,
    type Model,
    type ModelStore,
    type ModelTypeId,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { labelOf, paletteFor } from '../../shell/palette';

  let { tool }: { tool: ToolLibrary } = $props();

  let host: HTMLDivElement;
  let store: ModelStore | null = null;
  let scene: Scene | null = null;
  let view: CanvasView | null = null;
  let editor: Editor | null = null;
  let chosen = $state<string>('');
  let activeTool = $state<EditorTool>({ type: 'select' });
  let note = $state('');

  const modelTypes = $derived(
    Object.values(tool.modelTypes).sort((a, b) => a.key.localeCompare(b.key)),
  );
  const modelType = $derived(
    modelTypes.find((m) => m.id === chosen) ?? modelTypes[0],
  );
  const palette = $derived(
    modelType ? paletteFor(tool, modelType, null) : null,
  );

  function teardown() {
    editor?.destroy();
    view?.destroy();
    editor = view = scene = store = null;
  }

  /** Builds the preview again with the current tool library, keeping what was drawn. */
  function mount(previous: Model | null) {
    teardown();
    if (!modelType || !host) return;
    const model: Model =
      previous && previous.manifest.modelType === modelType.id
        ? {
            ...previous,
            manifest: {
              ...previous.manifest,
              toolVersion: tool.manifest.version,
            },
          }
        : createEmptyModel(tool, modelType.id as ModelTypeId, {
            name: 'Preview',
          });
    store = createModelStore(model, { tool });
    scene = new Scene(model, tool);
    scene.attach(store);
    view = new CanvasView(host, scene, { grid: tool.settings.grid });
    editor = new Editor({
      store,
      tool,
      view,
      allowedRelations: () => palette?.relationIds ?? new Set(),
      host: {
        onToolChange: (t) => (activeTool = t),
        onMessage: (text) => (note = text),
      },
    });
    editor.setTool(activeTool);
    view.fit();
  }

  let mounted = false;
  onMount(() => {
    mounted = true;
    mount(null);
  });
  onDestroy(teardown);

  // Every change to the tool library redraws the preview at once: this is the hot reload.
  $effect(() => {
    void tool;
    void modelType?.id;
    if (!mounted) return;
    untrack(() => mount((store?.state as Model | undefined) ?? null));
  });

  const place = (cls: string) => {
    editor?.setTool({ type: 'place', class: cls as never });
  };
</script>

<aside class="preview" data-testid="tool-preview">
  <header>
    <strong>Try it</strong>
    {#if modelTypes.length > 1}
      <select bind:value={chosen} aria-label="Model type to try">
        {#each modelTypes as m (m.id)}<option value={m.id}>{m.key}</option
          >{/each}
      </select>
    {/if}
  </header>
  {#if !modelType}
    <p class="muted">Add a model type to try the tool here.</p>
  {:else if palette && palette.classes.length === 0}
    <p class="muted">Allow a class in the model type to place it here.</p>
  {/if}
  {#if palette}
    <div class="tools">
      <button
        type="button"
        class:on={activeTool.type === 'select'}
        onclick={() => editor?.setTool({ type: 'select' })}>Select</button
      >
      {#each palette.classes as c (c.id)}
        <button
          type="button"
          class:on={activeTool.type === 'place' && activeTool.class === c.id}
          onclick={() => place(c.id)}
          data-testid="preview-place-{c.key}">{labelOf(c)}</button
        >
      {/each}
      {#each palette.relations as r (r.id)}
        <button
          type="button"
          class:on={activeTool.type === 'connect' &&
            activeTool.relation === r.id}
          onclick={() => editor?.setTool({ type: 'connect', relation: r.id })}
          data-testid="preview-connect-{r.key}">{labelOf(r)}</button
        >
      {/each}
    </div>
  {/if}
  <div class="canvas" bind:this={host} data-testid="preview-canvas"></div>
  {#if note}<p class="muted">{note}</p>{/if}
  <p class="muted">
    Nothing here is saved. It shows the tool as you change it.
  </p>
</aside>

<style>
  .preview {
    display: grid;
    grid-template-rows: auto auto 1fr auto auto;
    gap: 0.4rem;
    min-height: 0;
    height: 100%;
  }
  header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .tools {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .tools .on {
    background: #e7f5ff;
    border-color: #1971c2;
  }
  .canvas {
    border: 1px solid var(--line);
    border-radius: 6px;
    min-height: 12rem;
    position: relative;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0;
  }
</style>
