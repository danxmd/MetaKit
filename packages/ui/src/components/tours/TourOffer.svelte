<script lang="ts">
  let {
    onStart,
    onDismiss,
  }: {
    onStart: () => void;
    onDismiss: () => void;
  } = $props();
</script>

<!-- Shown once per browser, after the first "Who are you?". -->
<aside
  class="offer card"
  aria-labelledby="tour-offer-title"
  data-testid="tour-offer"
>
  <h2 id="tour-offer-title">New to MetaKit?</h2>
  <p>
    A one-minute tour shows where to start. You can take it later from
    Tutorials.
  </p>
  <div class="actions">
    <button
      type="button"
      class="ghost"
      onclick={onDismiss}
      data-testid="tour-offer-dismiss">Not now</button
    >
    <button
      type="button"
      class="primary"
      onclick={onStart}
      data-testid="tour-offer-start">Take the first-steps tour</button
    >
  </div>
</aside>

<style>
  .offer {
    position: fixed;
    z-index: 45;
    right: var(--gap-5);
    bottom: var(--gap-5);
    width: min(22rem, calc(100vw - 2rem));
    padding: var(--gap-4);
    display: grid;
    gap: var(--gap-2);
    box-shadow: var(--shadow-l);
  }
  h2 {
    font-size: var(--text-m);
  }
  p {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
    margin-top: var(--gap-1);
  }
</style>
