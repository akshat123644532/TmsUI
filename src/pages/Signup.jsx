import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";

const empty = {
  name: "",
  mobile: "",
  email: "",
  company_id: "",
  password: "",
  confirm: "",
};

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/companies", { auth: false })
      .then((data) => {
        const rows = data.companies || [];
        setCompanies(rows);
        if (rows[0]) {
          setForm((current) => ({
            ...current,
            company_id: current.company_id || String(rows[0].id),
          }));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }

    setBusy(true);

    try {
      await signup({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        password: form.password,
        company_id: form.company_id,
      });
      navigate("/login", {
        replace: true,
        state: { notice: "Account created. Sign in with your email and password." },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-lockup login-brand">
          <span className="brand-mark">
            <Icon name="truck" size={20} />
          </span>
          <strong className="brand-name">
            TMS <span>Desk</span>
          </strong>
        </div>
        <h1>Create account</h1>
        <p className="page-sub">Join your company on the transport desk.</p>

        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={set("name")} placeholder="Your name" required />
        </label>
        <label className="field">
          <span>Mobile</span>
          <input value={form.mobile} onChange={set("mobile")} placeholder="9876543210" required />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Company</span>
          <select value={form.company_id} onChange={set("company_id")} required>
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder="At least 6 characters"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            value={form.confirm}
            onChange={set("confirm")}
            placeholder="Repeat password"
            required
            autoComplete="new-password"
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="btn btn-primary login-submit" type="submit" disabled={busy || companies.length === 0}>
          {busy ? "Creating account..." : "Create account"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
