<script lang="ts">
  /** Where the project lives and how to support it; shown at the foot of the home pages. */
  const SOURCE = 'https://github.com/danxmd/MetaKit';
  const COFFEE = 'https://buymeacoffee.com/danial.amlashi';
</script>

<footer class="support" data-testid="support-footer">
  <span>MetaKit is free and open source.</span>
  <a href={SOURCE} target="_blank" rel="noopener noreferrer">Source on GitHub</a
  >
  <a
    href={COFFEE}
    target="_blank"
    rel="noopener noreferrer"
    class="coffee"
    data-testid="buy-me-a-coffee"
    ><span aria-hidden="true">☕</span> Buy me a coffee</a
  >
</footer>

<style>
  .support {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--gap-2) var(--gap-4);
    padding: var(--gap-5) var(--gap-4) var(--gap-4);
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  a {
    color: inherit;
  }
  a:hover {
    color: var(--accent);
  }
  .coffee {
    font-weight: 600;
  }
</style>
