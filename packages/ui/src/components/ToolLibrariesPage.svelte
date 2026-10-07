<script lang="ts">
  import type {
    HealthFinding,
    ModelEntry,
    ToolEntry,
  } from '@metakit-app/storage';
  import { menuBehaviour } from '../shell/menu-action';
  import PageFrame from './PageFrame.svelte';
  import WorkspaceNotices from './WorkspaceNotices.svelte';

  let {
    tools,
    trashedTools,
    models,
    health,
    warnings,
    error,
    notes = [],
    onNewTool,
    onAddTool,
    onGit,
    onEditTool,
    onExportTool,
    onTrashTool,
    onRestoreTool,
  }: {
    tools: ToolEntry[];
    trashedTools: ToolEntry[];
    /** Used to count the models that use each tool library. */
    models: ModelEntry[];
    health: HealthFinding[];
    warnings: string[];
    error: string | null;
    notes?: string[];
    /** Makes an empty tool library with this name; resolves with its slug. */
    onNewTool: (name: string) => Promise<string | undefined>;
    /** Called with the text of a tool library file the person chose. */
    onAddTool: (text: string) => void;
    /** Opens the Git settings, where a tool library is brought in from a repository. */
    onGit: () => void;
    onEditTool: (slug: string) => void;
    onExportTool: (slug: string) => void;
    onTrashTool: (slug: string) => void;
    onRestoreTool: (slug: string) => void;
  } = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  let toolName = $state('');
  let naming = $state(false);

  async function createTool(event: Event) {
    event.preventDefault();
    const slug = await onNewTool(toolName);
    if (slug) {
      toolName = '';
      naming = false;
      onEditTool(slug);
    }
  }

  async function chosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onAddTool(await file.text());
  }

  const usedBy = (tool: ToolEntry) =>
    models.filter((m) => m.tool === tool.id).length;
</script>

<PageFrame
  title="Tool libraries"
  help="Tool libraries define the notation and rules models use."
  testid="tools-page"
>
  {#snippet actions()}
    <details class="menu" use:menuBehaviour data-testid="add-menu">
      <summary>Add</summary>
      <div class="menu-list right">
        <button
          type="button"
          onclick={() => fileInput?.click()}
          data-testid="add-tool">From file…</button
        >
        <button type="button" onclick={onGit} data-testid="open-git"
          >From Git…</button
        >
      </div>
    </details>
    <button
      class="primary"
      onclick={() => (naming = !naming)}
      data-testid="new-tool">New tool library</button
    >
  {/snippet}

  <input
    bind:this={fileInput}
    type="file"
    accept=".json,application/json"
    class="visually-hidden"
    tabindex="-1"
    aria-label="Tool library file"
    onchange={chosen}
    data-testid="tool-file"
  />

  <WorkspaceNotices {error} {warnings} {notes} {health} />

  {#if naming}
    <form class="card naming" onsubmit={createTool}>
      <label>
        Name of the new tool library
        <input
          bind:value={toolName}
          placeholder="For example: Order process"
          data-testid="new-tool-name"
        />
      </label>
      <button type="button" onclick={() => (naming = false)}>Cancel</button>
      <button class="primary" type="submit" data-testid="new-tool-create"
        >Create and edit</button
      >
    </form>
  {/if}

  {#if tools.length === 0}
    <section class="card empty" data-testid="no-tools">
      <h2>No tool library yet</h2>
      <p class="muted">
        Without a tool library there is nothing to model with. There are three
        ways to start:
      </p>
      <ol>
        <li>
          <strong>Build one</strong> from scratch with “New tool library”.
        </li>
        <li>
          <strong>Add a file</strong> with Add, From file. The MetaKit
          repository has samples, for example
          <code>tools/agent-pipeline/tool.json</code>
          and <code>tools/bpmn-lite/tool.json</code>.
        </li>
        <li>
          <strong>Use a Git repository</strong> with Add, From Git, if your team keeps
          its tool library in GitHub or GitLab.
        </li>
      </ol>
    </section>
  {:else}
    <ul class="grid">
      {#each tools as tool (tool.slug)}
        <li class="card tool" data-testid="tool-{tool.slug}">
          <div class="head">
            <h2>{tool.name}</h2>
            <span class="badge">Version {tool.version}</span>
          </div>
          <p class="muted">
            {#if usedBy(tool) === 0}No models use it yet.{:else}Used by {usedBy(
                tool,
              )} model{usedBy(tool) === 1 ? '' : 's'}.{/if}
          </p>
          <div class="foot">
            <button
              class="primary"
              onclick={() => onEditTool(tool.slug)}
              aria-label="Edit {tool.name}"
              data-testid="edit-tool-{tool.slug}">Edit</button
            >
            <details class="menu more" use:menuBehaviour>
              <summary aria-label="More actions for {tool.name}">…</summary>
              <div class="menu-list right">
                <button
                  type="button"
                  onclick={() => onExportTool(tool.slug)}
                  data-testid="export-tool-{tool.slug}">Export package</button
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

  {#if trashedTools.length > 0}
    <details class="trash" data-testid="trash-tools">
      <summary
        >Deleted tool libraries ({trashedTools.length}), kept for 30 days</summary
      >
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

<style>
  .naming {
    display: flex;
    align-items: flex-end;
    gap: var(--gap-2);
    padding: var(--gap-4);
  }
  .naming label {
    flex: 1;
    display: grid;
    gap: var(--gap-1);
  }
  .empty {
    padding: var(--gap-6);
    display: grid;
    gap: var(--gap-3);
  }
  .empty ol {
    margin: 0;
    padding-left: 1.3rem;
    display: grid;
    gap: var(--gap-2);
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
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--gap-2);
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
