import { createContext } from 'react';
import type { CurrentUser } from '../api/authApi';

export interface AuthContextValue {
  /** The signed-in user, or null when not authenticated. */
  user: CurrentUser | null;
  /** True while the initial getMe() session check is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
