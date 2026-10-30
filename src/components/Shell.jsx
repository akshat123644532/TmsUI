import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, DEMO_TOKEN, getToken, pingApi } from "../api";
import { useAuth } from "../auth";
import { initials, roleLabel } from "../lib";
import { Icon } from "./Icons";
import { Modal } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: "grid" },
  { to: "/users", label: "Users", icon: "gear", admin: true },
  { to: "/fleet", label: "Vehicles", icon: "truck" },
  { to: "/staff", label: "Drivers & Helpers", icon: "users" },
  { to: "/loads", label: "Bilty", icon: "box" },
  { to: "/routes", label: "Trips", icon: "pin" },
  { to: "/expenses", label: "Trip Expenses", icon: "rupee" },
  { to: "/settlements", label: "Trip Settlement", icon: "check" },
  { to: "/clients", label: "Clients", icon: "crm" },
  { to: "/invoices", label: "Invoices", icon: "invoice" },
  { to: "/payments", label: "Payments", icon: "radio" },
  { to: "/reports", label: "Reports", icon: "download" },
  { to: "/documents", label: "Documents", icon: "file" },
];

const COMPANY_NAMES = {
  1: "sheel",
  2: "TMS Demo Company",
};

export default function Shell() {
  const { user, logout, refreshUser } = useAuth();
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
  const [companyName, setCompanyName] = useState(
    () => user?.company_name || COMPANY_NAMES[user?.company_id] || "Your company"
  );
  const demo = getToken() === DEMO_TOKEN;

  useEffect(() => {
    refreshUser().catch(() => {});
  }, []);

  useEffect(() => {
    setCompanyName(user?.company_name || COMPANY_NAMES[user?.company_id] || "Your company");
    let live = true;

    api("/api/companies", { auth: false })
      .then((data) => {
        const match = (data.companies || []).find((company) => String(company.id) === String(user?.company_id));
        if (live && match?.name) setCompanyName(match.name);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [user]);

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
          api("/api/bilties?limit=100"),
          api("/api/trips?limit=100"),
          api("/api/clients?limit=100"),
          api("/api/vehicles?limit=100"),
          api("/api/drivers?limit=100"),
        ]);
        const q = needle.toLowerCase();
        const next = [];

        for (const row of bilties.bilties || []) {
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

        for (const row of trips.trips || []) {
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

        for (const row of clients.clients || []) {
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

        for (const row of vehicles.vehicles || []) {
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

        for (const row of drivers.drivers || []) {
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

  const openAlerts = async () => {
    setPanel(panel === "alerts" ? "" : "alerts");

    if (panel === "alerts") return;

    try {
      const data = await api("/api/vehicle-documents?limit=100");
      const soon = (data.documents || []).filter((doc) => {
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
          {NAV.filter((item) => !item.admin || ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(user?.user_type)).map((item) => (
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
          </div>

          <div className={`online-pill${online ? "" : " off"}`}>
            <i className="dot" />
            {online ? "SYSTEM ONLINE" : "API OFFLINE"}
          </div>

          <div className="pop-anchor">
            <button className="icon-btn" type="button" aria-label="Notifications" onClick={openAlerts}>
              <Icon name="bell" />
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

          <div className="pop-anchor">
            <button
              className="icon-btn"
              type="button"
              aria-label="Account"
              onClick={() => setPanel(panel === "account" ? "" : "account")}
            >
              <Icon name="gear" />
            </button>
            {panel === "account" ? (
              <div className="popover">
                <h4>Account</h4>
                <p>{user?.name || "Signed in"}</p>
                <p className="muted">{user?.email}</p>
                <p className="muted">{user?.mobile || "No mobile"}</p>
                <p className="muted">{companyName}</p>
              </div>
            ) : null}
          </div>

          <div className="user-chip">
            <div>
              <strong>{user?.name || "User"}</strong>
              <small>{roleLabel(user?.user_type)}</small>
            </div>
            <span className="avatar">{initials(user?.name)}</span>
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
