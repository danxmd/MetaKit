<script lang="ts">
  import type {
    HealthFinding,
    ModelEntry,
    KitEntry,
  } from '@metakit-app/storage';
  import {
    BUILT_IN_DOMAINS,
    type BuiltInDomain,
    type BuiltInKit,
    type KitStart,
  } from '../build/built-in';
  import { menuBehaviour } from '../shell/menu-action';
  import NewKitDialog from './NewKitDialog.svelte';
  import PageFrame from './PageFrame.svelte';
  import WorkspaceNotices from './WorkspaceNotices.svelte';

  let {
    kits,
    trashedKits,
    builtIns,
    models,
    health,
    warnings,
    error,
    notes = [],
    onNewKit,
    onAddKit,
    onUseBuiltIn,
    onGit,
    onEditKit,
    onExportKit,
    onTrashKit,
    onRestoreKit,
  }: {
    kits: KitEntry[];
    trashedKits: KitEntry[];
    /** The Kits that ship with MetaKit (ADR 0010). */
    builtIns: readonly BuiltInKit[];
    /** Used to count the models that use each Kit. */
    models: ModelEntry[];
    health: HealthFinding[];
    warnings: string[];
    error: string | null;
    notes?: string[];
    /** Makes a Kit, empty or from a copy; resolves with its slug. */
    onNewKit: (name: string, start: KitStart) => Promise<string | undefined>;
    /** Called with the text of a Kit file the person chose. */
    onAddKit: (text: string) => void;
    /** Adds a built-in Kit to the workspace unchanged. */
    onUseBuiltIn: (kit: BuiltInKit) => void;
    /** Opens the Git settings, where a Kit is brought in from a repository. */
    onGit: () => void;
    onEditKit: (slug: string) => void;
    onExportKit: (slug: string) => void;
    onTrashKit: (slug: string) => void;
    onRestoreKit: (slug: string) => void;
  } = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  /** The New Kit dialog, and what it starts with. */
  let creating = $state<KitStart | null>(null);

  async function create(name: string, start: KitStart) {
    const slug = await onNewKit(name, start);
    if (!slug) return false;
    creating = null;
    onEditKit(slug);
    return true;
  }

  async function chosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onAddKit(await file.text());
  }

  /** The catalogue dialog, and the domain it opens at. */
  let browsing = $state<{ domain: BuiltInDomain | 'all' } | null>(null);
  const domains = $derived(
    BUILT_IN_DOMAINS.map((d) => ({
      ...d,
      count: builtIns.filter((b) => b.domain === d.id).length,
    })).filter((d) => d.count > 0),
  );

  const usedBy = (kit: KitEntry) =>
    models.filter((m) => m.kit === kit.id).length;
  const inWorkspace = (b: BuiltInKit) => kits.find((t) => t.id === b.id);
  const isBuiltIn = (t: KitEntry) => builtIns.some((b) => b.id === t.id);
</script>

<PageFrame
  title="Kits"
  help="Kits define the notation and rules models use."
  testid="kits-page"
