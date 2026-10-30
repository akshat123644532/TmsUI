import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.notice || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="brand-lockup login-brand">
          <span className="brand-mark">
            <Icon name="truck" size={20} />
          </span>
          <strong className="brand-name">
            TMS <span>Desk</span>
          </strong>
        </div>
        <h1>Sign in</h1>
        <p className="page-sub">Transport operations for your company.</p>
        <p className="form-hint">Demo login: admin@tms.com / 123456</p>

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
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setIssues((current) => ({ ...current, password: "" }));
            }}
            placeholder="Password"
            autoComplete="current-password"
          />
          {issues.password ? <small className="field-error">{issues.password}</small> : null}
        </label>

        {notice ? <p className="form-notice">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
