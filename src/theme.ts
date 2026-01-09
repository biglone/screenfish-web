export const THEME_STORAGE_KEY = 'screenfish.theme';

export const THEME_KEYS = ['blue', 'emerald', 'violet', 'rose', 'amber'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const DEFAULT_THEME: ThemeKey = 'blue';

export const THEMES: Array<{ key: ThemeKey; label: string }> = [
  { key: 'blue', label: '蓝色' },
  { key: 'emerald', label: '绿色' },
  { key: 'violet', label: '紫色' },
  { key: 'rose', label: '玫红' },
  { key: 'amber', label: '琥珀' },
];

export function isThemeKey(x: string): x is ThemeKey {
  return (THEME_KEYS as readonly string[]).includes(x);
}

export function getStoredTheme(): ThemeKey {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && isThemeKey(raw)) return raw;
  return DEFAULT_THEME;
}

export function storeTheme(theme: ThemeKey) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function applyTheme(theme: ThemeKey) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function applyStoredTheme(): ThemeKey {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

