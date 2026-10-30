import { createContext, useContext, useState } from "react";
import { api, clearSession, DEMO_TOKEN, getRefreshToken, getToken, getUser, setSession } from "./api";

const AuthContext = createContext(null);

const DEMO_EMAIL = "admin@tms.com";
const DEMO_PASSWORD = "123456";

const DEMO_USER = {
  id: 1,
  company_id: 2,
  user_type: "COMPANY_ADMIN",
  name: "TMS Admin",
  mobile: "9999999999",
  email: DEMO_EMAIL,
  status: 1,
  company_name: "TMS Demo Company",
};

function isDemoLogin(email, password) {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [authed, setAuthed] = useState(() => Boolean(getToken()));

  const login = async (email, password) => {
    try {
      const data = await api("/api/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });

      if (data?.token && data?.user) {
        setSession(data);
        setUser(data.user);
        setAuthed(true);
        return data.user;
      }
    } catch (error) {
      if (!isDemoLogin(email, password)) throw error;
    }

    if (!isDemoLogin(email, password)) {
      throw new Error("Invalid email or password");
    }

    const user = { ...DEMO_USER };
    setSession({ token: DEMO_TOKEN, refresh_token: DEMO_TOKEN, user });
    setUser(user);
    setAuthed(true);
    return user;
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
    if (getToken() === DEMO_TOKEN) return getUser();

    const data = await api("/api/profile");
    if (!data?.user) return getUser();

    setSession({ user: data.user });
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, authed, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
