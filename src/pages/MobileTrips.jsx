import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, openApiFile, pickList } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Banner, Field, FormActions, FormLegend, Select, StatusPill, Tabs } from "../components/ui";
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

const FALLBACK_TYPES = EXPENSE_TYPES.map((code) => ({
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

function typeValue(row) {
  return row.code || row.name || String(row.id);
}

function typeLabel(row) {
  return row.name || row.code || `#${row.id}`;
}

export function MobileTripsList() {
  const location = useLocation();
  const notice = location.state?.notice || "";
  const [tab, setTab] = useState("current");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const scope = tab === "history" ? "history" : "current";
    api(`${endpoints.mobileTrips}?scope=${scope}&limit=100`)
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
  }, [tab]);

  return (
    <section className="mobile-page stack">
      <div className="mobile-page-head">
        <h1>My Trips</h1>
        <p className="page-sub">Assigned trips only.</p>
      </div>
      {notice ? <Banner>{notice}</Banner> : null}
      <Banner>{error}</Banner>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "current", label: "Current" },
          { id: "history", label: "History" },
        ]}
      />
      {loading ? (
        <p className="muted">Loading trips…</p>
      ) : trips.length === 0 ? (
        <div className="mobile-empty">
          <strong>{tab === "history" ? "No trip history yet" : "No trips assigned yet"}</strong>
          <p className="muted">
            {tab === "history"
              ? "Completed trips will appear here."
              : "When a trip is assigned to you, it will show up here."}
          </p>
        </div>
      ) : (
        <ul className="mobile-trip-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link className="mobile-trip-card" to={`/routes/${trip.id}`}>
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

function DriverExpenseForm({ tripId, types, onClose, onCreated }) {
  const options = types.length ? types : FALLBACK_TYPES;
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    expense_type: typeValue(options[0]),
    requested_amount: "",
    remarks: "",
  });

  useEffect(() => {
    if (!form.expense_type && options[0]) {
      setForm((current) => ({ ...current, expense_type: typeValue(options[0]) }));
    }
  }, [options]);

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
      onCreated({
        expense_type: form.expense_type,
        requested_amount: num(form.requested_amount),
        remarks: form.remarks.trim() || "",
        status: "SUBMITTED",
      });
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
          {options.map((row) => (
            <option key={row.id || typeValue(row)} value={typeValue(row)}>{typeLabel(row)}</option>
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
          accept="image/*,.pdf,application/pdf"
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
  const [panel, setPanel] = useState("overview");
  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [settlements, setSettlements] = useState([]);
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
      const next = parseTrip(data, id);
      setTrip(next);

      const nestedSettlements = Array.isArray(next.settlements) ? next.settlements : [];
      setSettlements(nestedSettlements);

      if (driver) {
        const [expenseData, typeData, settlementData] = await Promise.all([
          api(`${endpoints.mobileExpenses}?trip_id=${id}&limit=100`).catch(() => ({ expenses: [] })),
          api(endpoints.mobileExpenseTypes).catch(() => ({ expenseTypes: [] })),
          nestedSettlements.length
            ? Promise.resolve({ settlements: nestedSettlements })
            : api(endpoints.mobileTripSettlement(id)).catch(() => ({ settlements: [] })),
        ]);
        setExpenses(pickList(expenseData, "expenses", "tripExpenses", "rows"));
        setExpenseTypes(
          pickList(typeData, "expenseTypes", "expense_types", "types", "rows")
            .filter((row) => row && Number(row.status ?? 1) !== 0)
        );
        setSettlements(pickList(settlementData, "settlements", "rows"));
      } else {
        setExpenses([]);
        setExpenseTypes([]);
      }
    } catch (err) {
      const message = String(err?.message || "");
      if (/\b403\b|forbidden|not assigned|not allowed/i.test(message)) {
        setForbidden(true);
        setError("This trip is not assigned to you.");
      } else {
        setError(message || "Could not load trip");
      }
      setTrip(null);
      setExpenses([]);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const tripDocs = Array.isArray(trip?.trip_documents) ? trip.trip_documents : [];
  const biltySummaries = Array.isArray(trip?.bilty_summaries)
    ? trip.bilty_summaries
    : Array.isArray(trip?.bilties)
      ? trip.bilties
      : [];
  const settlement = settlements[0] || null;

  return (
    <section className="mobile-page stack">
      <div className="mobile-page-head">
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/routes")}>
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
          <Link className="btn btn-primary" to="/routes">Back to My Trips</Link>
        </div>
      ) : null}

      {!loading && trip && !forbidden ? (
        <>
          <Tabs
            value={panel}
            onChange={setPanel}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "docs", label: "Documents" },
              { id: "expenses", label: "Expenses" },
              { id: "settlement", label: "Settlement" },
            ]}
          />

          {panel === "overview" ? (
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
              <div className="mobile-detail-row">
                <span>Bilty</span>
                <strong>
                  {biltySummaries.length
                    ? biltySummaries.map((b) => b.bilty_number || b.bilty_id).filter(Boolean).join(", ")
                    : (trip.bilty_number || trip.bilty_id || "—")}
                </strong>
              </div>
            </div>
          ) : null}

          {panel === "docs" ? (
            <div className="stack">
              <div className="mobile-expense-panel">
                <h2>Trip documents</h2>
                {tripDocs.length === 0 ? (
                  <p className="muted">No trip documents uploaded yet.</p>
                ) : (
                  <ul className="mobile-trip-list">
                    {tripDocs.map((doc) => (
                      <li key={doc.id || doc.document_url}>
                        <div className="mobile-trip-card">
                          <div>
                            <strong>{doc.document_type || "Document"}</strong>
                            <small>{doc.remarks || formatDate(doc.created_at)}</small>
                          </div>
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mobile-expense-panel">
                <h2>Bilty / LR</h2>
                {biltySummaries.length === 0 ? (
                  <p className="muted">No bilty linked to this trip.</p>
                ) : (
                  <ul className="mobile-trip-list">
                    {biltySummaries.map((row) => (
                      <li key={row.bilty_id || row.bilty_number}>
                        <div className="mobile-trip-card">
                          <div>
                            <strong>{row.bilty_number || `Bilty #${row.bilty_id}`}</strong>
                            <small>
                              {[row.consignor, row.consignee].filter(Boolean).join(" → ")
                                || [row.route?.from || row.pickup_location, row.route?.to || row.drop_location].filter(Boolean).join(" → ")
                                || "—"}
                            </small>
                          </div>
                          <StatusPill value={row.status || row.bilty_status || "—"} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {panel === "expenses" ? (
            <div className="stack">
              {driver ? (
                expenses.length ? (
                  <ul className="mobile-trip-list">
                    {expenses.map((row) => (
                      <li key={row.id || `${row.expense_type}-${row.requested_amount}`}>
                        <div className="mobile-trip-card">
                          <div>
                            <strong>{row.expense_type || "Expense"}</strong>
                            <small>
                              {money(row.requested_amount ?? row.approved_amount ?? 0)}
                              {row.remarks ? ` · ${row.remarks}` : ""}
                            </small>
                          </div>
                          <StatusPill value={row.status || "SUBMITTED"} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mobile-empty">
                    <strong>No expenses yet</strong>
                    <p className="muted">Submitted expenses and approval status will show here.</p>
                  </div>
                )
              ) : (
                <p className="muted">Helpers can view this trip. Expense history is for drivers only.</p>
              )}

              {driver ? (
                showExpense ? (
                  <div className="mobile-expense-panel">
                    <h2>Submit expense</h2>
                    <DriverExpenseForm
                      tripId={trip.id}
                      types={expenseTypes}
                      onClose={() => setShowExpense(false)}
                      onCreated={() => {
                        setShowExpense(false);
                        toast("Expense submitted for approval");
                        load();
                      }}
                    />
                  </div>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => setShowExpense(true)}>
                    Submit expense
                  </button>
                )
              ) : null}
            </div>
          ) : null}

          {panel === "settlement" ? (
            !driver ? (
              <p className="muted">Settlement status is shown to drivers for assigned trips.</p>
            ) : settlement ? (
              <div className="mobile-detail-card">
                <div className="mobile-detail-row">
                  <span>Status</span>
                  <StatusPill value={settlement.status || "—"} />
                </div>
                <div className="mobile-detail-row">
                  <span>Advance</span>
                  <strong>{money(settlement.total_advance)}</strong>
                </div>
                <div className="mobile-detail-row">
                  <span>Expenses</span>
                  <strong>{money(settlement.total_expenses)}</strong>
                </div>
                <div className="mobile-detail-row">
                  <span>Carry forward</span>
                  <strong>{money(settlement.carry_forward_amount)}</strong>
                </div>
                <div className="mobile-detail-row">
                  <span>Balance</span>
                  <strong>{money(settlement.balance_amount ?? settlement.closing_balance)}</strong>
                </div>
                <div className="mobile-detail-row">
                  <span>Verified</span>
                  <strong>{formatDate(settlement.verified_at)}</strong>
                </div>
                <div className="mobile-detail-row">
                  <span>Settled</span>
                  <strong>{formatDate(settlement.settled_at)}</strong>
                </div>
              </div>
            ) : (
              <div className="mobile-empty">
                <strong>Settlement not ready</strong>
                <p className="muted">Final settlement appears after office verifies the trip.</p>
              </div>
            )
          ) : null}
        </>
      ) : null}
    </section>
  );
}
