<script lang="ts">
  let {
    initial,
    colours,
    onSave,
  }: {
    initial: { name: string; colour: string };
    colours: readonly string[];
    onSave: (profile: { name: string; colour: string }) => void;
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
</script>

<dialog
  bind:this={dialog}
  oncancel={(e) => e.preventDefault()}
  data-testid="profile-dialog"
>
  <form onsubmit={submit}>
    <h2>Who are you?</h2>
    <p class="hint">
      Other people working in the same folder see this name and colour next to
      your changes. It is kept in this browser, and there is no account.
    </p>
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
      <button
        class="primary"
        type="submit"
        disabled={name.trim() === ''}
        data-testid="profile-save"
      >
        Continue
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    max-width: 26rem;
  }
  form {
    display: grid;
    gap: 0.8rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }
  legend {
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
  }
  .colours {
    display: flex;
    gap: 0.4rem;
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
    outline: 3px solid #212529;
    outline-offset: 2px;
  }
  .swatch:has(input:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
