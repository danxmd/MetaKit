<script lang="ts">
  import type {
    HealthFinding,
    ModelEntry,
    ToolEntry,
  } from '@metakit-app/storage';
  import type { ToolLibrary } from '@metakit-app/core';
  import type { BuiltInTool, ToolStart } from '../build/built-in';
  import { menuBehaviour } from '../shell/menu-action';
  import NewToolDialog from './NewToolDialog.svelte';
  import PageFrame from './PageFrame.svelte';
  import WorkspaceNotices from './WorkspaceNotices.svelte';

  let {
    tools,
    trashedTools,
    builtIns,
    models,
    health,
    warnings,
    error,
    notes = [],
    onNewTool,
    onAddTool,
    onUseBuiltIn,
    onGit,
    onEditTool,
    onExportTool,
    onTrashTool,
    onRestoreTool,
  }: {
    tools: ToolEntry[];
    trashedTools: ToolEntry[];
    /** The tool libraries that ship with MetaKit (ADR 0010). */
    builtIns: readonly BuiltInTool[];
    /** Used to count the models that use each tool library. */
    models: ModelEntry[];
    health: HealthFinding[];
    warnings: string[];
    error: string | null;
    notes?: string[];
    /** Makes a tool library, empty or from a copy; resolves with its slug. */
    onNewTool: (name: string, start: ToolStart) => Promise<string | undefined>;
    /** Called with the text of a tool library file the person chose. */
    onAddTool: (text: string) => void;
    /** Adds a built-in tool library to the workspace unchanged. */
    onUseBuiltIn: (tool: BuiltInTool) => void;
    /** Opens the Git settings, where a tool library is brought in from a repository. */
    onGit: () => void;
    onEditTool: (slug: string) => void;
    onExportTool: (slug: string) => void;
    onTrashTool: (slug: string) => void;
    onRestoreTool: (slug: string) => void;
  } = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  /** The New tool library dialog, and what it starts with. */
  let creating = $state<ToolStart | null>(null);

  async function create(name: string, start: ToolStart) {
    const slug = await onNewTool(name, start);
    if (!slug) return false;
    creating = null;
    onEditTool(slug);
    return true;
  }

  async function chosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onAddTool(await file.text());
  }

  const usedBy = (tool: ToolEntry) =>
    models.filter((m) => m.tool === tool.id).length;
  const inWorkspace = (b: BuiltInTool) => tools.find((t) => t.id === b.id);
  const isBuiltIn = (t: ToolEntry) => builtIns.some((b) => b.id === t.id);

  /** What is inside a built-in library, read when its "What is inside" opens. */
  let contents = $state<
    Record<string, { classes: string[]; relations: string[] }>
  >({});
  async function readContents(b: BuiltInTool) {
    if (contents[b.id]) return;
    const tool = JSON.parse(await b.load()) as ToolLibrary;
    const label = (x: { key: string; labels?: Record<string, string> }) =>
      x.labels?.['en'] ?? x.key;
    const sorted = (xs: string[]) => xs.sort((a, c) => a.localeCompare(c));
    contents = {
      ...contents,
      [b.id]: {
        classes: sorted(
          Object.values(tool.classes)
            .filter((c) => !c.abstract)
            .map(label),
        ),
        relations: sorted(Object.values(tool.relations).map(label)),
      },
    };
  }
</script>

<PageFrame
  title="Kits"
  help="Kits define the notation and rules models use."
  testid="kits-page"
