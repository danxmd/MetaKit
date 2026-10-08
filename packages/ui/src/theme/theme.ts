/**
 * The appearance setting: follow the system, or always light, or always dark. The choice belongs
 * to the browser (localStorage); where that is not available the page simply follows the system.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

export const THEME_KEY = 'metakit.theme';

export interface ThemeEnvironment {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  /** Whether the system prefers a dark appearance. */
  prefersDark: () => boolean;
  /** Where `data-theme` is written; `document.documentElement` in the browser. */
  root: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  };
}

const isPreference = (v: unknown): v is ThemePreference =>
  v === 'system' || v === 'light' || v === 'dark';

export function readPreference(
  storage: ThemeEnvironment['storage'],
): ThemePreference {
  try {
    const stored = storage?.getItem(THEME_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    // Private windows and blocked site data can throw; the system setting is the safe answer.
    return 'system';
  }
}

export function effectiveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): EffectiveTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/** Writes the choice to the page; `system` removes the attribute so the media query decides. */
export function applyPreference(
  preference: ThemePreference,
  root: ThemeEnvironment['root'],
): void {
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

export function createThemeController(env: ThemeEnvironment) {
  let preference = readPreference(env.storage);
  const listeners = new Set<(p: ThemePreference, e: EffectiveTheme) => void>();
  const emit = () => {
    const effective = effectiveTheme(preference, env.prefersDark());
    for (const l of listeners) l(preference, effective);
  };
  applyPreference(preference, env.root);
  return {
    get preference(): ThemePreference {
      return preference;
    },
    get effective(): EffectiveTheme {
      return effectiveTheme(preference, env.prefersDark());
    },
    set(next: ThemePreference): void {
      preference = next;
      try {
        env.storage?.setItem(THEME_KEY, next);
      } catch {
        // Not remembered, but it still applies to this page.
      }
      applyPreference(next, env.root);
      emit();
    },
    /** Call when the system setting changes, so `system` follows it. */
    systemChanged(): void {
      emit();
    },
    subscribe(
      listener: (p: ThemePreference, e: EffectiveTheme) => void,
    ): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type ThemeController = ReturnType<typeof createThemeController>;

/** The controller of the page; created on first use so that Node and tests do not need a DOM. */
let shared: ThemeController | undefined;
export function pageTheme(): ThemeController {
  if (shared) return shared;
  const media =
    typeof matchMedia === 'function'
      ? matchMedia('(prefers-color-scheme: dark)')
      : undefined;
  let storage: ThemeEnvironment['storage'];
  try {
    storage = typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    storage = undefined;
  }
  shared = createThemeController({
    storage,
    prefersDark: () => media?.matches ?? false,
    root: document.documentElement,
  });
  media?.addEventListener?.('change', () => shared?.systemChanged());
  return shared;
}

/**
 * The colours the canvas needs, read from the page's tokens so that the canvas follows the theme.
 * Falls back to the light values outside a browser.
 */
export interface CanvasColors {
  background: string;
  grid: string;
  gridStrong: string;
  selection: string;
}

export function canvasColors(
  read: (name: string) => string = (name) =>
    typeof getComputedStyle === 'function' && typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      : '',
): CanvasColors {
  const pick = (name: string, fallback: string) =>
    read(name).trim() || fallback;
  return {
    background: pick('--canvas-bg', '#fbfbfd'),
    grid: pick('--canvas-grid', '#e4e8ef'),
    gridStrong: pick('--canvas-grid-strong', '#d3d9e3'),
    selection: pick('--canvas-selection', '#4263eb'),
  };
}
