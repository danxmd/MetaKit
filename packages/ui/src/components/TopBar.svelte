<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { pageTheme, type ThemePreference } from '../theme/theme';
  import { menuBehaviour } from '../shell/menu-action';
  import BrandMark from './BrandMark.svelte';
  import Icon from './Icon.svelte';

  /** One step of the location: the workspace, Models or Kits, the open document. */
  interface Crumb {
    id: 'workspace' | 'area' | 'document';
    label: string;
    title?: string;
    /** Goes to that page; every crumb but the last has it. */
    onSelect?: () => void;
    /** The last crumb can be renamed in place (the open model). */
    onRename?: (name: string) => void;
    /** A test id for the label, kept from before the breadcrumb. */
    testid?: string;
  }

  let {
    crumbs,
    status,
    area,
    docsActive = false,
    tutorialsActive = false,
    helpOpen = false,
    onMode,
    onTutorials,
    onHelp,
    onGit,
    onAssistant,
    onProfile,
    onCloseWorkspace,
  }: {
    crumbs: Crumb[];
    /** Save or sync status and people of the open document, filled by its view. */
    status?: Snippet;
    area: 'model' | 'build';
    /** The Documentation area is showing: neither Model nor Build is current. */
    docsActive?: boolean;
    /** The Tutorials page is showing. */
    tutorialsActive?: boolean;
    helpOpen?: boolean;
    onMode: (area: 'model' | 'build') => void;
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

  let renaming = $state(false);
  // A rename left open ends when the document closes.
  $effect(() => {
    if (!crumbs.at(-1)?.onRename) renaming = false;
  });

  function finishRename(crumb: Crumb, input: HTMLInputElement, keep: boolean) {
    if (!renaming) return;
    renaming = false;
    const name = input.value.trim();
    if (keep && name !== '' && name !== crumb.label) crumb.onRename?.(name);
  }

  function focusAll(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

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
  <nav class="crumbs" aria-label="Location" data-tour="top-location">
    <ol>
      {#each crumbs as crumb, i (crumb.id)}
        {@const last = i === crumbs.length - 1}
        <li class={crumb.id}>
          {#if i > 0}<span class="sep" aria-hidden="true">›</span>{/if}
          {#if last && crumb.onRename && renaming}
            <input
              class="rename"
              value={crumb.label}
              aria-label="Name"
              use:focusAll
              onkeydown={(e) => {
                if (e.key === 'Enter')
                  finishRename(crumb, e.currentTarget, true);
                else if (e.key === 'Escape') {
                  e.stopPropagation();
                  finishRename(crumb, e.currentTarget, false);
                }
              }}
              onblur={(e) => finishRename(crumb, e.currentTarget, true)}
              data-testid="crumb-rename"
            />
          {:else if last && crumb.onRename}
            <button
              type="button"
              class="ghost link"
              aria-current="page"
              title="{crumb.label}: click to rename"
              onclick={() => (renaming = true)}
              data-testid="crumb-{crumb.id}"
              ><span class="label" data-testid={crumb.testid}
                >{crumb.label}</span
              ></button
            >
          {:else if !last && crumb.onSelect}
            <button
              type="button"
              class="ghost link"
              title={crumb.title ?? crumb.label}
              onclick={crumb.onSelect}
              data-testid="crumb-{crumb.id}"
              ><span class="label" data-testid={crumb.testid}
                >{crumb.label}</span
              ></button
            >
          {:else}
            <span
              class="here"
              aria-current="page"
              title={crumb.title ?? crumb.label}
              data-testid="crumb-{crumb.id}"
              ><span class="label" data-testid={crumb.testid}
                >{crumb.label}</span
              ></span
            >
          {/if}
        </li>
      {/each}
    </ol>
  </nav>

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

  {#if status}
    <div class="status" data-testid="document-status">{@render status()}</div>
  {/if}

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
    class="ghost help"
    aria-pressed={helpOpen}
    onclick={onHelp}
    title="Help for this page (F1)"
    data-testid="toggle-help"
    data-tour="top-help"><Icon name="help" /> Help</button
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
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    color: var(--text-strong);
  }
  .crumbs {
    flex: 0 1 auto;
    min-width: 0;
    padding-left: var(--gap-3);
    border-left: 1px solid var(--line);
  }
  .crumbs ol {
    display: flex;
    align-items: center;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-s);
  }
  .crumbs li {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .crumbs li.area {
    flex: none;
  }
  .sep {
    padding: 0 var(--gap-1);
    color: var(--text-faint);
  }
  .link,
  .here {
    display: flex;
    min-width: 0;
    padding: 0.2rem var(--gap-2);
  }
  .link {
    color: var(--text-muted);
  }
  .here,
  .link[aria-current='page'] {
    color: var(--text-strong);
    font-weight: 600;
  }
  /* Long names are cut short; the full name is in the window title of the button. */
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .workspace .label {
    max-width: 12rem;
  }
  .document .label {
    max-width: 22rem;
  }
  .rename {
    width: 16rem;
    min-width: 0;
    font-size: var(--text-s);
  }
  /* Only the crumbs give way on a narrow window; the status keeps its size. */
  .status {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--gap-2);
  }
  .mode {
    flex: none;
    margin-left: var(--gap-2);
  }
  .top-bar > :global(details),
  .top-bar > button {
    flex: none;
  }
  .spacer {
    flex: 1;
  }
  .tutorials-btn[aria-current='page'] {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .help[aria-pressed='true'] {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .help {
    display: flex;
    align-items: center;
    gap: var(--gap-1);
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
