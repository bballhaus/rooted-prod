// Light/dark theme, driven by data-theme on <html>. The preference is the user's
// explicit choice, falling back to the system setting the first time. Kept out of
// the app store so it never touches decision data.
import { useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'rooted-theme';

function systemTheme(): Theme {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  return systemTheme();
}

export function currentTheme(): Theme {
  const v = document.documentElement.dataset.theme;
  return v === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore
  }
}

export function applyStoredTheme() {
  document.documentElement.dataset.theme = storedTheme();
}

// Small hook for the toggle control.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  return { theme, toggle };
}
