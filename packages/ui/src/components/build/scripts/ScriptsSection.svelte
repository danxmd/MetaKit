<script lang="ts">
  import { onDestroy } from 'svelte';
  import { generateDeclarations } from '@metakit-app/behaviour';
  import type { Script, ScriptId, ToolLibrary } from '@metakit-app/core';
  import type { CommandResult } from '../../../shell/controller';
  import {
    createScript,
    hasCommand,
    isEnabled,
    nameProblem,
    putScript,
    removeScript,
    renameScript,
    setEnabled,
    setPermission,
    setSource,
    sortedScripts,
    statusNote,
    type ScriptsApi,
  } from '../../../build/scripts-model';
  import ScriptConsole from './ScriptConsole.svelte';
  import ScriptEditor from './ScriptEditor.svelte';
  import { asOneStep } from '@metakit-app/assistant';
  import type { AssistantPort } from '../../../assistant/assistant-service';
  import DraftWithAssistant from '../../assistant/DraftWithAssistant.svelte';
  import { useBuildUndo } from '../../../build/undo-context';
  import type { LanguageClient } from './script-language-client';

  let {
    tool,
    run,
    api = null,
    target = () => null,
    createClient,
    assistant,
  }: {
    tool: ToolLibrary;
    run: (command: never) => CommandResult;
    /** The running scripts of the open model; null when none are running (no model is open). */
    api?: ScriptsApi | null;
    /** The selected object of the open model, which "Run" hands to the command. */
    target?: () => string | null;
    createClient?: () => LanguageClient | Promise<LanguageClient>;
    /** The assistant; when absent there is no "Draft with assistant" button. */
    assistant?: AssistantPort | undefined;
  } = $props();

  const offerUndo = useBuildUndo();

  let error = $state<string | null>(null);
  let selectedId = $state<ScriptId | null>(null);
  let renaming = $state<ScriptId | null>(null);
  let renameText = $state('');
  let version = $state(0);

  const exec = (command: Record<string, unknown>): boolean => {
    const r = run(command as never);
    error = r.ok ? null : r.error;
    return r.ok;
  };

  const scripts = $derived(sortedScripts(tool));
  const selected = $derived(
    scripts.find((s) => s.id === selectedId) ?? scripts[0] ?? null,
  );
  // The same text when only a script changed, so the editor is not told again on every keystroke.
  const declarations = $derived(
    generateDeclarations({ ...tool, scripts: {}, rules: {} }),
  );
  const lines = $derived.by(() => {
    void version;
    return api ? [...api.log] : [];
  });

  $effect(() => {
    if (!api) return;
    const stops = [api.onLog(() => version++), api.onStatus(() => version++)];
    return () => stops.forEach((stop) => stop());
  });

  function add() {
    const script = createScript(tool);
    if (exec(putScript(script))) selectedId = script.id;
  }

  function startRename(script: Script) {
    renaming = script.id;
    renameText = script.name;
  }
  function finishRename(script: Script) {
    const problem = nameProblem(tool, renameText, script.id);
    if (problem) {
      error = problem;
      return;
    }
    if (renameText.trim() !== script.name)
      exec(renameScript(script, renameText));
    renaming = null;
  }
  function remove(script: Script) {
    // A pending edit is saved first, so Undo brings the script back as it was typed.
    flush();
    if (exec(removeScript(script.id)))
      offerUndo(`Deleted script ${script.name}`);
  }

  // The source is saved a moment after typing stops, as one undo step per pause; a pending save is
  // never lost when the section closes or another script is picked.
  let pending: { id: ScriptId; source: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    clearTimeout(timer);
    if (!pending) return;
    const { id, source } = pending;
    pending = null;
    const script = tool.scripts[id];
    if (script && script.source !== source) exec(setSource(script, source));
  }
  function edited(id: ScriptId, source: string) {
    if (pending && pending.id !== id) flush();
    pending = { id, source };
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
  }
  function select(id: ScriptId) {
    flush();
    selectedId = id;
  }
  onDestroy(flush);

  const permissions = $derived(tool.manifest.permissions ?? {});
</script>