>
  {#snippet actions()}
    <details class="menu" use:menuBehaviour data-testid="add-menu">
      <summary>Add</summary>
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
      data-testid="new-kit">New Kit</button
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
      <h2 id="workspace-kits">In this workspace</h2>
      <p class="muted">
        The Kits your team uses and edits. Everyone with the folder sees the
        same ones.
      </p>
    </div>
    {#if tools.length === 0}
      <div class="card empty" data-testid="no-kits">
        <h3>No Kit in this workspace yet</h3>
        <p class="muted">
          Without one there is nothing to model with. To start:
        </p>
        <ul>
          <li>
            <strong>Use a built-in one</strong> as it is, from the list below.
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
        {#each tools as tool (tool.slug)}
          <li class="card tool" data-testid="kit-{tool.slug}">
            <div class="head">
              <h3>{tool.name}</h3>
              <span class="badge">Version {tool.version}</span>
            </div>
            <div class="facts">
              {#if tool.basedOn}
                <p class="muted" data-testid="based-on-{tool.slug}">
                  Based on {tool.basedOn.name}
                  {tool.basedOn.version}
                </p>
              {:else if isBuiltIn(tool)}
                <p class="muted">Added from the built-in set.</p>
              {/if}
              <p class="muted">
                {#if usedBy(tool) === 0}No models use it yet.{:else}Used by {usedBy(
                    tool,
                  )} model{usedBy(tool) === 1 ? '' : 's'}.{/if}
              </p>
            </div>
            <div class="foot">
              <button
                class="primary"
                onclick={() => onEditTool(tool.slug)}
                aria-label="Edit {tool.name}"
                data-testid="edit-kit-{tool.slug}">Edit</button
              >
              <details class="menu more" use:menuBehaviour>
                <summary aria-label="More actions for {tool.name}">…</summary>
                <div class="menu-list right">
                  <button
                    type="button"
                    onclick={() =>
                      (creating = { kind: 'workspace', slug: tool.slug })}
                    data-testid="copy-kit-{tool.slug}">Copy and extend…</button
                  >
                  <button
                    type="button"
                    onclick={() => onExportTool(tool.slug)}
                    data-testid="export-kit-{tool.slug}">Export package</button
                  >
                  <div class="menu-sep"></div>
                  <button
                    type="button"
                    onclick={() => onTrashTool(tool.slug)}
                    aria-label="Delete {tool.name}">Delete</button
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
      <h2 id="built-in-kits">Built-in Kits</h2>
      <p class="muted">
        Ready-made Kits that come with MetaKit. They cannot be changed here: use
        one as it is, or copy it to make it your own.
      </p>
    </div>
    <ul class="grid">
      {#each builtIns as b (b.id)}
        {@const added = inWorkspace(b)}
        <li class="card tool built-in" data-testid="built-in-{b.id}">
          <div class="head">
            <h3>{b.name}</h3>
            <span class="badge lock" title="Built-in Kits are read-only"
              ><svg
                viewBox="0 0 20 20"
                width="11"
                height="11"
                aria-hidden="true"
                ><path
                  d="M6 9V6.5a4 4 0 0 1 8 0V9M5 9h10v8H5z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                /></svg
              >Built-in · read-only</span
            >
          </div>
          <p class="muted">{b.description}</p>
          <details
            class="inside"
            ontoggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) readContents(b);
            }}
          >
            <summary>What is inside</summary>
            {#if contents[b.id]}
              <p>
                <strong>Classes:</strong>
                {contents[b.id]!.classes.join(', ')}
              </p>
              {#if contents[b.id]!.relations.length > 0}
                <p>
                  <strong>Relation classes:</strong>
                  {contents[b.id]!.relations.join(', ')}
                </p>
              {/if}
            {:else}
              <p class="muted">Reading…</p>
            {/if}
          </details>
          <div class="foot">
            {#if added}
              <span class="muted in-use" data-testid="built-in-added-{b.id}"
                >✓ In this workspace</span
              >
            {:else}
              <button
                onclick={() => onUseBuiltIn(b)}
                data-testid="use-built-in-{b.id}">Use in this workspace</button
              >
            {/if}
            <button
              class="ghost"
              onclick={() => (creating = { kind: 'built-in', tool: b })}
              data-testid="copy-built-in-{b.id}">Copy and extend…</button
            >
          </div>
        </li>
      {/each}
    </ul>
  </section>

  {#if trashedTools.length > 0}
    <details class="trash" data-testid="trash-kits">
      <summary>Deleted Kits ({trashedTools.length}), kept for 30 days</summary>
      <ul>
        {#each trashedTools as tool (tool.slug)}
          <li>
            <span>{tool.name}</span>
            <button
              onclick={() => onRestoreTool(tool.slug)}
              aria-label="Restore {tool.name}">Restore</button
            >
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</PageFrame>

{#if creating}
  <NewToolDialog
    {tools}
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
  .tool {
    padding: var(--gap-4);
    display: grid;
    gap: var(--gap-3);
    align-content: space-between;
  }
  .tool h3 {
    margin: 0;
    font-size: var(--text-m);
  }
  .tool p {
    margin: 0;
  }
  .facts {
    display: grid;
    gap: var(--gap-1);
  }
  /* Built-in cards read as a shelf to take from, not as the team's own work. */
  .built-in {
    background: var(--surface-2);
    border-style: dashed;
    box-shadow: none;
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
  .lock {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .inside {
    font-size: var(--text-s);
  }
  .inside summary {
    cursor: pointer;
    color: var(--text-muted);
  }
  .inside p {
    margin: var(--gap-1) 0 0;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--gap-2);
    flex-wrap: wrap;
  }
  .in-use {
    font-size: var(--text-s);
  }
  details.more > summary::after {
    content: none;
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
