<script lang="ts">
  import { onMount } from 'svelte';
  import { pageTheme, type ThemePreference } from '../theme/theme';
  import { menuBehaviour } from '../shell/menu-action';
  import BrandMark from './BrandMark.svelte';

  let {
    workspaceName,
    area,
    onMode,
    onGit,
    onAssistant,
    onProfile,
    onCloseWorkspace,
  }: {
    workspaceName: string;
    area: 'model' | 'build';
    onMode: (area: 'model' | 'build') => void;
    onGit: () => void;
    onAssistant: () => void;
    onProfile: () => void;
    onCloseWorkspace: () => void;
  } = $props();

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

  <div class="segmented-control mode" role="group" aria-label="Area">
    <button
      type="button"
      aria-current={area === 'model' ? 'page' : undefined}
      onclick={() => onMode('model')}
      data-testid="mode-model">Model</button
    >
    <button
      type="button"
      aria-current={area === 'build' ? 'page' : undefined}
      onclick={() => onMode('build')}
      data-testid="mode-build">Build</button
    >
  </div>

  <span class="spacer"></span>

  <details class="menu" use:menuBehaviour data-testid="settings-menu">
    <summary>Settings</summary>
    <div class="menu-list right">
      <div class="menu-heading">Appearance</div>
      <div class="theme" data-keep-open>
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
      <button type="button" onclick={onGit} data-testid="settings-git"
        >Git settings…</button
      >
      <button type="button" onclick={onAssistant} data-testid="open-assistant"
        >Assistant…</button
      >
      <div class="menu-sep"></div>
      <div class="menu-heading">This browser</div>
      <button type="button" onclick={onProfile} data-testid="settings-profile"
        >Your name and colour…</button
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
