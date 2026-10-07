<script lang="ts">
  import {
    newId,
    type ClassId,
    type RelationDef,
    type RelationId,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { copyStarter, STARTER_IDS } from '@metakit-app/shapes';
  import { toggled, withPatch } from '../../build/attributes';
  import type { CommandResult } from '../../shell/controller';
  import AttributeList from './AttributeList.svelte';
  import KeyField from './KeyField.svelte';
  import LabelsField from './LabelsField.svelte';

  let {
    tool,
    id,
    run,
    onEditShape,
    usages,
  }: {
    tool: ToolLibrary;
    id: RelationId;
    run: (command: never) => CommandResult;
    onEditShape: (shapeId: string) => void;
    usages: (attributeId: string) => string[];
  } = $props();

  const def = $derived(tool.relations[id]);
  const languages = $derived(tool.manifest.languages);
  let error = $state<string | null>(null);

  const exec = (command: Record<string, unknown>): string | null => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok ? null : r.error;
  };
  const patch = (changes: Record<string, unknown>) => {
    if (def)
      exec({ type: 'putRelation', def: withPatch<RelationDef>(def, changes) });
  };
  const classes = $derived(
    Object.values(tool.classes).sort((a, b) => a.key.localeCompare(b.key)),
  );
  const parents = $derived(
    Object.values(tool.relations)
      .filter((r) => r.id !== id && r.extends !== id)
      .sort((a, b) => a.key.localeCompare(b.key)),
  );
  const relationShapes = $derived(
    Object.values(tool.shapes).filter((s) => s.kind === 'relation'),
  );
  function toggle(end: 'from' | 'to', cls: ClassId, on: boolean) {
    if (def) patch({ [end]: toggled(def[end], cls, on) });
  }
  function newShape() {
    const base = copyStarter(STARTER_IDS.flow, newId('shape'));
    if (!base) return;
    const named = { ...base, name: `${def?.key ?? 'Relation'} line` };
    if (exec({ type: 'putShape', def: named }) === null) {
      patch({ shape: named.id });
      onEditShape(named.id);
    }
  }
</script>

{#if def}
  <div class="editor" data-testid="relation-editor">
    <h2>Relation class {def.key}</h2>
    <KeyField
      value={def.key}
      testid="relation-key"
      onRename={(key) =>
        exec({
          type: 'renameKey',
          scope: { kind: 'relation', id },
          newKey: key,
        })}
    />
    <LabelsField
      title="Label"
      labels={def.labels}
      {languages}
      testid="relation-label"
      onChange={(labels) => patch({ labels })}
    />
    <div class="row">
      <label>
        Extends
        <select
          value={def.extends ?? ''}
          onchange={(e) =>
            patch({ extends: e.currentTarget.value || undefined })}
        >
          <option value="">Nothing</option>
          {#each parents as p (p.id)}<option value={p.id}>{p.key}</option
            >{/each}
        </select>
      </label>
      <label class="inline">
        <input
          type="checkbox"
          checked={def.abstract === true}
          onchange={(e) =>
            patch({ abstract: e.currentTarget.checked || undefined })}
        />
        Abstract
      </label>
    </div>
    <div class="ends">
      <fieldset>
        <legend>From (where a connection may start)</legend>
        {#each classes as c (c.id)}
          <label class="inline"
            ><input
              type="checkbox"
              checked={def.from.includes(c.id)}
              onchange={(e) => toggle('from', c.id, e.currentTarget.checked)}
              data-testid="relation-from-{c.key}"
            />
            {c.key}</label
          >
        {/each}
      </fieldset>
      <fieldset>
        <legend>To (where it may end)</legend>
        {#each classes as c (c.id)}
          <label class="inline"
            ><input
              type="checkbox"
              checked={def.to.includes(c.id)}
              onchange={(e) => toggle('to', c.id, e.currentTarget.checked)}
              data-testid="relation-to-{c.key}"
            />
            {c.key}</label
          >
        {/each}
      </fieldset>
    </div>
    <p class="muted">
      Leave a list empty to allow what the parent allows. A class that others
      extend allows all of them.
    </p>
    <div class="row">
      <label>
        Line shape
        <select
          value={def.shape ?? ''}
          onchange={(e) => patch({ shape: e.currentTarget.value || undefined })}
          data-testid="relation-shape"
        >
          <option value="">Automatic (grey arrow)</option>
          {#each relationShapes as s (s.id)}<option value={s.id}
              >{s.name ?? s.id}</option
            >{/each}
        </select>
      </label>
      {#if def.shape}<button
          type="button"
          onclick={() => onEditShape(def.shape!)}>Edit line</button
        >{/if}
      <button type="button" onclick={newShape} data-testid="relation-new-shape"
        >New line shape</button
      >
    </div>
    <AttributeList
      owner={{ kind: 'relation', id }}
      attributes={def.attributes}
      {tool}
      {run}
      {usages}
    />
    {#if error}<p class="problem" role="alert" data-testid="relation-problem">
        {error}
      </p>{/if}
  </div>
{/if}

<style>
  .editor {
    display: grid;
    gap: 0.8rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: end;
  }
  .ends {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    flex: 1;
  }
  label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.9rem;
  }
  label.inline {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0;
  }
  .problem {
    color: #c92a2a;
  }
</style>
