'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'formly-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  // Sync on mount
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
    setThemeState(saved);
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const next = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      root.classList.toggle('dark', next === 'dark');
      setResolved(next);
    };

    apply();
    media.addEventListener('change', apply);
    localStorage.setItem(STORAGE_KEY, theme);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}