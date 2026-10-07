<script lang="ts">
  import { drawPreview, type PreviewTarget } from '@metakit-app/canvas';
  import type { ToolLibrary } from '@metakit-app/core';
  import { canvasTheme } from '../shell/canvas-theme';
  import { pageTheme } from '../theme/theme';

  let {
    tool,
    target,
    width,
    height,
    text = true,
    padding = 3,
  }: {
    tool: ToolLibrary;
    target: PreviewTarget;
    width: number;
    height: number;
    /** Off for thumbnails, where text would only be a smear. */
    text?: boolean;
    padding?: number;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  // Bumped when the theme changes, so that default-coloured text is drawn again in the right colour.
  let themeTick = $state(0);

  $effect(() => pageTheme().subscribe(() => (themeTick += 1)));

  $effect(() => {
    void themeTick;
    if (!canvas) return;
    const theme = canvasTheme();
    drawPreview(canvas, tool, target, {
      width,
      height,
      text,
      padding,
      labelTheme: {
        text: theme.text,
        background: theme.canvas.background,
      },
    });
  });
</script>

<canvas bind:this={canvas} class="shape-preview" aria-hidden="true"></canvas>

<style>
  .shape-preview {
    display: block;
    flex: none;
  }
</style>
