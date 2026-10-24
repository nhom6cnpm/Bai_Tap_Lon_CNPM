'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  UserProfile,
  subscribeAuth,
  getStoredToken,
  getStoredUserRaw,
  loginApi,
  registerApi,
  clearAuth,
  saveAuth,
} from '@/lib/auth';

export function useAuth() {
  const token = useSyncExternalStore(subscribeAuth, getStoredToken, () => null);
  const rawUser = useSyncExternalStore(subscribeAuth, getStoredUserRaw, () => null);

  const user = useMemo<UserProfile | null>(() => {
    if (!rawUser) return null;
    try {
      return JSON.parse(rawUser) as UserProfile;
    } catch {
      return null;
    }
  }, [rawUser]);

  const login = async (email: string, password: string) => {
    const data = await loginApi(email, password);
    saveAuth(data.access_token, data.user);
    return data;
  };

  const register = async (email: string, password: string) => {
    await registerApi(email, password);
    return login(email, password);
  };

  const logout = () => {
    clearAuth();
  };

  return {
    token,
    user,
    isAuthenticated: !!token,
    login,
    register,
    logout,
  };
}
