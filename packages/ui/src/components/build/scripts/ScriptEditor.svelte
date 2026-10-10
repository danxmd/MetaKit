<script lang="ts">
  import { onMount } from 'svelte';
  import type { ScriptEditorHandle } from './script-editor';
  import type { LanguageClient } from './script-language-client';

  let {
    source,
    declarations,
    onChange,
    createClient,
  }: {
    /** The text to start with; later changes that did not come from this editor replace the text. */
    source: string;
    /** The TypeScript declarations of the `metakit` module for the kit, from `generateDeclarations`. */
    declarations: string;
    onChange: (source: string) => void;
    /** Starts the language service; the app's worker by default. */
    createClient?: () => LanguageClient | Promise<LanguageClient>;
  } = $props();

  let host: HTMLDivElement | undefined = $state();
  let handle: ScriptEditorHandle | null = null;
  let client: LanguageClient | null = null;
  let lastSent: string | null = null;
  let problem = $state<string | null>(null);

  /** What the editor falls back to when the language service cannot start: editing still works. */
  const offline: LanguageClient = {
    declarations: () => Promise.resolve(),
    diagnostics: () => Promise.resolve([]),
    completions: () => Promise.resolve(null),
    details: () => Promise.resolve(null),
    quickInfo: () => Promise.resolve(null),
    dispose: () => undefined,
  };

  onMount(() => {
    let closed = false;
    void (async () => {
      // Loaded now and not before: the editor, the compiler's worker and the library files are
      // all separate downloads that only a person editing a script ever needs.
      const editor = await import('./script-editor');
      try {
        client = createClient
          ? await createClient()
          : (await import('./start-worker')).startLanguageClient();
        await client.declarations(declarations);
      } catch (error) {
        client?.dispose();
        client = offline;
        problem = `Completion and error checking are not available (${error instanceof Error ? error.message : String(error)}). You can still edit the script.`;
      }
      if (closed || !host) {
        client.dispose();
        return;
      }
      handle = editor.createScriptEditor({
        parent: host,
        source,
        client,
        onChange: (text) => {
          lastSent = text;
          onChange(text);
        },
      });
    })();
    return () => {
      closed = true;
      handle?.destroy();
      handle = null;
      client?.dispose();
    };
  });

  // The kit changed (a class or attribute was added): the editor checks against the new names.
  $effect(() => {
    const text = declarations;
    if (client && handle)
      void client.declarations(text).then(() => handle?.recheck());
  });

  // A change from outside, such as undoing a script edit in Build mode.
  $effect(() => {
    const text = source;
    if (handle && text !== lastSent && text !== handle.text())
      handle.setText(text);
  });
</script>

<div class="wrap">
  <div class="editor" bind:this={host} data-testid="script-editor"></div>
  {#if problem}<p class="note" role="status" data-testid="script-editor-note">
      {problem}
    </p>{/if}
</div>

<style>
  .wrap {
    display: grid;
    gap: 0.3rem;
  }
  .editor {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    --syn-keep: 100%;
    --syn-lift: #fff;
    min-height: 14rem;
    max-height: 32rem;
    overflow: auto;
    background: var(--surface);
    color: var(--text);
  }
  :global(:root[data-theme='dark']) .editor {
    --syn-keep: 45%;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .editor {
      --syn-keep: 45%;
    }
  }
  .editor :global(.cm-editor.cm-focused) {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .note {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
</style>
