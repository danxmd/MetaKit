<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  let {
    label,
    onClose,
    testid,
    children,
  }: {
    /** Names the dialog for screen readers. */
    label: string;
    onClose: () => void;
    testid?: string;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => dialog?.showModal());
</script>

<!-- A click on the backdrop lands on the dialog element itself. -->
<dialog
  bind:this={dialog}
  aria-label={label}
  onclose={onClose}
  onclick={(e) => {
    if (e.target === dialog) dialog?.close();
  }}
  data-testid={testid}
>
  <div class="panel-body">{@render children()}</div>
</dialog>

<style>
  dialog {
    width: min(40rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 3rem);
    padding: 0;
  }
  .panel-body {
    padding: var(--gap-5);
    display: grid;
    gap: var(--gap-4);
  }
</style>
