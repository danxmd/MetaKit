<script lang="ts">
  let {
    supported,
    remembered,
    busy,
    error,
    pendingCreate,
    onOpen,
    onReopen,
    onCreate,
    onCancelCreate,
  }: {
    supported: boolean;
    /** The name of the remembered folder, if there is one. */
    remembered: string | null;
    busy: boolean;
    error: string | null;
    /** Set when the chosen folder is not a workspace yet: the name of that folder. */
    pendingCreate: string | null;
    onOpen: () => void;
    onReopen: () => void;
    onCreate: (name: string) => void;
    onCancelCreate: () => void;
  } = $props();

  let name = $state('');
  $effect(() => {
    if (pendingCreate !== null && name === '') name = pendingCreate;
  });
</script>

<main class="start">
  <h1>MetaKit</h1>
  <p class="lead">
    Build modelling tools and model with them, in a folder you share through
    OneDrive, SharePoint, Google Drive or Dropbox.
  </p>

  {#if !supported}
    <p role="alert" data-testid="unsupported-browser" class="notice">
      Local folders need Chrome or Edge on a desktop computer. This browser
      cannot open them.
    </p>
  {:else if pendingCreate !== null}
    <section class="card" data-testid="create-workspace">
      <h2>This folder is not a workspace yet</h2>
      <p>
        There is no <code>workspace.json</code> in "{pendingCreate}". You can
        make a new workspace here. Existing files in the folder stay as they
        are.
      </p>
      <label>
        Workspace name
        <input bind:value={name} data-testid="workspace-name" />
      </label>
      <div class="row">
        <button
          class="primary"
          disabled={busy || name.trim() === ''}
          onclick={() => onCreate(name)}
        >
          Create workspace
        </button>
        <button disabled={busy} onclick={onCancelCreate}
          >Choose another folder</button
        >
      </div>
    </section>
  {:else}
    <div class="row">
      <button
        class="primary"
        disabled={busy}
        onclick={onOpen}
        data-testid="open-folder"
      >
        Open workspace folder
      </button>
      {#if remembered}
        <button disabled={busy} onclick={onReopen} data-testid="reopen-folder">
          Reopen "{remembered}"
        </button>
      {/if}
    </div>
    <p class="hint">
      Pick the folder that holds your tool libraries and models. In a new folder
      you can start a workspace.
    </p>
  {/if}

  {#if error}
    <p role="alert" class="notice error" data-testid="start-error">{error}</p>
  {/if}
</main>

<style>
  .start {
    max-width: 38rem;
    margin: 5rem auto;
    padding: 0 1rem;
  }
  h1 {
    margin-bottom: 0.25rem;
  }
  .lead {
    color: var(--muted);
    margin-top: 0;
  }
  .row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin: 1.25rem 0 0.5rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    background: var(--panel);
  }
  .card h2 {
    margin-top: 0;
    font-size: 1.1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .hint {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .notice {
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    background: #fff4e6;
    border: 1px solid #ffd8a8;
  }
  .notice.error {
    background: #fff5f5;
    border-color: #ffc9c9;
  }
</style>
