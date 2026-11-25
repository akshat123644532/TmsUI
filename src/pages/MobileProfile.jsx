import { useState } from "react";
import { api } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Banner, Field, FormActions, FormLegend } from "../components/ui";
import { blankIssues, formatDate, hasIssues, roleLabel } from "../lib";
import { useToast } from "../toast";

export default function MobileProfile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["current_password", form.current_password, "Enter current password"],
      ["new_password", form.new_password, "Enter a new password"],
      ["confirm", form.confirm, "Confirm the new password"],
    ]);
    if (
      !nextIssues.new_password &&
      (form.new_password.length < 8 || !/[A-Za-z]/.test(form.new_password) || !/[0-9]/.test(form.new_password))
    ) {
      nextIssues.new_password = "Use 8+ characters with a letter and a number";
    }
    if (!nextIssues.confirm && form.new_password !== form.confirm) {
      nextIssues.confirm = "Passwords do not match";
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      await api(endpoints.passwordChange, {
        method: "POST",
        body: {
          current_password: form.current_password,
          new_password: form.new_password,
        },
      });
      setForm({ current_password: "", new_password: "", confirm: "" });
      setShowPassword(false);
      toast("Password updated");
      refreshUser().catch(() => {});
    } catch (err) {
      setError(err.message || "Could not change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mobile-page stack">
      <div className="mobile-page-head">
        <h1>Profile</h1>
        <p className="page-sub">Your field account.</p>
      </div>

      <div className="mobile-detail-card">
        <div className="mobile-detail-row">
          <span>Name</span>
          <strong>{user?.name || "—"}</strong>
        </div>
        <div className="mobile-detail-row">
          <span>Type</span>
          <strong>{roleLabel(user?.user_type)}</strong>
        </div>
        <div className="mobile-detail-row">
          <span>Mobile</span>
          <strong>{user?.mobile || "—"}</strong>
        </div>
        <div className="mobile-detail-row">
          <span>Email</span>
          <strong>{user?.email || "—"}</strong>
        </div>
        <div className="mobile-detail-row">
          <span>Last login</span>
          <strong>{formatDate(user?.last_login_at)}</strong>
        </div>
      </div>

      <p className="muted">
        Personal documents (DL, Aadhaar, PAN) are held by office. Contact admin for copies.
      </p>

      {!showPassword ? (
        <button type="button" className="btn btn-primary" onClick={() => setShowPassword(true)}>
          Change password
        </button>
      ) : (
        <form onSubmit={changePassword} className="form-grid mobile-expense-form" noValidate>
          <FormLegend />
          <Banner>{error}</Banner>
          <Field label="Current password" required error={issues.current_password} className="span-2">
            <input type="password" value={form.current_password} onChange={set("current_password")} autoComplete="current-password" />
          </Field>
          <Field label="New password" required error={issues.new_password} className="span-2" hint="Min 8 characters, letter + number">
            <input type="password" value={form.new_password} onChange={set("new_password")} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required error={issues.confirm} className="span-2">
            <input type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
          </Field>
          <FormActions onCancel={() => setShowPassword(false)} busy={busy} submitLabel="Update password" />
        </form>
      )}
    </section>
  );
}
