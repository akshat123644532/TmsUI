import { useEffect, useMemo, useState } from "react";
import { api, fetchAll, pickList } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Icon } from "../components/Icons";
import {
  Banner,
  DataTable,
  Field,
  FormActions,
  FormLegend,
  Modal,
  PageHeader,
  Pager,
  SearchField,
  Select,
  StatusNext,
  Tabs,
} from "../components/ui";
import {
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  isAdminRole,
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

function permissionMessage(err) {
  const message = String(err?.message || "");
  if (/\b403\b|forbidden|permission/i.test(message)) return "No Trip Expenses permission";
  return message || "Could not load expense types";
}

function useExpenseTypes() {
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await api(endpoints.tripExpenseTypes);
      // API: { success, expenseTypes: [{ id, name, code, status }] }
      const rows = pickList(data, "expenseTypes", "expense_types", "types", "rows")
        .filter((row) => row && Number(row.status ?? 1) !== 0);
      setTypes(rows);
      setError("");
      if (!rows.length) {
        toast("No expense types returned");
      }
    } catch (err) {
      const message = permissionMessage(err);
      setError(message);
      setTypes([]);
      toast(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return { types, error, loading, reload };
}

function typeValue(row) {
  return row.code || row.name || String(row.id);
}

function typeLabel(row) {
  return row.name || row.code || `#${row.id}`;
}

function ExpenseTypeSelect({ value, onChange, types, loading, error, onRetry, issuesError }) {
  return (
    <Field label="Expense type" required error={issuesError || (!loading && error ? error : "")}>
      {loading ? (
        <p className="form-hint" style={{ margin: 0 }}>Loading types…</p>
      ) : (
        <Select value={value} onChange={onChange} disabled={!types.length}>
          <option value="">{types.length ? "Select type" : "No types available"}</option>
          {types.map((row) => (
            <option key={row.id || typeValue(row)} value={typeValue(row)}>{typeLabel(row)}</option>
          ))}
        </Select>
      )}
      {!loading && error ? (
        <button type="button" className="btn btn-ghost table-action" onClick={onRetry} style={{ marginTop: 6 }}>
          Retry types
        </button>
      ) : null}
    </Field>
  );
}

function ExpenseForm({ trips, types, typesLoading, typesError, onRetryTypes, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    trip_id: "",
    expense_type: types[0] ? typeValue(types[0]) : "",
    requested_amount: "",
    remarks: "",
  });

  useEffect(() => {
    if (!form.expense_type && types[0]) {
      setForm((current) => ({ ...current, expense_type: typeValue(types[0]) }));
    }
  }, [types]);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["trip_id", form.trip_id, "Select a trip"],
      ["expense_type", form.expense_type, "Select expense type"],
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
      const fd = new FormData();
      fd.append("trip_id", form.trip_id);
      fd.append("expense_type", form.expense_type);
      fd.append("requested_amount", String(num(form.requested_amount)));
      if (form.remarks.trim()) fd.append("remarks", form.remarks.trim());
      if (file) fd.append("file", file);
      await api(endpoints.tripExpenses, { method: "POST", formData: fd });
      onCreated();
    } catch (err) {
      // JSON fallback if multipart not accepted without file
      try {
        if (file) throw err;
        await api(endpoints.tripExpenses, {
          method: "POST",
          body: {
            trip_id: Number(form.trip_id) || form.trip_id,
            expense_type: form.expense_type,
            requested_amount: num(form.requested_amount),
            remarks: form.remarks.trim() || null,
          },
        });
        onCreated();
      } catch (inner) {
        setError(inner.message || err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Trip" required error={issues.trip_id}>
        <Select value={form.trip_id} onChange={set("trip_id")}>
          <option value="">Select trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{tripLabel(trip)}</option>
          ))}
        </Select>
      </Field>
      <ExpenseTypeSelect
        value={form.expense_type}
        onChange={set("expense_type")}
        types={types}
        loading={typesLoading}
        error={typesError}
        onRetry={onRetryTypes}
        issuesError={issues.expense_type}
      />
      <Field label="Requested amount" required error={issues.requested_amount}>
        <input type="number" min="0.01" step="0.01" value={form.requested_amount} onChange={set("requested_amount")} />
      </Field>
      <Field label="Receipt file" hint="Optional on desk">
        <input type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </Field>
      <Field label="Remarks" className="span-2">
        <input value={form.remarks} onChange={set("remarks")} />
      </Field>
      <p className="form-hint span-2">approved_amount is set when status becomes APPROVED. Use Cancel/Reject — no delete.</p>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add expense" />
    </form>
  );
}

