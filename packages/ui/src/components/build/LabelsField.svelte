<script lang="ts">
  import type { Labels } from '@metakit-app/core';
  import { withLabel } from '../../build/attributes';

  let {
    title,
    labels,
    languages,
    onChange,
    testid,
    multiline = false,
  }: {
    title: string;
    labels: Labels | undefined;
    languages: string[];
    onChange: (labels: Labels) => void;
    testid?: string;
    multiline?: boolean;
  } = $props();
</script>

<fieldset class="labels">
  <legend>{title}</legend>
  {#each languages as lang (lang)}
    <label>
      <span class="lang">{lang}</span>
      {#if multiline}
        <textarea
          rows="2"
          value={labels?.[lang] ?? ''}
          onchange={(e) =>
            onChange(withLabel(labels, lang, e.currentTarget.value))}
          data-testid={testid ? `${testid}-${lang}` : undefined}></textarea>
      {:else}
        <input
          value={labels?.[lang] ?? ''}
          onchange={(e) =>
            onChange(withLabel(labels, lang, e.currentTarget.value))}
          data-testid={testid ? `${testid}-${lang}` : undefined}
        />
      {/if}
    </label>
  {/each}
</fieldset>

<style>
  .labels {
    border: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--gap-1);
  }
  legend {
    font-size: var(--text-s);
    color: var(--text-muted);
    padding: 0;
    margin-bottom: var(--gap-1);
  }
  label {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .lang {
    width: 2rem;
    color: var(--text-faint);
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  input,
  textarea {
    flex: 1;
  }
</style>
