<script lang="ts">
  import { onMount } from 'svelte';
  import type { GitTag } from '@metakit-app/storage';
  import {
    NO_RELEASES_TEXT,
    releaseLabel,
    sortReleases,
  } from '../../git/release-model';

  let {
    releases,
    current = null,
    busy = false,
    error = null,
    onPick,
    onCancel,
  }: {
    releases: GitTag[];
    /** The tag the tool library follows now, if any. */
    current?: string | null;
    busy?: boolean;
    error?: string | null;
    onPick: (tag: string) => void;
    onCancel: () => void;
  } = $props();

  let chosen = $state<string | null>(null);
  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => dialog?.showModal());

  const sorted = $derived(sortReleases(releases));
</script>

<dialog
  bind:this={dialog}
  onclose={onCancel}
  aria-labelledby="release-title"
  data-testid="release-picker"
>
  <div class="body">
    <h2 id="release-title">Tool library versions</h2>
    <p>
      A version is a tag of the repository. Pick one to open that version of the
      tool library to read or to follow.
    </p>

    {#if sorted.length === 0}
      <p data-testid="release-empty">{NO_RELEASES_TEXT}</p>
    {:else}
      <ul class="list" data-testid="release-list">
        {#each sorted as tag (tag.name)}
          <li>
            <label>
              <input
                type="radio"
                name="release"
                value={tag.name}
                checked={chosen === tag.name}
                onchange={() => (chosen = tag.name)}
                disabled={busy}
                data-testid="release-option"
              />
              <span>{releaseLabel(tag)}</span>
              {#if tag.name === current}<em>(in use)</em>{/if}
            </label>
          </li>
        {/each}
      </ul>
    {/if}

    {#if error}
      <p role="alert" class="error" data-testid="release-error">{error}</p>
    {/if}

    <div class="actions">
      <button
        type="button"
        onclick={() => dialog?.close()}
        disabled={busy}
        data-testid="release-cancel"
      >
        Cancel
      </button>
      <button
        type="button"
        class="primary"
        disabled={busy || chosen === null}
        onclick={() => chosen && onPick(chosen)}
        data-testid="release-open"
      >
        {busy ? 'Opening...' : 'Open this version'}
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    min-width: 24rem;
    max-width: 36rem;
  }
  .body {
    display: grid;
    gap: 0.7rem;
  }
  h2,
  p {
    margin: 0;
  }
  h2 {
    font-size: 1.15rem;
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.35rem;
    max-height: 16rem;
    overflow: auto;
  }
  label {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  em {
    color: #555;
    font-size: 0.85rem;
  }
  .error {
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    background: #fff4e6;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
