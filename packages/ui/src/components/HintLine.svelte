<script lang="ts">
  /** Interaction hints: one plain sentence about what the person is doing, under the canvas. */
  let { text }: { text: string } = $props();
</script>

{#if text}
  <p class="hint" role="status" data-testid="hint-line">
    <span class="mark" aria-hidden="true">i</span>{text}
  </p>
{/if}

<style>
  .hint {
    position: absolute;
    left: var(--gap-3);
    bottom: var(--gap-3);
    z-index: 20;
    max-width: min(42rem, calc(100% - 2rem));
    margin: 0;
    padding: 0.4rem 0.8rem 0.4rem 0.4rem;
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    font-size: var(--text-s);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    box-shadow: var(--shadow-s);
    pointer-events: none;
  }
  .mark {
    flex: none;
    width: 1.3rem;
    height: 1.3rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 700;
    font-size: 0.75rem;
  }
</style>
