<script lang="ts">
  import {
    effectiveRelationAttributes,
    type LookColour,
    type LookLineStyle,
    type MarkerType,
    type RelationId,
    type RelationLook,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { defaultRelationLook } from '@metakit-app/shapes';
  import {
    MARKER_LABELS,
    MARKER_SHAPES,
    MARKER_TYPES,
    appearanceOfRelation,
    attributeLabel,
    fixedColour,
    isDataColour,
    isShowable,
    saveRelationLook,
    valueOptions,
  } from '../../../build/appearance-model';
  import type { CommandResult } from '../../../shell/controller';
  import ColourControl from './ColourControl.svelte';
  import ColourRule from './ColourRule.svelte';

  let {
    tool,
    relationId,
    run,
    onClose,
  }: {
    tool: ToolLibrary;
    relationId: RelationId;
    run: (command: never) => CommandResult;
    onClose: () => void;
  } = $props();

  const rel = $derived(tool.relations[relationId]);
  const attributes = $derived(effectiveRelationAttributes(tool, relationId));
  const appearance = $derived(appearanceOfRelation(tool, relationId));
  let pending = $state<RelationLook | null>(null);
  const look = $derived.by((): RelationLook => {
    if (appearance.kind === 'look') return appearance.look;
    return pending ?? defaultRelationLook();
  });
  const shared = $derived(appearance.kind === 'look' ? appearance.shared : []);
  let error = $state<string | null>(null);

  function change(next: RelationLook) {
    if (!rel) return;
    if (appearance.kind !== 'look') pending = next;
    const result = run(saveRelationLook(tool, relationId, next) as never);
    error = result.ok ? null : result.error;
  }

  const STYLES: { id: LookLineStyle; label: string }[] = [
    { id: 'solid', label: 'Solid' },
    { id: 'dashed', label: 'Dashed' },
    { id: 'dotted', label: 'Dotted' },
  ];
  const ROUTES: { id: RelationLook['routing']; label: string; d: string }[] = [
    { id: 'straight', label: 'Straight', d: 'M3,17 L21,5' },
    { id: 'orthogonal', label: 'Right angles', d: 'M3,17 H12 V5 H21' },
    { id: 'curved', label: 'Curved', d: 'M3,17 C13,17 11,5 21,5' },
  ];

  // The preview: one line per value of the attribute that colours it, else a single line.
  interface Sample {
    label: string;
    colour: string;
    text: string;
  }
  const samples = $derived.by((): Sample[] => {
    const text = look.label
      ? (attributes.find((a) => a.key === look.label!.attribute)?.key ??
        'Label')
      : '';
    const c: LookColour = look.colour;
    if (!isDataColour(c)) return [{ label: '', colour: c, text }];
    const attr = attributes.find((a) => a.key === c.by);
    const options = valueOptions(attr);
    const keys = [
      ...options.map((o) => o.value),
      ...Object.keys(c.values).filter(
        (v) => !options.some((o) => o.value === v),
      ),
    ];
    return [
      ...keys.map((k) => ({
        label: options.find((o) => o.value === k)?.label ?? k,
        colour: c.values[k] ?? c.fallback,
        text,
      })),
      { label: 'Anything else', colour: c.fallback, text },
    ];
  });

  const dash = (s: LookLineStyle) =>
    s === 'dashed' ? '7 4' : s === 'dotted' ? '2 4' : undefined;

  /** Where the line runs between the two boxes, and the angle at each end (degrees). */
  function path(routing: RelationLook['routing']) {
    if (routing === 'straight')
      return {
        d: 'M70,25 L230,75',
        endAngle: (Math.atan2(50, 160) * 180) / Math.PI,
        startAngle: 180 + (Math.atan2(50, 160) * 180) / Math.PI,
        mid: [150, 50] as const,
      };
    if (routing === 'orthogonal')
      return {
        d: 'M70,25 H150 V75 H230',
        endAngle: 0,
        startAngle: 180,
        mid: [150, 50] as const,
      };
    return {
      d: 'M70,25 C150,25 150,75 230,75',
      endAngle: 0,
      startAngle: 180,
      mid: [150, 50] as const,
    };
  }
  const geometry = $derived(path(look.routing));

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented) onClose();
  }
  function setWidth(text: string) {
    const n = Number(text);
    if (text.trim() !== '' && Number.isFinite(n))
      change({ ...look, width: Math.min(8, Math.max(0.5, n)) });
  }
  function setLabel(keyName: string) {
    change({ ...look, label: keyName === '' ? null : { attribute: keyName } });
  }
  const showable = $derived(attributes.filter(isShowable));
