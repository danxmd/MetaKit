<script lang="ts">
  let {
    label = 'Key',
    value,
    onRename,
    testid,
    hint = 'The name that formulas use. Changing it rewrites the formulas that use it.',
  }: {
    label?: string;
    value: string;
    /** Returns an error text when the new key is refused. */
    onRename: (key: string) => string | null;
    testid?: string;
    hint?: string;
  } = $props();

  let problem = $state<string | null>(null);
  let text = $state('');
  let editing = $state(false);

  function commit(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const next = input.value.trim();
    editing = false;
    if (next === value) {
      problem = null;
      return;
    }
    problem = onRename(next);
    // A refused key goes back to what the kit has.
    if (problem) input.value = value;
  }
</script>

<label class="key">
  <span>{label}</span>
  <input
    value={editing ? text : value}
    oninput={(e) => {
      editing = true;
      text = e.currentTarget.value;
    }}
    onchange={commit}
    spellcheck="false"
    data-testid={testid}
  />
  <small class="muted">{hint}</small>
  {#if problem}<small
      class="problem"
      role="alert"
      data-testid={testid ? `${testid}-problem` : undefined}>{problem}</small
    >{/if}
</label>

<style>
  .key {
    display: grid;
    gap: var(--gap-1);
  }
  small {
    font-size: var(--text-s);
  }
  .problem {
    color: var(--danger);
  }
</style>
