<script lang="ts">
  import type {
    Json,
    TableAttribute,
    ReferenceAttribute,
  } from '@metakit-app/core';
  import {
    formatDuration,
    isoToLocalInput,
    localInputToIso,
    parseDuration,
    parseInput,
    type Field,
  } from '../panel';
  import type { ReferenceServices } from '../shell/references';
  import ReferencePicker from './ReferencePicker.svelte';
  import TableGrid from './TableGrid.svelte';

  let {
    field,
    references,
    onCommit,
    height,
  }: {
    field: Field;
    references: ReferenceServices;
    /** Height in pixels from a panel layout; used by tables and text areas. */
    height?: number;
    /** Called with the new value of the attribute (null clears it). */
    onCommit: (value: Json) => void;
  } = $props();

  const attr = $derived(field.attr);
  const id = $derived(`f-${attr.id}`);

  // What the user is typing, until it is accepted. A new selection starts a new draft.
  let draft = $state('');
  let dirty = $state(false);
  let message = $state('');

  // A new value or a new selection replaces the draft. The panel is rebuilt now and then (for
  // example when validation finishes), and that must not wipe what the user is typing.
  let shownKey = '';
  $effect(() => {
    const key = JSON.stringify([field.value, field.mixed, attr.id]);
    if (key === shownKey) return;
    shownKey = key;
    draft = displayText(field.value);
    dirty = false;
    message = '';
  });

  function displayText(value: Json | undefined): string {
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : String(value);
  }

  function commitText() {
    if (!dirty) return;
    const parsed = parseInput(attr, draft);
    if (!parsed.ok) {
      message = parsed.message;
      return;
    }
    message = '';
    dirty = false;
    onCommit(parsed.value);
  }

  function key(event: KeyboardEvent) {
    if (event.key === 'Enter' && field.control !== 'textarea') {
      event.preventDefault();
      commitText();
    } else if (event.key === 'Escape') {
      draft = displayText(field.value);
      dirty = false;
      message = '';
    }
  }

  // Duration is edited as parts.
  const parts = $derived(
    typeof field.value === 'string'
      ? (parseDuration(field.value) ?? {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        })
      : { days: 0, hours: 0, minutes: 0, seconds: 0 },
  );
  let durationDraft = $state({ days: '', hours: '', minutes: '' });
  let durationKey = '';
  $effect(() => {
    const key = JSON.stringify([field.value, field.mixed, attr.id]);
    if (key === durationKey) return;
    durationKey = key;
    durationDraft = {
      days: field.mixed || !parts.days ? '' : String(parts.days),
      hours: field.mixed || !parts.hours ? '' : String(parts.hours),
      minutes: field.mixed || !parts.minutes ? '' : String(parts.minutes),
    };
  });
  function commitDuration() {
    const n = (t: string) => (t.trim() === '' ? 0 : Number(t));
    const next = {
      days: n(durationDraft.days),
      hours: n(durationDraft.hours),
      minutes: n(durationDraft.minutes),
      seconds: parts.seconds,
    };
    if (
      [next.days, next.hours, next.minutes].some(
        (v) => !Number.isInteger(v) || v < 0,
      )
    ) {
      message = 'Use whole numbers, 0 or more.';
      return;
    }
    message = '';
    onCommit(formatDuration(next));
  }

  const chosen = $derived(
    Array.isArray(field.value) ? (field.value as unknown as string[]) : [],
  );
  function toggle(value: string) {
    const next = chosen.includes(value)
      ? chosen.filter((v) => v !== value)
      : [...chosen, value];
    onCommit(next);
  }
</script>

<div
  class="field"
  class:invalid={field.issues.length > 0 || message !== ''}
  data-testid="field-{attr.key}"
