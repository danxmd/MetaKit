import { describe, expect, it } from 'vitest';
import { canvasTheme } from './canvas-theme';

describe('the canvas theme', () => {
  it('reads the page tokens', () => {
    const tokens: Record<string, string> = {
      '--canvas-bg': '#131720',
      '--canvas-grid': '#1f2530',
      '--canvas-selection': '#9aacff',
      '--text': '#e4e7ee',
      '--line-strong': '#3b4357',
      '--accent': '#7f97ff',
    };
    const theme = canvasTheme((name) => tokens[name] ?? '');
    expect(theme.canvas).toEqual({
      background: '#131720',
      grid: '#1f2530',
      selection: '#9aacff',
      text: '#e4e7ee',
    });
    expect(theme.minimap.background).toBe('#131720');
    expect(theme.minimap.border).toBe('#3b4357');
    expect(theme.minimap.viewport).toBe('#9aacff');
  });

  it('falls back to the light colours when the page has no tokens', () => {
    const theme = canvasTheme(() => '');
    expect(theme.canvas.background).toBe('#fbfbfd');
    expect(theme.canvas.text).toBe('#212529');
  });
});
