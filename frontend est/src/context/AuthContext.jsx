import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const logout = useCallback(() => { tokenStore.set(null); setIsAdmin(false); }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { tokenStore.set(null); setIsAdmin(false); });
    if (!tokenStore.get()) { setChecking(false); return; }
    api.me().then(() => setIsAdmin(true)).catch(() => tokenStore.set(null)).finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (password) => {
    const r = await api.login(password);
    tokenStore.set(r.token);
    setIsAdmin(true);
  }, []);

  const value = useMemo(() => ({ isAdmin, checking, login, logout }), [isAdmin, checking, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