>
  <label for={id} title={field.help}>
    {field.label}{#if field.required}<span class="req" aria-label="required">
        *</span
      >{/if}
    {#if field.unit}<span class="unit">({field.unit})</span>{/if}
  </label>

  {#if field.control === 'text' || field.control === 'integer' || field.control === 'number' || field.control === 'link'}
    <input
      {id}
      type="text"
      inputmode={field.control === 'integer'
        ? 'numeric'
        : field.control === 'number'
          ? 'decimal'
          : undefined}
      placeholder={field.mixed ? '—' : ''}
      bind:value={draft}
      oninput={() => (dirty = true)}
      onblur={commitText}
      onkeydown={key}
      readonly={field.readOnly}
    />
    {#if field.control === 'link' && typeof field.value === 'string' && /^https?:\/\//.test(field.value)}
      <a href={field.value} target="_blank" rel="noopener noreferrer"
        >Open link</a
      >
    {/if}
  {:else if field.control === 'textarea'}
    <textarea
      {id}
      rows="3"
      style:height={height ? `${height}px` : undefined}
      placeholder={field.mixed ? '—' : ''}
      bind:value={draft}
      oninput={() => (dirty = true)}
      onblur={commitText}
      onkeydown={key}
      readonly={field.readOnly}></textarea>
  {:else if field.control === 'switch' || field.control === 'checkbox'}
    <input
      {id}
      type="checkbox"
      role={field.control === 'switch' ? 'switch' : undefined}
      checked={field.value === true}
      indeterminate={field.mixed}
      disabled={field.readOnly}
      onchange={(e) => onCommit(e.currentTarget.checked)}
    />
  {:else if field.control === 'date'}
    <input
      {id}
      type="date"
      value={field.mixed ? '' : displayText(field.value)}
      disabled={field.readOnly}
      onchange={(e) =>
        onCommit(e.currentTarget.value === '' ? null : e.currentTarget.value)}
    />
  {:else if field.control === 'date-time'}
    <input
      {id}
      type="datetime-local"
      value={field.mixed || typeof field.value !== 'string'
        ? ''
        : isoToLocalInput(field.value)}
      disabled={field.readOnly}
      onchange={(e) =>
        onCommit(
          e.currentTarget.value === ''
            ? null
            : localInputToIso(e.currentTarget.value),
        )}
    />
  {:else if field.control === 'duration'}
    <div class="duration" role="group" aria-label={field.label}>
      <input
        {id}
        aria-label="Days"
        inputmode="numeric"
        placeholder={field.mixed ? '—' : '0'}
        bind:value={durationDraft.days}
        onblur={commitDuration}
        onkeydown={(e) => e.key === 'Enter' && commitDuration()}
      />
      d
      <input
        aria-label="Hours"
        inputmode="numeric"
        placeholder={field.mixed ? '—' : '0'}
        bind:value={durationDraft.hours}
        onblur={commitDuration}
        onkeydown={(e) => e.key === 'Enter' && commitDuration()}
      />
      h
      <input
        aria-label="Minutes"
        inputmode="numeric"
        placeholder={field.mixed ? '—' : '0'}
        bind:value={durationDraft.minutes}
        onblur={commitDuration}
        onkeydown={(e) => e.key === 'Enter' && commitDuration()}
      /> min
    </div>
  {:else if field.control === 'select'}
    <select
      {id}
      value={field.mixed ? '' : displayText(field.value)}
      disabled={field.readOnly}
      onchange={(e) =>
        onCommit(e.currentTarget.value === '' ? null : e.currentTarget.value)}
    >
      <option value="">{field.mixed ? '—' : ''}</option>
      {#each field.options ?? [] as option (option.value)}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  {:else if field.control === 'segmented'}
    <div class="segmented" role="radiogroup" aria-label={field.label}>
      {#each field.options ?? [] as option (option.value)}
        <button
          type="button"
          role="radio"
          aria-checked={!field.mixed && field.value === option.value}
          class:on={!field.mixed && field.value === option.value}
          disabled={field.readOnly}
          onclick={() =>
            onCommit(
              !field.mixed && field.value === option.value && !field.required
                ? null
                : option.value,
            )}
        >
          {option.label}
        </button>
      {/each}
    </div>
    {#if field.mixed}<span class="mixed">— differs</span>{/if}
  {:else if field.control === 'chips'}
    <div class="chips" role="group" aria-label={field.label}>
      {#each field.options ?? [] as option (option.value)}
        <button
          type="button"
          aria-pressed={chosen.includes(option.value)}
          class:on={chosen.includes(option.value)}
          disabled={field.readOnly || field.mixed}
          onclick={() => toggle(option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
    {#if field.mixed}<span class="mixed"
        >— differs between the selected objects</span
      >{/if}
  {:else if field.control === 'table'}
    {#if field.mixed}
      <p class="mixed">The selected objects have different tables.</p>
    {:else}
      <div
        class:scroll={height !== undefined}
        style:max-height={height ? `${height}px` : undefined}
      >
        <TableGrid
          attr={attr as TableAttribute}
          rows={Array.isArray(field.value)
            ? (field.value as unknown as Record<string, Json>[])
            : []}
          readOnly={field.readOnly}
          onChange={(rows) => onCommit(rows as unknown as Json)}
        />
      </div>
    {/if}
  {:else if field.control === 'reference'}
    {#if field.mixed}
      <p class="mixed">The selected objects refer to different things.</p>
    {:else}
      <ReferencePicker
        attr={attr as ReferenceAttribute}
        value={field.value}
        readOnly={field.readOnly}
        services={references}
        onChange={onCommit}
      />
    {/if}
  {:else if field.control === 'button'}
    <button
      type="button"
      {id}
      class="action"
      data-testid="action-{attr.key}"
      onclick={() => onCommit(null)}>{field.label}</button
    >
  {:else if field.control === 'readonly'}
    <output
      {id}
      class="readonly"
      title={attr.type === 'formula' ? `= ${attr.formula}` : undefined}
    >
      {field.mixed
        ? '—'
        : field.value === undefined
          ? '—'
          : displayText(field.value)}
    </output>
    {#if field.error}<p
        class="message"
        role="alert"
        data-testid="formula-error"
      >
        {field.error}
      </p>{/if}
  {:else if field.control === 'button'}
    <button
      {id}
      type="button"
      disabled
      title="Buttons start working when rules and scripts arrive."
      >{field.label}</button
    >
  {/if}

  {#if message}<p class="message" role="alert">
      {message}
    </p>{/if}
  {#each field.issues as issue (issue)}<p class="message" role="alert">
      {issue}
    </p>{/each}
  {#if field.help}<p class="help">{field.help}</p>{/if}
</div>

<style>
  .field {
    display: grid;
    gap: 0.2rem;
    margin-bottom: 0.7rem;
  }
  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
  }
  .unit {
    font-weight: 400;
  }
  .req {
    color: var(--danger);
  }
  input[type='text'],
  textarea,
  select {
    width: 100%;
    box-sizing: border-box;
  }
  .invalid input,
  .invalid textarea,
  .invalid select {
    border-color: var(--danger);
  }
  .message {
    color: var(--danger);
    font-size: 0.8rem;
    margin: 0;
  }
  .help,
  .mixed {
    color: var(--muted);
    font-size: 0.8rem;
    margin: 0;
  }
  .duration {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  .duration input {
    width: 3rem;
  }
  .segmented,
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .segmented button,
  .chips button {
    border: 1px solid var(--line);
    background: var(--panel);
    border-radius: 999px;
    padding: 0.15rem 0.7rem;
    cursor: pointer;
  }
  .segmented button.on,
  .chips button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .scroll {
    overflow: auto;
  }
  .readonly {
    padding: 0.25rem 0.4rem;
    background: var(--hover);
    border-radius: 4px;
    min-height: 1.4rem;
  }
</style>
