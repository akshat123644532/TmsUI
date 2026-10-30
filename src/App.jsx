import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { ToastProvider } from "./toast";
import Shell from "./components/Shell";
import Login from "./pages/Login";
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

function Private() {
  const { authed } = useAuth();
  if (!authed) return <Navigate to="/login" replace />;
  return <Shell />;
}

function Guest({ children }) {
  const { authed } = useAuth();
  if (authed) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Guest><Login /></Guest>} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route element={<Private />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/loads" element={<Loads />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/settlements" element={<Settlements />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/outlook" element={<Navigate to="/routes?tab=board" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
