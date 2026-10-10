<script lang="ts">
  import { onMount } from 'svelte';
  import { pageTheme, type ThemePreference } from '../theme/theme';
  import { menuBehaviour } from '../shell/menu-action';
  import BrandMark from './BrandMark.svelte';

  let {
    workspaceName,
    area,
    docsActive = false,
    tutorialsActive = false,
    helpOpen = false,
    onMode,
    onDocs,
    onTutorials,
    onHelp,
    onGit,
    onAssistant,
    onProfile,
    onCloseWorkspace,
  }: {
    workspaceName: string;
    area: 'model' | 'build';
    /** The Documentation area is showing: neither Model nor Build is current. */
    docsActive?: boolean;
    /** The Tutorials page is showing. */
    tutorialsActive?: boolean;
    helpOpen?: boolean;
    onMode: (area: 'model' | 'build') => void;
    onDocs: () => void;
    onTutorials: () => void;
    onHelp: () => void;
    onGit: () => void;
    onAssistant: () => void;
    onProfile: () => void;
    onCloseWorkspace: () => void;
  } = $props();

  // The Documentation or the Tutorials page is showing: neither Model nor Build is current.
  const away = $derived(docsActive || tutorialsActive);

  const theme = pageTheme();
  let preference = $state<ThemePreference>(theme.preference);
  onMount(() => theme.subscribe((p) => (preference = p)));

  const choices: { id: ThemePreference; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];
</script>

<header class="top-bar" data-testid="top-bar">
  <div class="brand">
    <BrandMark size={22} />
    <strong>MetaKit</strong>
  </div>
  <span class="workspace" title="Workspace folder">
    <span class="muted">Workspace</span>
    <span class="name" data-testid="workspace-title">{workspaceName}</span>
  </span>

  <div
    class="segmented-control mode"
    role="group"
    aria-label="Area"
    data-tour="top-areas"
  >
    <button
      type="button"
      aria-current={!away && area === 'model' ? 'page' : undefined}
      onclick={() => onMode('model')}
      data-testid="mode-model">Model</button
    >
    <button
      type="button"
      aria-current={!away && area === 'build' ? 'page' : undefined}
      onclick={() => onMode('build')}
      data-testid="mode-build">Build</button
    >
  </div>

  <span class="spacer"></span>

  <button
    type="button"
    class="ghost tutorials-btn"
    aria-current={tutorialsActive ? 'page' : undefined}
    onclick={onTutorials}
    title="Guided tours and step-by-step tutorials"
    data-testid="open-tutorials"
    data-tour="top-tutorials">Tutorials</button
  >
  <button
    type="button"
    class="ghost docs-btn"
    aria-current={docsActive ? 'page' : undefined}
    onclick={onDocs}
    title="Read the documentation"
    data-testid="open-docs"
    data-tour="top-docs">Docs</button
  >
  <button
    type="button"
    class="ghost help"
    aria-pressed={helpOpen}
    onclick={onHelp}
    title="Help for this page (F1)"
    data-testid="toggle-help"
    data-tour="top-help"
    ><span class="mark" aria-hidden="true">?</span> Help</button
  >

  <details class="menu" use:menuBehaviour data-testid="settings-menu">
    <summary data-tour="top-settings">Settings</summary>
    <div class="menu-list right">
      <div class="menu-heading">Appearance</div>
      <div class="theme" data-keep-open data-tour="settings-theme">
        <div class="segmented-control" role="group" aria-label="Appearance">
          {#each choices as c (c.id)}
            <button
              type="button"
              aria-pressed={preference === c.id}
              onclick={() => theme.set(c.id)}
              data-testid="theme-{c.id}">{c.label}</button
            >
          {/each}
        </div>
      </div>
      <div class="menu-sep"></div>
      <div class="menu-heading">Connections</div>
      <button
        type="button"
        onclick={onGit}
        data-testid="settings-git"
        data-tour="settings-git">Git settings…</button
      >
      <button
        type="button"
        onclick={onAssistant}
        data-testid="open-assistant"
        data-tour="settings-assistant">Assistant…</button
      >
      <div class="menu-sep"></div>
      <div class="menu-heading">This browser</div>
      <button
        type="button"
        onclick={onProfile}
        data-testid="settings-profile"
        data-tour="settings-profile">Your name and colour…</button
      >
      <div class="menu-sep"></div>
      <button
        type="button"
        onclick={onCloseWorkspace}
        data-testid="close-workspace">Close workspace</button
      >
    </div>
  </details>
</header>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    gap: var(--gap-4);
    height: var(--bar-height);
    flex: none;
    padding: 0 var(--gap-4);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    color: var(--text-strong);
  }
  .workspace {
    display: flex;
    gap: var(--gap-2);
    align-items: baseline;
    min-width: 0;
    font-size: var(--text-s);
    padding-left: var(--gap-4);
    border-left: 1px solid var(--line);
  }
  .name {
    color: var(--text-strong);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mode {
    margin-left: var(--gap-3);
  }
  .spacer {
    flex: 1;
  }
  .docs-btn[aria-current='page'],
  .tutorials-btn[aria-current='page'] {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .help[aria-pressed='true'] {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .mark {
    display: inline-grid;
    place-items: center;
    width: 1.15rem;
    height: 1.15rem;
    margin-right: 0.15rem;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
  }
  .theme {
    padding: var(--gap-1) var(--gap-2);
  }
  .theme .segmented-control {
    display: flex;
  }
  .theme .segmented-control > button {
    flex: 1;
  }
</style>
