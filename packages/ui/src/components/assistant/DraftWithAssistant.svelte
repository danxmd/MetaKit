<script lang="ts">
  import type { DraftKind } from '@metakit-app/assistant';
  import type { KitCommand, Kit } from '@metakit-app/core';
  import type { AssistantPort } from '../../assistant/assistant-service';
  import DraftDialog from './DraftDialog.svelte';

  let {
    kind,
    kit,
    assistant = undefined,
    enabled = undefined,
    onAccept,
    language = undefined,
  }: {
    kind: DraftKind;
    kit: Kit;
    /** Absent: nothing is shown, so editors look the same as before. */
    assistant?: AssistantPort | undefined;
    /** Overrides `assistant.enabled`. */
    enabled?: boolean | undefined;
    onAccept: (commands: KitCommand[]) => void;
    language?: string | undefined;
  } = $props();

  let open = $state(false);
  let tick = $state(0);

  $effect(() => assistant?.subscribe?.(() => tick++));

  const on = $derived.by(() => {
    void tick;
    return enabled ?? assistant?.enabled ?? false;
  });
</script>

{#if assistant}
  <button
    type="button"
    class="draft"
    disabled={!on}
    title={on
      ? 'Describe it in a sentence and review the draft'
      : 'Turn on the assistant and add a key in the settings first'}
    onclick={() => (open = true)}
    data-testid="draft-with-assistant-{kind}"
  >
    Draft with assistant
  </button>
  {#if open}
    <DraftDialog
      {kind}
      {kit}
      {assistant}
      {language}
      {onAccept}
      onClose={() => (open = false)}
    />
  {/if}
{/if}
