import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  api,
  clearSession,
  DEMO_TOKEN,
  getActiveCompany,
  getRefreshToken,
  getToken,
  getUser,
  setActiveCompany,
  setSession,
} from "./api";
import { isSuperAdminRole, normalizeRole } from "./lib";

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

const DEMO_COMPANIES = [
  { id: 2, name: "TMS Demo Company" },
];

function isDemoLogin(email, password) {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}

function companyFromUser(user) {
  if (!user?.company_id) return null;
  return {
    id: user.company_id,
    name: user.company_name || `Company #${user.company_id}`,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [company, setCompanyState] = useState(() => getActiveCompany());

  const selectCompany = useCallback((next) => {
    const saved = setActiveCompany(next);
    setCompanyState(saved);
    return saved;
  }, []);

  const bindCompanyForUser = useCallback((nextUser) => {
    if (isSuperAdminRole(nextUser?.user_type)) {
      const existing = getActiveCompany();
      if (existing?.id) {
        setCompanyState(existing);
        return existing;
      }
      setActiveCompany(null);
      setCompanyState(null);
      return null;
    }

    const bound = companyFromUser(nextUser);
    if (!bound) {
      setActiveCompany(null);
      setCompanyState(null);
      return null;
    }
    const saved = setActiveCompany(bound);
    setCompanyState(saved);
    return saved;
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api("/api/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });

      if (data?.token && data?.user) {
        const nextUser = {
          ...data.user,
          user_type: normalizeRole(data.user.user_type) || data.user.user_type,
        };
        setSession({ ...data, user: nextUser });
        setUser(nextUser);
        setAuthed(true);
        bindCompanyForUser(nextUser);
        return nextUser;
      }
    } catch (error) {
      if (!isDemoLogin(email, password)) throw error;
    }

    if (!isDemoLogin(email, password)) {
      throw new Error("Invalid email or password");
    }

    const nextUser = { ...DEMO_USER };
    setSession({ token: DEMO_TOKEN, refresh_token: DEMO_TOKEN, user: nextUser });
    setUser(nextUser);
    setAuthed(true);
    bindCompanyForUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    if (getToken() !== DEMO_TOKEN) {
      try {
        await api("/api/logout", {
          method: "POST",
          body: { refresh_token: getRefreshToken() },
        });
      } catch {
        /* still sign out locally */
      }
    }

    clearSession();
    setUser(null);
    setCompanyState(null);
    setAuthed(false);
  };

  const refreshUser = async () => {
    if (getToken() === DEMO_TOKEN) return getUser();

    const data = await api("/api/profile");
    if (!data?.user) return getUser();

    const nextUser = {
      ...data.user,
      user_type: normalizeRole(data.user.user_type) || data.user.user_type,
    };
    setSession({ user: nextUser });
    setUser(nextUser);

    if (!isSuperAdminRole(nextUser.user_type)) {
      bindCompanyForUser(nextUser);
    }

    return nextUser;
  };

  const applyUser = (next) => {
    if (!next) return;
    const nextUser = {
      ...next,
      user_type: normalizeRole(next.user_type) || next.user_type,
    };
    setSession({ user: nextUser });
    setUser(nextUser);
  };

  const loadCompanies = useCallback(async () => {
    if (getToken() === DEMO_TOKEN) {
      return DEMO_COMPANIES;
    }

    const data = await api("/api/companies");
    return data.companies || [];
  }, []);

  const needsCompanySelection = useMemo(() => {
    if (!authed || !user) return false;
    if (isSuperAdminRole(user.user_type)) return !company?.id;
    return false;
  }, [authed, user, company]);

  const missingCompany = useMemo(() => {
    if (!authed || !user) return false;
    if (isSuperAdminRole(user.user_type)) return false;
    return !user.company_id && !company?.id;
  }, [authed, user, company]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authed,
        company,
        needsCompanySelection,
        missingCompany,
        login,
        logout,
        refreshUser,
        applyUser,
        selectCompany,
        loadCompanies,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
