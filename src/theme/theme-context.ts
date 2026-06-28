import { createContext } from 'react';
import type { ResolvedTheme, ThemePreference } from './theme';

export interface ThemeContextValue {
  /** What the user selected: 'system' | 'light' | 'dark'. */
  preference: ThemePreference;
  /** The concrete theme currently applied: 'light' | 'dark'. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
