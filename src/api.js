const BASE = import.meta.env.VITE_API_URL || "";

export const DEMO_TOKEN = "demo-session";

const KEYS = {
  token: "tms_token",
  refresh: "tms_refresh",
  user: "tms_user",
  company: "tms_company",
};

let refreshPromise = null;

export function getToken() {
  return localStorage.getItem(KEYS.token);
}

export function getRefreshToken() {
  return localStorage.getItem(KEYS.refresh);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.user) || "null");
  } catch {
    return null;
  }
}

export function setSession({ token, refresh_token, user } = {}) {
  if (token) localStorage.setItem(KEYS.token, token);
  if (refresh_token) localStorage.setItem(KEYS.refresh, refresh_token);
  if (user) localStorage.setItem(KEYS.user, JSON.stringify(user));
}

export function getActiveCompany() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.company) || "null");
  } catch {
    return null;
  }
}

export function setActiveCompany(company) {
  if (!company?.id) {
    localStorage.removeItem(KEYS.company);
    return null;
  }

  const next = {
    id: company.id,
    name: company.name || `Company #${company.id}`,
  };
  localStorage.setItem(KEYS.company, JSON.stringify(next));
  return next;
}

export function clearSession() {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.user);
  localStorage.removeItem(KEYS.company);
}

async function refreshSession() {
  const refresh_token = getRefreshToken();

  if (!refresh_token) {
    throw new Error("Session expired");
  }

  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.success) {
    clearSession();
    throw new Error(data.message || "Session expired");
  }

  setSession(data);
  return data.token;
}

export async function api(path, { method = "GET", body, auth = true, retry = true } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth && getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  const activeCompany = getActiveCompany();
  if (auth && activeCompany?.id) {
    headers["X-Company-Id"] = String(activeCompany.id);
  }

  let res;

  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const target = BASE || "https://tms-t8ln.onrender.com";
    throw new Error(`Unable to reach the TMS API at ${target}. The Render service may be waking up — retry in 30s.`);
  }

  const data = await res.json().catch(() => null);

  if (res.status === 401 && auth && retry && getToken() !== DEMO_TOKEN) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;
      return api(path, { method, body, auth, retry: false });
    } catch (error) {
      clearSession();

      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }

      throw error;
    }
  }

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data || {};
}

export async function fetchAll(path, listKey, maxPages = 10) {
  const rows = [];
  let total = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const joiner = path.includes("?") ? "&" : "?";
    const data = await api(`${path}${joiner}page=${page}&limit=100`);
    const chunk = data[listKey] || data.data || data.rows || [];
    total = Number(data.pagination?.total ?? data.total ?? rows.length + chunk.length);
    rows.push(...chunk);

    if (chunk.length === 0 || rows.length >= total) {
      break;
    }
  }

  return { rows, total: total || rows.length };
}

export async function pingApi() {
  const res = await fetch(`${BASE}/api`);

  if (!res.ok) {
    throw new Error("API offline");
  }

  return res.json();
}
