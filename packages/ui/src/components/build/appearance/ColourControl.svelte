<script lang="ts">
  import {
    PALETTE,
    STRONG_PALETTE,
    normaliseHex,
  } from '../../../build/appearance-model';

  let {
    value,
    label,
    testid,
    strong = false,
    onChange,
  }: {
    value: string;
    /** What the colour is for, spoken by screen readers: "Fill colour". */
    label: string;
    testid: string;
    /** Offers stronger colours (borders, text, marks) instead of soft ones. */
    strong?: boolean;
    onChange: (colour: string) => void;
  } = $props();

  let open = $state(false);
  let hex = $state('');
  let bad = $state(false);
  $effect(() => {
    hex = value;
    bad = false;
  });

  const colours = $derived(strong ? STRONG_PALETTE : PALETTE);

  function commit(text: string) {
    const next = normaliseHex(text);
    if (next === null) {
      bad = true;
      return;
    }
    bad = false;
    if (next !== value) onChange(next);
  }
  function pick(c: string) {
    open = false;
    if (c !== value) onChange(c);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      open = false;
      e.stopPropagation();
    }
  }
</script>

<span class="colour" onkeydown={key} role="presentation">
  <button
    type="button"
    class="swatch"
    style:background={value}
    aria-label="{label}: choose a colour"
    aria-expanded={open}
    data-testid="{testid}-swatch"
    onclick={() => (open = !open)}
  ></button>
  <input
    class="hex"
    value={hex}
    spellcheck="false"
    aria-label="{label} as a hex code"
    aria-invalid={bad}
    data-testid={testid}
    oninput={(e) => (hex = e.currentTarget.value)}
    onchange={(e) => commit(e.currentTarget.value)}
  />
  {#if open}
    <div class="palette" role="group" aria-label="Colours for {label}">
      {#each colours as c (c.value + c.name)}
        <button
          type="button"
          class="chip"
          style:background={c.value}
          title={c.name}
          aria-label={c.name}
          aria-pressed={c.value === value}
          data-testid="{testid}-pal-{c.name.replace(' ', '-')}"
          onclick={() => pick(c.value)}
        ></button>
      {/each}
      <label class="custom">
        Other
        <input
          type="color"
          value={normaliseHex(value) ?? '#000000'}
          aria-label="{label}: any colour"
          onchange={(e) => pick(e.currentTarget.value)}
        />
      </label>
    </div>
  {/if}
</span>

<style>
  .colour {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--gap-2);
  }
  .swatch {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-s);
  }
  .hex {
    width: 5.5rem;
    font-family: var(--font-mono);
    font-size: var(--text-s);
  }
  .hex[aria-invalid='true'] {
    border-color: var(--danger);
  }
  .palette {
    position: absolute;
    z-index: 5;
    top: calc(100% + 4px);
    left: 0;
    display: grid;
    grid-template-columns: repeat(6, 1.5rem);
    gap: var(--gap-1);
    padding: var(--gap-2);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .chip {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-s);
  }
  .chip[aria-pressed='true'] {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .custom {
    grid-column: 1 / -1;
    display: flex;
    gap: var(--gap-2);
    align-items: center;
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .custom input {
    padding: 0;
    width: 2rem;
    height: 1.5rem;
  }
</style>
