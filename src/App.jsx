import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Loads from "./pages/Loads";
import RoutesPage from "./pages/RoutesPage";
import Staff from "./pages/Staff";
import Documents from "./pages/Documents";
import Invoices from "./pages/Invoices";
import Clients from "./pages/Clients";
import Fleet from "./pages/Fleet";
import Outlook from "./pages/Outlook";

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
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Guest><Login /></Guest>} />
          <Route path="/signup" element={<Guest><Signup /></Guest>} />
          <Route element={<Private />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/loads" element={<Loads />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/outlook" element={<Outlook />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
