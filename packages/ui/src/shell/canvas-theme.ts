import type { CanvasPalette, MinimapPalette } from '@metakit-app/canvas';
import { canvasColors } from '../theme/theme';

/** What the model canvas and its minimap need from the page's tokens. */
export interface CanvasTheme {
  canvas: CanvasPalette;
  minimap: MinimapPalette;
  /** Text colour of the page, for previews drawn on a card. */
  text: string;
}

const readToken = (name: string): string =>
  typeof getComputedStyle === 'function' && typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';

/**
 * The canvas colours for the current theme. `read` is injectable so that this runs without a DOM;
 * it defaults to the tokens on the page. A missing token falls back to the light value.
 */
export function canvasTheme(
  read: (name: string) => string = readToken,
): CanvasTheme {
  const colours = canvasColors(read);
  const pick = (name: string, fallback: string) =>
    read(name).trim() || fallback;
  const text = pick('--text', '#212529');
  return {
    canvas: {
      background: colours.background,
      grid: colours.grid,
      selection: colours.selection,
      text,
    },
    minimap: {
      background: colours.background,
      border: pick('--line-strong', '#ced4da'),
      elements: pick('--accent', '#91a7ff'),
      viewport: colours.selection,
    },
    text,
  };
}
