<script lang="ts">
  let { size = 24 }: { size?: number } = $props();
</script>

<!-- Two linked nodes: a model made from a metamodel. -->
<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
>
  <rect width="24" height="24" rx="6" fill="var(--accent)" />
  <circle cx="7.5" cy="12" r="2.6" fill="var(--on-accent)" />
  <circle cx="16.5" cy="7.5" r="2.1" fill="var(--on-accent)" />
  <circle cx="16.5" cy="16.5" r="2.1" fill="var(--on-accent)" />
  <path
    d="M9.8 11 14.6 8.4M9.8 13 14.6 15.6"
    stroke="var(--on-accent)"
    stroke-width="1.4"
    stroke-linecap="round"
  />
</svg>