<div class="section" data-testid="scripts-section">
  <h2>Scripts</h2>
  <p class="muted">
    Scripts are TypeScript for what formulas and rules cannot do. They run only
    in the browser where a change was made, and they can only change the open
    model through commands, so everything they do can be undone.
  </p>

  <div class="layout">
    <ul class="list" aria-label="Scripts">
      {#each scripts as s (s.id)}
        {@const note = api ? statusNote(api.status(s.id)) : null}
        <li class:current={selected?.id === s.id}>
          <div class="line">
            <input
              type="checkbox"
              role="switch"
              checked={isEnabled(s)}
              onchange={(e) =>
                exec(
                  setEnabled(s, (e.currentTarget as HTMLInputElement).checked),
                )}
              aria-label="Run {s.name}"
              data-testid="script-enabled-{s.id}"
            />
            {#if renaming === s.id}
              <input
                class="rename"
                bind:value={renameText}
                aria-label="Script name"
                onkeydown={(e) => {
                  if (e.key === 'Enter') finishRename(s);
                  if (e.key === 'Escape') renaming = null;
                }}
                onblur={() => finishRename(s)}
                data-testid="script-rename-input"
              />
            {:else}
              <button
                type="button"
                class="name"
                onclick={() => select(s.id)}
                data-testid="script-select-{s.id}">{s.name}</button
              >
              <button
                type="button"
                class="small ghost"
                onclick={() => startRename(s)}
                aria-label="Rename {s.name}">Rename</button
              >
              <button
                type="button"
                class="small ghost danger"
                onclick={() => remove(s)}
                aria-label="Delete {s.name}">Delete</button
              >
            {/if}
          </div>
          {#if note}<p class="problem" role="status">{note}</p>{/if}
        </li>
      {:else}
        <li class="muted">
          No scripts yet. A script is TypeScript for what formulas and rules
          cannot do, such as a check across the whole model.
        </li>
      {/each}
      <li>
        <button
          type="button"
          class="primary"
          onclick={add}
          data-testid="script-add">Add a script</button
        >
        <DraftWithAssistant
          kind="script"
          {tool}
          {assistant}
          onAccept={(commands) => {
            const first = commands[0];
            if (
              exec(asOneStep(commands) as never) &&
              first?.type === 'putScript'
            )
              selectedId = first.script.id;
          }}
        />
      </li>
    </ul>

    <div class="work">
      {#if selected}
        <div class="bar">
          <strong>{selected.name}</strong>
          <span class="spacer"></span>
          {#if api && hasCommand(selected.source)}
            <button
              type="button"
              onclick={() => {
                flush();
                void api.runScript(selected.id, target());
              }}
              data-testid="script-run">Run</button
            >
          {/if}
        </div>
        {#key selected.id}
          <ScriptEditor
            source={selected.source}
            {declarations}
            onChange={(text) => edited(selected.id, text)}
            {createClient}
          />
        {/key}
      {:else}
        <p class="muted">Add a script on the left to start writing.</p>
      {/if}
      <ScriptConsole {lines} onClear={() => api?.clearLog()} />
    </div>
  </div>

  <fieldset>
    <legend>What the scripts of this Kit may do</legend>
    <p class="muted">
      Scripts can always change models and show dialogs. Say here what else they
      need. Each person is asked once, in their own browser, and again if you
      add something later.
    </p>
    <label class="check">
      <input
        type="checkbox"
        checked={permissions.network === true}
        onchange={(e) =>
          exec(
            setPermission(
              tool,
              'network',
              (e.currentTarget as HTMLInputElement).checked,
            ),
          )}
        data-testid="permission-network"
      />
      Contact web services on the internet
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={permissions.files === true}
        onchange={(e) =>
          exec(
            setPermission(
              tool,
              'files',
              (e.currentTarget as HTMLInputElement).checked,
            ),
          )}
        data-testid="permission-files"
      />
      Read and write files in the workspace, and open or save files
    </label>
  </fieldset>

  {#if error}<p class="problem" role="alert" data-testid="scripts-problem">
      {error}
    </p>{/if}
</div>

<style>
  .section {
    display: grid;
    gap: 0.7rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(16rem, 20rem) 1fr;
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 800px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
  }
  .list li {
    padding: 0.3rem 0.4rem;
    border-radius: 6px;
  }
  .list li.current {
    background: var(--accent-soft);
  }
  .line {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .name {
    flex: 1;
    text-align: left;
    background: none;
    border: none;
    padding: 0.1rem 0.2rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rename {
    flex: 1;
  }
  .small {
    font-size: 0.8rem;
  }
  .work {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .bar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  fieldset {
    padding: var(--gap-3) var(--gap-4);
    display: grid;
    gap: var(--gap-2);
  }
  .ghost.danger {
    border-color: transparent;
  }
  .check {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0;
  }
  .problem {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 0.2rem 0 0;
  }
</style>
