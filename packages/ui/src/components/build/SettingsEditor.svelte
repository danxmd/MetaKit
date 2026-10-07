<script lang="ts">
  import type { ToolLibrary } from '@metakit-app/core';
  import type { CommandResult } from '../../shell/controller';

  let {
    tool,
    run,
  }: { tool: ToolLibrary; run: (command: never) => CommandResult } = $props();

  let error = $state<string | null>(null);
  const exec = (command: Record<string, unknown>) => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
  };
  const grid = $derived(tool.settings.grid);
  let newLanguage = $state('');
  const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;
  function addLanguage() {
    const code = newLanguage.trim();
    if (!LANGUAGE.test(code)) {
      error = `"${code}" is not a language code such as en or de.`;
      return;
    }
    if (tool.manifest.languages.includes(code)) {
      error = `${code} is already listed.`;
      return;
    }
    exec({
      type: 'updateManifest',
      languages: [...tool.manifest.languages, code],
    });
    newLanguage = '';
  }
  function removeLanguage(code: string) {
    if (tool.manifest.languages.length === 1) {
      error = 'A tool library needs at least one language.';
      return;
    }
    exec({
      type: 'updateManifest',
      languages: tool.manifest.languages.filter((l) => l !== code),
    });
  }
</script>

<div class="editor" data-testid="settings-editor">
  <h2>Settings</h2>
  <fieldset>
    <legend>Languages</legend>
    <p class="muted">
      Labels can be given in each language. The first one is used for options
      and previews.
    </p>
    <ul>
      {#each tool.manifest.languages as code (code)}
        <li>
          {code}
          <button
            type="button"
            onclick={() => removeLanguage(code)}
            aria-label="Remove language {code}">Remove</button
          >
        </li>
      {/each}
    </ul>
    <div class="row">
      <input
        bind:value={newLanguage}
        placeholder="de"
        aria-label="New language code"
        data-testid="settings-new-language"
      />
      <button
        type="button"
        onclick={addLanguage}
        data-testid="settings-add-language">Add language</button
      >
    </div>
  </fieldset>
  <fieldset>
    <legend>Grid</legend>
    <div class="row">
      <label
        >Size <input
          type="number"
          min="1"
          max="200"
          value={grid.size}
          onchange={(e) =>
            exec({
              type: 'updateSettings',
              grid: { size: Math.max(1, Number(e.currentTarget.value) || 10) },
            })}
        /></label
      >
      <label class="inline"
        ><input
          type="checkbox"
          checked={grid.snap}
          onchange={(e) =>
            exec({
              type: 'updateSettings',
              grid: { snap: e.currentTarget.checked },
            })}
        /> Snap to grid</label
      >
      <label class="inline"
        ><input
          type="checkbox"
          checked={grid.visible}
          onchange={(e) =>
            exec({
              type: 'updateSettings',
              grid: { visible: e.currentTarget.checked },
            })}
        /> Show grid</label
      >
    </div>
  </fieldset>
  {#if error}<p class="problem" role="alert">{error}</p>{/if}
</div>

<style>
  .editor {
    display: grid;
    gap: 0.9rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 6px;
    display: grid;
    gap: 0.5rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.2rem;
  }
  .row {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    flex-wrap: wrap;
  }
  label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.9rem;
  }
  label.inline {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0;
  }
  .problem {
    color: #c92a2a;
  }
</style>
