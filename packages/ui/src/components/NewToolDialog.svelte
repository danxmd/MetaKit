<script lang="ts">
  import { onMount } from 'svelte';
  import type { ToolEntry } from '@metakit-app/storage';
  import type { BuiltInTool, ToolStart } from '../build/built-in';

  let {
    tools,
    builtIns,
    initial = { kind: 'empty' },
    onCreate,
    onCancel,
  }: {
    /** The workspace's own tool libraries. */
    tools: ToolEntry[];
    builtIns: readonly BuiltInTool[];
    /** What is chosen when the dialog opens, for "Copy and extend" on a card. */
    initial?: ToolStart;
    /** Resolves when the library is made; the dialog then closes. */
    onCreate: (name: string, start: ToolStart) => Promise<boolean>;
    onCancel: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let name = $state('');
  let choice = $state('empty');
  let busy = $state(false);

  const keyOf = (start: ToolStart) =>
    start.kind === 'empty'
      ? 'empty'
      : start.kind === 'workspace'
        ? `workspace:${start.slug}`
        : `built-in:${start.tool.id}`;

  function startOf(key: string): ToolStart {
    if (key.startsWith('workspace:'))
      return { kind: 'workspace', slug: key.slice('workspace:'.length) };
    const tool = builtIns.find((t) => `built-in:${t.id}` === key);
    return tool ? { kind: 'built-in', tool } : { kind: 'empty' };
  }

  const sourceName = $derived.by(() => {
    const start = startOf(choice);
    if (start.kind === 'workspace')
      return tools.find((t) => t.slug === start.slug)?.name;
    if (start.kind === 'built-in') return start.tool.name;
    return undefined;
  });

  // Set once, so a refresh of the lists while the dialog is open does not reset the choice.
  onMount(() => {
    choice = keyOf(initial);
    if (initial.kind === 'built-in') name = `${initial.tool.name} (ours)`;
    dialog?.showModal();
  });

  async function submit(event: Event) {
    event.preventDefault();
    if (name.trim() === '' || busy) return;
    busy = true;
    try {
      if (await onCreate(name, startOf(choice))) dialog?.close();
    } finally {
      busy = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  onclose={onCancel}
  aria-labelledby="new-kit-title"
  data-testid="new-kit-dialog"
>
  <form onsubmit={submit}>
    <div class="head">
      <h2 id="new-kit-title">New Kit</h2>
      <p class="muted">
        Start with an empty one, or copy an existing one and extend it. A copy
        is yours: the original does not change.
      </p>
    </div>
    <label>
      Name
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value={name}
        autofocus
        placeholder="For example: Order process"
        data-testid="new-kit-name"
      />
    </label>
    <fieldset>
      <legend>Start from</legend>
      <div class="options">
        <label class="option">
          <input
            type="radio"
            name="start"
            value="empty"
            bind:group={choice}
            data-testid="start-empty"
          />
          <span
            ><strong>Empty</strong><small>Build every class yourself.</small
            ></span
          >
        </label>
        {#if tools.length > 0}
          <p class="group">A copy of a Kit in this workspace</p>
          {#each tools as tool (tool.slug)}
            <label class="option">
              <input
                type="radio"
                name="start"
                value="workspace:{tool.slug}"
                bind:group={choice}
                data-testid="start-workspace-{tool.slug}"
              />
              <span
                ><strong>{tool.name}</strong><small
                  >Version {tool.version}</small
                ></span
              >
            </label>
          {/each}
        {/if}
        <p class="group">A copy of a built-in Kit</p>
        {#each builtIns as tool (tool.id)}
          <label class="option">
            <input
              type="radio"
              name="start"
              value="built-in:{tool.id}"
              bind:group={choice}
              data-testid="start-built-in-{tool.id}"
            />
            <span
              ><strong>{tool.name}</strong><small>{tool.description}</small
              ></span
            >
          </label>
        {/each}
      </div>
    </fieldset>
    {#if sourceName}
      <p class="muted note" data-testid="new-kit-note">
        The new Kit starts with everything in {sourceName}, at version 1.0.0,
        and shows “Based on {sourceName}”.
      </p>
    {/if}
    <div class="actions">
      <button type="button" onclick={() => dialog?.close()}>Cancel</button>
      <button
        class="primary"
        type="submit"
        disabled={name.trim() === '' || busy}
        data-testid="new-kit-create">Create and edit</button
      >
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(32rem, calc(100vw - 2rem));
  }
  form {
    display: grid;
    gap: var(--gap-4);
  }
  .head {
    display: grid;
    gap: var(--gap-1);
  }
  .head p,
  .note {
    font-size: var(--text-s);
    margin: 0;
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: var(--gap-1);
  }
  .options {
    display: grid;
    gap: var(--gap-1);
    max-height: min(22rem, 45dvh);
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--gap-2);
  }
  .group {
    margin: var(--gap-2) 0 0;
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .option {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-2);
    padding: var(--gap-2);
    border-radius: var(--radius-s);
    cursor: pointer;
  }
  .option:hover {
    background: var(--hover-bg);
  }
  .option:has(input:checked) {
    background: var(--accent-soft);
  }
  .option input {
    margin-top: 0.2rem;
  }
  .option span {
    display: grid;
  }
  .option small {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
  }
</style>
