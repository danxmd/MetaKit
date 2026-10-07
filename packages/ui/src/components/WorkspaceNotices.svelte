<script lang="ts">
  import type { HealthFinding } from '@metakit-app/storage';

  let {
    error,
    warnings,
    notes,
    health,
  }: {
    error: string | null;
    warnings: string[];
    /** What the last import did. */
    notes: string[];
    /** What the check of the folder found. */
    health: HealthFinding[];
  } = $props();
</script>

{#if error}
  <p role="alert" class="notice error" data-testid="explorer-error">{error}</p>
{/if}
{#each notes as note (note)}
  <p class="notice success" data-testid="import-note">{note}</p>
{/each}
{#each warnings as warning (warning)}
  <p class="notice warning" data-testid="workspace-warning">{warning}</p>
{/each}
{#if health.length > 0}
  <section class="notice warning health" data-testid="health">
    <strong>The folder may not be set up well for sharing</strong>
    <ul>
      {#each health as finding (finding.kind + (finding.path ?? ''))}
        <li>{finding.message}</li>
      {/each}
    </ul>
    <p class="muted">
      MetaKit can only see what the files show, not whether your sync program is
      running. Check its icon, and see the test protocol in the repository (<code
        >docs/phase-3-test-protocol.md</code
      >) for how to test it.
    </p>
  </section>
{/if}

<style>
  .error {
    white-space: pre-wrap;
  }
  ul {
    margin: var(--gap-1) 0;
    padding-left: 1.2rem;
  }
</style>
