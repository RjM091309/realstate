import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { RegisterInput, SessionPayload } from '@/types/session';
import { apiFetch, getToken, setToken } from '@/lib/api';

interface AuthContextValue {
  session: SessionPayload | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ session: SessionPayload }>('/api/auth/session');
      setSession(data.session);
    } catch {
      setToken(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiFetch<{ token: string; session: SessionPayload }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    setSession(data.session);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await apiFetch<{ token: string; session: SessionPayload }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setToken(data.token);
    setSession(data.session);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setSession(null);
    void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      login,
      register,
      logout,
      refreshSession,
    }),
    [session, loading, login, register, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
