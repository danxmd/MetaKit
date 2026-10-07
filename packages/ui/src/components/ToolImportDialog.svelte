<script lang="ts">
  import { onMount } from 'svelte';
  import type { ToolUpdatePlan } from '@metakit-app/storage';

  let {
    plan,
    onConfirm,
    onCancel,
  }: {
    plan: ToolUpdatePlan;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => dialog?.showModal());

  const title = $derived(
    plan.isNew ? 'Add tool library' : 'Update tool library',
  );
  const versionText = $derived(
    plan.isNew
      ? `Version ${plan.version.to}`
      : plan.version.direction === 'same'
        ? `Version ${plan.version.to} (unchanged)`
        : `Version ${plan.version.from} to ${plan.version.to}`,
  );
  const verb = { added: 'Added', removed: 'Removed', changed: 'Changed' };
</script>

<dialog
  bind:this={dialog}
  onclose={onCancel}
  aria-labelledby="tool-import-title"
  data-testid="tool-import-dialog"
>
  <div class="body">
    <h2 id="tool-import-title">{title}: {plan.tool.name}</h2>
    <p class="version" data-testid="tool-import-version">{versionText}</p>

    {#if plan.isNew}
      <p>
        This tool library is not in your workspace yet. It will be added, and
        you can then make models with it.
      </p>
    {:else if plan.changes.length === 0}
      <p data-testid="tool-import-nochange">Nothing in the library changes.</p>
    {:else}
      <ul class="changes" data-testid="tool-import-changes">
        {#each plan.changes as change (`${change.area}:${change.change}:${change.name}`)}
          <li class={change.change}>
            <strong>{verb[change.change]}</strong>
            {change.area}
            <code>{change.name}</code>{change.detail
              ? ` (${change.detail})`
              : ''}
          </li>
        {/each}
      </ul>
      <p>Existing models keep their ids and follow the update.</p>
    {/if}

    {#if plan.warnings.length > 0}
      <div role="alert" class="warnings" data-testid="tool-import-warnings">
        <h3>Please check</h3>
        <ul>
          {#each plan.warnings as warning (warning)}<li>{warning}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if plan.affectedModels.length > 0}
      <div data-testid="tool-import-models">
        <h3>Models affected</h3>
        <ul>
          {#each plan.affectedModels as model (model.slug)}
            <li>
              <strong>{model.name}</strong>: {model.effects.join(' ')}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="actions">
      <button
        type="button"
        onclick={() => dialog?.close()}
        data-testid="tool-import-cancel"
      >
        Cancel
      </button>
      <button
        type="button"
        class="primary"
        onclick={() => {
          // Closing would report a cancel, so the dialog is taken down without it.
          if (dialog) dialog.onclose = null;
          dialog?.close();
          onConfirm();
        }}
        data-testid="tool-import-confirm"
      >
        {plan.isNew ? 'Add' : 'Update'}
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
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: 1.15rem;
  }
  h3 {
    font-size: 0.95rem;
  }
  .version {
    color: #555;
    font-size: 0.9rem;
  }
  ul {
    margin: 0.2rem 0 0;
    padding-left: 1.2rem;
  }
  .changes {
    max-height: 16rem;
    overflow: auto;
  }
  .warnings {
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
