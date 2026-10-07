<script lang="ts">
  import { onMount } from 'svelte';
  import type { ToolLibrary } from '@metakit-app/core';
  import type { AssistantService } from '../../assistant/assistant-service';
  import {
    COST_NOTE,
    KEY_STATEMENT,
    WHAT_IS_SENT,
    sampleOutgoing,
  } from '../../assistant/notice';

  let {
    service,
    tool,
  }: {
    service: AssistantService;
    /** The open tool library, used for the sample; an example tool is used when none is open. */
    tool?: ToolLibrary | undefined;
  } = $props();

  let tick = $state(0);
  let keyText = $state('');
  let busy = $state<'test' | 'save' | null>(null);
  let message = $state<string | null>(null);
  let problem = $state<string | null>(null);

  onMount(() => {
    const stop = service.subscribe(() => tick++);
    void service.load();
    return stop;
  });

  const view = $derived.by(() => {
    void tick;
    return {
      loaded: service.loaded,
      enabled: service.settings.enabled,
      hasKey: service.hasKey,
      model: service.settings.model,
    };
  });
  const sample = $derived(sampleOutgoing(tool));

  async function guard(
    what: 'test' | 'save' | null,
    work: () => Promise<string | void>,
  ) {
    busy = what;
    message = null;
    problem = null;
    try {
      const done = await work();
      if (typeof done === 'string') message = done;
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    } finally {
      busy = null;
    }
  }

  const saveKey = () =>
    guard('save', async () => {
      await service.saveKey(keyText);
      keyText = '';
      return 'The key is saved in this browser. Test it to check that it works.';
    });
  const test = () => guard('test', () => service.testKey());
  const remove = () =>
    guard(null, async () => {
      await service.removeKey();
      return 'The key is removed from this browser.';
    });
</script>

<section class="assistant" data-testid="assistant-settings">
  <h2>Assistant (optional)</h2>
  <p class="muted">
    The assistant drafts rules, scripts, shapes and classes from a plain
    description. You review every draft and accept or discard it. It is off
    until you turn it on, and it uses your own key.
  </p>

  <label class="check">
    <input
      type="checkbox"
      role="switch"
      checked={view.enabled}
      disabled={!view.loaded}
      onchange={(e) =>
        guard(null, () => service.setEnabled(e.currentTarget.checked))}
      data-testid="assistant-enabled"
    />
    Turn on the assistant
  </label>

  {#if view.enabled}
    <div class="box">
      <h3>Key</h3>
      {#if view.hasKey}
        <p data-testid="assistant-key-state">
          A key is saved in this browser. It is not shown again.
        </p>
        <div class="row">
          <button
            type="button"
            onclick={test}
            disabled={busy !== null}
            aria-busy={busy === 'test'}
            data-testid="assistant-test"
          >
            {busy === 'test' ? 'Testing…' : 'Test the key'}
          </button>
          <button
            type="button"
            onclick={remove}
            disabled={busy !== null}
            data-testid="assistant-remove"
          >
            Remove the key
          </button>
        </div>
      {:else}
        <form
          class="row"
          onsubmit={(e) => {
            e.preventDefault();
            void saveKey();
          }}
        >
          <label class="grow">
            API key
            <input
              type="password"
              autocomplete="off"
              spellcheck="false"
              bind:value={keyText}
              placeholder="Paste your key"
              data-testid="assistant-key"
            />
          </label>
          <button
            type="submit"
            disabled={keyText.trim() === '' || busy !== null}
            data-testid="assistant-save"
          >
            Save key
          </button>
        </form>
      {/if}
      <label>
        Model
        <input
          type="text"
          value={view.model}
          onchange={(e) =>
            guard(null, () => service.setModel(e.currentTarget.value))}
          data-testid="assistant-model"
        />
      </label>
      {#if message}<p class="ok" role="status" data-testid="assistant-message">
          {message}
        </p>{/if}
      {#if problem}<p
          class="problem"
          role="alert"
          data-testid="assistant-problem"
        >
          {problem}
        </p>{/if}
    </div>
  {/if}

  <div class="box" data-testid="assistant-notice">
    <h3>What is sent</h3>
    <p>{WHAT_IS_SENT}</p>
    <p>{KEY_STATEMENT}</p>
    <p class="muted">{COST_NOTE}</p>
    <details>
      <summary>Show a sample request</summary>
      <pre data-testid="assistant-sample">{sample}</pre>
    </details>
  </div>
</section>

<style>
  .assistant {
    display: grid;
    gap: 0.8rem;
    max-width: 46rem;
  }
  h2,
  h3 {
    margin: 0;
  }
  h3 {
    font-size: 1rem;
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--muted, #5c6670);
    font-size: 0.85rem;
  }
  .check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .box {
    border: 1px solid var(--line, #d0d7de);
    border-radius: 8px;
    padding: 0.8rem 1rem;
    display: grid;
    gap: 0.6rem;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    align-items: end;
    flex-wrap: wrap;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  label.check {
    display: flex;
  }
  .grow {
    flex: 1;
    min-width: 14rem;
  }
  pre {
    max-height: 18rem;
    overflow: auto;
    background: var(--panel, #f1f3f5);
    padding: 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    white-space: pre-wrap;
  }
  .ok {
    color: #2b8a3e;
    font-size: 0.85rem;
  }
  .problem {
    color: #c92a2a;
    font-size: 0.85rem;
  }
</style>
