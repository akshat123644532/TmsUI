import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, DEMO_TOKEN, fetchAll, getToken, pingApi } from "../api";
import { useAuth } from "../auth";
import { initials, isAdminRole, isSuperAdminRole, roleLabel } from "../lib";
import { useTheme } from "../theme";
import { Icon } from "./Icons";
import { Modal } from "./ui";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: "grid" },
      { to: "/users", label: "Users", icon: "gear", admin: true },
      { to: "/access", label: "Module Access", icon: "gear", admin: true },
      { to: "/audit", label: "Audit Logs", icon: "file", admin: true },
    ],
  },
  {
    label: "Fleet",
    items: [
      { to: "/fleet", label: "Vehicles", icon: "truck" },
      { to: "/staff", label: "Drivers & Helpers", icon: "users" },
      { to: "/documents", label: "Documents", icon: "file" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/loads", label: "Bilty", icon: "box" },
      { to: "/routes", label: "Trips", icon: "pin" },
      { to: "/expenses", label: "Trip Expenses", icon: "rupee" },
      { to: "/settlements", label: "Trip Settlement", icon: "check" },
      { to: "/reports", label: "Reports", icon: "download" },
    ],
  },
  {
    label: "Billing",
    items: [
      { to: "/clients", label: "Clients", icon: "crm" },
      { to: "/invoices", label: "Invoices", icon: "invoice" },
      { to: "/payments", label: "Payments", icon: "radio" },
    ],
  },
];

