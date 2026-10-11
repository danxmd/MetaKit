<script lang="ts">
  import { DocsLayer, pushDocsContext } from '../../../docs/context';
  import { describePermissions } from '@metakit-app/behaviour';
  import type { KitPermissions } from '@metakit-app/core';

  let {
    kitName,
    wanted,
    onAllow,
    onDeny,
  }: {
    kitName: string;
    /** What the kit wants; the dialog lists it in plain English. */
    wanted: KitPermissions;
    onAllow: () => void;
    onDeny: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  const lines = $derived(describePermissions(wanted));

  $effect(() => dialog?.showModal());

  // Tells Help which dialog is open.
  $effect(() => pushDocsContext('dialog.permission', DocsLayer.dialog));
</script>

<dialog
  bind:this={dialog}
  oncancel={(e) => {
    e.preventDefault();
    onDeny();
  }}
  aria-labelledby="permission-title"
  data-testid="permission-dialog"
>
  <h2 id="permission-title">"{kitName}" asks for more</h2>
  <p class="hint">
    The scripts of this Kit can always change the models you open with it and
    show dialogs. It also wants to:
  </p>
  <ul data-testid="permission-lines">
    {#each lines as line (line)}<li>{line}</li>{/each}
  </ul>
  <p class="hint">
    Allow this only for Kits you trust. Your answer is kept in this browser
    only, and you are asked again if the Kit later wants something else. If you
    say no, the Kit still opens; its scripts just cannot do this.
  </p>
  <div class="actions">
    <button type="button" onclick={onDeny} data-testid="permission-deny"
      >Not now</button
    >
    <button
      type="button"
      class="primary"
      onclick={onAllow}
      data-testid="permission-allow">Allow</button
    >
  </div>
</dialog>

<style>
  dialog {
    max-width: 30rem;
  }
  h2 {
    margin: 0 0 var(--gap-2);
    font-size: 1.15rem;
  }
  .hint {
    margin: var(--gap-2) 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  ul {
    margin: var(--gap-2) 0;
    padding-left: 1.2rem;
    display: grid;
    gap: var(--gap-2);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
    margin-top: var(--gap-3);
  }
</style>
