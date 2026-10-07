<script lang="ts">
  import { supportsLocalFolders } from './browser-support';

  const folderSupport = supportsLocalFolders(window);
</script>

<main>
  <h1>MetaKit</h1>
  <p>MetaKit is under construction.</p>
  {#if !folderSupport}
    <p role="alert" data-testid="unsupported-browser">
      Local folders need Chrome or Edge on a desktop computer. This browser
      cannot open them.
    </p>
  {/if}
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
  }
</style>
