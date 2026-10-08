<script lang="ts">
  import { DocsLayer, pushDocsContext } from '../../docs/context';
  import { onMount } from 'svelte';
  import type {
    Choice,
    MergeConflict,
    Resolutions,
  } from '@metakit-app/storage';
  import {
    allChosen,
    CHOICE_LABELS,
    conflictSummary,
    conflictTitle,
    showValue,
    toResolutions,
  } from '../../git/conflict-model';

  let {
    conflicts,
    busy = false,
    error = null,
    onApply,
    onCancel,
  }: {
    conflicts: MergeConflict[];
    busy?: boolean;
    error?: string | null;
    /** The choices, ready for `finishPull`. */
    onApply: (choices: Resolutions) => void;
    onCancel: () => void;
  } = $props();

  // Chosen side by position in the list; nothing is chosen until the person decides.
  let choices = $state<Record<number, Choice | undefined>>({});
  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => dialog?.showModal());

  const ready = $derived(allChosen(conflicts, choices));

  // Tells Help which dialog is open.
  $effect(() => pushDocsContext('git.conflict', DocsLayer.dialog));
</script>

<dialog
  bind:this={dialog}
  onclose={onCancel}
  aria-labelledby="conflict-title"
  data-testid="conflict-dialog"
>
  <div class="body">
    <h2 id="conflict-title">Both sides changed the same thing</h2>
    <p>
      Everything else was merged. For each clash below, choose which value to
      keep.
    </p>
    <p class="count" data-testid="conflict-summary">
      {conflictSummary(conflicts, choices)}
    </p>

    <ol class="list">
      {#each conflicts as conflict, i (`${conflict.path}:${conflict.field}`)}
        <li data-testid="conflict-item">
          <h3 data-testid="conflict-title">{conflictTitle(conflict)}</h3>
          <p class="file">{conflict.path}</p>
          <div class="sides">
            {#each ['ours', 'theirs'] as const as side (side)}
              <button
                type="button"
                class="side"
                class:picked={choices[i] === side}
                aria-pressed={choices[i] === side}
                onclick={() => (choices[i] = side)}
                disabled={busy}
                data-testid={`conflict-${side}`}
              >
                <strong>{CHOICE_LABELS[side]}</strong>
                <span class="who"
                  >{side === 'ours' ? 'Your version' : 'Their version'}</span
                >
                <pre data-testid={`conflict-${side}-value`}>{showValue(
                    conflict[side],
                  )}</pre>
              </button>
            {/each}
          </div>
        </li>
      {/each}
    </ol>

    {#if error}
      <p role="alert" class="notice error" data-testid="conflict-error">
        {error}
      </p>
    {/if}

    <div class="actions">
      <button
        type="button"
        onclick={() => dialog?.close()}
        disabled={busy}
        data-testid="conflict-cancel"
      >
        Cancel
      </button>
      <button
        type="button"
        class="primary"
        disabled={busy || !ready}
        onclick={() => {
          // Closing would report a cancel, so the dialog is taken down without it.
          if (dialog) dialog.onclose = null;
          dialog?.close();
          onApply(toResolutions(conflicts, choices));
        }}
        data-testid="conflict-apply"
      >
        {busy ? 'Applying...' : 'Apply choices'}
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    min-width: 28rem;
    max-width: 48rem;
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
    font-size: 0.95rem;
  }
  .count,
  .file,
  .who {
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.9rem;
    max-height: 22rem;
    overflow: auto;
  }
  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
    margin-top: 0.3rem;
  }
  .side {
    display: grid;
    gap: 0.2rem;
    text-align: left;
    padding: var(--gap-2) var(--gap-3);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    font: inherit;
    cursor: pointer;
  }
  .side.picked {
    border-color: var(--accent);
    background: var(--accent-soft);
    outline: 2px solid var(--accent);
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.85rem;
    max-height: 9rem;
    overflow: auto;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
