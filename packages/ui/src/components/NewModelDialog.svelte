<script lang="ts">
  import { DocsLayer, pushDocsContext } from '../docs/context';
  import { onMount } from 'svelte';
  import type { KitEntry } from '@metakit-app/storage';
  import type { ModelTypeDef, ModelTypeId } from '@metakit-app/core';

  let {
    kits,
    builtIns = [],
    loadModelTypes,
    folders,
    initialFolder,
    onCreate,
    onCancel,
  }: {
    kits: KitEntry[];
    /**
     * Built-in Kits that are not in the workspace yet. Their `key` is passed as the
     * kit slug; the caller adds the library before it creates the model.
     */
    builtIns?: { key: string; name: string; version: string }[];
    /** Reads the model types of a Kit (a workspace slug or a built-in key). */
    loadModelTypes: (kitSlug: string) => Promise<ModelTypeDef[]>;
    folders: string[];
    initialFolder: string;
    onCreate: (input: {
      kitSlug: string;
      modelType: ModelTypeId;
      name: string;
      folder: string;
    }) => void;
    onCancel: () => void;
  } = $props();

  let kitSlug = $state('');
  let types = $state<ModelTypeDef[]>([]);
  let modelType = $state('');
  let name = $state('');
  let folder = $state('');
  let problem = $state('');
  let dialog: HTMLDialogElement | undefined = $state();

  // Set once. An effect that read `initialFolder` and `kits` would run again whenever the
  // explorer refreshed its lists, and wipe what the user had already typed.
  onMount(() => {
    folder = initialFolder;
    dialog?.showModal();
  });

  $effect(() => {
    // The workspace's own library is the obvious choice, even with built-in ones listed.
    if (kits.length === 1 && kitSlug === '') kitSlug = kits[0]!.slug;
  });

  $effect(() => {
    const slug = kitSlug;
    if (!slug) {
      types = [];
      return;
    }
    let current = true;
    loadModelTypes(slug).then(
      (loaded) => {
        if (!current) return;
        types = loaded;
        modelType = loaded.length === 1 ? loaded[0]!.id : '';
        problem = '';
      },
      (error: unknown) => {
        if (current)
          problem = error instanceof Error ? error.message : String(error);
      },
    );
    return () => (current = false);
  });

  const ready = $derived(
    kitSlug !== '' && modelType !== '' && name.trim() !== '',
  );

  function submit(event: Event) {
    event.preventDefault();
    if (!ready) return;
    onCreate({ kitSlug, modelType: modelType as ModelTypeId, name, folder });
  }

  // Tells Help which dialog is open.
  $effect(() => pushDocsContext('dialog.new-model', DocsLayer.dialog));
</script>

<dialog bind:this={dialog} onclose={onCancel} data-testid="new-model-dialog">
  <form onsubmit={submit}>
    <div class="head">
      <h2>New model</h2>
      <p class="muted">A model is made with a Kit.</p>
    </div>
    {#if kits.length === 0 && builtIns.length === 0}
      <p class="notice warning">
        This workspace has no Kit yet. Add one in Build mode, or copy a Kit
        folder into <code>tools/</code>.
      </p>
    {:else}
      <label>
        Kit
        <select bind:value={kitSlug} data-testid="new-model-kit">
          <option value="" disabled>Choose a Kit</option>
          {#if builtIns.length > 0 && kits.length > 0}
            <optgroup label="In this workspace">
              {#each kits as kit (kit.slug)}
                <option value={kit.slug}>{kit.name} ({kit.version})</option>
              {/each}
            </optgroup>
          {:else}
            {#each kits as kit (kit.slug)}
              <option value={kit.slug}>{kit.name} ({kit.version})</option>
            {/each}
          {/if}
          {#if builtIns.length > 0}
            <optgroup
              label="Built-in (added to this workspace when you create)"
            >
              {#each builtIns as b (b.key)}
                <option value={b.key}>{b.name} ({b.version})</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </label>
      <label>
        Model type
        <select
          bind:value={modelType}
          disabled={types.length === 0}
          data-testid="new-model-type"
        >
          <option value="" disabled>Choose a model type</option>
          {#each types as type (type.id)}
            <option value={type.id}>{type.labels['en'] ?? type.key}</option>
          {/each}
        </select>
      </label>
      <label>
        Name
        <input bind:value={name} data-testid="new-model-name" />
      </label>
      <label>
        Folder (optional)
        <input
          bind:value={folder}
          list="folder-list"
          placeholder="for example Sales/2026"
        />
        <datalist id="folder-list">
          {#each folders as f (f)}<option value={f}></option>{/each}
        </datalist>
      </label>
    {/if}
    {#if problem}<p role="alert" class="notice error">{problem}</p>{/if}
    <div class="actions">
      <button type="button" onclick={() => dialog?.close()}>Cancel</button>
      <button
        class="primary"
        type="submit"
        disabled={!ready}
        data-testid="new-model-create"
      >
        Create
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(26rem, calc(100vw - 2rem));
  }
  form {
    display: grid;
    gap: var(--gap-4);
  }
  .head {
    display: grid;
    gap: var(--gap-1);
  }
  .head p {
    font-size: var(--text-s);
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
  }
  .notice {
    margin: 0;
  }
</style>
