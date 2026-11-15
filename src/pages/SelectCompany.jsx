import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";
import { Field, FormActions, FormLegend } from "../components/ui";
import { blankIssues, hasIssues, isSuperAdminRole } from "../lib";
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
    <form onSubmit={submit} className="form-grid company-create-form" noValidate>
      <FormLegend />
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
      {error ? <p className="form-error span-2">{error}</p> : null}
      <div className="span-2">
        <FormActions
          busy={busy}
          submitLabel={busy ? "Creating..." : "Create company"}
          onCancel={onCancel}
        />
      </div>
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
  const autoPicked = useRef(false);

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

  const choose = (row) => {
    selectCompany({ id: row.id, name: row.name });
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (busy || creating || error || autoPicked.current) return;
    if (companies.length !== 1 || !needsCompanySelection) return;
    autoPicked.current = true;
    const only = companies[0];
    selectCompany({ id: only.id, name: only.name });
    navigate("/", { replace: true });
  }, [busy, creating, error, companies, needsCompanySelection, selectCompany, navigate]);

  if (!authed) return <Navigate to="/login" replace />;
  if (!isSuperAdminRole(user?.user_type)) return <Navigate to="/" replace />;
  if (!needsCompanySelection && company?.id) return <Navigate to="/" replace />;

  return (
    <div className="login-screen">
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

          <div className="login-card-head">
            <h1>{creating ? "New company" : "Select company"}</h1>
            <p className="page-sub">
              {creating
                ? "Create a company and its admin, then open the desk."
                : "Choose which company desk you want to open."}
            </p>
          </div>

          {busy ? <p className="muted">Loading companies...</p> : null}
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
                if (match?.id) choose(match);
              }}
            />
          ) : null}

          {!busy && !creating ? (
            <>
              <div className="company-pick-list">
                {companies.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="company-pick-item"
                    onClick={() => choose(row)}
                  >
                    <span className="company-pick-mark">
                      <Icon name="crm" size={18} />
                    </span>
                    <span className="company-pick-copy">
                      <strong>{row.name}</strong>
                      <small>Company ID {row.id}</small>
                    </span>
                    <Icon name="check" size={16} />
                  </button>
                ))}
              </div>

              {!companies.length ? (
                <p className="muted">No active companies yet. Create one to continue.</p>
              ) : null}

              <button
                className="btn btn-primary login-submit"
                type="button"
                onClick={() => setCreating(true)}
              >
                New company
              </button>
            </>
          ) : null}

          <button className="btn btn-ghost login-submit" type="button" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
