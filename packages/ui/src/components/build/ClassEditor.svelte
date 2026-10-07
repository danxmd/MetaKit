<script lang="ts">
  import {
    CLASS_KINDS,
    isA,
    newId,
    type ClassDef,
    type ClassId,
    type ClassKind,
    type ToolLibrary,
  } from '@metakit-app/core';
  import { copyStarter, STARTER_IDS } from '@metakit-app/shapes';
  import { withPatch } from '../../build/attributes';
  import type { CommandResult } from '../../shell/controller';
  import AttributeList from './AttributeList.svelte';
  import ConstraintsEditor from './ConstraintsEditor.svelte';
  import KeyField from './KeyField.svelte';
  import LabelsField from './LabelsField.svelte';

  let {
    tool,
    id,
    run,
    onEditShape,
    onEditPanel,
    usages,
  }: {
    tool: ToolLibrary;
    id: ClassId;
    run: (command: never) => CommandResult;
    onEditShape: (shapeId: string) => void;
    onEditPanel: (classId: string) => void;
    usages: (attributeId: string) => string[];
  } = $props();

  const def = $derived(tool.classes[id]);
  const languages = $derived(tool.manifest.languages);
  let error = $state<string | null>(null);

  const exec = (command: Record<string, unknown>): string | null => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok ? null : r.error;
  };
  const patch = (changes: Record<string, unknown>) => {
    if (def) exec({ type: 'putClass', def: withPatch<ClassDef>(def, changes) });
  };

  const parents = $derived(
    Object.values(tool.classes)
      .filter((c) => c.id !== id && !isA(tool, c.id, id))
      .sort((a, b) => a.key.localeCompare(b.key)),
  );
  const nodeShapes = $derived(
    Object.values(tool.shapes).filter((s) => s.kind === 'node'),
  );
  const parentKeys = $derived.by(() => {
    const keys: string[] = [];
    for (const c of Object.values(tool.classes))
      if (c.id !== id && (isA(tool, id, c.id) || isA(tool, c.id, id)))
        keys.push(...c.attributes.map((a) => a.key));
    return keys;
  });

  function newShape() {
    const base = copyStarter(STARTER_IDS.task, newId('shape'));
    if (!base) return;
    const named = { ...base, name: `${def?.key ?? 'Class'} shape` };
    if (exec({ type: 'putShape', def: named }) === null) {
      patch({ shape: named.id });
      onEditShape(named.id);
    }
  }
</script>

{#if def}
  <div class="editor" data-testid="class-editor">
    <h2>Class {def.key}</h2>
    <KeyField
      value={def.key}
      testid="class-key"
      onRename={(key) =>
        exec({ type: 'renameKey', scope: { kind: 'class', id }, newKey: key })}
    />
    <LabelsField
      title="Label"
      labels={def.labels}
      {languages}
      testid="class-label"
      onChange={(labels) => patch({ labels })}
    />
    <div class="row">
      <label>
        Kind
        <select
          value={def.kind}
          onchange={(e) => patch({ kind: e.currentTarget.value as ClassKind })}
          data-testid="class-kind"
        >
          {#each CLASS_KINDS as k (k)}
            <option value={k}
              >{k === 'node'
                ? 'Object'
                : k === 'container'
                  ? 'Container'
                  : 'Swimlane'}</option
            >
          {/each}
        </select>
      </label>
      <label>
        Extends
        <select
          value={def.extends ?? ''}
          onchange={(e) =>
            patch({ extends: e.currentTarget.value || undefined })}
          data-testid="class-parent"
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
          data-testid="class-abstract"
        />
        Abstract (only for others to extend)
      </label>
    </div>
    <LabelsField
      title="Help text"
      labels={def.help}
      {languages}
      multiline
      testid="class-help"
      onChange={(help) =>
        patch({ help: Object.keys(help).length ? help : undefined })}
    />
    <div class="row">
      <label>
        Shape
        <select
          value={def.shape ?? ''}
          onchange={(e) => patch({ shape: e.currentTarget.value || undefined })}
          data-testid="class-shape"
        >
          <option value="">Automatic (starter shape)</option>
          {#each nodeShapes as s (s.id)}<option value={s.id}
              >{s.name ?? s.id}</option
            >{/each}
        </select>
      </label>
      {#if def.shape}
        <button
          type="button"
          onclick={() => onEditShape(def.shape!)}
          data-testid="class-edit-shape">Edit shape</button
        >
      {/if}
      <button type="button" onclick={newShape} data-testid="class-new-shape"
        >New shape</button
      >
      <button
        type="button"
        onclick={() => onEditPanel(id)}
        data-testid="class-edit-panel"
      >
        {tool.panels[id] ? 'Edit panel layout' : 'Set up panel layout'}
      </button>
    </div>
    <AttributeList
      owner={{ kind: 'class', id }}
      attributes={def.attributes}
      {tool}
      {run}
      taken={parentKeys}
      {usages}
    />
    <ConstraintsEditor
      owner={{ kind: 'class', id }}
      constraints={def.constraints ?? []}
      {tool}
      {run}
    />
    {#if error}<p class="problem" role="alert" data-testid="class-problem">
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
  .problem {
    color: #c92a2a;
  }
</style>
