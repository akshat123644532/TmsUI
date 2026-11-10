import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";
import { isSuperAdminRole } from "../lib";
import { useTheme } from "../theme";

export default function Login() {
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.notice || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = {};
    if (!email.trim()) nextIssues.email = "Enter your email";
    if (!password) nextIssues.password = "Enter your password";
    setIssues(nextIssues);
    if (nextIssues.email || nextIssues.password) return;

    setBusy(true);
    setError("");

    try {
      const nextUser = await login(email.trim(), password);
      if (isSuperAdminRole(nextUser?.user_type)) {
        navigate("/select-company", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card-wrap">
        <form className="login-card" onSubmit={submit} noValidate>
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
            <h1>Sign in</h1>
            <p className="page-sub">Transport operations for your company.</p>
          </div>

          <div className="login-demo">
            <span>Demo</span>
            <code>admin@tms.com</code>
            <code>123456</code>
          </div>

          <label className={`field${issues.email ? " invalid" : ""}`}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setIssues((current) => ({ ...current, email: "" }));
              }}
              placeholder="you@company.com"
              autoComplete="username"
            />
            {issues.email ? <small className="field-error">{issues.email}</small> : null}
          </label>

          <label className={`field${issues.password ? " invalid" : ""}`}>
            <span>Password</span>
            <div className="login-password">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setIssues((current) => ({ ...current, password: "" }));
                }}
                placeholder="Password"
                autoComplete="current-password"
              />
              <button
                className="login-password-toggle"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {issues.password ? <small className="field-error">{issues.password}</small> : null}
          </label>

          {notice ? <p className="form-notice">{notice}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
