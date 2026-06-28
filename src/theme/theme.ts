// Theme primitives shared across the theming system.
// Three-way preference: System (default) follows the OS; Light / Dark are explicit.

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pom-theme';

/** Resolve a user preference to a concrete theme, consulting the OS for 'system'. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/** Read a persisted preference, defaulting to 'system' when absent/invalid. */
export function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}
