// Bundled and run inside Chromium by shapes.spec.ts: draws a compiled shape on a canvas.
import type { NodeShape } from '@metakit-app/core';
import { ImageCache, paintOps } from '@metakit-app/canvas';
import { compileNode } from '@metakit-app/shapes';
import type { Value } from '@metakit-app/formula';

function draw(
  shape: NodeShape,
  w: number,
  h: number,
  values: Record<string, Value>,
) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const compiled = compileNode(shape, {
    w,
    h,
    scope: { get: (n) => (Object.hasOwn(values, n) ? values[n] : undefined) },
  });
  paintOps(ctx, compiled.ops, {
    scale: 1,
    minTextPx: 0,
    images: new ImageCache(),
  });
  return { canvas, ctx, messages: compiled.messages };
}

const api = {
  /** Draws and returns the picture and the colour (as `#rrggbbaa`) at each asked point. */
  render(
    shape: NodeShape,
    w: number,
    h: number,
    values: Record<string, Value>,
    points: [number, number][],
  ) {
    const { canvas, ctx, messages } = draw(shape, w, h, values);
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    const pixels = points.map(([x, y]) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return `#${hex(d[0]!)}${hex(d[1]!)}${hex(d[2]!)}${hex(d[3]!)}`;
    });
    return { png: canvas.toDataURL('image/png'), pixels, messages };
  },
};

export type ShapesHarness = typeof api;
(window as unknown as { __shapes: ShapesHarness }).__shapes = api;