>
  {#snippet actions()}
    <details class="menu" use:menuBehaviour data-testid="add-menu">
      <summary data-tour="kits-add">Add</summary>
      <div class="menu-list right">
        <button
          type="button"
          onclick={() => fileInput?.click()}
          data-testid="add-kit">From file…</button
        >
        <button type="button" onclick={onGit} data-testid="open-git"
          >From Git…</button
        >
      </div>
    </details>
    <button
      class="primary"
      onclick={() => (creating = { kind: 'empty' })}
      data-testid="new-kit"
      data-tour="kits-new">New Kit</button
    >
  {/snippet}

  <input
    bind:this={fileInput}
    type="file"
    accept=".json,application/json"
    class="visually-hidden"
    tabindex="-1"
    aria-label="Kit file"
    onchange={chosen}
    data-testid="kit-file"
  />

  <WorkspaceNotices {error} {warnings} {notes} {health} />

  <section
    class="section"
    aria-labelledby="workspace-kits"
    data-testid="workspace-kits"
  >
    <div class="section-head">
      <h2 id="workspace-kits" data-tour="kits-workspace">In this workspace</h2>
      <p class="muted">
        The Kits your team uses and edits. Everyone with the folder sees the
        same ones.
      </p>
    </div>
    {#if kits.length === 0}
      <div class="card empty" data-testid="no-kits">
        <h3>No Kit in this workspace yet</h3>
        <p class="muted">
          Without one there is nothing to model with. To start:
        </p>
        <ul>
          <li>
            <strong>Use a built-in one</strong> as it is: choose
            <em>Browse built-in Kits</em> below.
          </li>
          <li>
            <strong>Copy one and extend it</strong> with “Copy and extend”, or with
            “New Kit”.
          </li>
          <li>
            <strong>Build one from scratch</strong> with “New Kit”.
          </li>
          <li>
            <strong>Bring one in</strong> with Add, from a file or a Git repository.
          </li>
        </ul>
      </div>
    {:else}
      <ul class="grid">
        {#each kits as kit (kit.slug)}
          <li class="card kit" data-testid="kit-{kit.slug}">
            <div class="head">
              <h3>{kit.name}</h3>
              <span class="badge">Version {kit.version}</span>
            </div>
            <div class="facts">
              {#if kit.basedOn}
                <p class="muted" data-testid="based-on-{kit.slug}">
                  Based on {kit.basedOn.name}
                  {kit.basedOn.version}
                </p>
              {:else if isBuiltIn(kit)}
                <p class="muted">Added from the built-in set.</p>
              {/if}
              <p class="muted">
                {#if usedBy(kit) === 0}No models use it yet.{:else}Used by {usedBy(
                    kit,
                  )} model{usedBy(kit) === 1 ? '' : 's'}.{/if}
              </p>
            </div>
            <div class="foot">
              <button
                class="primary"
                onclick={() => onEditKit(kit.slug)}
                aria-label="Edit {kit.name}"
                data-testid="edit-kit-{kit.slug}"
                data-tour="kits-edit">Edit</button
              >
              <details class="menu more" use:menuBehaviour>
                <summary aria-label="More actions for {kit.name}">…</summary>
                <div class="menu-list right">
                  <button
                    type="button"
                    onclick={() =>
                      (creating = { kind: 'workspace', slug: kit.slug })}
                    data-testid="copy-kit-{kit.slug}">Copy and extend…</button
                  >
                  <button
                    type="button"
                    onclick={() => onExportKit(kit.slug)}
                    data-testid="export-kit-{kit.slug}">Export package</button
                  >
                  <div class="menu-sep"></div>
                  <button
                    type="button"
                    onclick={() => onTrashKit(kit.slug)}
                    aria-label="Delete {kit.name}">Delete</button
                  >
                </div>
              </details>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section
    class="section"
    aria-labelledby="built-in-kits"
    data-testid="built-in-kits"
  >
    <div class="section-head">
      <h2 id="built-in-kits" data-tour="kits-built-in">Built-in Kits</h2>
      <p class="muted">
        Ready-made Kits that come with MetaKit, each with a sample model. Use
        one as it is, or copy it to make it your own.
      </p>
    </div>
    <div class="band">
      <ul class="chips" aria-label="Built-in Kits by domain">
        {#each domains as d (d.id)}
          <li>
            <button
              type="button"
              class="chip"
              onclick={() => (browsing = { domain: d.id })}
              data-testid="built-in-domain-{d.id}"
              >{d.label}<span class="count">{d.count}</span></button
            >
          </li>
        {/each}
      </ul>
      <button
        type="button"
        class="primary"
        onclick={() => (browsing = { domain: 'all' })}
        data-testid="browse-built-ins"
        data-tour="kits-browse">Browse built-in Kits</button
      >
    </div>
  </section>

  {#if trashedKits.length > 0}
    <details class="trash" data-testid="trash-kits">
      <summary>Deleted Kits ({trashedKits.length}), kept for 30 days</summary>
      <ul>
        {#each trashedKits as kit (kit.slug)}
          <li>
            <span>{kit.name}</span>
            <button
              onclick={() => onRestoreKit(kit.slug)}
              aria-label="Restore {kit.name}">Restore</button
            >
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</PageFrame>

{#if browsing}
  <!-- Loaded on first use, so the catalogue and its pictures cost nothing at start-up. -->
  {#await import('./KitCatalogDialog.svelte') then { default: KitCatalogDialog }}
    <KitCatalogDialog
      {builtIns}
      inWorkspace={(b) => inWorkspace(b) !== undefined}
      initialDomain={browsing.domain}
      onUse={onUseBuiltIn}
      onCopy={(b) => (creating = { kind: 'built-in', kit: b })}
      onClose={() => (browsing = null)}
    />
  {/await}
{/if}

{#if creating}
  <NewKitDialog
    {kits}
    {builtIns}
    initial={creating}
    onCreate={create}
    onCancel={() => (creating = null)}
  />
{/if}

<style>
  .section {
    display: grid;
    gap: var(--gap-3);
  }
  .section-head {
    display: grid;
    gap: var(--gap-1);
  }
  .section-head h2 {
    font-size: var(--text-l);
    margin: 0;
  }
  .section-head p {
    margin: 0;
    font-size: var(--text-s);
  }
  .empty {
    padding: var(--gap-5);
    display: grid;
    gap: var(--gap-2);
  }
  .empty h3,
  .empty p {
    margin: 0;
  }
  .empty ul {
    margin: 0;
    padding-left: 1.3rem;
    display: grid;
    gap: var(--gap-1);
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: var(--gap-4);
  }
  .kit {
    padding: var(--gap-4);
    display: grid;
    gap: var(--gap-3);
    align-content: space-between;
  }
  .kit h3 {
    margin: 0;
    font-size: var(--text-m);
  }
  .kit p {
    margin: 0;
  }
  .facts {
    display: grid;
    gap: var(--gap-1);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--gap-2);
  }
  .badge {
    white-space: nowrap;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--gap-2);
    flex-wrap: wrap;
  }
  details.more > summary::after {
    content: none;
  }
  /* The built-in Kits read as a shelf to take from, not as the team's own work. */
  .band {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-3);
    padding: var(--gap-3) var(--gap-4);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--gap-2);
    border-radius: 999px;
  }
  .count {
    color: var(--text-muted);
    font-size: var(--text-s);
    font-variant-numeric: tabular-nums;
  }
  .trash {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .trash summary {
    cursor: pointer;
  }
  .trash ul {
    list-style: none;
    margin: var(--gap-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--gap-1);
  }
  .trash li {
    display: flex;
    align-items: center;
    gap: var(--gap-3);
  }
</style>
