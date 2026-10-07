<script lang="ts">
  import { tick } from 'svelte';
  import { namesAtCursor, type Completion } from '@metakit-app/shapes';

  let {
    value,
    label,
    testid,
    complete,
    onCommit,
  }: {
    /** The formula as stored, including its leading `=`. */
    value: string;
    /** Accessible name of the field. */
    label: string;
    testid: string;
    complete: (prefix: string) => Completion[];
    /** Called with the formula (always starting with `=`), or '' when it was cleared. */
    onCommit: (value: string) => void;
  } = $props();

  let draft = $state('');
  let dirty = false;
  let input: HTMLInputElement | undefined = $state();
  let options = $state<Completion[]>([]);
  let active = $state(0);
  let range: { start: number; end: number } | null = null;

  // A new stored value (another part, an undo) replaces what is shown.
  $effect(() => {
    draft = value;
    dirty = false;
    options = [];
  });

  const KIND: Record<Completion['kind'], string> = {
    attribute: 'attribute',
    let: 'named value',
    builtin: 'built in',
    function: 'function',
  };

  function typed() {
    draft = input?.value ?? draft;
    dirty = true;
    const at = namesAtCursor(draft, input?.selectionStart ?? draft.length);
    if (!at || at.prefix === '') {
      options = [];
      return;
    }
    range = at;
    options = complete(at.prefix).filter(
      (c) => c.name !== at.prefix || at.prefix === '',
    );
    active = 0;
  }

  async function accept(choice: Completion) {
    if (!range) return;
    const before = draft.slice(0, range.start);
    const after = draft.slice(range.end);
    draft = before + choice.insert + after;
    const caret = before.length + choice.insert.length;
    dirty = true;
    options = [];
    await tick();
    input?.setSelectionRange(caret, caret);
    input?.focus();
    commit();
  }

  function commit() {
    if (!dirty) return;
    dirty = false;
    const text = draft.trim();
    if (text === '' || text === '=') onCommit('');
    else onCommit(text.startsWith('=') ? text : `= ${text}`);
  }

  function key(e: KeyboardEvent) {
    if (options.length > 0) {
      if (e.key === 'ArrowDown') {
        active = (active + 1) % options.length;
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        active = (active - 1 + options.length) % options.length;
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        void accept(options[active]!);
      } else if (e.key === 'Escape') {
        options = [];
        e.stopPropagation();
      }
    } else if (e.key === 'Enter') commit();
  }
</script>

<div class="formula">
  <input
    bind:this={input}
    type="text"
    class="mono"
    value={draft}
    oninput={typed}
    onkeydown={key}
    onchange={commit}
    onblur={commit}
    aria-label={label}
    aria-autocomplete="list"
    autocomplete="off"
    spellcheck="false"
    data-testid={testid}
  />
  {#if options.length > 0}
    <!-- Mouse presses must not take focus from the field, or the list would vanish before the click. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <ul
      class="options"
      aria-label="Suggestions"
      data-testid={`${testid}-suggestions`}
      onmousedown={(e) => e.preventDefault()}
    >
      {#each options as o, i (o.kind + o.name)}
        <li>
          <button
            type="button"
            tabindex="-1"
            class:active={i === active}
            data-testid={`shape-completion-${o.name}`}
            onclick={() => accept(o)}
          >
            <span>{o.name}</span>
            <small>{KIND[o.kind]}</small>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .formula {
    position: relative;
    min-width: 0;
    flex: 1;
  }
  input {
    width: 100%;
    box-sizing: border-box;
  }
  .mono {
    font-family: ui-monospace, monospace;
    font-size: 0.85rem;
  }
  .options {
    position: absolute;
    z-index: 5;
    left: 0;
    right: 0;
    margin: 2px 0 0;
    padding: 2px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--line, var(--line));
    border-radius: 6px;
    box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
    max-height: 12rem;
    overflow: auto;
  }
  .options button {
    display: flex;
    width: 100%;
    justify-content: space-between;
    gap: 0.5rem;
    border: 0;
    border-radius: 4px;
    text-align: left;
    background: transparent;
  }
  .options button.active {
    background: var(--hover, var(--surface-3));
  }
  small {
    color: var(--muted, var(--text-muted));
  }
</style>
