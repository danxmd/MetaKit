<script lang="ts">
  import type {
    ClassId,
    RuleAction,
    RuleActionType,
    ToolLibrary,
  } from '@metakit-app/core';
  import {
    ACTION_LABELS,
    ACTION_TYPES,
    attributesFor,
    classesFor,
    relationsFor,
    type ActionPath,
    type RuleEditorModel,
  } from '../../../build/rule-editor-model';
  import ActionList from './ActionList.svelte';

  let {
    model,
    tool,
    actions,
    branch = [],
    classId,
    changed,
    testid = 'rule-add-action',
  }: {
    model: RuleEditorModel;
    tool: ToolLibrary;
    actions: readonly RuleAction[];
    /** `[]` for the rule's own list, `[2, 'then']` for a branch of a question. */
    branch?: ActionPath;
    /** The class the rule is about, to offer its attribute keys. */
    classId: ClassId | undefined;
    /** Called after the draft changed, so the form redraws and saves. */
    changed: () => void;
    testid?: string;
  } = $props();

  const keyOf = (path: ActionPath) => path.join('-');
  const pathOf = (i: number): ActionPath => [...branch, i];

  const keys = $derived(attributesFor(tool, classId, true));
  const withCurrent = (current: string | undefined) =>
    current && !keys.includes(current) ? [current, ...keys] : keys;

  const shown = (v: unknown): string =>
    v === undefined || v === null
      ? ''
      : typeof v === 'string'
        ? v
        : JSON.stringify(v);

  function patch(i: number, changes: Record<string, unknown>) {
    model.updateAction(pathOf(i), changes);
    changed();
  }

  function add(type: string) {
    if (!type) return;
    model.addAction(type as RuleActionType, branch);
    changed();
  }

  function pairs(a: Extract<RuleAction, { action: 'createObject' }>) {
    return Object.entries(a.attributes ?? {});
  }

  function setPairs(i: number, list: [string, unknown][]) {
    patch(i, {
      attributes: list.length ? Object.fromEntries(list) : undefined,
    });
  }
</script>

