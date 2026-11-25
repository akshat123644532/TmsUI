import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";
import { isMobileCrewRole } from "../lib";
import { useTheme } from "../theme";

export default function FieldLogin() {
  const { login, loginWithOtp, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.notice || "";
  const [mode, setMode] = useState("password");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);

  const digits = mobile.replace(/\D/g, "").slice(-10);

  const finishCrewLogin = async (nextUser) => {
    if (!isMobileCrewRole(nextUser?.user_type)) {
      await logout();
      setError("This login is for Driver / Helper only. Use Desk sign-in for office accounts.");
      return;
    }
    navigate("/mobile/trips", { replace: true });
  };

  const requestOtp = async () => {
    if (digits.length !== 10) {
      setIssues({ mobile: "Enter a valid 10-digit mobile" });
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const data = await api(endpoints.otpRequest, {
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
    if (mode === "password" && !password) nextIssues.password = "Enter your password";
    if (mode === "otp" && !/^\d{6}$/.test(otp.trim())) nextIssues.otp = "Enter the 6-digit OTP";
    setIssues(nextIssues);
    if (Object.keys(nextIssues).length) return;

    setBusy(true);
    setError("");
    setInfo("");
    try {
      const nextUser =
        mode === "otp"
          ? await loginWithOtp(digits, otp.trim())
          : await login(digits, password);
      await finishCrewLogin(nextUser);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen field-login-screen">
      <div className="login-card-wrap">
        <form className="login-card field-login-card" onSubmit={submit} noValidate>
          <div className="login-card-top">
            <div className="brand-lockup">
              <span className="brand-mark">
                <Icon name="truck" size={16} />
              </span>
              <strong className="brand-name">
                TMS <span>Field</span>
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
            <h1>Driver / Helper</h1>
            <p className="page-sub">Sign in with your registered mobile to see assigned trips.</p>
          </div>

          <div className="login-mode-tabs" role="tablist" aria-label="Sign in method">
            <button
              type="button"
              className={mode === "password" ? "active" : ""}
              onClick={() => { setMode("password"); setError(""); setInfo(""); }}
            >
              Password
            </button>
            <button
              type="button"
              className={mode === "otp" ? "active" : ""}
              onClick={() => { setMode("otp"); setError(""); setInfo(""); }}
            >
              OTP
            </button>
          </div>

          <label className={`field${issues.mobile ? " invalid" : ""}`}>
            <span>Mobile number</span>
            <input
              type="tel"
              inputMode="tel"
              value={mobile}
              onChange={(event) => {
                setMobile(event.target.value);
                setIssues((current) => ({ ...current, mobile: "" }));
              }}
              placeholder="9876543210"
              autoComplete="username"
            />
            {issues.mobile ? <small className="field-error">{issues.mobile}</small> : null}
          </label>

          {mode === "password" ? (
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
          ) : (
            <>
              <div className="login-otp-row">
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={requestOtp}>
                  {otpSent ? "Resend OTP" : "Send OTP"}
                </button>
              </div>
              <label className={`field${issues.otp ? " invalid" : ""}`}>
                <span>OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setIssues((current) => ({ ...current, otp: "" }));
                  }}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                />
                {issues.otp ? <small className="field-error">{issues.otp}</small> : null}
              </label>
            </>
          )}

          {notice ? <p className="form-notice">{notice}</p> : null}
          {info ? <p className="form-notice">{info}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Continue"}
          </button>

          <p className="login-footer-link">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          <p className="login-footer-link">
            <Link to="/login">Office / Admin Desk sign-in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
