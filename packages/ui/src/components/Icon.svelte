<script lang="ts" module>
  /** Line icons on a 20 × 20 grid, drawn with the current text colour. */
  const PATHS = {
    undo: 'M8 5 4 9l4 4M4 9h7a4 4 0 0 1 0 8H8',
    redo: 'm12 5 4 4-4 4m4-4H9a4 4 0 0 0 0 8h3',
    'zoom-in': 'M10 4v12M4 10h12',
    'zoom-out': 'M4 10h12',
    fit: 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4',
    close: 'm5 5 10 10M15 5 5 15',
    help: 'M7.5 7.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V12M10 15h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
    more: 'M5 10h.01M10 10h.01M15 10h.01',
    back: 'M12 15 7 10l5-5',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

<svg
  viewBox="0 0 20 20"
  width={size}
  height={size}
  aria-hidden="true"
  class="icon-svg"
  class:dots={name === 'more'}
  ><path
    d={PATHS[name]}
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  /></svg
>

<style>
  .icon-svg {
    display: block;
    flex: none;
  }
  .dots path {
    stroke-width: 3;
  }
</style>
