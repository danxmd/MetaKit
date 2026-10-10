<script lang="ts">
  import { onMount } from 'svelte';
  import type { DraftKind } from '@metakit-app/assistant';
  import type { ToolCommand, ToolLibrary } from '@metakit-app/core';
  import type { AssistantPort } from '../../assistant/assistant-service';
  import {
    DraftDialogModel,
    KIND_EXAMPLE,
    KIND_NOUN,
  } from '../../assistant/draft-dialog-model';

  let {
    kind,
    tool,
    assistant,
    onAccept,
    onClose,
    language,
  }: {
    kind: DraftKind;
    tool: ToolLibrary;
    assistant: AssistantPort;
    /** Called with the commands that apply the draft; running them is one undo step. */
    onAccept: (commands: ToolCommand[]) => void;
    onClose: () => void;
    language?: string | undefined;
  } = $props();

  // The dialog drafts one kind of part for as long as it is open.
  // svelte-ignore state_referenced_locally
  const model = new DraftDialogModel(kind, tool, assistant, language);
  let sentence = $state('');
  let view = $state(model.view);
  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => {
    dialog?.showModal();
    return model.subscribe(() => (view = model.view));
  });

  $effect(() => model.setTool(tool));

  function start(event: Event) {
    event.preventDefault();
    model.sentence = sentence;
    void model.start();
  }

  function accept() {
    const commands = model.accept(tool);
    if (!commands) return;
    onAccept(commands);
    dialog?.close();
  }

  function discard() {
    model.discard();
    sentence = '';
    dialog?.close();
  }

  const noun = $derived(KIND_NOUN[kind]);
</script>

<dialog
  bind:this={dialog}
  onclose={onClose}
  aria-labelledby="draft-title"
  data-testid="draft-dialog"
>
  <div class="body">
    <h2 id="draft-title">Draft a {noun} with the assistant</h2>

    <form onsubmit={start}>
      <label>
        What should the {noun} do?
        <textarea
          rows="3"
          bind:value={sentence}
          placeholder={KIND_EXAMPLE[kind]}
          disabled={view.status === 'drafting'}
          data-testid="draft-sentence"></textarea>
      </label>
      <div class="row">
        <button
          class="primary"
          type="submit"
          disabled={sentence.trim() === '' || view.status === 'drafting'}
          aria-busy={view.status === 'drafting'}
          data-testid="draft-go"
        >
          {view.status === 'drafting'
            ? 'Drafting…'
            : view.status === 'done'
              ? 'Draft again'
              : 'Draft'}
        </button>
        <span class="muted"
          >Only the Kit definition and your description are sent, never a model.</span
        >
      </div>
    </form>

    {#if view.error}
      <p class="problem" role="alert" data-testid="draft-error">{view.error}</p>
    {/if}

    {#if view.status === 'done' && !view.error}
      {#if view.problems.length > 0}
        <div class="problem" role="alert" data-testid="draft-problems">
          <strong
            >The draft still has problems{view.attempts > 1
              ? ' after a second try'
              : ''}:</strong
          >
          <ul>
            {#each view.problems as p, i (i)}<li>{p}</li>{/each}
          </ul>
          <span>You can change the description and draft again.</span>
        </div>
      {/if}

      {#if view.lines.length > 0}
        <div data-testid="draft-change">
          <h3>The change</h3>
          <ul>
            {#each view.lines as line, i (i)}<li>{line}</li>{/each}
          </ul>
        </div>
      {/if}

      {#if view.raw}
        <label>
          {view.rawLabel} (read only)
          <textarea
            class="raw"
            rows="10"
            readonly
            value={view.raw}
            data-testid="draft-raw"></textarea>
        </label>
      {/if}
    {/if}

    <div class="actions">
      <button type="button" onclick={discard} data-testid="draft-discard"
        >Discard</button
      >
      <button
        type="button"
        class="primary"
        onclick={accept}
        disabled={!view.canAccept}
        data-testid="draft-accept"
      >
        Accept
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(42rem, 92vw);
  }
  .body {
    display: grid;
    gap: var(--gap-3);
  }
  h2,
  h3 {
    margin: 0;
  }
  h3 {
    font-size: 1rem;
  }
  form {
    display: grid;
    gap: 0.6rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  textarea {
    font: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .raw {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .row {
    display: flex;
    gap: var(--gap-3);
    align-items: center;
    flex-wrap: wrap;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  ul {
    margin: 0.3rem 0 0;
    padding-left: 1.2rem;
  }
  .muted {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  .problem {
    color: var(--danger);
    background: var(--danger-soft);
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius);
    margin: 0;
    font-size: 0.85rem;
  }
</style>
