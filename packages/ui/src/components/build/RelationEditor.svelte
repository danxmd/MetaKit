<script lang="ts">
  import {
    newId,
    type ClassId,
    type RelationDef,
    type RelationId,
    type Kit,
  } from '@metakit-app/core';
  import { copyStarter, STARTER_IDS } from '@metakit-app/shapes';
  import { toggled, withPatch } from '../../build/attributes';
  import type { CommandResult } from '../../shell/controller';
  import AttributeList from './AttributeList.svelte';
  import ConstraintsEditor from './ConstraintsEditor.svelte';
  import KeyField from './KeyField.svelte';
  import Section from './Section.svelte';
  import LabelsField from './LabelsField.svelte';
  import AppearanceCard from './appearance/AppearanceCard.svelte';
  import { appearanceOfRelation } from '../../build/appearance-model';

  let {
    kit,
    id,
    run,
    onEditShape,
    onEditAppearance,
    usages,
  }: {
    kit: Kit;
    id: RelationId;
    run: (command: never) => CommandResult;
    onEditShape: (shapeId: string) => void;
    onEditAppearance: (relationId: string) => void;
    usages: (attributeId: string) => string[];
  } = $props();

  const def = $derived(kit.relations[id]);
  const languages = $derived(kit.manifest.languages);
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
    Object.values(kit.classes).sort((a, b) => a.key.localeCompare(b.key)),
  );
  const parents = $derived(
    Object.values(kit.relations)
      .filter((r) => r.id !== id && r.extends !== id)
      .sort((a, b) => a.key.localeCompare(b.key)),
  );
  const relationShapes = $derived(
    Object.values(kit.shapes).filter((s) => s.kind === 'relation'),
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
    {#if error}<p
        class="notice error"
        role="alert"
        data-testid="relation-problem"
      >
        {error}
      </p>{/if}
    <Section
      title="Identity"
      help="What the relation class is called and how it relates to other relation classes."
    >
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
    </Section>
    <Section
      title="Connects"
      help="Leave a list empty to allow what the parent allows. A class that others extend allows all of them."
    >
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
    </Section>
    <Section
      title="Appearance"
      help="How the connection is drawn between two objects."
    >
      <AppearanceCard
        {kit}
        owner={{ kind: 'relation', id }}
        {run}
        {onEditAppearance}
        {onEditShape}
      >
        <div class="row">
          <label>
            Use an existing line shape
            <select
              value={def.shape ?? ''}
              onchange={(e) =>
                patch({ shape: e.currentTarget.value || undefined })}
              data-testid="relation-shape"
            >
              <option value="">Automatic (grey arrow)</option>
              {#each relationShapes as s (s.id)}<option value={s.id}
                  >{s.name ?? s.id}</option
                >{/each}
            </select>
          </label>
          {#if def.shape && appearanceOfRelation(kit, id).kind === 'look'}
            <button type="button" onclick={() => onEditShape(def.shape!)}
              >Edit as drawing</button
            >
          {/if}
          <button
            type="button"
            onclick={newShape}
            data-testid="relation-new-shape">New drawn line shape</button
          >
        </div>
      </AppearanceCard>
    </Section>
    <AttributeList
      owner={{ kind: 'relation', id }}
      attributes={def.attributes}
      {kit}
      {run}
      {usages}
    />
    <ConstraintsEditor
      owner={{ kind: 'relation', id }}
      constraints={def.constraints ?? []}
      {kit}
      {run}
    />
  </div>
{/if}

<style>
  .editor {
    display: grid;
    gap: var(--gap-4);
    max-width: 56rem;
  }
  .row {
    display: flex;
    gap: var(--gap-4);
    flex-wrap: wrap;
    align-items: end;
  }
  .ends {
    display: flex;
    gap: var(--gap-3);
    flex-wrap: wrap;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-3);
    flex: 1;
    min-width: 14rem;
  }
  legend {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  label.inline {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
  }
</style>
