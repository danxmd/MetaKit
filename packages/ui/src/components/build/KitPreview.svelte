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
    type Kit,
  } from '@metakit-app/core';
  import { labelOf, paletteFor } from '../../shell/palette';

  let { kit, onCollapse }: { kit: Kit; onCollapse?: () => void } = $props();

  let host: HTMLDivElement;
  let store: ModelStore | null = null;
  let scene: Scene | null = null;
  let view: CanvasView | null = null;
  let editor: Editor | null = null;
  let chosen = $state<string>('');
  let activeTool = $state<EditorTool>({ type: 'select' });
  let note = $state('');

  const modelTypes = $derived(
    Object.values(kit.modelTypes).sort((a, b) => a.key.localeCompare(b.key)),
  );
  const modelType = $derived(
    modelTypes.find((m) => m.id === chosen) ?? modelTypes[0],
  );
  const palette = $derived(modelType ? paletteFor(kit, modelType, null) : null);

  function teardown() {
    editor?.destroy();
    view?.destroy();
    editor = view = scene = store = null;
  }

  /** Builds the preview again with the current Kit, keeping what was drawn. */
  function mount(previous: Model | null) {
    teardown();
    if (!modelType || !host) return;
    const model: Model =
      previous && previous.manifest.modelType === modelType.id
        ? {
            ...previous,
            manifest: {
              ...previous.manifest,
              toolVersion: kit.manifest.version,
            },
          }
        : createEmptyModel(kit, modelType.id as ModelTypeId, {
            name: 'Preview',
          });
    store = createModelStore(model, { kit });
    scene = new Scene(model, kit);
    scene.attach(store);
    view = new CanvasView(host, scene, { grid: kit.settings.grid });
    editor = new Editor({
      store,
      kit,
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

  // Every change to the Kit redraws the preview at once: this is the hot reload.
  $effect(() => {
    void kit;
    void modelType?.id;
    if (!mounted) return;
    untrack(() => mount((store?.state as Model | undefined) ?? null));
  });

  const place = (cls: string) => {
    editor?.setTool({ type: 'place', class: cls as never });
  };
</script>

<section class="preview" data-testid="kit-preview">
  <header>
    <h2>Try it</h2>
    {#if modelTypes.length > 1}
      <select
        value={modelType?.id}
        onchange={(e) => (chosen = e.currentTarget.value)}
        aria-label="Model type to try"
      >
        {#each modelTypes as m (m.id)}<option value={m.id}>{m.key}</option
          >{/each}
      </select>
    {/if}
    <span class="spacer"></span>
    {#if onCollapse}
      <button
        type="button"
        class="ghost icon"
        onclick={onCollapse}
        title="Hide the preview"
        aria-label="Hide the preview"
        data-testid="preview-collapse">»</button
      >
    {/if}
  </header>
  <p class="muted hint">A live model of your Kit. Nothing here is saved.</p>
  {#if !modelType}
    <div class="empty" data-testid="preview-empty">
      <strong>Nothing to try yet</strong>
      <p class="muted">
        Add a model type under Metamodel, allow some classes in it, and you can
        place and connect objects here as you build.
      </p>
    </div>
  {:else if palette && palette.classes.length === 0}
    <p class="notice warning">
      Allow a class in the model type to place it here.
    </p>
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
</section>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--gap-2);
    min-height: 0;
    flex: 1;
  }
  header {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  .hint {
    font-size: var(--text-s);
  }
  .empty {
    display: grid;
    gap: var(--gap-1);
    padding: var(--gap-4);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: var(--text-s);
  }
  .tools {
    display: flex;
    gap: var(--gap-1);
    flex-wrap: wrap;
  }
  .tools .on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .canvas {
    flex: 1;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--canvas-bg);
    min-height: 12rem;
    position: relative;
    overflow: hidden;
  }
  .muted {
    font-size: var(--text-s);
    margin: 0;
  }
</style>
