import { useMemo, useState } from "react";
import { api, fetchAll } from "../api";
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
} from "../components/ui";
import {
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  money,
  NEXT_STATUS,
  tripLabel,
  usePaged,
  useResource,
} from "../lib";
import { useToast } from "../toast";

function SettlementForm({ trips, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ trip_id: "", remarks: "" });

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([["trip_id", form.trip_id, "Select a trip"]]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      await api("/api/trip-settlements", {
        method: "POST",
        body: {
          trip_id: form.trip_id,
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
      <FormLegend />
      <Field label="Trip" required error={issues.trip_id}>
        <Select
          value={form.trip_id}
          onChange={(event) => {
            setForm({ ...form, trip_id: event.target.value });
            setIssues({});
          }}
        >
          <option value="">Select trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{tripLabel(trip)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Remarks">
        <input value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
      </Field>
      <p className="form-hint span-2">
        Balance = Advance + Carry-Forward − Approved Expenses. Only trip_id is required; total advance, total expenses and balance are calculated from approved advances &amp; expenses. Status defaults to PENDING.
      </p>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create settlement" />
    </form>
  );
}

export default function Settlements() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [settlements, trips] = await Promise.all([
      fetchAll("/api/trip-settlements", "settlements"),
      fetchAll("/api/trips", "trips"),
    ]);
    return {
      settlements: settlements.rows,
      trips: trips.rows,
    };
  }, []);

  const tripNames = useMemo(
    () => new Map((data?.trips || []).map((trip) => [String(trip.id), tripLabel(trip)])),
    [data]
  );
  const filtered = useMemo(
    () => (data?.settlements || [])
      .map((row) => ({ ...row, trip_name: tripNames.get(String(row.trip_id)) || `#${row.trip_id}` }))
      .filter((row) => includesQuery(row, query, ["trip_name", "status", "remarks"])),
    [data, query, tripNames]
  );
  const pager = usePaged(filtered);

  const patch = async (row, status) => {
    setActionError("");
    try {
      await api(`/api/trip-settlements/${row.id}/status`, { method: "PATCH", body: { status } });
      toast("Settlement updated");
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <section>
      <PageHeader title="Trip Settlement" subtitle="Advance + Carry-Forward − Approved Expenses = Balance. Settle or carry the balance forward.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Settlement
        </button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>trip_settlements {data ? <span className="count">{data.settlements.length}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading settlements...</p> : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No settlements match this search." : "No trip settlements yet."}
            emptyAction={query ? null : { label: "New Settlement", onClick: () => setOpen(true) }}
            columns={[
              { key: "trip", label: "Trip", render: (row) => row.trip_name },
              { key: "advance", label: "Advance", align: "right", render: (row) => money(row.total_advance) },
              { key: "carry", label: "Carry-forward", align: "right", render: (row) => money(row.carry_forward_amount) },
              { key: "expenses", label: "Approved expenses", align: "right", render: (row) => money(row.total_expenses) },
              { key: "balance", label: "Closing balance", align: "right", render: (row) => money(row.balance_amount) },
              { key: "settled", label: "Settled at", render: (row) => formatDate(row.settled_at) },
              { key: "remarks", label: "Remarks", render: (row) => row.remarks || "—" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusNext
                    value={row.status}
                    next={NEXT_STATUS.settlement[row.status] || []}
                    onChange={(status) => patch(row, status)}
                  />
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open && data ? (
        <Modal title="New Settlement" onClose={() => setOpen(false)}>
          <SettlementForm
            trips={data.trips}
            onClose={() => setOpen(false)}
            onCreated={() => { setOpen(false); toast("Settlement created"); reload(); }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
