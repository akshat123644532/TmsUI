import { createContext, useContext, useState } from "react";
import { api, clearSession, getRefreshToken, getToken, getUser, setSession } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [authed, setAuthed] = useState(() => Boolean(getToken()));

  const signup = async (payload) => {
    return api("/api/register", {
      method: "POST",
      auth: false,
      body: payload,
    });
  };

  const login = async (email, password) => {
    const data = await api("/api/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });

    setSession(data);
    setUser(data.user);
    setAuthed(true);
    return data.user;
  };

  const logout = async () => {
    try {
      await api("/api/logout", {
        method: "POST",
        body: { refresh_token: getRefreshToken() },
      });
    } catch {
      clearSession();
    }

    clearSession();
    setUser(null);
    setAuthed(false);
  };

  const refreshUser = async () => {
    const data = await api("/api/profile");
    setSession({ user: data.user });
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, authed, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
