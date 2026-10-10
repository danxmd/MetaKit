<script lang="ts">
  import {
    effectiveAttributes,
    type ClassId,
    type LookBase,
    type LookLineStyle,
    type NodeLook,
    type Kit,
  } from '@metakit-app/core';
  import { readableOn } from '@metakit-app/shapes';
  import {
    appearanceOfClass,
    clampSize,
    fixedColour,
    isDataColour,
    saveNodeLook,
    startLookFor,
    withBase,
    BOX_LIKE,
    omit,
  } from '../../../build/appearance-model';
  import type { CommandResult } from '../../../shell/controller';
  import BaseGallery from './BaseGallery.svelte';
  import ColourControl from './ColourControl.svelte';
  import DataRules from './DataRules.svelte';
  import LookPreview from './LookPreview.svelte';
  import TextControls from './TextControls.svelte';

  let {
    kit,
    classId,
    run,
    onClose,
  }: {
    kit: Kit;
    classId: ClassId;
    run: (command: never) => CommandResult;
    onClose: () => void;
  } = $props();

  const cls = $derived(kit.classes[classId]);
  const attributes = $derived(effectiveAttributes(kit, classId));
  const appearance = $derived(appearanceOfClass(kit, classId));
  // Until the first change the class has no shape of its own; the editor starts from a good one.
  let pending = $state<NodeLook | null>(null);
  const look = $derived.by((): NodeLook => {
    if (appearance.kind === 'look') return appearance.look;
    return pending ?? startLookFor(cls?.kind ?? 'node');
  });
  const shared = $derived(appearance.kind === 'look' ? appearance.shared : []);
  let error = $state<string | null>(null);

  function change(next: NodeLook) {
    if (!cls) return;
    if (appearance.kind !== 'look') pending = next;
    const result = run(saveNodeLook(kit, classId, next) as never);
    error = result.ok ? null : result.error;
  }

  const STYLES: { id: LookLineStyle; label: string }[] = [
    { id: 'solid', label: 'Solid' },
    { id: 'dashed', label: 'Dashed' },
    { id: 'dotted', label: 'Dotted' },
  ];
  const rounded = $derived(BOX_LIKE.includes(look.base));
  const automaticText = $derived(look.title.colour === undefined);

  function setNumber(
    text: string,
    apply: (n: number) => NodeLook,
    min: number,
    max: number,
  ) {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) return;
    change(apply(Math.min(max, Math.max(min, n))));
  }
  function setAutomaticText(on: boolean) {
    if (on) {
      const rest = omit(look.title, 'colour');
      change({ ...look, title: rest });
    } else
      change({
        ...look,
        title: { ...look.title, colour: readableOn(look.fill) },
      });
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented) onClose();
  }
</script>

<svelte:window onkeydown={key} />

