<script lang="ts">
  import type { Kit } from '@metakit-app/core';
  import type { CommandResult } from '../../shell/controller';
  import Section from './Section.svelte';

  let { kit, run }: { kit: Kit; run: (command: never) => CommandResult } =
    $props();

  let error = $state<string | null>(null);
  const exec = (command: Record<string, unknown>) => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
  };
  const grid = $derived(kit.settings.grid);
  let newLanguage = $state('');
  const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;
  function addLanguage() {
    const code = newLanguage.trim();
    if (!LANGUAGE.test(code)) {
      error = `"${code}" is not a language code such as en or de.`;
      return;
    }
    if (kit.manifest.languages.includes(code)) {
      error = `${code} is already listed.`;
      return;
    }
    exec({
      type: 'updateManifest',
      languages: [...kit.manifest.languages, code],
    });
    newLanguage = '';
  }
  function removeLanguage(code: string) {
    if (kit.manifest.languages.length === 1) {
      error = 'A Kit needs at least one language.';
      return;
    }
    exec({
      type: 'updateManifest',
      languages: kit.manifest.languages.filter((l) => l !== code),
    });
  }
</script>

<div class="editor" data-testid="settings-editor">
  <h2>Settings</h2>
  {#if error}<p class="notice error" role="alert">{error}</p>{/if}
  <Section
    title="Languages"
    help="Labels can be given in each language. The first one is used for options and previews."
  >
    <ul>
      {#each kit.manifest.languages as code (code)}
        <li>
          <span class="code">{code}</span>
          <button
            type="button"
            class="ghost danger"
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
        class="primary"
        onclick={addLanguage}
        data-testid="settings-add-language">Add language</button
      >
    </div>
  </Section>
  <Section
    title="Grid"
    help="The grid modellers see and snap to on the canvas."
  >
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
  </Section>
</div>

<style>
  .editor {
    display: grid;
    gap: var(--gap-4);
    max-width: 40rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--gap-1);
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--gap-1) var(--gap-2);
    background: var(--surface-2);
    border-radius: var(--radius-s);
  }
  .code {
    font-family: var(--font-mono);
  }
  .row {
    display: flex;
    gap: var(--gap-3);
    align-items: center;
    flex-wrap: wrap;
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  label.inline {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
  }
</style>
