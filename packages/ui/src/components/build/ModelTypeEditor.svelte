<script lang="ts">
  import {
    newId,
    type Cardinality,
    type ClassId,
    type ModelTypeDef,
    type ModelTypeId,
    type RelationId,
    type ToolLibrary,
    type ViewDef,
  } from '@metakit-app/core';
  import { toggled, uniqueKey, withPatch } from '../../build/attributes';
  import type { CommandResult } from '../../shell/controller';
  import AttributeList from './AttributeList.svelte';
  import KeyField from './KeyField.svelte';
  import LabelsField from './LabelsField.svelte';

  let {
    tool,
    id,
    run,
    usages,
  }: {
    tool: ToolLibrary;
    id: ModelTypeId;
    run: (command: never) => CommandResult;
    usages: (attributeId: string) => string[];
  } = $props();

  const def = $derived(tool.modelTypes[id]);
  const languages = $derived(tool.manifest.languages);
  const lang = $derived(languages[0] ?? 'en');
  let error = $state<string | null>(null);

  const exec = (command: Record<string, unknown>): string | null => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok ? null : r.error;
  };
  const patch = (changes: Record<string, unknown>) => {
    if (def)
      exec({
        type: 'putModelType',
        def: withPatch<ModelTypeDef>(def, changes),
      });
  };
  const classes = $derived(
    Object.values(tool.classes).sort((a, b) => a.key.localeCompare(b.key)),
  );
  const relations = $derived(
    Object.values(tool.relations).sort((a, b) => a.key.localeCompare(b.key)),
  );
  const containerClasses = $derived(
    classes.filter(
      (c) =>
        def?.classes.includes(c.id) &&
        (c.kind === 'container' || c.kind === 'swimlane'),
    ),
  );
  const nodeShapes = $derived(
    Object.values(tool.shapes).filter((s) => s.kind === 'node'),
  );

  function toggleClass(cls: ClassId, on: boolean) {
    if (def) patch({ classes: toggled(def.classes, cls, on) });
  }
  function toggleRelation(rel: RelationId, on: boolean) {
    if (def) patch({ relations: toggled(def.relations, rel, on) });
  }

  // Views ---------------------------------------------------------------------------------------
  function setViews(views: ViewDef[]) {
    patch({ views });
  }
  function addView() {
    if (!def) return;
    const key = uniqueKey(
      'View',
      def.views.map((v) => v.key),
    );
    setViews([
      ...def.views,
      {
        id: newId('view'),
        key,
        labels: { [lang]: key },
        classes: [...def.classes],
        relations: [...def.relations],
      },
    ]);
  }
  function patchView(index: number, changes: Partial<ViewDef>) {
    if (!def) return;
    setViews(def.views.map((v, i) => (i === index ? { ...v, ...changes } : v)));
  }
  function toggleInView(
    index: number,
    field: 'classes' | 'relations',
    value: string,
    on: boolean,
  ) {
    const view = def!.views[index]!;
    patchView(index, {
      [field]: toggled<string>(view[field], value, on),
    } as Partial<ViewDef>);
  }

  // Cardinalities -------------------------------------------------------------------------------
  const num = (text: string): number | undefined =>
    text.trim() === '' || Number.isNaN(Number(text))
      ? undefined
      : Math.max(0, Math.floor(Number(text)));
  function setCardinalities(list: Cardinality[]) {
    patch({ cardinalities: list });
  }
  function addCardinality() {
    if (!def || def.classes.length === 0) return;
    setCardinalities([
      ...def.cardinalities,
      { kind: 'count', class: def.classes[0]!, max: 1 },
    ]);
  }
  function patchCardinality(i: number, changes: Record<string, unknown>) {
    if (!def) return;
    setCardinalities(
      def.cardinalities.map((c, j) => {
        if (j !== i) return c;
        const next = withPatch(c, changes) as Cardinality;
        return next;
      }),
    );
  }
  function setKind(i: number, kind: 'count' | 'degree') {
    const c = def!.cardinalities[i]!;
    if (c.kind === kind) return;
    setCardinalities(
      def!.cardinalities.map((x, j) =>
        j !== i
          ? x
          : kind === 'count'
            ? {
                kind: 'count',
                class: c.class,
                ...(c.min !== undefined ? { min: c.min } : {}),
                ...(c.max !== undefined ? { max: c.max } : {}),
              }
            : {
                kind: 'degree',
                class: c.class,
                relation: def!.relations[0] ?? ('rel_none' as RelationId),
                end: 'from',
                ...(c.min !== undefined ? { min: c.min } : {}),
                ...(c.max !== undefined ? { max: c.max } : {}),
              },
      ),
    );
  }

  // Containers ----------------------------------------------------------------------------------
  function setAccepts(container: ClassId, accepted: ClassId[] | null) {
    if (!def) return;
    const next = { ...(def.containers ?? {}) };
    if (accepted === null) delete next[container];
    else next[container] = accepted;
    patch({ containers: Object.keys(next).length ? next : undefined });
  }
