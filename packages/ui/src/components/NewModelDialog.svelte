<script lang="ts">
  import { onMount } from 'svelte';
  import type { ToolEntry } from '@metakit-app/storage';
  import type { ModelTypeDef, ModelTypeId } from '@metakit-app/core';

  let {
    tools,
    loadModelTypes,
    folders,
    initialFolder,
    onCreate,
    onCancel,
  }: {
    tools: ToolEntry[];
    /** Reads the model types of a tool library. */
    loadModelTypes: (toolSlug: string) => Promise<ModelTypeDef[]>;
    folders: string[];
    initialFolder: string;
    onCreate: (input: {
      toolSlug: string;
      modelType: ModelTypeId;
      name: string;
      folder: string;
    }) => void;
    onCancel: () => void;
  } = $props();

  let toolSlug = $state('');
  let types = $state<ModelTypeDef[]>([]);
  let modelType = $state('');
  let name = $state('');
  let folder = $state('');
  let problem = $state('');
  let dialog: HTMLDialogElement | undefined = $state();

  // Set once. An effect that read `initialFolder` and `tools` would run again whenever the
  // explorer refreshed its lists, and wipe what the user had already typed.
  onMount(() => {
    folder = initialFolder;
    dialog?.showModal();
  });

  $effect(() => {
    if (tools.length === 1 && toolSlug === '') toolSlug = tools[0]!.slug;
  });

  $effect(() => {
    const slug = toolSlug;
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
    toolSlug !== '' && modelType !== '' && name.trim() !== '',
  );

  function submit(event: Event) {
    event.preventDefault();
    if (!ready) return;
    onCreate({ toolSlug, modelType: modelType as ModelTypeId, name, folder });
  }
</script>

<dialog bind:this={dialog} onclose={onCancel} data-testid="new-model-dialog">
  <form onsubmit={submit}>
    <h2>New model</h2>
    {#if tools.length === 0}
      <p class="notice">
        This workspace has no tool library yet. Add one in Build mode, or copy a
        tool library folder into <code>tools/</code>.
      </p>
    {:else}
      <label>
        Tool library
        <select bind:value={toolSlug} data-testid="new-model-tool">
          <option value="" disabled>Choose a tool library</option>
          {#each tools as tool (tool.slug)}
            <option value={tool.slug}>{tool.name} ({tool.version})</option>
          {/each}
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
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    min-width: 22rem;
  }
  form {
    display: grid;
    gap: 0.8rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .notice {
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    background: #fff4e6;
    margin: 0;
  }
  .notice.error {
    background: #fff5f5;
  }
</style>
