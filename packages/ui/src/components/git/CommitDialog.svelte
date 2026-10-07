<script lang="ts">
  import { onMount } from 'svelte';
  import type { PartChange } from '@metakit-app/storage';
  import {
    changeCountText,
    commitProblem,
    groupChanges,
    suggestMessage,
  } from '../../git/commit-model';

  let {
    changes,
    busy = false,
    error = null,
    onCommit,
    onCancel,
  }: {
    changes: PartChange[];
    /** True while the commit is on its way; the buttons wait. */
    busy?: boolean;
    /** What went wrong, in plain English, for example that a pull is needed first. */
    error?: string | null;
    onCommit: (message: string) => void;
    onCancel: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let message = $state(suggestMessage(changes));
  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => dialog?.showModal());

  const groups = $derived(groupChanges(changes));
  const problem = $derived(commitProblem(message, changes));

  function submit(event: Event) {
    event.preventDefault();
    if (busy || problem) return;
    onCommit(message.trim());
  }
</script>

<dialog
  bind:this={dialog}
  onclose={onCancel}
  aria-labelledby="commit-title"
  data-testid="commit-dialog"
>
  <form class="body" onsubmit={submit}>
    <h2 id="commit-title">Commit and push</h2>
    <p class="count" data-testid="commit-count">{changeCountText(changes)}</p>

    {#if groups.length === 0}
      <p data-testid="commit-empty">
        Nothing has changed since the last pull or commit.
      </p>
    {:else}
      <div class="changes" data-testid="commit-changes">
        {#each groups as group (group.title)}
          <h3>{group.title}</h3>
          <ul>
            {#each group.changes as change (change.path)}
              <li data-testid="commit-change">{change.text}</li>
            {/each}
          </ul>
        {/each}
      </div>
    {/if}

    <label>
      Message
      <textarea
        rows="3"
        bind:value={message}
        disabled={busy}
        placeholder="What did you change, and why?"
        data-testid="commit-message"></textarea>
    </label>

    {#if error}
      <p role="alert" class="notice error" data-testid="commit-error">
        {error}
      </p>
    {/if}

    <div class="actions">
      <button
        type="button"
        onclick={() => dialog?.close()}
        disabled={busy}
        data-testid="commit-cancel"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="primary"
        disabled={busy || problem !== null}
        title={problem ?? ''}
        data-testid="commit-confirm"
      >
        {busy ? 'Committing...' : 'Commit and push'}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    min-width: 24rem;
    max-width: 36rem;
  }
  .body {
    display: grid;
    gap: var(--gap-3);
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h3 {
    font-size: 0.9rem;
    margin-top: 0.4rem;
  }
  .count {
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .changes {
    max-height: 14rem;
    overflow: auto;
  }
  ul {
    margin: 0.2rem 0 0;
    padding-left: 1.2rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  textarea {
    resize: vertical;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
