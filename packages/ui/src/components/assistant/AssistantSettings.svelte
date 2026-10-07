<script lang="ts">
  import { onMount } from 'svelte';
  import type { ToolLibrary } from '@metakit-app/core';
  import type { AssistantService } from '../../assistant/assistant-service';

  // Only the public members: the class has private fields, which makes two copies of it (one
  // through the package, one through a path) different types.
  type AssistantServiceLike = Pick<AssistantService, keyof AssistantService>;
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
    service: AssistantServiceLike;
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
    gap: var(--gap-4);
  }
  p,
  .muted {
    font-size: var(--text-s);
  }
  .check {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
    color: var(--text);
    font-size: var(--text-m);
  }
  .box {
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--gap-3) var(--gap-4);
    display: grid;
    gap: var(--gap-3);
  }
  .row {
    display: flex;
    gap: var(--gap-2);
    align-items: end;
    flex-wrap: wrap;
  }
  label {
    display: grid;
    gap: var(--gap-1);
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
    background: var(--surface-3);
    padding: var(--gap-3);
    border-radius: var(--radius-s);
    font-size: 0.75rem;
    white-space: pre-wrap;
  }
  summary {
    cursor: pointer;
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .ok {
    color: var(--success);
    font-size: var(--text-s);
  }
  .problem {
    color: var(--danger);
    font-size: var(--text-s);
  }
</style>
