import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";
import { Field, FormActions, FormLegend } from "../components/ui";
import { blankIssues, hasIssues, initials, isMobileCrewRole, isSuperAdminRole } from "../lib";
import { useTheme } from "../theme";

function CreateCompanyForm({ onCreated, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [form, setForm] = useState({
    name: "",
    admin_name: "",
    admin_mobile: "",
    admin_email: "",
    admin_password: "",
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["name", form.name, "Enter company name"],
      ["admin_name", form.admin_name, "Enter admin name"],
      ["admin_mobile", form.admin_mobile, "Enter admin mobile"],
      ["admin_email", form.admin_email, "Enter admin email"],
      ["admin_password", form.admin_password, "Enter admin password"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      const data = await api(endpoints.companies, {
        method: "POST",
        body: {
          name: form.name.trim(),
          admin_name: form.admin_name.trim(),
          admin_mobile: form.admin_mobile.trim(),
          admin_email: form.admin_email.trim().toLowerCase(),
          admin_password: form.admin_password,
        },
      });
      onCreated(data.company || { id: data.id, name: form.name.trim() });
    } catch (err) {
      setError(err.message || "Could not create company");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="company-create-panel" noValidate>
      <div className="company-create-banner">
        <span className="company-create-icon">
          <Icon name="crm" size={18} />
        </span>
        <div>
          <strong>Create company</strong>
          <p>Adds the company and its first company admin in one step.</p>
        </div>
      </div>

      <FormLegend />
      <div className="form-grid">
        <Field label="Company name" required error={issues.name}>
          <input value={form.name} onChange={set("name")} placeholder="Acme Logistics" autoFocus />
        </Field>
        <Field label="Admin name" required error={issues.admin_name}>
          <input value={form.admin_name} onChange={set("admin_name")} placeholder="Company admin" />
        </Field>
        <Field label="Admin mobile" required error={issues.admin_mobile}>
          <input value={form.admin_mobile} onChange={set("admin_mobile")} placeholder="10-digit mobile" />
        </Field>
        <Field label="Admin email" required error={issues.admin_email}>
          <input type="email" value={form.admin_email} onChange={set("admin_email")} placeholder="admin@company.com" />
        </Field>
        <Field label="Admin password" required error={issues.admin_password} hint="Min 8 characters, letter + number">
          <input type="password" value={form.admin_password} onChange={set("admin_password")} autoComplete="new-password" />
        </Field>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <FormActions
        busy={busy}
        submitLabel={busy ? "Creating..." : "Create company"}
        onCancel={onCancel}
      />
    </form>
  );
}

export default function SelectCompany() {
  const { user, authed, company, selectCompany, loadCompanies, logout, needsCompanySelection } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const autoPicked = useRef(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return companies;
    return companies.filter((row) =>
      [row.name, String(row.id)].join(" ").toLowerCase().includes(needle)
    );
  }, [companies, search]);

  const reload = () => {
    setBusy(true);
    setError("");
    return loadCompanies()
      .then((rows) => {
        const active = (rows || []).filter((row) => Number(row.status ?? 1) === 1);
        setCompanies(active);
        if (!active.length) {
          setError("");
          setCreating(true);
        }
        return active;
      })
      .catch((err) => {
        setError(err.message || "Could not load companies");
        return [];
      })
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");

    loadCompanies()
      .then((rows) => {
        if (!live) return;
        const active = (rows || []).filter((row) => Number(row.status ?? 1) === 1);
        setCompanies(active);
        if (!active.length) setCreating(true);
      })
      .catch((err) => {
        if (!live) return;
        setError(err.message || "Could not load companies");
      })
      .finally(() => {
        if (live) setBusy(false);
      });

    return () => {
      live = false;
    };
  }, [loadCompanies]);

  const choose = async (row) => {
    setPicking(true);
    setActiveId(row.id);
    setError("");
    try {
      await selectCompany({ id: row.id, name: row.name });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Could not open company desk");
      autoPicked.current = false;
      setActiveId(null);
    } finally {
      setPicking(false);
    }
  };

  useEffect(() => {
    if (busy || creating || error || picking || autoPicked.current) return;
    if (companies.length !== 1 || !needsCompanySelection) return;
    autoPicked.current = true;
    choose(companies[0]);
  }, [busy, creating, error, picking, companies, needsCompanySelection]);

  if (!authed) return <Navigate to="/login" replace />;
  if (isMobileCrewRole(user?.user_type)) return <Navigate to="/mobile/trips" replace />;
  if (!isSuperAdminRole(user?.user_type)) return <Navigate to="/" replace />;
  if (!needsCompanySelection && company?.id) return <Navigate to="/" replace />;

  return (
    <div className="login-screen company-select-screen">
      <div className="login-card-wrap">
        <div className="login-card company-pick-card">
          <div className="login-card-top">
            <div className="brand-lockup">
              <span className="brand-mark">
                <Icon name="truck" size={16} />
              </span>
              <strong className="brand-name">
                TMS <span>Desk</span>
              </strong>
            </div>
            <div className="login-theme" role="group" aria-label="Theme">
              <button
                type="button"
                className={theme === "light" ? "active" : ""}
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
              >
                <Icon name="sun" size={15} />
                Light
              </button>
              <button
                type="button"
                className={theme === "dark" ? "active" : ""}
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                <Icon name="moon" size={15} />
                Dark
              </button>
            </div>
          </div>

          <div className="company-select-hero">
            <span className="company-select-avatar">{initials(user?.name || "SA")}</span>
            <div>
              <p className="company-select-kicker">System administrator</p>
              <h1>{creating ? "New company" : "Choose a company"}</h1>
              <p className="page-sub">
                {creating
                  ? "Create a company and its admin, then open the desk."
                  : `Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Open the desk for one active company.`}
              </p>
            </div>
          </div>

          {busy || picking ? (
            <div className="company-select-status">
              <span className="company-select-spinner" aria-hidden="true" />
              <p className="muted">{picking ? "Opening company desk..." : "Loading companies..."}</p>
            </div>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}

          {!busy && creating ? (
            <CreateCompanyForm
              onCancel={() => {
                if (companies.length) setCreating(false);
              }}
              onCreated={async (companyRow) => {
                setCreating(false);
                const rows = await reload();
                const match =
                  rows.find((row) => String(row.id) === String(companyRow?.id)) ||
                  companyRow;
                if (match?.id) await choose(match);
              }}
            />
          ) : null}

          {!busy && !creating && !picking ? (
            <>
              <div className="company-select-toolbar">
                <div className="company-select-search">
                  <Icon name="search" size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search companies"
                    aria-label="Search companies"
                  />
                </div>
                <span className="company-select-count">
                  {filtered.length} of {companies.length}
                </span>
              </div>

              <div className="company-pick-list">
                {filtered.map((row) => {
                  const selected = String(activeId) === String(row.id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={`company-pick-item${selected ? " active" : ""}`}
                      onClick={() => choose(row)}
                      disabled={picking}
                    >
                      <span className="company-pick-mark">{initials(row.name)}</span>
                      <span className="company-pick-copy">
                        <strong>{row.name}</strong>
                        <small>ID {row.id} · Active</small>
                      </span>
                      <span className="company-pick-cta">
                        Open desk
                        <Icon name="check" size={14} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {!companies.length ? (
                <p className="muted company-select-empty">No active companies yet. Create one to continue.</p>
              ) : null}
              {companies.length && !filtered.length ? (
                <p className="muted company-select-empty">No companies match “{search.trim()}”.</p>
              ) : null}

              <div className="company-select-actions">
                <button
                  className="btn btn-primary login-submit"
                  type="button"
                  onClick={() => setCreating(true)}
                >
                  New company
                </button>
                <button className="btn btn-ghost login-submit" type="button" onClick={() => logout()}>
                  Sign out
                </button>
              </div>
            </>
          ) : null}

          {(busy || picking || creating) ? (
            <button className="btn btn-ghost login-submit" type="button" onClick={() => logout()}>
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