</script>

<svelte:window onkeydown={key} />

{#snippet markerIcon(type: MarkerType)}
  <svg viewBox="0 0 44 20" width="44" height="20" aria-hidden="true">
    <line
      x1="2"
      y1="10"
      x2={type === 'none' ? 42 : 30}
      y2="10"
      stroke="currentColor"
      stroke-width="1.5"
    />
    {#if type !== 'none'}
      <path
        d={MARKER_SHAPES[type].d}
        transform="translate(40 10)"
        fill={MARKER_SHAPES[type].fill === 'solid' ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    {/if}
  </svg>
{/snippet}

{#snippet pickEnd(which: 'start' | 'end', title: string)}
  <fieldset class="ends">
    <legend>{title}</legend>
    <div class="marker-grid">
      {#each MARKER_TYPES as m (m)}
        <button
          type="button"
          class="marker"
          title={MARKER_LABELS[m]}
          aria-label={MARKER_LABELS[m]}
          aria-pressed={look[which] === m}
          data-testid="line-{which}-{m}"
          onclick={() => change({ ...look, [which]: m })}
        >
          {@render markerIcon(m)}
        </button>
      {/each}
    </div>
  </fieldset>
{/snippet}

{#if rel}
  <div
    class="appearance"
    role="group"
    aria-label="Appearance of {rel.key}"
    data-testid="relation-appearance-editor"
  >
    <header class="top">
      <h2>Appearance of {rel.key}</h2>
      <span class="spacer"></span>
      <button
        type="button"
        class="primary"
        data-testid="appearance-done"
        onclick={onClose}>Done</button
      >
    </header>
    {#if shared.length > 0}
      <p class="notice warning" data-testid="appearance-shared">
        This look is also used by {shared.join(', ')}. Changing it here gives
        {rel.key} its own copy.
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
      <main class="centre">
        <section
          class="surface"
          aria-label="Preview"
          data-testid="line-preview"
        >
          {#each samples as s (s.label)}
            <figure>
              <svg
                viewBox="0 0 300 100"
                role="img"
                aria-label="A {rel.key} line{s.label ? `, ${s.label}` : ''}"
              >
                <rect x="10" y="10" width="60" height="30" rx="6" class="box" />
                <rect
                  x="230"
                  y="60"
                  width="60"
                  height="30"
                  rx="6"
                  class="box"
                />
                <path
                  d={geometry.d}
                  fill="none"
                  stroke={s.colour}
                  stroke-width={look.width}
                  stroke-dasharray={dash(look.style)}
                  stroke-linejoin="round"
                />
                {#each [{ t: look.start, at: [70, 25], a: geometry.startAngle }, { t: look.end, at: [230, 75], a: geometry.endAngle }] as m, i (i)}
                  {#if m.t !== 'none'}
                    <path
                      d={MARKER_SHAPES[m.t].d}
                      transform="translate({m.at[0]} {m.at[1]}) rotate({m.a})"
                      fill={MARKER_SHAPES[m.t].fill === 'solid'
                        ? s.colour
                        : MARKER_SHAPES[m.t].fill === 'hollow'
                          ? 'var(--canvas-bg)'
                          : 'none'}
                      stroke={s.colour}
                      stroke-width="1.5"
                      stroke-linejoin="round"
                    />
                  {/if}
                {/each}
                {#if s.text}
                  <text
                    x={geometry.mid[0]}
                    y={geometry.mid[1] - 6}
                    text-anchor="middle"
                    class="label">{s.text}</text
                  >
                {/if}
              </svg>
              {#if s.label}<figcaption>{s.label}</figcaption>{/if}
            </figure>
          {/each}
        </section>
      </main>

      <aside class="right">
        <section class="group" aria-labelledby="l-line">
          <h3 id="l-line">Line</h3>
          <div class="field">
            <span class="name">Colour</span>
            {#if isDataColour(look.colour)}
              <span class="muted">Depends on {look.colour.by} (see below)</span>
            {:else}
              <ColourControl
                value={look.colour}
                label="Line colour"
                testid="line-colour"
                strong
                onChange={(colour) => change({ ...look, colour })}
              />
            {/if}
          </div>
          <div class="field">
            <label class="name" for="line-width">Width</label>
            <input
              id="line-width"
              type="number"
              class="num"
              min="0.5"
              max="8"
              step="0.5"
              value={look.width}
              data-testid="line-width"
              onchange={(e) => setWidth(e.currentTarget.value)}
            />
          </div>
          <div class="field">
            <span class="name" id="line-style-name">Style</span>
            <div class="seg" role="group" aria-labelledby="line-style-name">
              {#each STYLES as s (s.id)}
                <button
                  type="button"
                  aria-pressed={look.style === s.id}
                  data-testid="line-style-{s.id}"
                  onclick={() => change({ ...look, style: s.id })}
                  >{s.label}</button
                >
              {/each}
            </div>
          </div>
          <div class="field">
            <span class="name" id="line-route-name">Route</span>
            <div class="seg" role="group" aria-labelledby="line-route-name">
              {#each ROUTES as r (r.id)}
                <button
                  type="button"
                  class="route"
                  title={r.label}
                  aria-label={r.label}
                  aria-pressed={look.routing === r.id}
                  data-testid="line-route-{r.id}"
                  onclick={() => change({ ...look, routing: r.id })}
                >
                  <svg
                    viewBox="0 0 24 22"
                    width="24"
                    height="22"
                    aria-hidden="true"
                  >
                    <path
                      d={r.d}
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              {/each}
            </div>
          </div>
        </section>

        <section class="group" aria-labelledby="l-ends">
          <h3 id="l-ends">Ends</h3>
          {@render pickEnd('start', 'Start of the line')}
          {@render pickEnd('end', 'End of the line')}
        </section>

        <section class="group" aria-labelledby="l-text">
          <h3 id="l-text">Text on the line</h3>
          <label class="field">
            <span class="name">Show</span>
            <select
              value={look.label?.attribute ?? ''}
              data-testid="line-label"
              onchange={(e) => setLabel(e.currentTarget.value)}
            >
              <option value="">Nothing</option>
              {#each showable as a (a.id)}
                <option value={a.key}>{attributeLabel(a)}</option>
              {/each}
            </select>
          </label>
        </section>

        <section class="group" aria-labelledby="l-data">
          <h3 id="l-data">Changes with data</h3>
          <ColourRule
            label="Line colour"
            colour={look.colour}
            {attributes}
            testid="rule-line"
            strong
            onChange={(colour) =>
              change({
                ...look,
                colour: isDataColour(colour) ? colour : fixedColour(colour),
              })}
          />
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
    grid-template-columns: minmax(0, 1fr) 26rem;
    gap: var(--gap-4);
    min-height: 0;
  }
  .centre,
  .right {
    min-height: 0;
    overflow: auto;
    align-content: start;
    display: grid;
    gap: var(--gap-3);
  }
  .surface {
    display: grid;
    gap: var(--gap-3);
    padding: var(--gap-4);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background-color: var(--canvas-bg);
    background-image:
      linear-gradient(var(--canvas-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
    background-size: 20px 20px;
    color: var(--text);
  }
  figure {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: var(--gap-1);
  }
  figure svg {
    width: min(100%, 30rem);
    height: auto;
  }
  figcaption {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .box {
    fill: var(--accent-soft);
    stroke: var(--accent);
    stroke-width: 1.5;
  }
  .label {
    font-size: 11px;
    fill: var(--text);
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
    min-width: 5rem;
    font-weight: 600;
  }
  .num {
    width: 5rem;
  }
  .seg {
    display: inline-flex;
    gap: var(--gap-1);
  }
  .seg button[aria-pressed='true'],
  .marker[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .route {
    padding: var(--gap-1) var(--gap-2);
  }
  .ends {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    margin: 0;
    padding: var(--gap-2);
  }
  legend {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .marker-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--gap-1);
  }
  .marker {
    display: grid;
    place-items: center;
    padding: var(--gap-1);
  }
  .muted {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
</style>
