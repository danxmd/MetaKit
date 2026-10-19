<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type {
    ClassId,
    Kit,
    KitCommand,
    MarkerType,
    ModelTypeId,
    RelationId,
  } from '@metakit-app/core';
  import {
    STEPS,
    STEP_TITLES,
    WIZARD_ATTRIBUTE_TYPES,
    WIZARD_BASES,
    attributeKeys,
    classChoices,
    emptyDraft,
    stepProblems,
    summary,
    withKind,
    withLabel,
    wizardCommands,
    type ConceptKind,
    type WizardDraft,
  } from '../../build/concept-wizard';
  import {
    PALETTE,
    STRONG_PALETTE,
    MARKER_LABELS,
  } from '../../build/appearance-model';
  import { labelIn } from '../../build/attributes';
  import { DocsLayer, pushDocsContext } from '../../docs/context';

  let {
    kit,
    kind = 'class',
    modelType,
    where = 'build',
    onCreate,
    onClose,
  }: {
    kit: Kit;
    /** What the wizard starts with; the person can switch on the first step. */
    kind?: ConceptKind;
    /** The model type of the open model: it is ticked, and the others are not. */
    modelType?: ModelTypeId;
    /** Only for the wording: in the model view the Kit changes for every model of it. */
    where?: 'build' | 'model';
    /** Runs the batch; returns null when it worked, otherwise the reason it did not. */
    onCreate: (
      commands: KitCommand[],
      id: ClassId | RelationId,
      draft: WizardDraft,
    ) => string | null;
    onClose: () => void;
  } = $props();

  const language = $derived(kit.manifest.languages[0] ?? 'en');
  let dialog: HTMLDialogElement | undefined = $state();
  // Set once: the wizard keeps its draft while the Kit changes around it.
  let draft: WizardDraft = $state(
    untrack(() => emptyDraft(kit, kind, modelType ? { modelType } : {})),
  );
  let index = $state(0);
  let tried = $state(false);
  let refusal = $state('');

  const steps = $derived(STEPS[draft.kind]);
  const step = $derived(steps[index]!);
  const problems = $derived(stepProblems(kit, draft, step));
  const classes = $derived(classChoices(kit, language));
  const keys = $derived(attributeKeys(draft));
  const lines = $derived(step === 'where' ? summary(kit, draft, language) : []);
  const noun = $derived(draft.kind === 'class' ? 'class' : 'relation class');

  $effect(() => pushDocsContext('dialog.concept-wizard', DocsLayer.dialog));
  onMount(() => dialog?.showModal());

  function next() {
    tried = true;
    if (problems.length > 0) return;
    tried = false;
    if (index < steps.length - 1) index += 1;
    else create();
  }

  function back() {
    tried = false;
    refusal = '';
    if (index > 0) index -= 1;
  }

  function create() {
    const { commands, id } = wizardCommands(kit, draft, language);
    const reason = onCreate(commands, id, draft);
    if (reason) refusal = reason;
    else dialog?.close();
  }

  const toggle = (list: ClassId[], id: ClassId, on: boolean) =>
    on ? [...list, id] : list.filter((x) => x !== id);

  function setAttribute(
    i: number,
    patch: Partial<WizardDraft['attributes'][number]>,
  ) {
    draft.attributes = draft.attributes.map((a, j) =>
      j === i ? { ...a, ...patch } : a,
    );
  }

  const ENDS: MarkerType[] = ['arrow', 'open-arrow', 'triangle', 'none'];
</script>

<dialog
  bind:this={dialog}
  onclose={onClose}
  aria-labelledby="concept-wizard-title"
  data-testid="concept-wizard"
