import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

// Must match the inline script in index.html, which applies the theme before first paint.
export const THEME_STORAGE_KEY = 'uplift.theme';

export const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
