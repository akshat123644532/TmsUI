import { useEffect, useState } from "react";
import { api, openApiFile, pickList } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Banner, Field, FormActions, FormLegend, StatusPill } from "../components/ui";
import { blankIssues, formatDate, hasIssues, roleLabel } from "../lib";
import { useToast } from "../toast";

export default function MobileProfile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError("");
    api(endpoints.mobileMe)
      .then((data) => {
        if (!live) return;
        setProfile(data.profile || null);
        setDocuments(pickList(data, "documents", "rows"));
      })
      .catch((err) => {
        if (!live) return;
        setLoadError(err.message || "Could not load profile");
        setProfile(null);
        setDocuments([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

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

  const display = profile || user || {};

  return (
    <section className="mobile-page stack">
      <div className="mobile-page-head">
        <h1>Profile</h1>
        <p className="page-sub">Your account and permitted documents.</p>
      </div>

      <Banner>{loadError}</Banner>
      {loading ? <p className="muted">Loading profile…</p> : null}

      <div className="mobile-detail-card">
        <div className="mobile-detail-row">
          <span>Name</span>
          <strong>{display.name || "—"}</strong>
        </div>
        <div className="mobile-detail-row">
          <span>Type</span>
          <strong>{roleLabel(display.user_type || user?.user_type)}</strong>
        </div>
        <div className="mobile-detail-row">
          <span>Mobile</span>
          <strong>{display.mobile || "—"}</strong>
        </div>
        <div className="mobile-detail-row">
          <span>Email</span>
          <strong>{display.email || "—"}</strong>
        </div>
        {display.license_number ? (
          <div className="mobile-detail-row">
            <span>License</span>
            <strong>{display.license_number}</strong>
          </div>
        ) : null}
        <div className="mobile-detail-row">
          <span>Last login</span>
          <strong>{formatDate(user?.last_login_at)}</strong>
        </div>
      </div>

      <div className="mobile-expense-panel">
        <h2>My documents</h2>
        {!loading && documents.length === 0 ? (
          <p className="muted">No documents shared with your account yet.</p>
        ) : (
          <ul className="mobile-trip-list">
            {documents.map((doc) => (
              <li key={doc.id || `${doc.document_type}-${doc.document_number}`}>
                <div className="mobile-trip-card">
                  <div>
                    <strong>{doc.document_type || "Document"}</strong>
                    <small>
                      {doc.document_number || "—"}
                      {doc.expiry_date ? ` · Exp ${formatDate(doc.expiry_date)}` : ""}
                    </small>
                  </div>
                  <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                    <StatusPill value={doc.verification_status || doc.status || "—"} />
                    {doc.document_url ? (
                      <button
                        type="button"
                        className="btn btn-ghost table-action"
                        onClick={() => openApiFile(doc.document_url).catch((err) => toast(err.message))}
                      >
                        Open
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