function MobileExpenseForm({ trips, types, typesLoading, typesError, onRetryTypes, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    trip_id: "",
    expense_type: types[0] ? typeValue(types[0]) : "",
    amount: "",
    remarks: "",
  });

  useEffect(() => {
    if (!form.expense_type && types[0]) {
      setForm((current) => ({ ...current, expense_type: typeValue(types[0]) }));
    }
  }, [types]);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["trip_id", form.trip_id, "Select a trip"],
      ["expense_type", form.expense_type, "Select expense type"],
      ["amount", form.amount, "Enter the amount"],
    ]);
    if (!nextIssues.amount && num(form.amount) <= 0) nextIssues.amount = "Enter an amount greater than 0";
    if (!file) nextIssues.file = "Receipt photo is required";
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("trip_id", form.trip_id);
      fd.append("expense_type", form.expense_type);
      fd.append("amount", String(num(form.amount)));
      if (form.remarks.trim()) fd.append("remarks", form.remarks.trim());
      fd.append("file", file);
      await api(endpoints.mobileExpenses, { method: "POST", formData: fd });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <p className="form-hint span-2">Mobile expense — receipt photo required (camera or gallery).</p>
      <Field label="Trip" required error={issues.trip_id}>
        <Select value={form.trip_id} onChange={set("trip_id")}>
          <option value="">Select trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{tripLabel(trip)}</option>
          ))}
        </Select>
      </Field>
      <ExpenseTypeSelect
        value={form.expense_type}
        onChange={set("expense_type")}
        types={types}
        loading={typesLoading}
        error={typesError}
        onRetry={onRetryTypes}
        issuesError={issues.expense_type}
      />
      <Field label="Amount" required error={issues.amount}>
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} />
      </Field>
      <Field label="Receipt photo" required error={issues.file} hint="Camera / gallery">
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
      {file ? <p className="form-hint span-2">{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</p> : null}
      <Field label="Remarks" className="span-2">
        <input value={form.remarks} onChange={set("remarks")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Submit with receipt" />
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
      await api(endpoints.tripAdvances, {
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
      <FormLegend />
      <Field label="Trip" required error={issues.trip_id}>
        <Select value={form.trip_id} onChange={set("trip_id")}>
          <option value="">Select trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{tripLabel(trip)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" required error={issues.amount}>
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} />
      </Field>
      <Field label="Payment date">
        <input type="date" value={form.payment_date} onChange={set("payment_date")} />
      </Field>
      <Field label="Payment method">
        <Select value={form.payment_method} onChange={set("payment_method")}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>{method.replaceAll("_", " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Reference no">
        <input value={form.reference_no} onChange={set("reference_no")} />
      </Field>
      <p className="form-hint span-2">Use Cancel on advances — hard delete is not available.</p>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add advance" />
    </form>
  );
}

function ExpenseTypesPanel({ types, reload, toast }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a type name");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(endpoints.tripExpenseTypes, {
        method: "POST",
        body: { name: name.trim(), code: code.trim() || name.trim().toUpperCase().replace(/\s+/g, "_") },
      });
      setName("");
      setCode("");
      toast("Expense type added");
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Remove expense type “${typeLabel(row)}”?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(endpoints.tripExpenseType(row.id), { method: "DELETE" });
      toast("Expense type removed");
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Banner>{error}</Banner>
      <form onSubmit={add} className="form-grid">
        <Field label="Name" required>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Fuel" />
        </Field>
        <Field label="Code" hint="Optional · defaults from name">
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="FUEL" />
        </Field>
        <div className="span-2 form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Add type"}
          </button>
        </div>
      </form>
      <DataTable
        rows={types}
        empty="No expense types yet."
        columns={[
          { key: "name", label: "Name", render: (row) => row.name || "—" },
          { key: "code", label: "Code", render: (row) => row.code || "—" },
          {
            key: "actions",
            label: "",
            render: (row) => (
              <button type="button" className="btn btn-ghost table-action" disabled={busy} onClick={() => remove(row)}>
                Remove
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}

export default function Expenses() {
  const toast = useToast();
  const { user } = useAuth();
  const admin = isAdminRole(user?.user_type);
  const [tab, setTab] = useState("expenses");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [actionError, setActionError] = useState("");
  const typeState = useExpenseTypes();
  const { data, loading, error, reload } = useResource(async () => {
    const [expenses, advances, trips] = await Promise.all([
      fetchAll(endpoints.tripExpenses, "expenses"),
      fetchAll(endpoints.tripAdvances, "advances"),
      fetchAll(endpoints.trips, "trips"),
    ]);
    return {
      expenses: expenses.rows,
      advances: advances.rows,
      trips: trips.rows,
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
    if (tab === "types") return typeState.types;
    return (data?.expenses || [])
      .map((row) => ({ ...row, trip_name: tripNames.get(String(row.trip_id)) || `#${row.trip_id}` }))
      .filter((row) => includesQuery(row, query, ["trip_name", "expense_type", "status", "remarks"]));
  }, [data, tab, query, tripNames, typeState.types]);
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

  const tabs = [
    { id: "expenses", label: `Expenses (${data?.expenses.length || 0})` },
    { id: "advances", label: `Advances (${data?.advances.length || 0})` },
    { id: "mobile", label: "Mobile receipt" },
  ];
  if (admin) tabs.push({ id: "types", label: `Types (${typeState.types.length})` });

  return (
    <section>
      <PageHeader title="Trip Expenses" subtitle="Desk expenses with optional receipt · mobile requires photo · Cancel/Reject only.">
        {tab === "expenses" || tab === "advances" ? (
          <button className="btn btn-primary" type="button" onClick={() => setModal(tab)}>
            {tab === "advances" ? "New Advance" : "New Expense"}
          </button>
        ) : null}
        {tab === "mobile" ? (
          <button className="btn btn-primary" type="button" onClick={() => setModal("mobile")}>
            Mobile expense
          </button>
        ) : null}
      </PageHeader>
      <Banner>{error || actionError || (tab === "types" ? typeState.error : "")}</Banner>
      <Tabs
        value={tab}
        onChange={(next) => { setTab(next); pager.setPage(1); }}
        tabs={tabs}
      />

      {tab === "mobile" ? (
        <article className="card table-card">
          <div className="card-head">
            <h2>Mobile expenses</h2>
          </div>
          <div className="pad stack">
            <p className="muted">Drivers submit with a receipt photo via `/api/mobile/expenses`. Desk can also submit here for testing.</p>
            <button className="btn btn-primary" type="button" onClick={() => setModal("mobile")} style={{ width: "fit-content" }}>
              <Icon name="file" size={16} /> Submit mobile expense
            </button>
          </div>
        </article>
      ) : null}

      {tab === "types" && admin ? (
        <article className="card table-card">
          <div className="card-head">
            <h2>Expense types</h2>
          </div>
          <div className="pad">
            <ExpenseTypesPanel types={typeState.types} reload={typeState.reload} toast={toast} />
          </div>
        </article>
      ) : null}

      {tab === "expenses" || tab === "advances" ? (
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
                      onChange={(status) => patch(endpoints.tripAdvanceStatus(row.id), status)}
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
                  key: "receipt",
                  label: "Receipt",
                  render: (row) => (row.receipt_url || row.file_url
                    ? <a className="text-link" href={row.receipt_url || row.file_url} target="_blank" rel="noreferrer">Open</a>
                    : "—"),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <StatusNext
                      value={row.status}
                      next={NEXT_STATUS.expense[row.status] || []}
                      onChange={(status) => patch(
                        endpoints.tripExpenseStatus(row.id),
                        status,
                        status === "APPROVED" ? { approved_amount: row.requested_amount } : {}
                      )}
                    />
                  ),
                },
              ]}
            />
          )}
          <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
        </article>
      ) : null}

      {modal === "expenses" && data ? (
        <Modal title="New Trip Expense" onClose={() => setModal("")}>
          <ExpenseForm
            trips={data.trips}
            types={typeState.types}
            typesLoading={typeState.loading}
            typesError={typeState.error}
            onRetryTypes={typeState.reload}
            onClose={() => setModal("")}
            onCreated={() => { setModal(""); toast("Expense added"); reload(); }}
          />
        </Modal>
      ) : null}
      {modal === "advances" && data ? (
        <Modal title="New Trip Advance" onClose={() => setModal("")}>
          <AdvanceForm trips={data.trips} onClose={() => setModal("")} onCreated={() => { setModal(""); toast("Advance added"); reload(); }} />
        </Modal>
      ) : null}
      {modal === "mobile" && data ? (
        <Modal title="Mobile expense (receipt required)" onClose={() => setModal("")}>
          <MobileExpenseForm
            trips={data.trips}
            types={typeState.types}
            typesLoading={typeState.loading}
            typesError={typeState.error}
            onRetryTypes={typeState.reload}
            onClose={() => setModal("")}
            onCreated={() => { setModal(""); toast("Mobile expense submitted"); reload(); }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
