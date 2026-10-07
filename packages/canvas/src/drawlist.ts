import {
  FONT_WORLD_PX,
  LINE_HEIGHT,
  traceShape,
  wrapText,
  type PathSink,
  type ShapeName,
} from './shapes';

export interface TextRun {
  text: string;
  /** Centre of the line, in the element's local coordinates. */
  x: number;
  y: number;
}

/**
 * Everything needed to draw one element at its size, in local coordinates: the outline and the
 * label lines. The browser `Path2D` is made on first use so that lists can be built and tested
 * without a canvas.
 */
export class DrawList {
  private path: Path2D | null = null;

  constructor(
    readonly key: string,
    readonly shape: ShapeName,
    readonly w: number,
    readonly h: number,
    readonly fill: string,
    readonly text: readonly TextRun[],
  ) {}

  outline(): Path2D {
    if (!this.path) {
      this.path = new Path2D();
      traceShape(this.path, this.shape, 0, 0, this.w, this.h);
    }
    return this.path;
  }
}

export function drawKey(
  shape: ShapeName,
  w: number,
  h: number,
  label: string,
  fill: string,
): string {
  return `${shape}|${w}|${h}|${fill}|${label}`;
}

export function buildDrawList(
  shape: ShapeName,
  w: number,
  h: number,
  label: string,
  fill: string,
): DrawList {
  const inner = shape === 'ellipse' || shape === 'diamond' ? 0.65 : 0.9;
  const maxLines = Math.max(
    1,
    Math.floor((h * inner) / (FONT_WORLD_PX * LINE_HEIGHT)),
  );
  const lines =
    label === '' ? [] : wrapText(label, w * inner, FONT_WORLD_PX, maxLines);
  const lineHeight = FONT_WORLD_PX * LINE_HEIGHT;
  const top = h / 2 - ((lines.length - 1) * lineHeight) / 2;
  const text = lines.map((line, i) => ({
    text: line,
    x: w / 2,
    y: top + i * lineHeight,
  }));
  return new DrawList(
    drawKey(shape, w, h, label, fill),
    shape,
    w,
    h,
    fill,
    text,
  );
}

/** Counts builds, so tests and the benchmark can see whether the cache works. */
export class DrawListCache {
  builds = 0;

  /** The list for these inputs: `current` when its key still matches, otherwise a new one. */
  get(
    current: DrawList | undefined,
    shape: ShapeName,
    w: number,
    h: number,
    label: string,
    fill: string,
  ): DrawList {
    if (current && current.key === drawKey(shape, w, h, label, fill))
      return current;
    this.builds += 1;
    return buildDrawList(shape, w, h, label, fill);
  }
}

export type { PathSink };
