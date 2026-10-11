import { describe, expect, it } from 'vitest';
import {
  LOOK_KEY,
  THEME_KEY,
  canvasColors,
  createThemeController,
  effectiveTheme,
  readLook,
  readPreference,
} from './theme';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    data,
  };
};
const fakeRoot = () => {
  const attrs: Record<string, string> = {};
  return {
    attrs,
    setAttribute: (n: string, v: string) => void (attrs[n] = v),
    removeAttribute: (n: string) => void delete attrs[n],
  };
};

describe('theme', () => {
  it('follows the system until a choice is made', () => {
    expect(readPreference(memoryStorage())).toBe('system');
    expect(effectiveTheme('system', true)).toBe('dark');
    expect(effectiveTheme('system', false)).toBe('light');
    expect(effectiveTheme('light', true)).toBe('light');
  });

  it('remembers the choice and writes it to the page', () => {
    const storage = memoryStorage();
    const root = fakeRoot();
    const theme = createThemeController({
      storage,
      prefersDark: () => false,
      root,
    });
    expect(root.attrs['data-theme']).toBeUndefined();
    theme.set('dark');
    expect(storage.data[THEME_KEY]).toBe('dark');
    expect(root.attrs['data-theme']).toBe('dark');
    expect(theme.effective).toBe('dark');
    // A new page starts with the stored choice.
    const root2 = fakeRoot();
    createThemeController({ storage, prefersDark: () => false, root: root2 });
    expect(root2.attrs['data-theme']).toBe('dark');
    theme.set('system');
    expect(root.attrs['data-theme']).toBeUndefined();
  });

  it('survives storage that throws and unknown values', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const theme = createThemeController({
      storage: broken,
      prefersDark: () => true,
      root: fakeRoot(),
    });
    expect(theme.preference).toBe('system');
    expect(() => theme.set('light')).not.toThrow();
    expect(readPreference(memoryStorage({ [THEME_KEY]: 'purple' }))).toBe(
      'system',
    );
  });

  it('tells listeners when the system setting changes', () => {
    let dark = false;
    const theme = createThemeController({
      storage: memoryStorage(),
      prefersDark: () => dark,
      root: fakeRoot(),
    });
    const seen: string[] = [];
    theme.subscribe((_, e) => seen.push(e));
    dark = true;
    theme.systemChanged();
    expect(seen).toEqual(['dark']);
  });

  it('starts in Workshop and remembers another look', () => {
    const storage = memoryStorage();
    const root = fakeRoot();
    const theme = createThemeController({
      storage,
      prefersDark: () => false,
      root,
    });
    expect(theme.look).toBe('workshop');
    expect(root.attrs['data-look']).toBe('workshop');
    theme.setLook('drafting');
    expect(storage.data[LOOK_KEY]).toBe('drafting');
    expect(root.attrs['data-look']).toBe('drafting');
    // The light or dark choice is a separate setting and stays as it was.
    expect(storage.data[THEME_KEY]).toBeUndefined();
    const root2 = fakeRoot();
    const again = createThemeController({
      storage,
      prefersDark: () => false,
      root: root2,
    });
    expect(again.look).toBe('drafting');
    expect(root2.attrs['data-look']).toBe('drafting');
  });

  it('falls back to Workshop for unknown or unreadable looks', () => {
    expect(readLook(memoryStorage({ [LOOK_KEY]: 'purple' }))).toBe('workshop');
    expect(readLook(undefined)).toBe('workshop');
    expect(
      readLook({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => undefined,
      }),
    ).toBe('workshop');
  });

  it('tells listeners about a new look and a new mode', () => {
    const root = fakeRoot();
    const theme = createThemeController({
      storage: memoryStorage(),
      prefersDark: () => true,
      root,
    });
    const seen: string[] = [];
    theme.subscribe((p, e, look) => seen.push(`${p} ${e} ${look}`));
    theme.setLook('meadow');
    theme.setMode('build');
    theme.setMode('build');
    expect(root.attrs['data-mode']).toBe('build');
    expect(seen).toEqual(['system dark meadow', 'system dark meadow']);
  });

  it('reads canvas colours from the tokens, with light fallbacks', () => {
    expect(canvasColors(() => '').background).toBe('#fbfbfd');
    expect(
      canvasColors((n) => (n === '--canvas-bg' ? ' #131720 ' : '')).background,
    ).toBe('#131720');
  });
});