export default function Shell() {
  const { user, logout, refreshUser, company, selectCompany, loadCompanies } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [panel, setPanel] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [alertNote, setAlertNote] = useState("");
  const [help, setHelp] = useState("");
  const [companyName, setCompanyName] = useState(() => company?.name || user?.company_name || "Your company");
  const demo = getToken() === DEMO_TOKEN;
  const superAdmin = isSuperAdminRole(user?.user_type);

  useEffect(() => {
    refreshUser().catch(() => {});
  }, []);

  useEffect(() => {
    setCompanyName(company?.name || user?.company_name || "Your company");
    let live = true;
    const activeId = company?.id || user?.company_id;
    if (!activeId || demo) return undefined;

    loadCompanies()
      .then((rows) => {
        const match = rows.find((row) => String(row.id) === String(activeId));
        if (!live || !match?.name) return;
        setCompanyName(match.name);
        if (String(company?.id) === String(match.id) && company?.name !== match.name) {
          selectCompany({ id: match.id, name: match.name });
        } else if (!company?.name && match.name) {
          selectCompany({ id: match.id, name: match.name });
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [user?.company_id, user?.company_name, company?.id, company?.name, demo, loadCompanies, selectCompany]);

  useEffect(() => {
    let live = true;

    const check = () => {
      pingApi()
        .then(() => live && setOnline(true))
        .catch(() => live && setOnline(false));
    };

    check();
    const timer = setInterval(check, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const needle = query.trim();

    if (needle.length < 2) {
      setHits([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setSearching(true);

      try {
        const [bilties, trips, clients, vehicles, drivers] = await Promise.all([
          fetchAll("/api/bilties", "bilties"),
          fetchAll("/api/trips", "trips"),
          fetchAll("/api/clients", "clients"),
          fetchAll("/api/vehicles", "vehicles"),
          fetchAll("/api/drivers", "drivers"),
        ]);
        const q = needle.toLowerCase();
        const next = [];

        for (const row of bilties.rows || []) {
          if (String(row.bilty_number || "").toLowerCase().includes(q)) {
            next.push({
              id: `b-${row.id}`,
              recordId: row.id,
              type: "Bilty",
              label: row.bilty_number,
              query: row.bilty_number,
              to: "/loads",
            });
          }
        }

        for (const row of trips.rows || []) {
          const queryText = `${row.source || ""} ${row.destination || ""}`.trim();
          const label = `${row.source || ""} → ${row.destination || ""}`;
          if (label.toLowerCase().includes(q) || queryText.toLowerCase().includes(q) || String(row.status || "").toLowerCase().includes(q)) {
            next.push({
              id: `t-${row.id}`,
              recordId: row.id,
              type: "Trip",
              label,
              query: queryText,
              to: "/routes",
            });
          }
        }

        for (const row of clients.rows || []) {
          if (String(row.name || "").toLowerCase().includes(q)) {
            next.push({
              id: `c-${row.id}`,
              recordId: row.id,
              type: "Client",
              label: row.name,
              query: row.name,
              to: "/clients",
            });
          }
        }

        for (const row of vehicles.rows || []) {
          if (String(row.registration_no || "").toLowerCase().includes(q)) {
            next.push({
              id: `v-${row.id}`,
              recordId: row.id,
              type: "Vehicle",
              label: row.registration_no,
              query: row.registration_no,
              to: "/fleet",
            });
          }
        }

        for (const row of drivers.rows || []) {
          if (String(row.name || "").toLowerCase().includes(q)) {
            next.push({
              id: `d-${row.id}`,
              recordId: row.id,
              type: "Driver",
              label: row.name,
              query: row.name,
              to: "/staff",
            });
          }
        }

        setHits(next.slice(0, 8));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const loadAlerts = async () => {
    try {
      const packs = await Promise.all([
        api("/api/vehicle-documents?limit=100").catch(() => ({ documents: [] })),
        api("/api/driver-documents?limit=100").catch(() => ({ documents: [] })),
        api("/api/helper-documents?limit=100").catch(() => ({ documents: [] })),
      ]);
      const soon = packs.flatMap((pack) => pack.documents || []).filter((doc) => {
        if (!doc.expiry_date) return false;
        return new Date(doc.expiry_date).getTime() - Date.now() < 30 * 86400000;
      });
      setAlerts(soon);
      setAlertNote(soon.length ? "" : "No documents expire in the next 30 days.");
    } catch (error) {
      setAlerts([]);
      setAlertNote(error.message);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const openAlerts = async () => {
    setPanel(panel === "alerts" ? "" : "alerts");
    if (panel === "alerts") return;
    await loadAlerts();
  };

  useEffect(() => {
    if (!panel) return undefined;

    const close = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".pop-anchor")) {
        setPanel("");
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [panel]);

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className={`app-shell${collapsed ? " collapsed" : ""}${mobileOpen ? " nav-open" : ""}`}>
      {mobileOpen ? <button className="scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} /> : null}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-lockup">
            <span className="brand-mark">
              <Icon name="truck" size={18} />
            </span>
            <strong className="brand-name">
              TMS <span>Desk</span>
            </strong>
          </div>
          <button
            className="icon-btn brand-close"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              setCollapsed((value) => !value);
              setMobileOpen(false);
            }}
          >
            <Icon name={collapsed ? "menu" : "close"} size={16} />
          </button>
        </div>

        <nav className="nav">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.admin || isAdminRole(user?.user_type));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.label}>
                <p className="nav-group-label">{group.label}</p>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    title={item.label}
                    className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <button className="nav-link" type="button" onClick={signOut}>
            <Icon name="logout" />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Icon name="menu" />
          </button>
          <label className="search-wrap">
            <span className="search-icon">
              <Icon name="search" size={16} />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Global search..."
              aria-label="Global search"
            />
            {query.trim().length >= 2 ? (
              <div className="search-results">
                {searching ? <p className="muted pad">Searching...</p> : null}
                {!searching && hits.length === 0 ? <p className="muted pad">No matches</p> : null}
                {hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="search-hit"
                    onClick={() => {
                      setQuery("");
                      setHits([]);
                      navigate(`${hit.to}?q=${encodeURIComponent(hit.query || hit.label)}&focus=${hit.recordId}`);
                    }}
                  >
                    <strong>{hit.label}</strong>
                    <span>{hit.type}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <div className="top-spacer" />

          <div className="company-chip">
            <small>Company</small>
            <strong>{companyName}</strong>
            {superAdmin ? (
              <button
                className="company-switch"
                type="button"
                onClick={() => {
                  selectCompany(null);
                  navigate("/select-company");
                }}
              >
                Switch
              </button>
            ) : null}
          </div>

          <div className={`online-pill${online ? "" : " off"}`}>
            <i className="dot" />
            {online ? "SYSTEM ONLINE" : "API OFFLINE"}
          </div>

          <div className="pop-anchor">
            <button className="icon-btn" type="button" aria-label="Notifications" onClick={openAlerts}>
              <Icon name="bell" />
              {alerts.length ? <span className="badge">{alerts.length}</span> : null}
            </button>
            {panel === "alerts" ? (
              <div className="popover">
                <h4>Documents</h4>
                {alertNote ? <p className="muted">{alertNote}</p> : null}
                {alerts.map((doc) => (
                  <p key={doc.id}>
                    {doc.document_type} {doc.document_number || ""} expires {String(doc.expiry_date).slice(0, 10)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <button
            className="icon-btn"
            type="button"
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Icon name={theme === "light" ? "moon" : "sun"} />
          </button>

          <div className="pop-anchor">
            <button
              className="user-chip user-chip-btn"
              type="button"
              aria-label="Open profile"
              onClick={() => setPanel(panel === "account" ? "" : "account")}
            >
              <div>
                <strong>{user?.name || "User"}</strong>
                <small>{roleLabel(user?.user_type)}</small>
              </div>
              <span className="avatar">{initials(user?.name)}</span>
            </button>
            {panel === "account" ? (
              <div className="popover profile-menu">
                <h4>Profile</h4>
                <p>{user?.name || "Signed in"}</p>
                <p className="muted">{user?.email}</p>
                <p className="muted">{user?.mobile || "No mobile"}</p>
                <p className="muted">{companyName}</p>
                <div className="theme-row">
                  <span>Theme</span>
                  <div className="theme-toggle">
                    <button
                      type="button"
                      className={theme === "dark" ? "active" : ""}
                      onClick={() => setTheme("dark")}
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      className={theme === "light" ? "active" : ""}
                      onClick={() => setTheme("light")}
                    >
                      Light
                    </button>
                  </div>
                </div>
                <button className="menu-action" type="button" onClick={signOut}>
                  <Icon name="logout" size={16} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>

        <footer className="footer">
          <div className="server-line">
            <i className={`dot${demo ? " demo" : online ? "" : " off"}`} />
            <span>{demo ? "Demo mode" : online ? "API online" : "API offline"}</span>
            <span className="muted">API v1.0.0</span>
          </div>
          <div className="footer-links">
            <button type="button" onClick={() => setHelp("support")}>
              Support
            </button>
            <button type="button" onClick={() => setHelp("docs")}>
              Documentation
            </button>
            <span>© 2026 TMS</span>
          </div>
        </footer>
      </div>

      {help ? (
        <Modal title={help === "docs" ? "Documentation" : "Support"} onClose={() => setHelp("")}>
          {help === "docs" ? (
            <div className="help-copy">
              <p>This desk follows the TMS tables: vehicles, drivers, helpers, bilties, trips, expenses, settlements, clients, invoices, and payments.</p>
              <p>Trip expenses and advances sit on a trip. Settlements compare approved advances against expenses.</p>
              <p>Invoices start as drafts. Send one, record a payment, then confirm it so the balance updates.</p>
            </div>
          ) : (
            <div className="help-copy">
              <p>If the header says API offline, start the backend with <code>node server.js</code> inside the TMS backend folder.</p>
              <p>Sign in with a company user. Records are scoped to that company.</p>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