</script>

{#if def}
  <div class="editor" data-testid="modeltype-editor">
    <h2>Model type {def.key}</h2>
    <KeyField
      value={def.key}
      testid="modeltype-key"
      onRename={(key) =>
        exec({
          type: 'renameKey',
          scope: { kind: 'modelType', id },
          newKey: key,
        })}
    />
    <LabelsField
      title="Label"
      labels={def.labels}
      {languages}
      testid="modeltype-label"
      onChange={(labels) => patch({ labels })}
    />
    <LabelsField
      title="Help text"
      labels={def.help}
      {languages}
      multiline
      onChange={(help) =>
        patch({ help: Object.keys(help).length ? help : undefined })}
    />
    <div class="ends">
      <fieldset>
        <legend>Classes allowed in the model</legend>
        {#each classes as c (c.id)}
          <label class="inline"
            ><input
              type="checkbox"
              checked={def.classes.includes(c.id)}
              onchange={(e) => toggleClass(c.id, e.currentTarget.checked)}
              data-testid="mt-class-{c.key}"
            />
            {c.key}</label
          >
        {/each}
      </fieldset>
      <fieldset>
        <legend>Relation classes allowed</legend>
        {#each relations as r (r.id)}
          <label class="inline"
            ><input
              type="checkbox"
              checked={def.relations.includes(r.id)}
              onchange={(e) => toggleRelation(r.id, e.currentTarget.checked)}
              data-testid="mt-relation-{r.key}"
            />
            {r.key}</label
          >
        {/each}
      </fieldset>
    </div>
    <label>
      Background shape
      <select
        value={def.background ?? ''}
        onchange={(e) =>
          patch({ background: e.currentTarget.value || undefined })}
      >
        <option value="">None</option>
        {#each nodeShapes as s (s.id)}<option value={s.id}
            >{s.name ?? s.id}</option
          >{/each}
      </select>
    </label>

    <section>
      <h3>Views</h3>
      <p class="muted">
        A view offers a smaller set of classes and relation classes in the
        palette.
      </p>
      {#each def.views as v, i (v.id)}
        <details class="view">
          <summary>{v.key}</summary>
          <KeyField
            value={v.key}
            hint=""
            onRename={(key) => {
              patchView(i, { key });
              return null;
            }}
          />
          <LabelsField
            title="Label"
            labels={v.labels}
            {languages}
            onChange={(labels) => patchView(i, { labels })}
          />
          <div class="ends">
            <fieldset>
              <legend>Classes</legend>
              {#each def.classes as cid (cid)}
                <label class="inline"
                  ><input
                    type="checkbox"
                    checked={v.classes.includes(cid)}
                    onchange={(e) =>
                      toggleInView(i, 'classes', cid, e.currentTarget.checked)}
                  />
                  {tool.classes[cid]?.key ?? cid}</label
                >
              {/each}
            </fieldset>
            <fieldset>
              <legend>Relation classes</legend>
              {#each def.relations as rid (rid)}
                <label class="inline"
                  ><input
                    type="checkbox"
                    checked={v.relations.includes(rid)}
                    onchange={(e) =>
                      toggleInView(
                        i,
                        'relations',
                        rid,
                        e.currentTarget.checked,
                      )}
                  />
                  {tool.relations[rid]?.key ?? rid}</label
                >
              {/each}
            </fieldset>
          </div>
          <button
            type="button"
            onclick={() => setViews(def.views.filter((_, j) => j !== i))}
            >Delete view</button
          >
        </details>
      {/each}
      <button type="button" onclick={addView} data-testid="mt-add-view"
        >Add view</button
      >
    </section>

    <section>
      <h3>Cardinalities</h3>
      <p class="muted">
        Limits on how many objects, or how many connections at an object, a
        model may have.
      </p>
      {#each def.cardinalities as c, i (i)}
        <div class="card">
          <select
            value={c.kind}
            onchange={(e) =>
              setKind(i, e.currentTarget.value as 'count' | 'degree')}
            aria-label="Kind of cardinality"
          >
            <option value="count">Number of objects of class</option>
            <option value="degree">Connections at an object of class</option>
          </select>
          <select
            value={c.class}
            onchange={(e) =>
              patchCardinality(i, { class: e.currentTarget.value })}
            aria-label="Class"
          >
            {#each def.classes as cid (cid)}<option value={cid}
                >{tool.classes[cid]?.key ?? cid}</option
              >{/each}
          </select>
          {#if c.kind === 'degree'}
            <select
              value={c.relation}
              onchange={(e) =>
                patchCardinality(i, { relation: e.currentTarget.value })}
              aria-label="Relation class"
            >
              {#each def.relations as rid (rid)}<option value={rid}
                  >{tool.relations[rid]?.key ?? rid}</option
                >{/each}
            </select>
            <select
              value={c.end}
              onchange={(e) =>
                patchCardinality(i, { end: e.currentTarget.value })}
              aria-label="End"
            >
              <option value="from">starting there</option><option value="to"
                >ending there</option
              >
            </select>
          {/if}
          <label class="inline"
            >at least <input
              type="number"
              min="0"
              value={c.min ?? ''}
              onchange={(e) =>
                patchCardinality(i, { min: num(e.currentTarget.value) })}
            /></label
          >
          <label class="inline"
            >at most <input
              type="number"
              min="0"
              value={c.max ?? ''}
              onchange={(e) =>
                patchCardinality(i, { max: num(e.currentTarget.value) })}
            /></label
          >
          <button
            type="button"
            onclick={() =>
              setCardinalities(def.cardinalities.filter((_, j) => j !== i))}
            >Remove</button
          >
        </div>
      {/each}
      <button
        type="button"
        onclick={addCardinality}
        disabled={def.classes.length === 0}>Add cardinality</button
      >
    </section>

    {#if containerClasses.length > 0}
      <section>
        <h3>What containers accept</h3>
        <p class="muted">
          By default a container or swimlane accepts every class. Choose classes
          to limit it.
        </p>
        {#each containerClasses as c (c.id)}
          {@const accepted = def.containers?.[c.id]}
          <fieldset>
            <legend>{c.key}</legend>
            <label class="inline"
              ><input
                type="checkbox"
                checked={accepted === undefined}
                onchange={(e) =>
                  setAccepts(
                    c.id,
                    e.currentTarget.checked
                      ? null
                      : def.classes.filter((x) => x !== c.id),
                  )}
                data-testid="mt-accepts-any-{c.key}"
              /> Accepts any class</label
            >
            {#if accepted !== undefined}
              {#each def.classes.filter((x) => x !== c.id) as cid (cid)}
                <label class="inline"
                  ><input
                    type="checkbox"
                    checked={accepted.includes(cid)}
                    onchange={(e) =>
                      setAccepts(
                        c.id,
                        e.currentTarget.checked
                          ? [...accepted, cid]
                          : accepted.filter((x) => x !== cid),
                      )}
                  />
                  {tool.classes[cid]?.key ?? cid}</label
                >
              {/each}
            {/if}
          </fieldset>
        {/each}
      </section>
    {/if}

    <AttributeList
      owner={{ kind: 'modelType', id }}
      attributes={def.attributes}
      {tool}
      {run}
      {usages}
    />
    {#if error}<p class="problem" role="alert" data-testid="modeltype-problem">
        {error}
      </p>{/if}
  </div>
{/if}

<style>
  .editor {
    display: grid;
    gap: 0.9rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  h3 {
    margin: 0 0 0.3rem;
    font-size: 1rem;
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
  .card {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .card input[type='number'] {
    width: 4.5rem;
  }
  .view {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.4rem 0.7rem;
    margin-bottom: 0.4rem;
    display: grid;
    gap: 0.5rem;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0 0 0.4rem;
  }
  .problem {
    color: #c92a2a;
  }
</style>
