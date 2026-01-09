import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { THEMES, applyTheme, getStoredTheme, storeTheme, type ThemeKey } from '../theme';

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
  themes: typeof THEMES;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(() => getStoredTheme());

  const setTheme = useCallback((nextTheme: ThemeKey) => {
    setThemeState(nextTheme);
    storeTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

