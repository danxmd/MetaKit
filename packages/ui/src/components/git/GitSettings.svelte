<script lang="ts">
  import { DocsLayer, pushDocsContext } from '../../docs/context';
  import type { TokenInfo } from '@metakit-app/storage';
  import {
    SERVICE_NAMES,
    TOKEN_NOTICE,
    checkAccess,
    describeToken,
    draftProblem,
    newDraft,
    normaliseFolder,
    normaliseRepo,
    switchService,
    toTarget,
    type AccessReport,
    type GitTarget,
    type MakeRemote,
    type TokenApi,
  } from '../../git/settings-model';

  let {
    store,
    makeRemote,
    initial,
    onChoose,
    onClose,
  }: {
    /** Saved tokens; `TokenStore` of the storage package. */
    store: TokenApi;
    /** Builds the GitHub or GitLab adapter for a request. */
    makeRemote: MakeRemote;
    /** Pre-fills the repository chooser, for example with the current link. */
    initial?: Partial<GitTarget>;
    /** Called with the chosen repository, folder and branch (no secret in it). */
    onChoose?: (target: GitTarget) => void;
    onClose?: () => void;
  } = $props();

  let tokens: TokenInfo[] = $state([]);
  let draft = $state(newDraft());
  let draftError = $state('');
  let loadError = $state('');
  let renaming = $state<string | null>(null);
  let renameText = $state('');
  let confirmRemove = $state<string | null>(null);

  // svelte-ignore state_referenced_locally
  let tokenId = $state(initial?.tokenId ?? '');
  // svelte-ignore state_referenced_locally
  let repo = $state(initial?.repo ?? '');
  // svelte-ignore state_referenced_locally
  let folder = $state(initial?.folder ?? '');
  // svelte-ignore state_referenced_locally
  let branch = $state(initial?.branch ?? '');
  let report = $state<AccessReport | null>(null);
  let busy = $state(false);

  const selected = $derived(tokens.find((t) => t.id === tokenId));
  const target = $derived(
    report?.ok ? toTarget(selected, repo, folder, branch) : null,
  );

  async function refresh() {
    try {
      tokens = await store.list();
      loadError = '';
      if (!tokens.some((t) => t.id === tokenId)) tokenId = tokens[0]?.id ?? '';
    } catch {
      loadError = 'This browser would not let the page read the saved tokens.';
    }
  }
  $effect(() => {
    void refresh();
  });

  async function addToken(event: Event) {
    event.preventDefault();
    const problem = draftProblem(draft);
    if (problem) {
      draftError = problem;
      return;
    }
    try {
      const added = await store.add({
        service: draft.service,
        host: draft.host,
        label: draft.label,
        token: draft.token,
      });
      tokenId = added.id;
      draft = newDraft(draft.service);
      draftError = '';
      await refresh();
    } catch (error) {
      // The message of a store failure never holds the token.
      draftError =
        error instanceof Error ? error.message : 'The token was not saved.';
    }
  }

  async function removeToken(id: string) {
    await store.remove(id);
    confirmRemove = null;
    report = null;
    await refresh();
  }

  async function saveRename(id: string) {
    await store.rename(id, renameText);
    renaming = null;
    await refresh();
  }

  async function runCheck() {
    if (!selected) return;
    busy = true;
    repo = normaliseRepo(repo);
    folder = normaliseFolder(folder);
    report = await checkAccess(
      { store, makeRemote },
      {
        tokenId: selected.id,
        service: selected.service,
        host: selected.host,
        repo,
        folder,
        branch,
      },
    );
    if (report.ok) branch = report.branch;
    busy = false;
  }

  // A different token, repository or folder invalidates the last check.
  function forget() {
    report = null;
  }

  // Tells Help which dialog is open.
  $effect(() => pushDocsContext('settings.git', DocsLayer.dialog));
</script>

