// Light/dark theme, driven by data-theme on <html>. Light is the default; the
// preference is the user's explicit choice once they toggle. Kept out of the app
// store so it never touches decision data.
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'rooted-theme';
// Every toggle control shares one source of truth (the <html> attribute); this
// event lets all useTheme() instances re-read it, so two toggles never disagree.
const THEME_EVENT = 'rooted-theme-change';

export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  // Light by default, regardless of the OS setting, until the user picks one.
  return 'light';
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
  try {
    window.dispatchEvent(new CustomEvent(THEME_EVENT));
  } catch {
    // ignore — the toggling control still updates its own state below
  }
}

export function applyStoredTheme() {
  document.documentElement.dataset.theme = storedTheme();
}

// Small hook for the toggle control. Any number of these can live on a page (the
// bar toggle and the profile menu); they all track the same <html> attribute, so
// toggling one updates the others.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync); // another tab changed it
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const toggle = () => {
    // Read the live value, not this instance's state, so a stale copy can't flip the wrong way.
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  return { theme, toggle };
}
