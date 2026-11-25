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
import { endpoints } from "./api/endpoints";
import { isMobileCrewRole, isSuperAdminRole, normalizeRole } from "./lib";

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

  /**
   * Super Admin company bind must hit POST /api/auth/select-company so the
   * JWT gets active_company_id. Local X-Company-Id alone is ignored by API.
   */
  const selectCompany = useCallback(async (next, { syncSession = true } = {}) => {
    if (!next?.id) {
      setActiveCompany(null);
      setCompanyState(null);
      return null;
    }

    const label = {
      id: next.id,
      name: next.name || `Company #${next.id}`,
    };

    if (
      syncSession &&
      isSuperAdminRole(user?.user_type || getUser()?.user_type) &&
      getToken() &&
      getToken() !== DEMO_TOKEN
    ) {
      const data = await api(endpoints.selectCompany, {
        method: "POST",
        body: {
          company_id: Number(next.id),
          refresh_token: getRefreshToken() || undefined,
        },
      });

      if (data?.token && data?.user) {
        const nextUser = {
          ...data.user,
          user_type: normalizeRole(data.user.user_type) || data.user.user_type,
          company_name: label.name,
        };
        setSession({ ...data, user: nextUser });
        setUser(nextUser);
      }

      const saved = setActiveCompany({
        id: data?.user?.company_id || label.id,
        name: label.name,
      });
      setCompanyState(saved);
      return saved;
    }

    const saved = setActiveCompany(label);
    setCompanyState(saved);
    return saved;
  }, [user?.user_type]);

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

  const acceptSession = useCallback((data) => {
    if (!data?.token || !data?.user) {
      throw new Error("Invalid login response");
    }
    const nextUser = {
      ...data.user,
      user_type: normalizeRole(data.user.user_type) || data.user.user_type,
    };
    setSession({ ...data, user: nextUser });
    setUser(nextUser);
    setAuthed(true);
    if (isSuperAdminRole(nextUser.user_type)) {
      setActiveCompany(null);
      setCompanyState(null);
    } else {
      bindCompanyForUser(nextUser);
    }
    return nextUser;
  }, [bindCompanyForUser]);

  const login = async (identifier, password) => {
    const value = String(identifier || "").trim();
    try {
      const isEmail = value.includes("@");
      const data = await api(endpoints.login, {
        method: "POST",
        auth: false,
        body: isEmail
          ? { email: value.toLowerCase(), identifier: value.toLowerCase(), password }
          : { mobile: value, identifier: value, password },
      });

      if (data?.token && data?.user) {
        return acceptSession(data);
      }
    } catch (error) {
      if (!isDemoLogin(value, password)) throw error;
    }

    if (!isDemoLogin(value, password)) {
      throw new Error("Invalid email or password");
    }

    const nextUser = { ...DEMO_USER };
    setSession({ token: DEMO_TOKEN, refresh_token: DEMO_TOKEN, user: nextUser });
    setUser(nextUser);
    setAuthed(true);
    bindCompanyForUser(nextUser);
    return nextUser;
  };

  const loginWithOtp = async (mobile, otp) => {
    const data = await api(endpoints.otpVerify, {
      method: "POST",
      auth: false,
      body: { mobile: String(mobile || "").trim(), otp: String(otp || "").trim() },
    });
    return acceptSession(data);
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
    } else if (nextUser.company_id) {
      // Profile may return active company from JWT claim.
      const existing = getActiveCompany();
      const saved = setActiveCompany({
        id: nextUser.company_id,
        name: existing?.name || nextUser.company_name || `Company #${nextUser.company_id}`,
      });
      setCompanyState(saved);
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
    // Driver/Helper use mobile shell; do not block on desk company assignment UI.
    if (isMobileCrewRole(user.user_type)) return false;
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
        loginWithOtp,
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
