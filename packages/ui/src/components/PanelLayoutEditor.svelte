<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    isFormula,
    type AttributeDef,
    type PanelAttributeItem,
    type PanelControl,
    type PanelGroupItem,
    type PanelItem,
    type PanelLayout,
    type PanelTab,
  } from '@metakit-app/core';
  import { parse } from '@metakit-app/formula';
  import {
    PanelLayoutModel,
    type ConditionName,
    type LayoutPath,
  } from '../build/panel-layout-model';
  import { controlsFor } from '../panel/layout';

  let {
    layout,
    attributes,
    onChange,
    onClose,
  }: {
    layout: PanelLayout;
    attributes: AttributeDef[];
    onChange: (layout: PanelLayout) => void;
    onClose: () => void;
  } = $props();

  // The editor works on its own draft and reports every change; a new `layout` prop later does
  // not replace the draft, because the parent only echoes back what the editor sent.
  // svelte-ignore state_referenced_locally
  const model = new PanelLayoutModel(layout, attributes);
  let current = $state<PanelLayout>(model.toLayout());
  const stop = model.onChange((next) => {
    current = next;
    onChange(next);
  });
  onDestroy(stop);

  let selected = $state<LayoutPath | null>(null);
  let activeTab = $state(0);
  let message = $state('');

  const unplaced = $derived.by(() => {
    void current;
    return model.unplaced();
  });
  const canUndo = $derived.by(() => {
    void current;
    return model.canUndo();
  });
  const canRedo = $derived.by(() => {
    void current;
    return model.canRedo();
  });

  const same = (a: LayoutPath | null, b: LayoutPath) =>
    a !== null && a.length === b.length && a.every((v, i) => v === b[i]);
  const isGroup = (item: PanelItem): item is PanelGroupItem => 'group' in item;

  function attempt(action: () => void) {
    try {
      message = '';
      action();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  }

  function pick(path: LayoutPath) {
    selected = same(selected, path) ? null : path;
    activeTab = path[0]!;
  }

  function itemAt(path: LayoutPath): PanelTab | PanelItem | undefined {
    let tab: PanelTab | undefined = current.tabs[path[0]!];
    if (path.length === 1) return tab;
    let item: PanelItem | undefined = tab?.items[path[1]!];
    if (path.length === 2) return item;
    item = item && isGroup(item) ? item.items[path[2]!] : undefined;
    return item;
  }

  function move(path: LayoutPath, step: -1 | 1) {
    attempt(() => {
      const moved = step < 0 ? model.moveUp(path) : model.moveDown(path);
      if (moved && same(selected, path))
        selected = [...path.slice(0, -1), path.at(-1)! + step];
    });
  }

  function nest(path: LayoutPath, into: boolean) {
    attempt(() => {
      if (into) model.intoGroup(path);
      else model.outOfGroup(path);
      selected = null;
    });
  }

  function remove(path: LayoutPath) {
    attempt(() => {
      model.removeAttribute(path);
      selected = null;
    });
  }

  function addTab() {
    attempt(() => {
      activeTab = model.addTab();
      selected = null;
    });
  }

  function removeTab(index: number) {
    attempt(() => {
      model.removeTab(index);
      selected = null;
      activeTab = Math.max(0, Math.min(activeTab, current.tabs.length - 1));
    });
  }

  function removeGroup(path: LayoutPath) {
    attempt(() => {
      model.removeGroup(path);
      selected = null;
    });
  }

  function addUnplaced(key: string) {
    attempt(() => model.addAttribute([activeTab], key));
  }

  function controlOf(item: PanelAttributeItem): string {
    return item.control ?? '';
  }

  function typeOf(item: PanelAttributeItem): AttributeDef | undefined {
    return attributes.find((a) => a.key === item.attribute);
  }

  function conditionValue(
    item: PanelTab | PanelItem,
    name: ConditionName,
  ): boolean | string | undefined {
    return (item as { [k in ConditionName]?: boolean | string })[name];
  }

  const defaultFor = (name: ConditionName) => name === 'visible';

  function setFixed(path: LayoutPath, name: ConditionName, value: boolean) {
    attempt(() => model.setCondition(path, name, value));
  }

  function toggleFx(
    path: LayoutPath,
    name: ConditionName,
    value: boolean | string | undefined,
  ) {
    attempt(() => {
      if (typeof value === 'string' && isFormula(value))
        model.setCondition(path, name, defaultFor(name));
      else
        model.setCondition(
          path,
          name,
          `= ${typeof value === 'boolean' ? value : defaultFor(name)}`,
        );
    });
  }

  function formulaProblem(text: string): string {
    const parsed = parse(text.trimStart().slice(1).trim());
    return parsed.ok ? '' : `${parsed.error} (at ${parsed.at})`;
  }

  function setFormula(path: LayoutPath, name: ConditionName, text: string) {
    attempt(() =>
      model.setCondition(
        path,
        name,
        text.trimStart().startsWith('=') ? text : `= ${text}`,
      ),
    );
  }

  const conditionsFor = (path: LayoutPath): ConditionName[] =>
    path.length === 1 || isGroup(itemAt(path) as PanelItem)
      ? ['visible']
      : ['visible', 'readOnly', 'required'];

  const conditionLabel: Record<ConditionName, string> = {
    visible: 'Visible',
    readOnly: 'Read only',
    required: 'Required',
  };
</script>

{#snippet conditions(path: LayoutPath)}
  {@const item = itemAt(path)}
  {#if item}
    {#each conditionsFor(path) as name (name)}
      {@const value = conditionValue(item, name)}
      {@const isFx = typeof value === 'string' && isFormula(value)}
      <div class="condition" data-testid="panel-condition-{name}">
        <span class="cname">{conditionLabel[name]}</span>
        {#if !isFx}
          <label>
            <input
              type="checkbox"
              data-testid="panel-cond-{name}"
              checked={typeof value === 'boolean' ? value : defaultFor(name)}
              onchange={(e) => setFixed(path, name, e.currentTarget.checked)}
            />
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 'Default'}
          </label>
        {:else}
          <input
            type="text"
            class="formula"
            aria-label="{conditionLabel[name]} formula"
            data-testid="panel-formula-{name}"
            {value}
            onchange={(e) => setFormula(path, name, e.currentTarget.value)}
          />
        {/if}
        <button
          type="button"
          class="fx"
          aria-pressed={isFx}
          title="Use a formula"
          data-testid="panel-fx-{name}"
          onclick={() => toggleFx(path, name, value)}>fx</button
        >
        {#if isFx && formulaProblem(value as string)}
          <span class="problem" role="alert"
            >{formulaProblem(value as string)}</span
          >
        {/if}
      </div>
    {/each}
  {/if}
{/snippet}

{#snippet itemRows(items: PanelItem[], parent: number[])}
  {#each items as item, i (isGroup(item) ? `g-${item.group}-${i}` : `a-${item.attribute}`)}
    {@const path = [...parent, i]}
    {#if isGroup(item)}
      <li class="group">
        <div class="row">
          <button
            type="button"
            class="name"
            aria-expanded={same(selected, path)}
            onclick={() => pick(path)}>Group: {item.group}</button
          >
          <button
            type="button"
            title="Move up"
            aria-label="Move group up"
            onclick={() => move(path, -1)}>↑</button
          >
          <button
            type="button"
            title="Move down"
            aria-label="Move group down"
            onclick={() => move(path, 1)}>↓</button
          >
          <button
            type="button"
            title="Remove the group; its attributes stay"
            aria-label="Remove group"
            onclick={() => removeGroup(path)}>✕</button
          >
        </div>
        {#if same(selected, path)}
          <div class="details">
            <label
              >Name
              <input
                type="text"
                data-testid="panel-group-name"
                value={item.group}
                onchange={(e) =>
                  attempt(() => model.renameGroup(path, e.currentTarget.value))}
              />
            </label>
            {@render conditions(path)}
          </div>
        {/if}
        <ul>
          {@render itemRows(item.items, path)}
        </ul>
      </li>
    {:else}
      {@const def = typeOf(item)}
      <li data-testid="panel-attr-{item.attribute}">
        <div class="row">
          <button
            type="button"
            class="name"
            aria-expanded={same(selected, path)}
            onclick={() => pick(path)}>{item.attribute}</button
          >
          <button
            type="button"
            title="Move up"
            aria-label="Move {item.attribute} up"
            data-testid="panel-up-{item.attribute}"
            onclick={() => move(path, -1)}>↑</button
          >
          <button
            type="button"
            title="Move down"
            aria-label="Move {item.attribute} down"
            data-testid="panel-down-{item.attribute}"
            onclick={() => move(path, 1)}>↓</button
          >
          {#if path.length === 2}
            <button
              type="button"
              title="Move into the group next to it"
              aria-label="Move {item.attribute} into a group"
              data-testid="panel-in-{item.attribute}"
              onclick={() => nest(path, true)}>⇥</button
            >
          {:else}
            <button
              type="button"
              title="Move out of the group"
              aria-label="Move {item.attribute} out of the group"
              data-testid="panel-out-{item.attribute}"
              onclick={() => nest(path, false)}>⇤</button
            >
          {/if}
          <button
            type="button"
            title="Remove from the layout"
            aria-label="Remove {item.attribute}"
            data-testid="panel-remove-{item.attribute}"
            onclick={() => remove(path)}>✕</button
          >
        </div>
        {#if same(selected, path)}
          <div class="details">
            <label
              >Control
              <select
                data-testid="panel-control"
                value={controlOf(item)}
                onchange={(e) =>
                  attempt(() =>
                    model.setControl(
                      path,
                      (e.currentTarget.value || undefined) as
                        PanelControl | undefined,
                    ),
                  )}
              >
                <option value="">Default</option>
                {#each def ? controlsFor(def.type) : [] as control (control)}
                  <option value={control}>{control}</option>
                {/each}
              </select>
            </label>
            {#if def && (def.type === 'table' || (def.type === 'text' && (item.control === 'textarea' || def.multiline)))}
              <label
                >Height (pixels)
                <input
                  type="number"
                  min="1"
                  data-testid="panel-height"
                  value={item.height ?? ''}
                  onchange={(e) =>
                    attempt(() =>
                      model.setHeight(
                        path,
                        e.currentTarget.value === ''
                          ? undefined
                          : Number(e.currentTarget.value),
                      ),
                    )}
                />
              </label>
            {/if}
            {@render conditions(path)}
          </div>
        {/if}
      </li>
    {/if}
  {/each}
{/snippet}

<section
  class="editor"
  aria-label="Panel layout"
  data-testid="panel-layout-editor"
>
  <header>
    <h3>Panel layout</h3>
    <button
      type="button"
      disabled={!canUndo}
      data-testid="panel-undo"
      onclick={() => model.undo()}>Undo</button
    >
    <button
      type="button"
      disabled={!canRedo}
      data-testid="panel-redo"
      onclick={() => model.redo()}>Redo</button
    >
    <button type="button" data-testid="panel-close" onclick={onClose}
      >Close</button
    >
  </header>

  {#if message}<p class="problem" role="alert">{message}</p>{/if}

  <ol class="tabs">
    {#each current.tabs as tab, i (i)}
      <li class:active={activeTab === i}>
        <div class="row">
          <button
            type="button"
            class="name"
            data-testid="panel-tab-{i}"
            aria-expanded={same(selected, [i])}
            onclick={() => pick([i])}>Tab: {tab.label}</button
          >
          <button
            type="button"
            title="Move tab up"
            aria-label="Move tab {tab.label} up"
            disabled={i === 0}
            onclick={() => attempt(() => model.moveTab(i, i - 1))}>↑</button
          >
          <button
            type="button"
            title="Move tab down"
            aria-label="Move tab {tab.label} down"
            disabled={i === current.tabs.length - 1}
            onclick={() => attempt(() => model.moveTab(i, i + 1))}>↓</button
          >
          <button
            type="button"
            title="Remove the tab; its attributes become unplaced"
            aria-label="Remove tab {tab.label}"
            data-testid="panel-remove-tab-{i}"
            onclick={() => removeTab(i)}>✕</button
          >
        </div>
        {#if same(selected, [i])}
          <div class="details">
            <label
              >Name
              <input
                type="text"
                data-testid="panel-tab-name"
                value={tab.label}
                onchange={(e) =>
                  attempt(() => model.renameTab(i, e.currentTarget.value))}
              />
            </label>
            {@render conditions([i])}
          </div>
        {/if}
        <ul>
          {@render itemRows(tab.items, [i])}
        </ul>
        <button
          type="button"
          data-testid="panel-add-group-{i}"
          onclick={() =>
            attempt(() => {
              model.addGroup(i, 'New group');
              activeTab = i;
            })}>Add group</button
        >
      </li>
    {/each}
  </ol>

  <button type="button" data-testid="panel-add-tab" onclick={addTab}
    >Add tab</button
  >

  <label class="relations">
    <input
      type="checkbox"
      data-testid="panel-show-relations"
      checked={current.showRelations === true}
      onchange={() => model.toggleShowRelations()}
    />
    Show the connected relations
  </label>

  <h4>Not placed yet</h4>
  {#if unplaced.length === 0}
    <p class="note">Every attribute is placed.</p>
  {:else}
    <p class="note">
      These show up in a final tab called "More" until you place them. The Add
      button puts one at the end of the tab you last used.
    </p>
    <ul class="unplaced">
      {#each unplaced as key (key)}
        <li data-testid="panel-unplaced-{key}">
          <span>{key}</span>
          <button
            type="button"
            data-testid="panel-add-{key}"
            onclick={() => addUnplaced(key)}>Add</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .editor {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }
  header {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  header h3 {
    margin: 0 auto 0 0;
    font-size: 1rem;
  }
  ol,
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ul ul {
    padding-left: 1rem;
  }
  .tabs > li {
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.35rem 0.5rem;
    margin: 0.5rem 0;
  }
  .tabs > li.active {
    border-color: var(--accent);
  }
  .group {
    margin-top: 0.25rem;
  }
  .row {
    display: flex;
    gap: 0.2rem;
    align-items: center;
    margin: 0.15rem 0;
  }
  .row .name {
    flex: 1;
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0.15rem 0.25rem;
    border-radius: 3px;
  }
  .row .name:hover {
    background: var(--hover);
  }
  .details {
    display: grid;
    gap: 0.35rem;
    padding: 0.4rem;
    margin: 0.2rem 0 0.4rem;
    background: var(--hover);
    border-radius: 4px;
  }
  .details label {
    display: grid;
    gap: 0.15rem;
  }
  .condition {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }
  .condition .cname {
    min-width: 5rem;
    font-weight: 600;
  }
  .condition label {
    display: flex;
    gap: 0.25rem;
  }
  .formula {
    flex: 1;
    min-width: 8rem;
    font-family: monospace;
  }
  .fx {
    font-style: italic;
    font-weight: 600;
  }
  .fx[aria-pressed='true'] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .problem {
    color: var(--danger);
    margin: 0.2rem 0;
  }
  .note {
    color: var(--muted);
  }
  .relations {
    display: flex;
    gap: 0.35rem;
    margin: 0.6rem 0;
  }
  h4 {
    margin: 0.8rem 0 0.2rem;
  }
  .unplaced li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.15rem 0;
  }
</style>
