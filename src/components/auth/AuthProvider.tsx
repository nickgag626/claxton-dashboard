'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthContextType {
  user: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
