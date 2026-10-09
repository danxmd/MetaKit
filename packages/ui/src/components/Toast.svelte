<script lang="ts">
  import { toasts } from '../shell/feedback';

  const toast = $derived($toasts);
</script>

<div class="toast-region" aria-live="polite">
  {#if toast}
    {#key toast.id}
      <p class="toast" role="status" data-testid="message">
        <span>{toast.text}</span>
        {#if toast.undo}
          <button
            type="button"
            class="ghost"
            onclick={() => toasts.undo()}
            data-testid="toast-undo">Undo</button
          >
        {/if}
        <button
          type="button"
          class="ghost icon"
          aria-label="Dismiss"
          onclick={() => toasts.dismiss()}>×</button
        >
      </p>
    {/key}
  {/if}
</div>

<style>
  .toast-region {
    position: fixed;
    z-index: 50;
    left: 50%;
    bottom: calc(var(--gap-5) + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    max-width: min(36rem, calc(100vw - 2rem));
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--gap-3);
    margin: 0;
    padding: var(--gap-2) var(--gap-2) var(--gap-2) var(--gap-4);
    /* Inverts with the theme: light text on a dark chip, or the other way round. */
    background: var(--text-strong);
    color: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .toast button {
    color: inherit;
    min-height: 1.75rem;
  }
  .toast button:not(.icon) {
    font-weight: 650;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .toast button:hover {
    background: color-mix(in srgb, var(--surface) 15%, transparent);
  }
</style>
