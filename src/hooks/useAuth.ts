'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuthState {
  user: string | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  // Check auth status on mount
  useEffect(() => {
    fetch('/api/auth/check')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setState({ user: data.user, loading: false, isAuthenticated: true });
        } else {
          setState({ user: null, loading: false, isAuthenticated: false });
        }
      })
      .catch(() => {
        setState({ user: null, loading: false, isAuthenticated: false });
      });
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed');
    }

    const data = await res.json();
    setState({ user: data.user, loading: false, isAuthenticated: true });
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ user: null, loading: false, isAuthenticated: false });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    signIn,
    signOut,
  };
}
