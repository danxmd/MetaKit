<script lang="ts">
  import type { AttributeDef, LookBadge, NodeLook } from '@metakit-app/core';
  import { readableOn } from '@metakit-app/shapes';
  import {
    attributeLabel,
    isDrivable,
    valueOptions,
    omit,
  } from '../../../build/appearance-model';
  import ColourControl from './ColourControl.svelte';
  import ColourRule from './ColourRule.svelte';

  let {
    look,
    attributes,
    onChange,
  }: {
    look: NodeLook;
    attributes: readonly AttributeDef[];
    onChange: (look: NodeLook) => void;
  } = $props();

  const choices = $derived(attributes.filter(isDrivable));
  const badge = $derived(look.badge);
  const badgeAttr = $derived(
    badge ? attributes.find((a) => a.key === badge.attribute) : undefined,
  );
  const badgeOptions = $derived(valueOptions(badgeAttr));

  // The text colour is "automatic" (readable on the fill) until the author picks one.
  const textColour = $derived(look.title.colour ?? readableOn(look.fill));

  function setBadge(next: LookBadge | undefined) {
    if (next) onChange({ ...look, badge: next });
    else {
      const rest = omit(look, 'badge');
      onChange(rest);
    }
  }
  function enableBadge(on: boolean) {
    if (!on) return setBadge(undefined);
    const attr = choices.find((a) => valueOptions(a).length > 0) ?? choices[0];
    if (!attr) return;
    const first = valueOptions(attr)[0];
    setBadge({
      attribute: attr.key,
      equals: first?.value ?? '',
      text: first?.label ?? 'Mark',
      colour: '#e03131',
    });
  }
  function setBadgeAttribute(key: string) {
    const attr = attributes.find((a) => a.key === key);
    if (!attr || !badge) return;
    const first = valueOptions(attr)[0];
    setBadge({
      ...badge,
      attribute: key,
      equals: first?.value ?? '',
      text: first?.label ?? badge.text,
    });
  }
  function setBadgeValue(value: string) {
    if (!badge) return;
    const known = badgeOptions.find((o) => o.value === value);
    // The text follows the value while it still says the old value.
    const old = badgeOptions.find((o) => o.value === badge.equals);
    const follows = badge.text === badge.equals || badge.text === old?.label;
    setBadge({
      ...badge,
      equals: value,
      text: follows ? (known?.label ?? value) : badge.text,
    });
  }
</script>

<div class="rules">
  <ColourRule
    label="Fill colour"
    colour={look.fill}
    {attributes}
    testid="rule-fill"
    onChange={(fill) => onChange({ ...look, fill })}
  />
  <ColourRule
    label="Border colour"
    colour={look.border}
    {attributes}
    testid="rule-border"
    strong
    onChange={(border) => onChange({ ...look, border })}
  />
  <ColourRule
    label="Text colour"
    colour={textColour}
    {attributes}
    testid="rule-text"
    strong
    onChange={(colour) =>
      onChange({ ...look, title: { ...look.title, colour } })}
  />

  <div class="mark" data-testid="rule-badge" data-tour="appearance-badge">
    <label class="check">
      <input
        type="checkbox"
        checked={badge !== undefined}
        disabled={choices.length === 0}
        data-testid="badge-on"
        onchange={(e) => enableBadge(e.currentTarget.checked)}
      />
      Show a mark on the corner
    </label>
    {#if choices.length === 0}
      <p class="muted">Add an attribute to the concept to use this.</p>
    {/if}
    {#if badge}
      <div class="sentence">
        <span>when</span>
        <select
          value={badge.attribute}
          aria-label="Attribute the mark depends on"
          data-testid="badge-attr"
          onchange={(e) => setBadgeAttribute(e.currentTarget.value)}
        >
          {#each choices as a (a.id)}
            <option value={a.key}>{attributeLabel(a)}</option>
          {/each}
        </select>
        <span>is</span>
        {#if badgeOptions.length > 0}
          <select
            value={badge.equals}
            aria-label="Value that shows the mark"
            data-testid="badge-value"
            onchange={(e) => setBadgeValue(e.currentTarget.value)}
          >
            {#each badgeOptions as o (o.value)}
              <option value={o.value}>{o.label}</option>
            {/each}
          </select>
        {:else}
          <input
            value={badge.equals}
            aria-label="Value that shows the mark"
            data-testid="badge-value"
            onchange={(e) => setBadgeValue(e.currentTarget.value)}
          />
        {/if}
      </div>
      <div class="sentence">
        <label>
          Mark text
          <input
            class="short"
            value={badge.text}
            maxlength="6"
            data-testid="badge-text"
            onchange={(e) =>
              setBadge({ ...badge, text: e.currentTarget.value })}
          />
        </label>
        <span class="with-colour">
          Colour
          <ColourControl
            value={badge.colour}
            label="Mark colour"
            testid="badge-colour"
            strong
            onChange={(colour) => setBadge({ ...badge, colour })}
          />
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  .rules {
    display: grid;
    gap: var(--gap-4);
  }
  .mark {
    display: grid;
    gap: var(--gap-2);
    border-top: 1px solid var(--line);
    padding-top: var(--gap-3);
  }
  .check {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
    font-weight: 600;
  }
  .sentence {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2);
    align-items: center;
  }
  .sentence label,
  .with-colour {
    display: inline-flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .short {
    width: 5rem;
  }
  .muted {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-s);
  }
</style>
