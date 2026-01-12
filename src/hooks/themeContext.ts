import { createContext } from 'react';
import { THEMES, type ThemeKey } from '../theme';

export type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
  themes: typeof THEMES;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