<section class="git-settings" data-testid="git-settings">
  <header>
    <h2>Git settings</h2>
    {#if onClose}
      <button type="button" onclick={onClose} data-testid="git-settings-close">
        Close
      </button>
    {/if}
  </header>

  <p class="notice" data-testid="git-token-notice">{TOKEN_NOTICE}</p>
  {#if loadError}<p class="error" role="alert">{loadError}</p>{/if}

  <h3>Saved tokens</h3>
  {#if tokens.length === 0}
    <p class="hint" data-testid="git-token-empty">No token saved yet.</p>
  {:else}
    <ul class="tokens" data-testid="git-token-list">
      {#each tokens as t (t.id)}
        <li data-testid="git-token">
          {#if renaming === t.id}
            <input
              bind:value={renameText}
              aria-label="Token name"
              autocomplete="off"
              data-testid="git-token-rename-input"
            />
            <button type="button" onclick={() => saveRename(t.id)}>Save</button>
            <button type="button" onclick={() => (renaming = null)}>
              Cancel
            </button>
          {:else}
            <span class="name">{t.label}</span>
            <span class="where">{describeToken(t)}</span>
            <span class="actions">
              <button
                type="button"
                onclick={() => {
                  renaming = t.id;
                  renameText = t.label;
                }}
              >
                Rename
              </button>
              {#if confirmRemove === t.id}
                <button
                  type="button"
                  class="danger"
                  onclick={() => removeToken(t.id)}
                  data-testid="git-token-remove-confirm"
                >
                  Remove it
                </button>
                <button type="button" onclick={() => (confirmRemove = null)}>
                  Keep it
                </button>
              {:else}
                <button
                  type="button"
                  onclick={() => (confirmRemove = t.id)}
                  data-testid="git-token-remove"
                >
                  Remove
                </button>
              {/if}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <h3>Add a token</h3>
  <form onsubmit={addToken} data-testid="git-token-form">
    <label>
      Service
      <select
        value={draft.service}
        onchange={(e) =>
          (draft = switchService(
            draft,
            e.currentTarget.value === 'gitlab' ? 'gitlab' : 'github',
          ))}
        data-testid="git-token-service"
      >
        <option value="github">{SERVICE_NAMES.github}</option>
        <option value="gitlab">{SERVICE_NAMES.gitlab}</option>
      </select>
    </label>
    <label>
      Address of the service
      <input
        bind:value={draft.host}
        autocomplete="off"
        data-testid="git-token-host"
      />
    </label>
    <label>
      Name for this token
      <input
        bind:value={draft.label}
        placeholder="For example: Work laptop"
        autocomplete="off"
        data-testid="git-token-label"
      />
    </label>
    <label>
      Token
      <input
        type="password"
        bind:value={draft.token}
        autocomplete="off"
        spellcheck="false"
        data-testid="git-token-value"
      />
    </label>
    {#if draftError}<p class="error" role="alert">{draftError}</p>{/if}
    <div class="row">
      <button type="submit" class="primary" data-testid="git-token-add">
        Save token
      </button>
    </div>
  </form>

  <h3>Choose the tool library</h3>
  {#if tokens.length === 0}
    <p class="hint">Save a token first.</p>
  {:else}
    <div class="chooser">
      <label>
        Token
        <select
          bind:value={tokenId}
          onchange={forget}
          data-testid="git-choose-token"
        >
          {#each tokens as t (t.id)}
            <option value={t.id}>{t.label} ({describeToken(t)})</option>
          {/each}
        </select>
      </label>
      <label>
        Repository
        <input
          bind:value={repo}
          oninput={forget}
          placeholder={selected?.service === 'gitlab'
            ? 'group/project'
            : 'owner/name'}
          autocomplete="off"
          data-testid="git-choose-repo"
        />
      </label>
      <label>
        Folder in the repository
        <input
          bind:value={folder}
          oninput={forget}
          placeholder="Leave empty for the root"
          autocomplete="off"
          data-testid="git-choose-folder"
        />
      </label>
      <div class="row">
        <button
          type="button"
          disabled={busy || !selected}
          onclick={runCheck}
          data-testid="git-test"
        >
          {busy ? 'Testing…' : 'Test the token'}
        </button>
      </div>
      {#if report}
        <p
          class={report.ok ? 'ok' : 'error'}
          role={report.ok ? 'status' : 'alert'}
          data-testid="git-test-result"
        >
          {report.text}
        </p>
        {#if report.ok && report.branches.length > 0}
          <label>
            Branch
            <select bind:value={branch} data-testid="git-choose-branch">
              {#each report.branches as b (b)}
                <option value={b}>{b}</option>
              {/each}
            </select>
          </label>
        {/if}
      {/if}
      {#if onChoose}
        <div class="row">
          <button
            type="button"
            class="primary"
            disabled={!target}
            onclick={() => target && onChoose(target)}
            data-testid="git-choose"
          >
            Use this tool library
          </button>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .git-settings {
    display: grid;
    gap: var(--gap-4);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h3 {
    margin-top: var(--gap-2);
    padding-top: var(--gap-4);
    border-top: 1px solid var(--line);
  }
  .hint {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .tokens {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--gap-2);
  }
  .tokens li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2);
    align-items: center;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--gap-2) var(--gap-3);
  }
  .name {
    font-weight: 600;
    color: var(--text-strong);
  }
  .where {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .actions {
    margin-left: auto;
    display: flex;
    gap: var(--gap-1);
  }
  form,
  .chooser {
    display: grid;
    gap: var(--gap-3);
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
  }
  .error {
    color: var(--danger);
    font-size: var(--text-s);
  }
  .ok {
    color: var(--success);
    font-size: var(--text-s);
  }
</style>
