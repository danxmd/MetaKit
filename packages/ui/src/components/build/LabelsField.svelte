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
    gap: 0.3rem;
  }
  legend {
    font-size: 0.85rem;
    color: var(--muted);
    padding: 0;
    margin-bottom: 0.2rem;
  }
  label {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .lang {
    width: 2rem;
    color: var(--muted);
    font-size: 0.8rem;
  }
  input,
  textarea {
    flex: 1;
  }
</style>
