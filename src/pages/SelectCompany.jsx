import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";
import { isSuperAdminRole } from "../lib";
import { useTheme } from "../theme";

export default function SelectCompany() {
  const { user, authed, company, selectCompany, loadCompanies, logout, needsCompanySelection } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");

    loadCompanies()
      .then((rows) => {
        if (!live) return;
        setCompanies(rows);
        if (!rows.length) setError("No active companies found for your account.");
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

  if (!authed) return <Navigate to="/login" replace />;
  if (!isSuperAdminRole(user?.user_type)) return <Navigate to="/" replace />;
  if (!needsCompanySelection && company?.id) return <Navigate to="/" replace />;

  const choose = (row) => {
    selectCompany(row);
    navigate("/", { replace: true });
  };

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
            <h1>Select company</h1>
            <p className="page-sub">Choose which company desk you want to open.</p>
          </div>

          {busy ? <p className="muted">Loading companies...</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          {!busy && !error ? (
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
          ) : null}

          <button className="btn btn-ghost login-submit" type="button" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
