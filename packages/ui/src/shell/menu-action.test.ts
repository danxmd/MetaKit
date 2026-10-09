import { describe, expect, it } from 'vitest';
import { menuFocusTarget } from './menu-action';

describe('menuFocusTarget', () => {
  it('starts at the first or last item', () => {
    expect(menuFocusTarget('ArrowDown', -1, 3)).toBe(0);
    expect(menuFocusTarget('ArrowUp', -1, 3)).toBe(2);
  });

  it('wraps around', () => {
    expect(menuFocusTarget('ArrowDown', 2, 3)).toBe(0);
    expect(menuFocusTarget('ArrowUp', 0, 3)).toBe(2);
  });

  it('jumps with Home and End', () => {
    expect(menuFocusTarget('Home', 1, 3)).toBe(0);
    expect(menuFocusTarget('End', 0, 3)).toBe(2);
  });

  it('ignores other keys and empty menus', () => {
    expect(menuFocusTarget('a', 0, 3)).toBeNull();
    expect(menuFocusTarget('ArrowDown', -1, 0)).toBeNull();
  });
});
