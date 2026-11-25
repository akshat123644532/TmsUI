import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";
import { homePathForUser, isMobileCrewRole } from "../lib";

export default function ForgotPassword() {
  const { authed, user } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);

  if (authed) {
    return <Navigate to={isMobileCrewRole(user?.user_type) ? "/mobile/trips" : homePathForUser(user?.user_type)} replace />;
  }

  const digits = mobile.replace(/\D/g, "").slice(-10);

  const sendOtp = async () => {
    if (digits.length !== 10) {
      setIssues({ mobile: "Enter a valid 10-digit mobile" });
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const data = await api(endpoints.passwordForgot, {
        method: "POST",
        auth: false,
        body: { mobile: digits },
      });
      setOtpSent(true);
      setInfo(data?.message || "If this mobile is registered, an OTP has been sent");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = {};
    if (digits.length !== 10) nextIssues.mobile = "Enter a valid 10-digit mobile";
    if (!/^\d{6}$/.test(otp.trim())) nextIssues.otp = "Enter the 6-digit OTP";
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      nextIssues.password = "Use 8+ characters with a letter and a number";
    }
    if (password !== confirm) nextIssues.confirm = "Passwords do not match";
    setIssues(nextIssues);
    if (Object.keys(nextIssues).length) return;

    setBusy(true);
    setError("");
    try {
      await api(endpoints.passwordReset, {
        method: "POST",
        auth: false,
        body: { mobile: digits, otp: otp.trim(), new_password: password },
      });
      navigate("/login", { replace: true, state: { notice: "Password reset. Please sign in." } });
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
                TMS <span>Field</span>
              </strong>
            </div>
          </div>
          <div className="login-card-head">
            <h1>Forgot password</h1>
            <p className="page-sub">Driver/Helper: verify mobile OTP, then set a new password.</p>
          </div>

          <label className={`field${issues.mobile ? " invalid" : ""}`}>
            <span>Mobile</span>
            <input
              value={mobile}
              onChange={(event) => {
                setMobile(event.target.value);
                setIssues((current) => ({ ...current, mobile: "" }));
              }}
              placeholder="9876543210"
              inputMode="tel"
            />
            {issues.mobile ? <small className="field-error">{issues.mobile}</small> : null}
          </label>

          <div className="login-otp-row">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={sendOtp}>
              {otpSent ? "Resend OTP" : "Send OTP"}
            </button>
          </div>

          <label className={`field${issues.otp ? " invalid" : ""}`}>
            <span>OTP</span>
            <input
              value={otp}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                setIssues((current) => ({ ...current, otp: "" }));
              }}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
            />
            {issues.otp ? <small className="field-error">{issues.otp}</small> : null}
          </label>

          <label className={`field${issues.password ? " invalid" : ""}`}>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setIssues((current) => ({ ...current, password: "" }));
              }}
              autoComplete="new-password"
            />
            {issues.password ? <small className="field-error">{issues.password}</small> : null}
          </label>

          <label className={`field${issues.confirm ? " invalid" : ""}`}>
            <span>Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                setIssues((current) => ({ ...current, confirm: "" }));
              }}
              autoComplete="new-password"
            />
            {issues.confirm ? <small className="field-error">{issues.confirm}</small> : null}
          </label>

          {info ? <p className="form-notice">{info}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Reset password"}
          </button>
          <p className="login-footer-link">
            <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
