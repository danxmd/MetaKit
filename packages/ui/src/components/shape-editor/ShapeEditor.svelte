<script lang="ts">
  import { untrack } from 'svelte';
  import { ImageCache } from '@metakit-app/canvas';
  import type {
    AttributeDef,
    NodeShape,
    ShapeDef,
    ShapeId,
  } from '@metakit-app/core';
  import type { EditablePartType } from '@metakit-app/shapes';
  import { withoutLook } from '../../build/appearance-model';
  import { ShapeEditorModel } from '../../build/shape-editor-model';
  import Gallery from './Gallery.svelte';
  import LayerList from './LayerList.svelte';
  import PreviewStrip from './PreviewStrip.svelte';
  import PropertiesPanel from './PropertiesPanel.svelte';
  import ShapeCanvas from './ShapeCanvas.svelte';
  import SvgImport from './SvgImport.svelte';

  let {
    shape,
    attributes,
    className,
    shapes,
    resolveAsset,
    onChange,
    onClose,
  }: {
    /** The shape to edit. It seeds the editor; open another shape with a new `{#key}`. */
    shape: NodeShape;
    /** Effective attributes of the class the shape is previewed for; may be empty. */
    attributes: AttributeDef[];
    className: string;
    /** Looks up other shapes, for parts that embed one. */
    shapes: (id: ShapeId) => ShapeDef | undefined;
    /** Turns an `assets/` path into a loadable address; data URIs need no help. */
    resolveAsset?: (src: string) => string | null;
    /** Called with the whole shape after every edit, so a change shows in the model at once. */
    onChange: (shape: NodeShape) => void;
    onClose: () => void;
  } = $props();

  // The draft belongs to the editor from here on; later changes of `shape` (the echo of our own
  // onChange, for one) must not reset it.
  const model = untrack(
    () =>
      new ShapeEditorModel({
        // Editing as a drawing makes the shape hand-drawn: the saved shape has no simple look.
        shape: withoutLook(shape),
        attributes,
        className,
        shapes: (id) => shapes(id),
      }),
  );
  const images = new ImageCache(untrack(() => resolveAsset));

  let version = $state(0);

  $effect(() => {
    images.onLoaded = () => version++;
    return () => (images.onLoaded = null);
  });
  $effect(() => model.subscribe(() => version++));
  $effect(() => model.onChange((s) => onChange(s)));
  $effect(() => {
    const a = attributes;
    const c = className;
    untrack(() => model.setAttributes(a, c));
  });

  const canUndo = $derived.by(() => {
    void version;
    return model.canUndo;
  });
  const canRedo = $derived.by(() => {
    void version;
    return model.canRedo;
  });
  const hasSelection = $derived.by(() => {
    void version;
    return model.selection !== null;
  });

  const ADD: { type: EditablePartType; label: string }[] = [
    { type: 'rect', label: 'Rectangle' },
    { type: 'ellipse', label: 'Ellipse' },
    { type: 'polygon', label: 'Polygon' },
    { type: 'text', label: 'Text' },
    { type: 'image', label: 'Image' },
  ];

  function save() {
    onChange(model.draft);
    onClose();
  }

  function keydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    onClose();
  }
</script>

<svelte:window onkeydown={keydown} />

<div
  class="editor"
  role="group"
  aria-label={`Advanced drawing editor for ${className}`}
  data-testid="shape-editor"
>
  <header class="toolbar">
    <h2 class="title" data-testid="shape-editor-title">
      Advanced drawing editor
    </h2>
    <div class="group" role="group" aria-label="Add a part">
      {#each ADD as a (a.type)}
        <button
          type="button"
          data-testid={`shape-add-${a.type}`}
          onclick={() => model.addPart(a.type)}
        >
          Add {a.label.toLowerCase()}
        </button>
      {/each}
    </div>
    <div class="group" role="group" aria-label="Edit">
      <button
        type="button"
        disabled={!hasSelection}
        data-testid="shape-duplicate"
        onclick={() => model.duplicateSelected()}
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={!hasSelection}
        data-testid="shape-delete"
        onclick={() => model.removeSelected()}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={!canUndo}
        data-testid="shape-undo"
        onclick={() => model.undo()}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!canRedo}
        data-testid="shape-redo"
        onclick={() => model.redo()}
      >
        Redo
      </button>
    </div>
    <div class="group end">
      <button type="button" data-testid="shape-close" onclick={onClose}>
        Close
      </button>
      <button
        type="button"
        class="primary"
        data-testid="shape-save"
        onclick={save}
      >
        Save and close
      </button>
    </div>
  </header>

  <aside class="left">
    <LayerList {model} {version} />
    <Gallery {images} onPick={(id) => model.addFromGallery(id)} />
    <SvgImport onImport={(text, mode) => model.importSvg(text, mode)} />
  </aside>

  <main class="centre">
    <ShapeCanvas {model} {version} {images} />
    <PreviewStrip {model} {version} {images} />
  </main>

  <aside class="right">
    <PropertiesPanel {model} {version} />
  </aside>
</div>

<style>
  .editor {
    display: grid;
    grid-template-columns: 18rem minmax(0, 1fr) 25rem;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.75rem;
    height: 100%;
    min-height: 0;
    padding: 0.75rem;
    box-sizing: border-box;
  }
  .toolbar {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }
  .title {
    margin: 0;
    font-size: var(--text-m);
  }
  .group {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .group.end {
    margin-left: auto;
  }
  .left,
  .right,
  .centre {
    display: grid;
    gap: 1rem;
    align-content: start;
    overflow: auto;
    min-height: 0;
  }
  .left {
    padding-right: 0.25rem;
    grid-template-columns: minmax(0, 1fr);
  }
  .centre,
  .right {
    grid-template-columns: minmax(0, 1fr);
  }
</style>
