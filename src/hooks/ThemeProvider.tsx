import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { THEMES, applyTheme, getStoredTheme, storeTheme, type ThemeKey } from '../theme';
import { ThemeContext } from './themeContext';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(() => getStoredTheme());

  const setTheme = useCallback((nextTheme: ThemeKey) => {
    setThemeState(nextTheme);
    storeTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

