import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readStoredPreference, resolveTheme, THEME_STORAGE_KEY } from './theme';
import type { ResolvedTheme, ThemePreference } from './theme';
import { ThemeContext } from './theme-context';

/** Writes the resolved theme onto <html data-theme> so CSS variables switch. */
function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference));

  useEffect(() => {
    const sync = () => {
      const next = resolveTheme(preference);
      setResolved(next);
      applyResolvedTheme(next);
    };
    sync();

    // Only track OS changes while following the system preference.
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