>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      next();
    }}
  >
    <div class="head">
      <h2 id="concept-wizard-title">New {noun}</h2>
      <ol class="steps" aria-label="Steps">
        {#each steps as s, i (s)}
          <li
            class:current={i === index}
            class:done={i < index}
            aria-current={i === index ? 'step' : undefined}
          >
            {i + 1}. {STEP_TITLES[s]}
          </li>
        {/each}
      </ol>
    </div>

    <div class="body" data-testid="concept-wizard-step-{step}">
      {#if step === 'basics'}
        {#if index === 0}
          <fieldset class="kind">
            <legend>What do you want to add?</legend>
            <label class="option">
              <input
                type="radio"
                name="kind"
                checked={draft.kind === 'class'}
                onchange={() => (draft = withKind(kit, draft, 'class'))}
                data-testid="concept-wizard-kind-class"
              />
              <span
                ><strong>A class</strong><small
                  >Something people place on the canvas, such as a Task or a
                  Risk.</small
                ></span
              >
            </label>
            <label class="option">
              <input
                type="radio"
                name="kind"
                checked={draft.kind === 'relation'}
                onchange={() => (draft = withKind(kit, draft, 'relation'))}
                data-testid="concept-wizard-kind-relation"
              />
              <span
                ><strong>A relation class</strong><small
                  >A kind of line between objects, such as "Assigned to".</small
                ></span
              >
            </label>
          </fieldset>
        {/if}
        <label>
          Name
          <!-- svelte-ignore a11y_autofocus -->
          <input
            value={draft.label}
            oninput={(e) =>
              (draft = withLabel(kit, draft, e.currentTarget.value))}
            autofocus
            placeholder={draft.kind === 'class'
              ? 'For example Risk'
              : 'For example Assigned to'}
            data-testid="concept-wizard-name"
          />
        </label>
        <label>
          Key <small class="muted"
            >used in formulas and files; made from the name</small
          >
          <input
            value={draft.key}
            oninput={(e) => {
              draft.key = e.currentTarget.value.trim();
              draft.keyEdited = true;
            }}
            spellcheck="false"
            data-testid="concept-wizard-key"
          />
        </label>
        <label>
          Description <small class="muted">shown in the palette preview</small>
          <textarea
            bind:value={draft.help}
            rows="2"
            placeholder="What it stands for, in a sentence."
            data-testid="concept-wizard-help"></textarea>
        </label>
        {#if draft.kind === 'class'}
          <label>
            Is it a kind of another class?
            <select
              bind:value={draft.parent}
              data-testid="concept-wizard-parent"
            >
              <option value="">No</option>
              {#each classes as c (c.id)}
                <option value={c.id}>{c.label}</option>
              {/each}
            </select>
          </label>
          <label class="check">
            <input
              type="checkbox"
              bind:checked={draft.abstract}
              data-testid="concept-wizard-abstract"
            />
            Only for other classes to extend (abstract, never placed)
          </label>
        {/if}
      {:else if step === 'look'}
        <fieldset>
          <legend>How is it drawn?</legend>
          <div class="radios">
            {#each [['node', 'An object'], ['container', 'A container that holds others'], ['swimlane', 'A swimlane (a band across the canvas)']] as [value, text] (value)}
              <label class="check">
                <input
                  type="radio"
                  name="classKind"
                  {value}
                  bind:group={draft.classKind}
                  data-testid="concept-wizard-class-kind-{value}"
                />
                {text}
              </label>
            {/each}
          </div>
        </fieldset>
        {#if draft.classKind === 'node'}
          <label>
            Form
            <select bind:value={draft.base} data-testid="concept-wizard-base">
              {#each WIZARD_BASES as b (b.base)}
                <option value={b.base}>{b.label}</option>
              {/each}
            </select>
          </label>
          <fieldset>
            <legend>Fill</legend>
            <div class="swatches">
              {#each PALETTE as c (c.value)}
                <button
                  type="button"
                  class="swatch"
                  style:background={c.value}
                  aria-label={c.name}
                  aria-pressed={draft.fill === c.value}
                  onclick={() => (draft.fill = c.value)}
                ></button>
              {/each}
            </div>
          </fieldset>
          <fieldset>
            <legend>Border</legend>
            <div class="swatches">
              {#each STRONG_PALETTE as c (c.value)}
                <button
                  type="button"
                  class="swatch"
                  style:background={c.value}
                  aria-label={c.name}
                  aria-pressed={draft.border === c.value}
                  onclick={() => (draft.border = c.value)}
                ></button>
              {/each}
            </div>
          </fieldset>
        {/if}
        <p class="muted small">
          Colours that depend on a value, icons and fields: in Build mode, under
          Appearance.
        </p>
      {:else if step === 'connects'}
        <div class="ends">
          {#each [['from', 'Where may it start?'], ['to', 'Where may it end?']] as [end, title] (end)}
            <fieldset>
              <legend>{title}</legend>
              <div class="list">
                {#each classes as c (c.id)}
                  {@const list = end === 'from' ? draft.from : draft.to}
                  <label class="check">
                    <input
                      type="checkbox"
                      checked={list.includes(c.id)}
                      onchange={(e) => {
                        const next = toggle(
                          list,
                          c.id,
                          e.currentTarget.checked,
                        );
                        if (end === 'from') draft.from = next;
                        else draft.to = next;
                      }}
                      data-testid="concept-wizard-{end}-{kit.classes[c.id]
                        ?.key}"
                    />
                    {c.label}{#if c.abstract}<small class="muted">
                        (and every kind of it)</small
                      >{/if}
                  </label>
                {/each}
              </div>
            </fieldset>
          {/each}
        </div>
        <fieldset>
          <legend>Line</legend>
          <div class="radios">
            {#each ['solid', 'dashed', 'dotted'] as s (s)}
              <label class="check"
                ><input
                  type="radio"
                  name="line"
                  value={s}
                  bind:group={draft.lineStyle}
                />
                {s[0]!.toUpperCase() + s.slice(1)}</label
              >
            {/each}
            <label>
              End
              <select bind:value={draft.end}>
                {#each ENDS as m (m)}<option value={m}
                    >{MARKER_LABELS[m]}</option
                  >{/each}
              </select>
            </label>
          </div>
          <div class="swatches">
            {#each STRONG_PALETTE as c (c.value)}
              <button
                type="button"
                class="swatch"
                style:background={c.value}
                aria-label={c.name}
                aria-pressed={draft.colour === c.value}
                onclick={() => (draft.colour = c.value)}
              ></button>
            {/each}
          </div>
        </fieldset>
      {:else if step === 'attributes'}
        <p class="muted small">
          What people fill in for each {draft.kind === 'class'
            ? 'object'
            : 'connection'}. Formulas, tables and references: in Build mode.
        </p>
        {#each draft.attributes as a, i (i)}
          <div class="attribute" data-testid="concept-wizard-attribute-{i}">
            <input
              value={a.label}
              oninput={(e) => setAttribute(i, { label: e.currentTarget.value })}
              placeholder="Name"
              aria-label="Name of attribute {i + 1}"
              data-testid="concept-wizard-attribute-name-{i}"
            />
            <select
              value={a.type}
              onchange={(e) =>
                setAttribute(i, { type: e.currentTarget.value as never })}
              aria-label="Type of attribute {i + 1}"
              data-testid="concept-wizard-attribute-type-{i}"
            >
              {#each WIZARD_ATTRIBUTE_TYPES as t (t.type)}<option value={t.type}
                  >{t.label}</option
                >{/each}
            </select>
            <label class="check"
              ><input
                type="checkbox"
                checked={a.required}
                onchange={(e) =>
                  setAttribute(i, { required: e.currentTarget.checked })}
              /> Required</label
            >
            <button
              type="button"
              class="ghost"
              aria-label="Remove attribute {i + 1}"
              onclick={() =>
                (draft.attributes = draft.attributes.filter((_, j) => j !== i))}
              >×</button
            >
            {#if a.type === 'choice'}
              <textarea
                value={a.options}
                oninput={(e) =>
                  setAttribute(i, { options: e.currentTarget.value })}
                rows="3"
                placeholder="One option per line"
                aria-label="Options of attribute {i + 1}"
                data-testid="concept-wizard-attribute-options-{i}"></textarea>
            {/if}
            {#if a.label.trim() !== ''}<small class="muted key"
                >Key {keys[i]}</small
              >{/if}
          </div>
        {/each}
        <button
          type="button"
          onclick={() =>
            (draft.attributes = [
              ...draft.attributes,
              { label: '', type: 'text', options: '', required: false },
            ])}
          data-testid="concept-wizard-add-attribute">Add attribute</button
        >
      {:else}
        {#if !(draft.kind === 'class' && draft.abstract)}
          <fieldset>
            <legend>Which model types allow it?</legend>
            <div class="list">
              {#each Object.values(kit.modelTypes) as t (t.id)}
                <label class="check">
                  <input
                    type="checkbox"
                    checked={draft.modelTypes.includes(t.id)}
                    onchange={(e) =>
                      (draft.modelTypes = e.currentTarget.checked
                        ? [...draft.modelTypes, t.id]
                        : draft.modelTypes.filter((x) => x !== t.id))}
                    data-testid="concept-wizard-model-type-{t.key}"
                  />
                  {labelIn(
                    t.labels,
                    language,
                    t.key,
                  )}{#if t.id === modelType}<small class="muted">
                      (this model)</small
                    >{/if}
                </label>
              {/each}
            </div>
          </fieldset>
        {/if}
        <div class="summary" data-testid="concept-wizard-summary">
          {#each lines as line (line)}<p>{line}</p>{/each}
        </div>
        {#if where === 'model'}
          <p class="muted small">
            This changes the Kit {kit.manifest.name}, so every model made with
            it can use the new {noun}. You can undo it right after, and change
            it later in Build mode.
          </p>
        {/if}
      {/if}
    </div>

    {#if (tried && problems.length > 0) || refusal}
      <ul class="problems" role="alert" data-testid="concept-wizard-problems">
        {#each tried ? problems : [] as p (p)}<li>{p}</li>{/each}
        {#if refusal}<li>{refusal}</li>{/if}
      </ul>
    {/if}

    <div class="actions">
      <button type="button" onclick={() => dialog?.close()}>Cancel</button>
      <span class="spacer"></span>
      <button
        type="button"
        disabled={index === 0}
        onclick={back}
        data-testid="concept-wizard-back">Back</button
      >
      <button class="primary" type="submit" data-testid="concept-wizard-next">
        {index === steps.length - 1 ? `Add ${noun}` : 'Next'}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(36rem, calc(100vw - 2rem));
  }
  form {
    display: grid;
    gap: var(--gap-3);
  }
  h2 {
    margin: 0;
  }
  .head {
    display: grid;
    gap: var(--gap-2);
  }
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-1) var(--gap-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .steps .current {
    color: var(--text);
    font-weight: 600;
  }
  .body {
    display: grid;
    gap: var(--gap-3);
    max-height: min(30rem, 60dvh);
    overflow-y: auto;
    padding-right: var(--gap-1);
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  label.check {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
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
  .kind {
    display: grid;
    gap: var(--gap-1);
  }
  .option {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-2);
    padding: var(--gap-2);
    border-radius: var(--radius-s);
    cursor: pointer;
  }
  .option:has(input:checked) {
    background: var(--accent-soft);
  }
  .option span {
    display: grid;
  }
  .option small,
  .small {
    font-size: var(--text-s);
  }
  .small {
    margin: 0;
  }
  .radios {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2) var(--gap-4);
    align-items: center;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-1);
    margin-top: var(--gap-1);
  }
  .swatch {
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-s);
  }
  .swatch[aria-pressed='true'] {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .ends {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap-3);
  }
  .list {
    display: grid;
    gap: var(--gap-1);
    max-height: 12rem;
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--gap-2);
  }
  .attribute {
    display: grid;
    grid-template-columns: 1fr 10rem auto auto;
    gap: var(--gap-1) var(--gap-2);
    align-items: center;
  }
  .attribute textarea {
    grid-column: 1 / -1;
  }
  .attribute .key {
    grid-column: 1 / -1;
    font-size: var(--text-s);
  }
  .summary {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--gap-2) var(--gap-3);
  }
  .summary p {
    margin: var(--gap-1) 0;
  }
  .problems {
    margin: 0;
    padding: var(--gap-2) var(--gap-2) var(--gap-2) var(--gap-5);
    color: var(--danger);
    background: var(--danger-soft);
    border-radius: var(--radius);
    font-size: var(--text-s);
  }
  .actions {
    display: flex;
    gap: var(--gap-2);
  }
  .spacer {
    flex: 1;
  }
</style>
