/*
 * Keeps the signed-in user in one place so every page can ask 'who is logged in?'.
 * Use it with: const { user, loading, login, logout } = useAuth();
 * The JWT tokens themselves are handled in api/client.js; this file only decides
 * who the user is and exposes login / logout.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { tokenStore } from "../api/client";

const AuthContext = createContext(null);

// Wrap the app with this (see main.jsx).
export function AuthProvider({ children }) {
  // user is null when nobody is signed in, otherwise the object the API returned
  // (id, username, role, full_name, department_name ...).
  const [user, setUser] = useState(null);
  // loading is true while a saved token is being checked, so pages do not flash the login screen.
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  // Restore the session after a page refresh.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get("/auth/me/")
      .then(({ data }) => setUser(data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // The axios client fires this when a token can no longer be refreshed.
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  // Sign in. The role is sent too, so a person cannot enter through the wrong role's login.
  // On success the tokens are saved and the user object is kept in state.
  const login = useCallback(async (username, password, role) => {
    const { data } = await api.post("/auth/login/", { username, password, role });
    tokenStore.set({ access: data.access, refresh: data.refresh });
    setUser(data.user);
    return data.user;
  }, []);

  // Sign out: tell the server to block the refresh token, then forget everything here.
  const logout = useCallback(async () => {
    const tokens = tokenStore.get();
    try {
      if (tokens?.refresh) await api.post("/auth/logout/", { refresh: tokens.refresh });
    } catch {
      /* the token is discarded locally either way */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  // useMemo keeps the same object between renders, so pages only re-render when something really changed.
  const value = useMemo(() => ({ user, loading, login, logout, setUser }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Shortcut used by pages and layouts.
export const useAuth = () => useContext(AuthContext);