{#if cls}
  <div
    class="appearance"
    role="group"
    aria-label="Appearance of {cls.key}"
    data-testid="appearance-editor"
  >
    <header class="top">
      <h2>Appearance of {cls.key}</h2>
      <span class="spacer"></span>
      <button
        type="button"
        class="primary"
        data-testid="appearance-done"
        data-tour="appearance-done"
        onclick={onClose}>Done</button
      >
    </header>
    {#if shared.length > 0}
      <p class="notice warning" data-testid="appearance-shared">
        This look is also used by {shared.join(', ')}. Changing it here gives
        {cls.key} its own copy.
      </p>
    {/if}
    {#if error}<p
        class="notice error"
        role="alert"
        data-testid="appearance-problem"
      >
        {error}
      </p>{/if}

    <div class="grid">
      <aside class="left" data-tour="appearance-form">
        <BaseGallery
          {look}
          {attributes}
          className={cls.key}
          onPick={(base: LookBase) => change(withBase(look, base))}
        />
      </aside>

      <main class="centre" data-tour="appearance-preview">
        <LookPreview {look} {attributes} className={cls.key} />
      </main>

      <aside class="right">
        <section
          class="group"
          aria-labelledby="g-colours"
          data-tour="appearance-colours"
        >
          <h3 id="g-colours">Colours and border</h3>
          <div class="field">
            <span class="name">Fill</span>
            {#if isDataColour(look.fill)}
              <span class="muted" data-testid="fill-depends"
                >Depends on {look.fill.by} (see Changes with data)</span
              >
            {:else}
              <ColourControl
                value={look.fill}
                label="Fill colour"
                testid="look-fill"
                onChange={(fill) => change({ ...look, fill })}
              />
            {/if}
          </div>
          <div class="field">
            <span class="name">Border</span>
            {#if isDataColour(look.border)}
              <span class="muted" data-testid="border-depends"
                >Depends on {look.border.by} (see Changes with data)</span
              >
            {:else}
              <ColourControl
                value={look.border}
                label="Border colour"
                testid="look-border"
                strong
                onChange={(border) => change({ ...look, border })}
              />
            {/if}
          </div>
          <div class="field">
            <span class="name">Text</span>
            <label class="check">
              <input
                type="checkbox"
                checked={automaticText}
                data-testid="look-text-auto"
                onchange={(e) => setAutomaticText(e.currentTarget.checked)}
              />
              Automatic
            </label>
            {#if !automaticText && look.title.colour !== undefined && !isDataColour(look.title.colour)}
              <ColourControl
                value={fixedColour(look.title.colour)}
                label="Text colour"
                testid="look-text-colour"
                strong
                onChange={(colour) =>
                  change({ ...look, title: { ...look.title, colour } })}
              />
            {/if}
          </div>
          <div class="field">
            <label class="name" for="look-border-width">Border width</label>
            <input
              id="look-border-width"
              type="number"
              min="0"
              max="8"
              step="0.5"
              class="num"
              value={look.borderWidth}
              data-testid="look-border-width"
              onchange={(e) =>
                setNumber(
                  e.currentTarget.value,
                  (borderWidth) => ({ ...look, borderWidth }),
                  0,
                  8,
                )}
            />
          </div>
          <div class="field">
            <span class="name" id="style-name">Border style</span>
            <div class="seg" role="group" aria-labelledby="style-name">
              {#each STYLES as s (s.id)}
                <button
                  type="button"
                  aria-pressed={look.borderStyle === s.id}
                  data-testid="look-style-{s.id}"
                  onclick={() => change({ ...look, borderStyle: s.id })}
                  >{s.label}</button
                >
              {/each}
            </div>
          </div>
          {#if rounded}
            <div class="field">
              <label class="name" for="look-corner">Corner</label>
              <input
                id="look-corner"
                type="number"
                min="0"
                max="40"
                class="num"
                value={look.corner ?? (look.base === 'rounded' ? 10 : 0)}
                data-testid="look-corner"
                onchange={(e) =>
                  setNumber(
                    e.currentTarget.value,
                    (corner) => ({ ...look, corner }),
                    0,
                    40,
                  )}
              />
            </div>
          {/if}
        </section>

        <section class="group" aria-labelledby="g-text">
          <h3 id="g-text">Text and icon</h3>
          <TextControls {look} {attributes} onChange={change} />
        </section>

        <section
          class="group"
          aria-labelledby="g-data"
          data-tour="appearance-data"
        >
          <h3 id="g-data">Changes with data</h3>
          <p class="muted lead">
            Let a colour or a mark follow the value of an attribute. The tiles
            under the preview show every value.
          </p>
          <DataRules {look} {attributes} onChange={change} />
        </section>

        <section class="group" aria-labelledby="g-size">
          <h3 id="g-size">Size</h3>
          <div class="field">
            <span class="pair"
              ><label class="name" for="look-width">Width</label>
              <input
                id="look-width"
                type="number"
                class="num"
                min="20"
                value={look.size.width}
                data-testid="look-width"
                onchange={(e) =>
                  setNumber(
                    e.currentTarget.value,
                    (w) => ({
                      ...look,
                      size: { ...look.size, width: clampSize(w) },
                    }),
                    20,
                    1200,
                  )}
              />
            </span><span class="pair"
              ><label class="name" for="look-height">Height</label>
              <input
                id="look-height"
                type="number"
                class="num"
                min="20"
                value={look.size.height}
                data-testid="look-height"
                onchange={(e) =>
                  setNumber(
                    e.currentTarget.value,
                    (h) => ({
                      ...look,
                      size: { ...look.size, height: clampSize(h) },
                    }),
                    20,
                    1200,
                  )}
              />
            </span>
          </div>
          <label class="check">
            <input
              type="checkbox"
              checked={look.size.resizable ?? false}
              data-testid="look-resizable"
              onchange={(e) =>
                change({
                  ...look,
                  size: { ...look.size, resizable: e.currentTarget.checked },
                })}
            />
            Modellers can resize it
          </label>
        </section>
      </aside>
    </div>
  </div>
{/if}

<style>
  .appearance {
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    gap: var(--gap-3);
    height: 100%;
    min-height: 0;
    padding: var(--gap-3);
    box-sizing: border-box;
  }
  .top {
    display: flex;
    gap: var(--gap-3);
    align-items: center;
  }
  .top h2 {
    margin: 0;
    font-size: var(--text-l);
  }
  .spacer {
    flex: 1;
  }
  .notice {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: 17rem minmax(0, 1fr) 24rem;
    gap: var(--gap-4);
    min-height: 0;
  }
  .left,
  .centre,
  .right {
    min-height: 0;
    overflow: auto;
    align-content: start;
    display: grid;
    gap: var(--gap-3);
    padding-right: var(--gap-1);
  }
  .group {
    display: grid;
    gap: var(--gap-3);
    padding: var(--gap-3);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  h3 {
    margin: 0;
    font-size: var(--text-m);
  }
  .field {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2);
    align-items: center;
  }
  .name {
    min-width: 5.5rem;
    font-weight: 600;
  }
  .pair {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .num {
    width: 5rem;
  }
  .check {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .seg {
    display: inline-flex;
    gap: var(--gap-1);
  }
  .seg button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .muted {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .lead {
    margin: 0;
  }
  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: 14rem minmax(0, 1fr);
    }
    .right {
      grid-column: 1 / -1;
    }
  }
</style>
