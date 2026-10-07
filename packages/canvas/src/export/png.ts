import type { ImageSource } from '../paint';
import { paintConnectors, paintOps } from '../paint';
import type { Scene } from '../scene';
import { collectContent, imageSources, type ExportSelection } from './content';
import { DEFAULT_EXPORT_PADDING } from './svg';

export interface PngExportOptions {
  scale: 1 | 2 | 3 | 4;
  /** Leave the background see-through instead of filling it. */
  transparent: boolean;
  selection?: ExportSelection;
  /** Space around the content, in world units. Default 16. */
  padding?: number;
  /** Fill used when not transparent. Default white. */
  background?: string;
  /** Turns an `assets/` path into something a browser can load; data URIs always work. */
  resolveImage?: (src: string) => string | null;
}

/** Browsers refuse canvases much larger than this on one side. */
export const MAX_EXPORT_PIXELS = 16384;
/** Chromium's canvas area limit is 268 million pixels; stay under it. */
const MAX_EXPORT_AREA = 256_000_000;

/** Preloads the images the content uses, so that the synchronous drawing finds them. */
async function loadImages(
  sources: readonly string[],
  resolve: (src: string) => string | null,
): Promise<ImageSource> {
  const loaded = new Map<string, HTMLImageElement>();
  await Promise.all(
    sources.map(async (src) => {
      const url = src.startsWith('data:') ? src : resolve(src);
      if (!url) return;
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
        loaded.set(src, img);
      } catch {
        // An image that cannot be loaded is left out, as on screen.
      }
    }),
  );
  return { get: (src) => loaded.get(src) ?? null };
}

/** Plain-English refusal for an export that would not fit in a canvas. */
export function sizeProblem(width: number, height: number): string | null {
  if (width > MAX_EXPORT_PIXELS || height > MAX_EXPORT_PIXELS)
    return `This image would be ${width} by ${height} pixels, and the limit is ${MAX_EXPORT_PIXELS} pixels on a side. Choose a smaller scale, export only a selection, or export SVG or PDF instead.`;
  if (width * height > MAX_EXPORT_AREA)
    return `This image would be ${width} by ${height} pixels, which is too large for the browser to draw. Choose a smaller scale, export only a selection, or export SVG or PDF instead.`;
  return null;
}

/**
 * Draws the model (or a selection) with the same painter the screen uses, at 1x to 4x, on an
 * offscreen canvas, and returns a PNG. Rejects with a plain-English message when too large.
 */
export async function exportPng(
  scene: Scene,
  options: PngExportOptions,
): Promise<Blob> {
  const padding = options.padding ?? DEFAULT_EXPORT_PADDING;
  const content = collectContent(scene, options.selection, padding);
  const { bounds } = content;
  const k = options.scale;
  const width = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) * k));
  const height = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) * k));
  const problem = sizeProblem(width, height);
  if (problem) throw new Error(problem);

  const images = await loadImages(
    imageSources(content),
    options.resolveImage ?? (() => null),
  );

  const offscreen =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : null;
  const canvas = offscreen ? null : document.createElement('canvas');
  if (canvas) {
    canvas.width = width;
    canvas.height = height;
  }
  // OffscreenCanvasRenderingContext2D has the same drawing methods as the DOM one; the painter
  // only uses those, so the one type stands in for both.
  const ctx = (offscreen ?? canvas!).getContext(
    '2d',
  ) as CanvasRenderingContext2D | null;
  if (!ctx)
    throw new Error('This browser could not create a canvas to draw on.');

  if (!options.transparent) {
    ctx.fillStyle = options.background ?? '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  const at = (x: number, y: number) =>
    ctx.setTransform(k, 0, 0, k, (x - bounds.minX) * k, (y - bounds.minY) * k);

  at(0, 0);
  paintConnectors(
    ctx,
    content.connectors.map((c) => ({ route: c.route, look: c.look })),
    { scale: k, minTextPx: 0, minArrowPx: 0 },
  );
  for (const e of content.elements) {
    at(e.x, e.y);
    paintOps(ctx, e.compiled.compiled.ops, {
      scale: k,
      minTextPx: 0,
      images,
    });
  }

  if (offscreen) return offscreen.convertToBlob({ type: 'image/png' });
  return new Promise<Blob>((resolve, reject) =>
    canvas!.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('The browser could not write the image.')),
      'image/png',
    ),
  );
}
