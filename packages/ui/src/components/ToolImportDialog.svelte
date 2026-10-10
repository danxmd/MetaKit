<script lang="ts">
  import { DocsLayer, pushDocsContext } from '../docs/context';
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

  const title = $derived(plan.isNew ? 'Add Kit' : 'Update Kit');
  const versionText = $derived(
    plan.isNew
      ? `Version ${plan.version.to}`
      : plan.version.direction === 'same'
        ? `Version ${plan.version.to} (unchanged)`
        : `Version ${plan.version.from} to ${plan.version.to}`,
  );
  const verb = { added: 'Added', removed: 'Removed', changed: 'Changed' };

  // Tells Help which dialog is open.
  $effect(() => pushDocsContext('dialog.kit-import', DocsLayer.dialog));
</script>

<dialog
  bind:this={dialog}
  onclose={onCancel}
  aria-labelledby="kit-import-title"
  data-testid="kit-import-dialog"
>
  <div class="body">
    <h2 id="kit-import-title">{title}: {plan.tool.name}</h2>
    <p class="version" data-testid="kit-import-version">{versionText}</p>

    {#if plan.isNew}
      <p>
        This Kit is not in your workspace yet. It will be added, and you can
        then make models with it.
      </p>
    {:else if plan.changes.length === 0}
      <p data-testid="kit-import-nochange">Nothing in the Kit changes.</p>
    {:else}
      <ul class="changes" data-testid="kit-import-changes">
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
      <div role="alert" class="warnings" data-testid="kit-import-warnings">
        <h3>Please check</h3>
        <ul>
          {#each plan.warnings as warning (warning)}<li>{warning}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if plan.affectedModels.length > 0}
      <div data-testid="kit-import-models">
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
        data-testid="kit-import-cancel"
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
        data-testid="kit-import-confirm"
      >
        {plan.isNew ? 'Add' : 'Update'}
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(34rem, calc(100vw - 2rem));
  }
  .body {
    display: grid;
    gap: var(--gap-3);
  }
  .version {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  ul {
    margin: var(--gap-1) 0 0;
    padding-left: 1.2rem;
  }
  .changes {
    max-height: 16rem;
    overflow: auto;
  }
  .warnings {
    padding: var(--gap-3) var(--gap-4);
    border-radius: var(--radius);
    background: var(--warning-soft);
    border: 1px solid var(--line);
    font-size: var(--text-s);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
  }
</style>
