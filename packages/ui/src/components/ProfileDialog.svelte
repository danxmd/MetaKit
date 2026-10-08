<script lang="ts">
  import { DocsLayer, pushDocsContext } from '../docs/context';
  let {
    initial,
    colours,
    onSave,
    onCancel,
  }: {
    initial: { name: string; colour: string };
    colours: readonly string[];
    onSave: (profile: { name: string; colour: string }) => void;
    /** Given when the person may leave without choosing (changing the profile later). */
    onCancel?: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(initial.name);
  // svelte-ignore state_referenced_locally
  let colour = $state(initial.colour);
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => dialog?.showModal());

  function submit(event: Event) {
    event.preventDefault();
    if (name.trim() === '') return;
    onSave({ name: name.trim(), colour });
    dialog?.close();
  }

  // Tells Help which dialog is open.
  $effect(() => pushDocsContext('settings.profile', DocsLayer.dialog));
</script>

<dialog
  bind:this={dialog}
  oncancel={(e) => {
    // The first visit must choose; later the person may leave.
    if (onCancel) onCancel();
    else e.preventDefault();
  }}
  data-testid="profile-dialog"
>
  <form onsubmit={submit}>
    <div class="head">
      <h2>{onCancel ? 'Your name and colour' : 'Who are you?'}</h2>
      <p class="muted">
        Other people working in the same folder see this name and colour next to
        your changes. It is kept in this browser, and there is no account.
      </p>
    </div>
    <label>
      Display name
      <input bind:value={name} data-testid="profile-name" autocomplete="off" />
    </label>
    <fieldset>
      <legend>Colour</legend>
      <div class="colours">
        {#each colours as c (c)}
          <label class="swatch" style="background:{c}" title={c}>
            <input
              type="radio"
              name="colour"
              value={c}
              bind:group={colour}
              aria-label={c}
            />
          </label>
        {/each}
      </div>
    </fieldset>
    <div class="actions">
      {#if onCancel}
        <button type="button" onclick={onCancel}>Cancel</button>
      {/if}
      <button
        class="primary"
        type="submit"
        disabled={name.trim() === ''}
        data-testid="profile-save"
      >
        {onCancel ? 'Save' : 'Continue'}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(26rem, calc(100vw - 2rem));
  }
  form {
    display: grid;
    gap: var(--gap-4);
  }
  .head {
    display: grid;
    gap: var(--gap-2);
  }
  .head p {
    font-size: var(--text-s);
  }
  label {
    display: grid;
    gap: var(--gap-1);
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }
  legend {
    font-size: var(--text-s);
    color: var(--text-muted);
    margin-bottom: var(--gap-2);
    padding: 0;
  }
  .colours {
    display: flex;
    gap: var(--gap-2);
    flex-wrap: wrap;
  }
  .swatch {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    position: relative;
    cursor: pointer;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .swatch:has(input:checked) {
    outline: 3px solid var(--text-strong);
    outline-offset: 2px;
  }
  .swatch:has(input:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-2);
  }
</style>
