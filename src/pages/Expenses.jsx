import { useMemo, useState } from "react";
import { api } from "../api";
import {
  Banner,
  DataTable,
  Field,
  FormActions,
  Modal,
  PageHeader,
  Pager,
  SearchField,
  Select,
  StatusNext,
  StatusPill,
  Tabs,
} from "../components/ui";
import {
  blankIssues,
  EXPENSE_TYPES,
  formatDate,
  hasIssues,
  includesQuery,
  money,
  NEXT_STATUS,
  num,
  PAYMENT_METHODS,
  today,
  tripLabel,
  usePaged,
  useResource,
} from "../lib";
import { useToast } from "../toast";

function ExpenseForm({ trips, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    trip_id: "",
    expense_type: "FUEL",
    requested_amount: "",
    receipt_url: "",
    remarks: "",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["trip_id", form.trip_id, "Select a trip"],
      ["expense_type", form.expense_type, "Enter the expense type"],
      ["requested_amount", form.requested_amount, "Enter the amount"],
    ]);
    if (!nextIssues.requested_amount && num(form.requested_amount) <= 0) {
      nextIssues.requested_amount = "Enter an amount greater than 0";
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      await api("/api/trip-expenses", {
        method: "POST",
        body: {
          trip_id: form.trip_id,
          expense_type: form.expense_type.trim(),
          requested_amount: num(form.requested_amount),
          receipt_url: form.receipt_url.trim() || null,
          remarks: form.remarks.trim() || null,
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <Field label="Trip" error={issues.trip_id}>
        <Select value={form.trip_id} onChange={set("trip_id")}>
          <option value="">Select trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{tripLabel(trip)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Expense type" error={issues.expense_type}>
        <Select value={form.expense_type} onChange={set("expense_type")}>
          {EXPENSE_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
      </Field>
      <Field label="Requested amount" error={issues.requested_amount}>
        <input type="number" min="0.01" step="0.01" value={form.requested_amount} onChange={set("requested_amount")} />
      </Field>
      <Field label="Receipt URL">
        <input value={form.receipt_url} onChange={set("receipt_url")} placeholder="https://" />
      </Field>
      <Field label="Remarks">
        <input value={form.remarks} onChange={set("remarks")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add expense" />
    </form>
  );
}

function AdvanceForm({ trips, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    trip_id: "",
    amount: "",
    payment_date: today(),
    payment_method: "NEFT",
    reference_no: "",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["trip_id", form.trip_id, "Select a trip"],
      ["amount", form.amount, "Enter the amount"],
    ]);
    if (!nextIssues.amount && num(form.amount) <= 0) nextIssues.amount = "Enter an amount greater than 0";
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      await api("/api/trip-advances", {
        method: "POST",
        body: {
          trip_id: form.trip_id,
          amount: num(form.amount),
          payment_date: form.payment_date || null,
          payment_method: form.payment_method || null,
          reference_no: form.reference_no.trim() || null,
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <Field label="Trip" error={issues.trip_id}>
        <Select value={form.trip_id} onChange={set("trip_id")}>
          <option value="">Select trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{tripLabel(trip)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" error={issues.amount}>
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} />
      </Field>
      <Field label="Payment date">
        <input type="date" value={form.payment_date} onChange={set("payment_date")} />
      </Field>
      <Field label="Method">
        <Select value={form.payment_method} onChange={set("payment_method")}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>{method.replaceAll("_", " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Reference">
        <input value={form.reference_no} onChange={set("reference_no")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add advance" />
    </form>
  );
}

export default function Expenses() {
  const toast = useToast();
  const [tab, setTab] = useState("expenses");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [expenses, advances, trips] = await Promise.all([
      api("/api/trip-expenses?limit=100"),
      api("/api/trip-advances?limit=100"),
      api("/api/trips?limit=100"),
    ]);
    return {
      expenses: expenses.expenses || [],
      advances: advances.advances || [],
      trips: trips.trips || [],
    };
  }, []);

  const tripNames = useMemo(
    () => new Map((data?.trips || []).map((trip) => [String(trip.id), tripLabel(trip)])),
    [data]
  );

  const rows = useMemo(() => {
    if (tab === "advances") {
      return (data?.advances || [])
        .map((row) => ({ ...row, trip_name: tripNames.get(String(row.trip_id)) || `#${row.trip_id}` }))
        .filter((row) => includesQuery(row, query, ["trip_name", "status", "payment_method", "reference_no"]));
    }
    return (data?.expenses || [])
      .map((row) => ({ ...row, trip_name: tripNames.get(String(row.trip_id)) || `#${row.trip_id}` }))
      .filter((row) => includesQuery(row, query, ["trip_name", "expense_type", "status", "remarks"]));
  }, [data, tab, query, tripNames]);
  const pager = usePaged(rows);

  const patch = async (path, status, extra = {}) => {
    setActionError("");
    try {
      await api(path, { method: "PATCH", body: { status, ...extra } });
      toast("Status updated");
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <section>
      <PageHeader title="Trip Expenses" subtitle="Expenses and advances recorded against trips.">
        <button className="btn btn-primary" type="button" onClick={() => setModal(tab)}>
          {tab === "advances" ? "New Advance" : "New Expense"}
        </button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <Tabs
        value={tab}
        onChange={(next) => { setTab(next); pager.setPage(1); }}
        tabs={[
          { id: "expenses", label: `Expenses (${data?.expenses.length || 0})` },
          { id: "advances", label: `Advances (${data?.advances.length || 0})` },
        ]}
      />
      <article className="card table-card">
        <div className="card-head">
          <h2>{tab === "advances" ? "trip_advances" : "trip_expenses"}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading...</p> : tab === "advances" ? (
          <DataTable
            rows={pager.rows}
            empty={query ? "No advances match this search." : "No trip advances yet."}
            emptyAction={query ? null : { label: "New Advance", onClick: () => setModal("advances") }}
            columns={[
              { key: "trip", label: "Trip", render: (row) => row.trip_name },
              { key: "amount", label: "Amount", align: "right", render: (row) => money(row.amount) },
              { key: "date", label: "Payment date", render: (row) => formatDate(row.payment_date) },
              { key: "method", label: "Method", render: (row) => String(row.payment_method || "—").replaceAll("_", " ") },
              { key: "ref", label: "Reference", render: (row) => row.reference_no || "—" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusNext
                    value={row.status}
                    next={NEXT_STATUS.advance[row.status] || []}
                    onChange={(status) => patch(`/api/trip-advances/${row.id}/status`, status)}
                  />
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No expenses match this search." : "No trip expenses yet."}
            emptyAction={query ? null : { label: "New Expense", onClick: () => setModal("expenses") }}
            columns={[
              { key: "trip", label: "Trip", render: (row) => row.trip_name },
              { key: "type", label: "Type", render: (row) => row.expense_type },
              { key: "requested", label: "Requested", align: "right", render: (row) => money(row.requested_amount) },
              { key: "approved", label: "Approved", align: "right", render: (row) => row.approved_amount == null ? "—" : money(row.approved_amount) },
              { key: "remarks", label: "Remarks", render: (row) => row.remarks || "—" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusNext
                    value={row.status}
                    next={NEXT_STATUS.expense[row.status] || []}
                    onChange={(status) => patch(`/api/trip-expenses/${row.id}/status`, status, status === "APPROVED" ? { approved_amount: row.requested_amount } : {})}
                  />
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>

      {modal === "expenses" && data ? (
        <Modal title="New Trip Expense" onClose={() => setModal("")}>
          <ExpenseForm trips={data.trips} onClose={() => setModal("")} onCreated={() => { setModal(""); toast("Expense added"); reload(); }} />
        </Modal>
      ) : null}
      {modal === "advances" && data ? (
        <Modal title="New Trip Advance" onClose={() => setModal("")}>
          <AdvanceForm trips={data.trips} onClose={() => setModal("")} onCreated={() => { setModal(""); toast("Advance added"); reload(); }} />
        </Modal>
      ) : null}
    </section>
  );
}
