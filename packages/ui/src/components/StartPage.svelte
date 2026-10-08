<script lang="ts">
  import BrandMark from './BrandMark.svelte';

  let {
    supported,
    remembered,
    busy,
    error,
    pendingCreate,
    onOpen,
    onReopen,
    onCreate,
    onCancelCreate,
    helpOpen = false,
    onHelp,
  }: {
    supported: boolean;
    /** The name of the remembered folder, if there is one. */
    remembered: string | null;
    busy: boolean;
    error: string | null;
    /** Set when the chosen folder is not a workspace yet: the name of that folder. */
    pendingCreate: string | null;
    onOpen: () => void;
    onReopen: () => void;
    onCreate: (name: string) => void;
    onCancelCreate: () => void;
    helpOpen?: boolean;
    /** The start page has no top bar, so it carries its own Help button. */
    onHelp: () => void;
  } = $props();

  let name = $state('');
  $effect(() => {
    if (pendingCreate !== null && name === '') name = pendingCreate;
  });

  const steps = [
    {
      title: 'Open or create a workspace folder',
      text: 'Pick a folder on your computer. It holds everything: tool libraries and models.',
    },
    {
      title: 'Add a tool library, or build one',
      text: 'A tool library defines the kinds of objects, connections, shapes and rules. Use a ready-made one or make your own in Build.',
    },
    {
      title: 'Model',
      text: 'Draw models with the tool library in Model. Several people can work in the same folder at once.',
    },
  ];
</script>

<main class="start" data-testid="start-page">
  <button
    type="button"
    class="ghost help"
    aria-pressed={helpOpen}
    onclick={onHelp}
    title="Help for this page (F1)"
    data-testid="toggle-help"
    ><span class="mark" aria-hidden="true">?</span> Help</button
  >
  <div class="wrap">
    <section class="hero">
      <div class="brand">
        <BrandMark size={36} />
        <span>MetaKit</span>
      </div>
      <h1>Build modelling languages and model with them</h1>
      <p class="lead">
        MetaKit is a tool for method engineers and modellers. In Build you
        define a notation, in Model you draw with it.
      </p>

      {#if !supported}
        <p
          role="alert"
          data-testid="unsupported-browser"
          class="notice warning"
        >
          Local folders need Chrome or Edge on a desktop computer. This browser
          cannot open them, so MetaKit cannot start here.
        </p>
      {:else if pendingCreate !== null}
        <section class="card create" data-testid="create-workspace">
          <h2>This folder is not a workspace yet</h2>
          <p class="muted">
            There is no <code>workspace.json</code> in “{pendingCreate}”. You
            can make a new workspace here. Existing files in the folder stay as
            they are.
          </p>
          <label>
            Workspace name
            <input bind:value={name} data-testid="workspace-name" />
          </label>
          <div class="row end">
            <button disabled={busy} onclick={onCancelCreate}
              >Choose another folder</button
            >
            <button
              class="primary"
              disabled={busy || name.trim() === ''}
              onclick={() => onCreate(name)}
            >
              Create workspace
            </button>
          </div>
        </section>
      {:else}
        <div class="row">
          {#if remembered}
            <button
              class="primary big"
              disabled={busy}
              onclick={onReopen}
              data-testid="reopen-folder"
            >
              Continue with “{remembered}”
            </button>
            <button disabled={busy} onclick={onOpen} data-testid="open-folder">
              Open another folder
            </button>
          {:else}
            <button
              class="primary big"
              disabled={busy}
              onclick={onOpen}
              data-testid="open-folder"
            >
              Open workspace folder
            </button>
          {/if}
        </div>
        <p class="muted small">
          Choose an existing workspace, or an empty folder to start a new one.
        </p>
      {/if}

      {#if error}
        <p role="alert" class="notice error" data-testid="start-error">
          {error}
        </p>
      {/if}
    </section>

    <section class="info" aria-label="How MetaKit works">
      <ol class="steps card">
        {#each steps as step, i (step.title)}
          <li>
            <span class="num">{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p class="muted">{step.text}</p>
            </div>
          </li>
        {/each}
      </ol>
      <div class="about card" data-testid="workspace-explainer">
        <h3>What is a workspace folder?</h3>
        <p class="muted">
          A normal folder with plain JSON files. Keep it in OneDrive,
          SharePoint, Google Drive or Dropbox and your team shares it through
          that service. MetaKit runs in your browser and uploads nothing
          anywhere.
        </p>
      </div>
    </section>
  </div>
</main>

<style>
  .start {
    position: relative;
    min-height: 100dvh;
    display: grid;
    align-items: center;
    padding: var(--gap-6) var(--gap-4);
  }
  .help {
    position: absolute;
    top: var(--gap-3);
    right: var(--gap-4);
  }
  .help[aria-pressed='true'] {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .mark {
    display: inline-grid;
    place-items: center;
    width: 1.15rem;
    height: 1.15rem;
    margin-right: 0.15rem;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
  }
  .wrap {
    max-width: 64rem;
    width: 100%;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 3rem;
    align-items: start;
  }
  @media (max-width: 900px) {
    .wrap {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--gap-5);
    }
  }
  .hero {
    display: grid;
    gap: var(--gap-4);
    justify-items: start;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: var(--gap-2);
    font-size: var(--text-l);
    font-weight: 700;
    color: var(--text-strong);
  }
  h1 {
    font-size: 2.2rem;
    line-height: 1.15;
  }
  .lead {
    font-size: var(--text-l);
    color: var(--text-muted);
  }
  .row {
    display: flex;
    gap: var(--gap-3);
    flex-wrap: wrap;
    align-items: center;
  }
  .row.end {
    justify-content: flex-end;
  }
  .big {
    min-height: 2.6rem;
    padding: 0.5rem 1.2rem;
    font-size: var(--text-m);
  }
  .small {
    font-size: var(--text-s);
  }
  .create {
    padding: var(--gap-5);
    display: grid;
    gap: var(--gap-3);
    width: 100%;
  }
  .create label {
    display: grid;
    gap: var(--gap-1);
  }
  .info {
    display: grid;
    gap: var(--gap-4);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: var(--gap-2) var(--gap-4);
  }
  .steps li {
    display: flex;
    gap: var(--gap-3);
    padding: var(--gap-3) 0;
  }
  .steps li + li {
    border-top: 1px solid var(--line);
  }
  .num {
    flex: none;
    width: 1.8rem;
    height: 1.8rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 700;
    font-size: var(--text-s);
  }
  .steps p {
    font-size: var(--text-s);
    margin-top: var(--gap-1);
  }
  .about {
    padding: var(--gap-4);
    display: grid;
    gap: var(--gap-2);
  }
  .about p {
    font-size: var(--text-s);
  }
</style>
