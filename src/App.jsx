import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { ThemeProvider } from "./theme";
import { ToastProvider } from "./toast";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import FieldLogin from "./pages/FieldLogin";
import ForgotPassword from "./pages/ForgotPassword";
import SelectCompany from "./pages/SelectCompany";
import Companies from "./pages/Companies";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Loads from "./pages/Loads";
import RoutesPage from "./pages/RoutesPage";
import Staff from "./pages/Staff";
import Documents from "./pages/Documents";
import Invoices from "./pages/Invoices";
import Clients from "./pages/Clients";
import Fleet from "./pages/Fleet";
import Expenses from "./pages/Expenses";
import Settlements from "./pages/Settlements";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Access from "./pages/Access";
import Audit from "./pages/Audit";
import { MobileTripDetail, MobileTripsList } from "./pages/MobileTrips";
import MobileVehicle from "./pages/MobileVehicle";
import MobileProfile from "./pages/MobileProfile";
import { Banner, PageHeader } from "./components/ui";
import { homePathForUser, isCrewAllowedPath, isMobileCrewRole } from "./lib";

function Guest({ children }) {
  const { authed, needsCompanySelection, user } = useAuth();
  if (authed && needsCompanySelection) return <Navigate to="/select-company" replace />;
  if (authed && isMobileCrewRole(user?.user_type)) return <Navigate to="/routes" replace />;
  if (authed) return <Navigate to="/" replace />;
  return children;
}

/** Shared Desk shell; Driver/Helper see filtered modules only. */
function PrivateApp() {
  const { authed, needsCompanySelection, missingCompany, user } = useAuth();
  if (!authed) return <Navigate to="/login" replace />;
  if (!isMobileCrewRole(user?.user_type) && needsCompanySelection) {
    return <Navigate to="/select-company" replace />;
  }
  if (!isMobileCrewRole(user?.user_type) && missingCompany) {
    return (
      <section className="login-screen">
        <div className="login-card-wrap">
          <div className="login-card">
            <PageHeader title="Company missing" subtitle="Your account has no company assigned." />
            <Banner>Ask a system administrator to assign you to an active company.</Banner>
          </div>
        </div>
      </section>
    );
  }
  return <Shell />;
}

/** Block desk-only pages for Driver/Helper; keep same Shell chrome. */
function DeskOnly({ children }) {
  const { user } = useAuth();
  if (isMobileCrewRole(user?.user_type)) {
    return (
      <Navigate
        to="/routes"
        replace
        state={{ notice: "Admin modules not available for Driver/Helper" }}
      />
    );
  }
  return children;
}

function CrewHome() {
  return <Navigate to="/routes" replace />;
}

function TripsGate() {
  const { user } = useAuth();
  if (isMobileCrewRole(user?.user_type)) return <MobileTripsList />;
  return <RoutesPage />;
}

function TripDetailGate() {
  const { user } = useAuth();
  if (isMobileCrewRole(user?.user_type)) return <MobileTripDetail />;
  return <Navigate to="/routes" replace />;
}

function FleetGate() {
  const { user } = useAuth();
  if (isMobileCrewRole(user?.user_type)) return <MobileVehicle />;
  return <Fleet />;
}

function CatchAll() {
  const { authed, user } = useAuth();
  const location = useLocation();
  if (!authed) return <Navigate to="/login" replace />;
  if (isMobileCrewRole(user?.user_type) && !isCrewAllowedPath(location.pathname)) {
    return <Navigate to="/routes" replace />;
  }
  return <Navigate to={homePathForUser(user?.user_type)} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Guest><Login /></Guest>} />
              <Route path="/field" element={<Guest><FieldLogin /></Guest>} />
              <Route path="/forgot-password" element={<Guest><ForgotPassword /></Guest>} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/select-company" element={<SelectCompany />} />

              <Route element={<PrivateApp />}>
                <Route path="/" element={<DeskOnly><Dashboard /></DeskOnly>} />
                <Route path="/companies" element={<DeskOnly><Companies /></DeskOnly>} />
                <Route path="/users" element={<DeskOnly><Users /></DeskOnly>} />
                <Route path="/access" element={<DeskOnly><Access /></DeskOnly>} />
                <Route path="/audit" element={<DeskOnly><Audit /></DeskOnly>} />
                <Route path="/fleet" element={<FleetGate />} />
                <Route path="/staff" element={<DeskOnly><Staff /></DeskOnly>} />
                <Route path="/loads" element={<DeskOnly><Loads /></DeskOnly>} />
                <Route path="/routes" element={<TripsGate />} />
                <Route path="/routes/:id" element={<TripDetailGate />} />
                <Route path="/profile" element={<MobileProfile />} />
                <Route path="/expenses" element={<DeskOnly><Expenses /></DeskOnly>} />
                <Route path="/settlements" element={<DeskOnly><Settlements /></DeskOnly>} />
                <Route path="/clients" element={<DeskOnly><Clients /></DeskOnly>} />
                <Route path="/invoices" element={<DeskOnly><Invoices /></DeskOnly>} />
                <Route path="/payments" element={<DeskOnly><Payments /></DeskOnly>} />
                <Route path="/reports" element={<DeskOnly><Reports /></DeskOnly>} />
                <Route path="/documents" element={<DeskOnly><Documents /></DeskOnly>} />
                <Route path="/outlook" element={<DeskOnly><Navigate to="/routes?tab=board" replace /></DeskOnly>} />

                {/* Legacy field URLs → same Shell modules */}
                <Route path="/mobile" element={<CrewHome />} />
                <Route path="/mobile/trips" element={<Navigate to="/routes" replace />} />
                <Route path="/mobile/trips/:id" element={<TripDetailGate />} />
                <Route path="/mobile/vehicle" element={<Navigate to="/fleet" replace />} />
                <Route path="/mobile/profile" element={<Navigate to="/profile" replace />} />
              </Route>

              <Route path="*" element={<CatchAll />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
