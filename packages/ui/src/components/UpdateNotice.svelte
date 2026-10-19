<script lang="ts">
  import type { Release } from '../shell/update-check';

  let {
    release,
    current,
    banner = false,
    onDismiss,
  }: {
    /** The newer release on GitHub. */
    release: Release;
    /** The version of this copy. */
    current: string;
    /** A thin strip under the top bar, rather than a box on the Start page. */
    banner?: boolean;
    onDismiss: () => void;
  } = $props();
</script>

<!-- Only copies run from a download see this (ADR 0015); the Pages copy is always the newest. -->
<div
  class="update notice"
  class:banner
  role="status"
  data-testid="update-notice"
>
  <p>
    <strong data-testid="update-notice-text"
      >MetaKit {release.version} is available (you have {current}).</strong
    >
    To update, run <code>git pull</code> in your MetaKit folder and start it
    again, or download the new zip from the
    <a
      href={release.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="update-notice-link">release page</a
    >.
  </p>
  <button
    type="button"
    class="ghost"
    onclick={onDismiss}
    data-testid="update-notice-dismiss">Dismiss</button
  >
</div>

<style>
  .update {
    display: flex;
    align-items: center;
    gap: var(--gap-3);
  }
  .update p {
    flex: 1;
    min-width: 0;
  }
  .update button {
    flex: none;
  }
  .banner {
    border-radius: 0;
    border-width: 0 0 1px;
    padding: var(--gap-2) var(--gap-4);
  }
</style>