<ol class="actions">
  {#each actions as a, i (i)}
    {@const key = keyOf(pathOf(i))}
    <li data-testid="rule-action-{key}">
      <div class="head">
        <select
          value={a.action}
          onchange={(e) => {
            model.changeActionType(
              pathOf(i),
              e.currentTarget.value as RuleActionType,
            );
            changed();
          }}
          aria-label="Type of action {i + 1}"
          data-testid="action-{key}-type"
        >
          {#each ACTION_TYPES as t (t)}<option value={t}
              >{ACTION_LABELS[t]}</option
            >{/each}
        </select>
        <button
          type="button"
          disabled={i === 0}
          onclick={() => {
            model.moveAction(pathOf(i), -1);
            changed();
          }}
          aria-label="Move action {i + 1} up"
          data-testid="action-{key}-up">↑</button
        >
        <button
          type="button"
          disabled={i === actions.length - 1}
          onclick={() => {
            model.moveAction(pathOf(i), 1);
            changed();
          }}
          aria-label="Move action {i + 1} down"
          data-testid="action-{key}-down">↓</button
        >
        <button
          type="button"
          onclick={() => {
            model.removeAction(pathOf(i));
            changed();
          }}
          aria-label="Remove action {i + 1}"
          data-testid="action-{key}-remove">Remove</button
        >
      </div>

      <div class="fields">
        {#if a.action === 'setAttribute'}
          <label>
            Attribute
            <select
              value={a.attribute}
              onchange={(e) => patch(i, { attribute: e.currentTarget.value })}
              data-testid="action-{key}-attribute"
            >
              <option value="">Pick an attribute</option>
              {#each withCurrent(a.attribute) as k (k)}<option value={k}
                  >{k}</option
                >{/each}
            </select>
          </label>
          <label>
            To
            <input
              value={shown(a.value)}
              placeholder="A value, or a formula starting with ="
              onchange={(e) =>
                patch(i, {
                  value: model.valueFromText(
                    a.attribute,
                    e.currentTarget.value,
                  ),
                })}
              data-testid="action-{key}-value"
            />
          </label>
          <label>
            On
            <input
              value={a.target ?? ''}
              placeholder="This object (or a formula giving another)"
              onchange={(e) =>
                patch(i, { target: e.currentTarget.value.trim() || undefined })}
              data-testid="action-{key}-target"
            />
          </label>
        {:else if a.action === 'createObject'}
          <label>
            Class
            <select
              value={a.class}
              onchange={(e) => patch(i, { class: e.currentTarget.value })}
              data-testid="action-{key}-class"
            >
              {#each classesFor(tool) as c (c.id)}<option value={c.id}
                  >{c.key}</option
                >{/each}
            </select>
          </label>
          <div class="pairs">
            {#each pairs(a) as [k, v], j (j)}
              <div class="pair">
                <select
                  value={k}
                  onchange={(e) =>
                    setPairs(
                      i,
                      pairs(a).map((p, n) =>
                        n === j ? [e.currentTarget.value, p[1]] : p,
                      ),
                    )}
                  aria-label="Attribute to fill in"
                  data-testid="action-{key}-attr-{j}-key"
                >
                  {#each attributesFor(tool, a.class, true) as name (name)}<option
                      value={name}>{name}</option
                    >{/each}
                </select>
                <input
                  value={shown(v)}
                  placeholder="Value or formula"
                  onchange={(e) =>
                    setPairs(
                      i,
                      pairs(a).map((p, n) =>
                        n === j ? [p[0], e.currentTarget.value] : p,
                      ),
                    )}
                  aria-label="Value"
                  data-testid="action-{key}-attr-{j}-value"
                />
                <button
                  type="button"
                  onclick={() =>
                    setPairs(
                      i,
                      pairs(a).filter((_, n) => n !== j),
                    )}
                  aria-label="Remove this value"
                  data-testid="action-{key}-attr-{j}-remove">✕</button
                >
              </div>
            {/each}
            <button
              type="button"
              onclick={() => {
                const used = pairs(a).map((p) => p[0]);
                const next = attributesFor(tool, a.class, true).find(
                  (n) => !used.includes(n),
                );
                if (next) setPairs(i, [...pairs(a), [next, '']]);
              }}
              data-testid="action-{key}-add-attr">Fill in an attribute</button
            >
          </div>
          <label>
            Right by
            <input
              type="number"
              value={a.offset?.x ?? 40}
              onchange={(e) =>
                patch(i, {
                  offset: {
                    x: Number(e.currentTarget.value) || 0,
                    y: a.offset?.y ?? 40,
                  },
                })}
              data-testid="action-{key}-offset-x"
            />
          </label>
          <label>
            Down by
            <input
              type="number"
              value={a.offset?.y ?? 40}
              onchange={(e) =>
                patch(i, {
                  offset: {
                    x: a.offset?.x ?? 40,
                    y: Number(e.currentTarget.value) || 0,
                  },
                })}
              data-testid="action-{key}-offset-y"
            />
          </label>
        {:else if a.action === 'createConnector'}
          <label>
            Relation
            <select
              value={a.relation}
              onchange={(e) => patch(i, { relation: e.currentTarget.value })}
              data-testid="action-{key}-relation"
            >
              {#each relationsFor(tool) as r (r.id)}<option value={r.id}
                  >{r.key}</option
                >{/each}
            </select>
          </label>
          <label>
            From
            <input
              value={a.from ?? ''}
              placeholder="This object (or a formula)"
              onchange={(e) =>
                patch(i, { from: e.currentTarget.value.trim() || undefined })}
              data-testid="action-{key}-from"
            />
          </label>
          <label>
            To
            <input
              value={a.to ?? ''}
              placeholder="The object made just before, or this one"
              onchange={(e) =>
                patch(i, { to: e.currentTarget.value.trim() || undefined })}
              data-testid="action-{key}-to"
            />
          </label>
        {:else if a.action === 'delete'}
          <label>
            Object
            <input
              value={a.target ?? ''}
              placeholder="This object (or a formula giving another)"
              onchange={(e) =>
                patch(i, { target: e.currentTarget.value.trim() || undefined })}
              data-testid="action-{key}-target"
            />
          </label>
        {:else if a.action === 'message'}
          <label>
            Kind
            <select
              value={a.kind}
              onchange={(e) => patch(i, { kind: e.currentTarget.value })}
              data-testid="action-{key}-kind"
            >
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </label>
          <label>
            Text
            <input
              value={a.text}
              placeholder="Text, or a formula starting with ="
              onchange={(e) => patch(i, { text: e.currentTarget.value })}
              data-testid="action-{key}-text"
            />
          </label>
        {:else if a.action === 'ask'}
          <label>
            Question
            <input
              value={a.text}
              onchange={(e) => patch(i, { text: e.currentTarget.value })}
              data-testid="action-{key}-text"
            />
          </label>
          <div class="branch">
            <strong>If the answer is yes</strong>
            <ActionList
              {model}
              {tool}
              {classId}
              {changed}
              actions={a.then}
              branch={[...pathOf(i), 'then']}
              testid="action-{key}-then-add"
            />
          </div>
          <div class="branch">
            <strong>If the answer is no</strong>
            <ActionList
              {model}
              {tool}
              {classId}
              {changed}
              actions={a.else ?? []}
              branch={[...pathOf(i), 'else']}
              testid="action-{key}-else-add"
            />
          </div>
        {:else if a.action === 'choose'}
          <label>
            Question
            <input
              value={a.text}
              onchange={(e) => patch(i, { text: e.currentTarget.value })}
              data-testid="action-{key}-text"
            />
          </label>
          <label>
            Choices
            <input
              value={a.options.join(', ')}
              placeholder="Separated by commas"
              onchange={(e) =>
                patch(i, {
                  options: e.currentTarget.value
                    .split(',')
                    .map((o) => o.trim())
                    .filter((o) => o !== ''),
                })}
              data-testid="action-{key}-options"
            />
          </label>
          <label>
            Put the answer in
            <select
              value={a.attribute}
              onchange={(e) => patch(i, { attribute: e.currentTarget.value })}
              data-testid="action-{key}-attribute"
            >
              <option value="">Pick an attribute</option>
              {#each withCurrent(a.attribute) as k (k)}<option value={k}
                  >{k}</option
                >{/each}
            </select>
          </label>
        {:else if a.action === 'cancel'}
          <label>
            Reason shown to the person
            <input
              value={a.reason}
              placeholder="Text, or a formula starting with ="
              onchange={(e) => patch(i, { reason: e.currentTarget.value })}
              data-testid="action-{key}-reason"
            />
          </label>
        {:else if a.action === 'openModel'}
          <label>
            Model
            <input
              value={a.model}
              placeholder="Name of the model"
              onchange={(e) => patch(i, { model: e.currentTarget.value })}
              data-testid="action-{key}-model"
            />
          </label>
        {:else if a.action === 'runCommand'}
          <label>
            Command
            <input
              value={a.command}
              placeholder="Name of the command"
              onchange={(e) => patch(i, { command: e.currentTarget.value })}
              data-testid="action-{key}-command"
            />
          </label>
        {:else if a.action === 'runScript'}
          <label>
            Script
            <input
              value={a.script}
              placeholder="Name of the script"
              onchange={(e) => patch(i, { script: e.currentTarget.value })}
              data-testid="action-{key}-script"
            />
          </label>
        {/if}
      </div>
    </li>
  {/each}
</ol>
<select
  class="add"
  value=""
  onchange={(e) => {
    add(e.currentTarget.value);
    e.currentTarget.value = '';
  }}
  aria-label="Add an action"
  data-testid={testid}
>
  <option value="">Add an action…</option>
  {#each ACTION_TYPES as t (t)}<option value={t}>{ACTION_LABELS[t]}</option
    >{/each}
</select>

<style>
  .actions {
    list-style: none;
    padding: 0;
    margin: 0 0 0.4rem;
    display: grid;
    gap: 0.5rem;
  }
  li {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem;
    display: grid;
    gap: 0.4rem;
  }
  .head {
    display: flex;
    gap: 0.3rem;
  }
  .head select {
    flex: 1;
  }
  .fields {
    display: grid;
    gap: 0.35rem;
  }
  label {
    display: grid;
    gap: 0.15rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .pair {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.25rem;
  }
  .pair input {
    flex: 1;
  }
  .branch {
    border-left: 3px solid var(--line);
    padding-left: 0.6rem;
    display: grid;
    gap: 0.3rem;
  }
</style>
