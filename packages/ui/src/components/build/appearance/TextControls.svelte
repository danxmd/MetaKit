<script lang="ts">
  import type {
    AttributeDef,
    LookIconName,
    LookText,
    NodeLook,
  } from '@metakit-app/core';
  import { LOOK_ICON_NAMES } from '@metakit-app/core';
  import { LOOK_ICONS } from '@metakit-app/shapes';
  import {
    attributeLabel,
    isShowable,
    omit,
  } from '../../../build/appearance-model';

  let {
    look,
    attributes,
    onChange,
  }: {
    look: NodeLook;
    attributes: readonly AttributeDef[];
    onChange: (look: NodeLook) => void;
  } = $props();

  const showable = $derived(attributes.filter(isShowable));
  const LABEL = '__label';
  const FIXED = '__text';
  const NONE = '';

  const titleChoice = $derived(
    look.title.attribute ? look.title.attribute : LABEL,
  );
  const subtitleChoice = $derived.by(() => {
    const s = look.subtitle;
    if (!s) return NONE;
    if (s.attribute) return s.attribute;
    if (s.attribute === null) return LABEL;
    return FIXED;
  });
  const SIZES: { label: string; value: number | undefined }[] = [
    { label: 'Small', value: 11 },
    { label: 'Normal', value: undefined },
    { label: 'Large', value: 17 },
  ];

  function withText(base: LookText | undefined, choice: string): LookText {
    const kept: LookText = {};
    if (base?.colour !== undefined) kept.colour = base.colour;
    if (base?.bold !== undefined) kept.bold = base.bold;
    if (base?.size !== undefined) kept.size = base.size;
    if (choice === LABEL) return { ...kept, attribute: null };
    if (choice === FIXED) return { ...kept, text: base?.text ?? 'Text' };
    return { ...kept, attribute: choice };
  }
  function setTitle(choice: string) {
    onChange({ ...look, title: withText(look.title, choice) });
  }
  function setSubtitle(choice: string) {
    if (choice === NONE) {
      const rest = omit(look, 'subtitle');
      onChange(rest);
    } else onChange({ ...look, subtitle: withText(look.subtitle, choice) });
  }
  function setSubtitleText(text: string) {
    onChange({ ...look, subtitle: { ...look.subtitle, text } });
  }
  function setBold(bold: boolean) {
    onChange({ ...look, title: { ...look.title, bold } });
  }
  function setSize(text: string) {
    const rest = omit(look.title, 'size');
    const value = text === '' ? undefined : Number(text);
    onChange({
      ...look,
      title: value === undefined ? rest : { ...rest, size: value },
    });
  }
  function setIcon(name: LookIconName | null) {
    if (name === null) {
      const rest = omit(look, 'icon');
      onChange(rest);
    } else onChange({ ...look, icon: { ...look.icon, name } });
  }
  function toggleField(key: string, on: boolean) {
    const now = look.fields ?? [];
    const next = on
      ? [...now.filter((k) => k !== key), key]
      : now.filter((k) => k !== key);
    const order = attributes.map((a) => a.key);
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    onChange({ ...look, fields: next });
  }
</script>

<div class="text-controls">
  <label>
    Title
    <select
      value={titleChoice}
      data-testid="look-title"
      onchange={(e) => setTitle(e.currentTarget.value)}
    >
      <option value={LABEL}>Name of the object</option>
      {#each showable as a (a.id)}
        <option value={a.key}>{attributeLabel(a)}</option>
      {/each}
    </select>
  </label>
  <div class="inline">
    <label class="check">
      <input
        type="checkbox"
        checked={look.title.bold ?? false}
        data-testid="look-bold"
        onchange={(e) => setBold(e.currentTarget.checked)}
      />
      Bold
    </label>
    <label>
      Text size
      <select
        value={look.title.size === undefined ? '' : String(look.title.size)}
        data-testid="look-text-size"
        onchange={(e) => setSize(e.currentTarget.value)}
      >
        {#each SIZES as s (s.label)}
          <option value={s.value === undefined ? '' : String(s.value)}
            >{s.label}</option
          >
        {/each}
      </select>
    </label>
  </div>
  {#if look.base !== 'circle' && look.base !== 'diamond' && look.base !== 'swimlane'}
    <label>
      Subtitle
      <select
        value={subtitleChoice}
        data-testid="look-subtitle"
        onchange={(e) => setSubtitle(e.currentTarget.value)}
      >
        <option value={NONE}>None</option>
        <option value={LABEL}>Name of the object</option>
        <option value={FIXED}>Fixed text</option>
        {#each showable as a (a.id)}
          <option value={a.key}>{attributeLabel(a)}</option>
        {/each}
      </select>
    </label>
    {#if subtitleChoice === FIXED}
      <label>
        Subtitle text
        <input
          value={look.subtitle?.text ?? ''}
          data-testid="look-subtitle-text"
          onchange={(e) => setSubtitleText(e.currentTarget.value)}
        />
      </label>
    {/if}
  {/if}

  {#if look.base === 'header-box'}
    <fieldset class="fields">
      <legend>Lines shown under the title</legend>
      {#each showable as a (a.id)}
        <label class="check">
          <input
            type="checkbox"
            checked={(look.fields ?? []).includes(a.key)}
            data-testid="look-field-{a.key}"
            onchange={(e) => toggleField(a.key, e.currentTarget.checked)}
          />
          {attributeLabel(a)}
        </label>
      {:else}
        <p class="muted">This concept has no attributes yet.</p>
      {/each}
    </fieldset>
  {/if}

  <fieldset class="icons">
    <legend>Icon</legend>
    <div class="icon-grid">
      <button
        type="button"
        class="icon-btn none"
        aria-pressed={look.icon === undefined}
        data-testid="look-icon-none"
        onclick={() => setIcon(null)}>None</button
      >
      {#each LOOK_ICON_NAMES as name (name)}
        <button
          type="button"
          class="icon-btn"
          title={LOOK_ICONS[name].label}
          aria-label={LOOK_ICONS[name].label}
          aria-pressed={look.icon?.name === name}
          data-testid="look-icon-{name}"
          onclick={() => setIcon(name)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d={LOOK_ICONS[name].path}
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      {/each}
    </div>
  </fieldset>
</div>

<style>
  .text-controls {
    display: grid;
    gap: var(--gap-3);
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  label.check {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .inline {
    display: flex;
    gap: var(--gap-4);
    align-items: end;
    flex-wrap: wrap;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    margin: 0;
    padding: var(--gap-2) var(--gap-3);
  }
  legend {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .fields {
    display: grid;
    gap: var(--gap-1);
  }
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));
    gap: var(--gap-1);
  }
  .icon-btn {
    display: grid;
    place-items: center;
    padding: var(--gap-1);
    min-height: 2.25rem;
  }
  .icon-btn.none {
    grid-column: span 2;
    font-size: var(--text-s);
  }
  .icon-btn[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
    font-size: var(--text-s);
  }
</style>
