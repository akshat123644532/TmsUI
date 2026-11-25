import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { roleLabel } from "../lib";
import { Icon } from "./Icons";

export default function MobileShell() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    refreshUser().catch(() => {});
  }, []);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="mobile-shell">
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <span className="brand-mark">
            <Icon name="truck" size={16} />
          </span>
          <div>
            <strong className="brand-name">
              TMS <span>Field</span>
            </strong>
            <small>{roleLabel(user?.user_type)} · {user?.name || "Crew"}</small>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          Logout
        </button>
      </header>
      <main className="mobile-main">
        <Outlet />
      </main>
    </div>
  );
}
