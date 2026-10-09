<script lang="ts">
  import { confirms } from '../shell/feedback';

  let dialog: HTMLDialogElement | undefined = $state();
  const request = $derived($confirms);

  $effect(() => {
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    else if (!request && dialog.open) dialog.close();
  });
</script>

<!-- Escape or a click on the backdrop counts as Cancel. -->
<dialog
  bind:this={dialog}
  aria-labelledby="confirm-title"
  oncancel={(e) => {
    e.preventDefault();
    confirms.answer(false);
  }}
  onclick={(e) => {
    if (e.target === dialog) confirms.answer(false);
  }}
  data-testid="confirm-dialog"
>
  {#if request}
    <h2 id="confirm-title">{request.title}</h2>
    <p>{request.message}</p>
    <div class="actions">
      <button
        type="button"
        onclick={() => confirms.answer(false)}
        data-testid="confirm-cancel">Cancel</button
      >
      <!-- svelte-ignore a11y_autofocus -->
      <button
        type="button"
        class={request.danger ? 'danger' : 'primary'}
        autofocus
        onclick={() => confirms.answer(true)}
        data-testid="confirm-ok">{request.action}</button
      >
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(28rem, calc(100vw - 2rem));
  }
  h2 {
    margin: 0 0 var(--gap-2);
    font-size: var(--text-l);
  }
  p {
    margin: 0 0 var(--gap-5);
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
  }
</style>
