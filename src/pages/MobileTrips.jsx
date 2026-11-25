import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, pickList } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Banner, Field, FormActions, FormLegend, Select, StatusPill } from "../components/ui";
import {
  blankIssues,
  EXPENSE_TYPES,
  formatDate,
  hasIssues,
  isDriverRole,
  money,
  num,
  tripLabel,
} from "../lib";
import { useToast } from "../toast";

/** Hardcoded BRD defaults matching backend seed codes (no desk types ACL). */
const DEFAULT_EXPENSE_TYPES = EXPENSE_TYPES.map((code) => ({
  code,
  name: code.charAt(0) + code.slice(1).toLowerCase(),
}));

function tripTitle(trip) {
  if (!trip) return "Trip";
  const route = [trip.source, trip.destination].filter(Boolean).join(" → ");
  if (route) return route;
  return tripLabel(trip) || `Trip #${trip.id}`;
}

function parseTrips(data) {
  return pickList(data, "trips", "mobileTrips", "mobile_trips", "rows");
}

function parseTrip(data, id) {
  const nested = data?.trip || data?.mobileTrip || data?.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested;
  if (data && typeof data === "object" && data.id) return data;
  return { id: Number(id) || id };
}

export function MobileTripsList() {
  const location = useLocation();
  const notice = location.state?.notice || "";
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api(endpoints.mobileTrips)
      .then((data) => {
        if (!live) return;
        setTrips(parseTrips(data));
      })
      .catch((err) => {
        if (!live) return;
        setError(err.message || "Could not load trips");
        setTrips([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="mobile-page stack">
      <div className="mobile-page-head">
        <h1>My Trips</h1>
        <p className="page-sub">Assigned trips only.</p>
      </div>
      {notice ? <Banner>{notice}</Banner> : null}
      <Banner>{error}</Banner>
      {loading ? (
        <p className="muted">Loading trips…</p>
      ) : trips.length === 0 ? (
        <div className="mobile-empty">
          <strong>No trips assigned yet</strong>
          <p className="muted">When a trip is assigned to you, it will show up here.</p>
        </div>
      ) : (
        <ul className="mobile-trip-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link className="mobile-trip-card" to={`/mobile/trips/${trip.id}`}>
                <div>
                  <strong>{tripTitle(trip)}</strong>
                  <small>
                    {formatDate(trip.start_date)}
                    {trip.end_date ? ` · ${formatDate(trip.end_date)}` : ""}
                  </small>
                </div>
                <StatusPill value={trip.status || "—"} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DriverExpenseForm({ tripId, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    expense_type: DEFAULT_EXPENSE_TYPES[0].code,
    requested_amount: "",
    remarks: "",
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["expense_type", form.expense_type, "Select expense type"],
      ["requested_amount", form.requested_amount, "Enter the amount"],
    ]);
    if (!nextIssues.requested_amount && num(form.requested_amount) <= 0) {
      nextIssues.requested_amount = "Enter an amount greater than 0";
    }
    if (!file) nextIssues.file = "Receipt photo is required";
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("trip_id", String(tripId));
      fd.append("expense_type", form.expense_type);
      fd.append("requested_amount", String(num(form.requested_amount)));
      if (form.remarks.trim()) fd.append("remarks", form.remarks.trim());
      fd.append("file", file);
      await api(endpoints.mobileExpenses, { method: "POST", formData: fd });
      onCreated();
    } catch (err) {
      setError(err.message || "Could not submit expense");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid mobile-expense-form" noValidate>
      <FormLegend />
      <p className="form-hint span-2">Receipt photo required (camera or gallery).</p>
      <Field label="Expense type" required error={issues.expense_type}>
        <Select value={form.expense_type} onChange={set("expense_type")}>
          {DEFAULT_EXPENSE_TYPES.map((row) => (
            <option key={row.code} value={row.code}>{row.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" required error={issues.requested_amount}>
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={form.requested_amount}
          onChange={set("requested_amount")}
        />
      </Field>
      <Field label="Receipt photo" required error={issues.file} className="span-2" hint="Camera / gallery">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setIssues((current) => ({ ...current, file: "" }));
          }}
        />
      </Field>
      {file ? (
        <p className="form-hint span-2">{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</p>
      ) : null}
      <Field label="Remarks" className="span-2">
        <input value={form.remarks} onChange={set("remarks")} placeholder="Optional" />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions
        onCancel={onClose}
        busy={busy}
        submitLabel="Submit expense"
        submitDisabled={!file || busy}
      />
    </form>
  );
}

export function MobileTripDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const driver = isDriverRole(user?.user_type);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const data = await api(endpoints.mobileTrip(id));
      setTrip(parseTrip(data, id));
    } catch (err) {
      const message = String(err?.message || "");
      if (/\b403\b|forbidden|not assigned|not allowed/i.test(message)) {
        setForbidden(true);
        setError("This trip is not assigned to you.");
      } else {
        setError(message || "Could not load trip");
      }
      setTrip(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  return (
    <section className="mobile-page stack">
      <div className="mobile-page-head">
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/mobile/trips")}>
          ← My Trips
        </button>
        <h1>{loading ? "Trip" : tripTitle(trip) || `Trip #${id}`}</h1>
      </div>

      <Banner>{error}</Banner>

      {loading ? <p className="muted">Loading trip…</p> : null}

      {forbidden ? (
        <div className="mobile-empty">
          <strong>Trip not available</strong>
          <p className="muted">You can only open trips assigned to you.</p>
          <Link className="btn btn-primary" to="/mobile/trips">Back to My Trips</Link>
        </div>
      ) : null}

      {!loading && trip && !forbidden ? (
        <>
          <div className="mobile-detail-card">
            <div className="mobile-detail-row">
              <span>Status</span>
              <StatusPill value={trip.status || "—"} />
            </div>
            <div className="mobile-detail-row">
              <span>Start</span>
              <strong>{formatDate(trip.start_date)}</strong>
            </div>
            <div className="mobile-detail-row">
              <span>End</span>
              <strong>{formatDate(trip.end_date)}</strong>
            </div>
            <div className="mobile-detail-row">
              <span>Vehicle</span>
              <strong>{trip.vehicle_name || trip.registration_no || trip.vehicle_id || "—"}</strong>
            </div>
            <div className="mobile-detail-row">
              <span>Client</span>
              <strong>{trip.client_name || trip.client_id || "—"}</strong>
            </div>
            {trip.freight_amount != null ? (
              <div className="mobile-detail-row">
                <span>Freight</span>
                <strong>{money(trip.freight_amount)}</strong>
              </div>
            ) : null}
          </div>

          {driver ? (
            showExpense ? (
              <div className="mobile-expense-panel">
                <h2>Submit expense</h2>
                <DriverExpenseForm
                  tripId={trip.id}
                  onClose={() => setShowExpense(false)}
                  onCreated={() => {
                    setShowExpense(false);
                    toast("Expense submitted");
                  }}
                />
              </div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setShowExpense(true)}>
                Submit expense
              </button>
            )
          ) : (
            <p className="muted">Helpers can view assigned trips. Expense submit is for drivers only.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
