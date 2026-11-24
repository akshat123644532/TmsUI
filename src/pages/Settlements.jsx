import { useMemo, useState } from "react";
import { api, fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
import {
  Banner,
  DataTable,
  DetailList,
  Field,
  FormActions,
  FormLegend,
  Modal,
  PageHeader,
  Pager,
  SearchField,
  Select,
  StatusNext,
  ViewButton,
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
      await api(endpoints.tripSettlements, {
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
        Balance = Advance + Carry-Forward − Approved Expenses. Settled / carry-forward records show verified_by and verified_at. No delete — Cancel via trip/expense flows only.
      </p>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create settlement" />
    </form>
  );
}

function verifierLabel(row) {
  return row.verified_by_name
    || row.verifier_name
    || (row.verified_by != null ? `User #${row.verified_by}` : "—");
}

function SettlementDetail({ row, onClose }) {
  const showVerifier = ["SETTLED", "CARRY_FORWARD"].includes(String(row.status || "").toUpperCase());
  return (
    <div className="stack">
      <DetailList rows={[
        ["Trip", row.trip_name],
        ["Status", row.status],
        ["Advance", money(row.total_advance)],
        ["Carry-forward", money(row.carry_forward_amount)],
        ["Approved expenses", money(row.total_expenses)],
        ["Closing balance", money(row.balance_amount)],
        ["Settled at", formatDate(row.settled_at)],
        ["Remarks", row.remarks || "—"],
        ...(showVerifier ? [
          ["Verified by", verifierLabel(row)],
          ["Verified at", formatDate(row.verified_at)],
        ] : []),
      ]} />
      <div className="page-actions bilty-detail-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function Settlements() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [settlements, trips] = await Promise.all([
      fetchAll(endpoints.tripSettlements, "settlements"),
      fetchAll(endpoints.trips, "trips"),
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
      .filter((row) => includesQuery(row, query, ["trip_name", "status", "remarks", "verified_by_name", "verifier_name"])),
    [data, query, tripNames]
  );
  const pager = usePaged(filtered);

  const patch = async (row, status) => {
    setActionError("");
    try {
      await api(endpoints.tripSettlementStatus(row.id), { method: "PATCH", body: { status } });
      toast("Settlement updated");
      const refreshed = await api(endpoints.tripSettlement(row.id)).catch(() => null);
      const next = refreshed?.settlement || refreshed || { ...row, status };
      reload();
      if (detail?.id === row.id) {
        setDetail({
          ...row,
          ...next,
          trip_name: row.trip_name,
          status: next.status || status,
        });
      }
    } catch (err) {
      setActionError(err.message);
    }
  };

  const openDetail = async (row) => {
    try {
      const data = await api(endpoints.tripSettlement(row.id));
      const next = data.settlement || data;
      setDetail({ ...row, ...next, trip_name: row.trip_name });
    } catch {
      setDetail(row);
    }
  };

  return (
    <section>
      <PageHeader title="Trip Settlement" subtitle="Advance + Carry-Forward − Approved Expenses = Balance. Verifier shown after settle / carry-forward.">
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
              {
                key: "verifier",
                label: "Verified by",
                render: (row) => (["SETTLED", "CARRY_FORWARD"].includes(String(row.status || "").toUpperCase())
                  ? verifierLabel(row)
                  : "—"),
              },
              {
                key: "verified_at",
                label: "Verified at",
                render: (row) => (["SETTLED", "CARRY_FORWARD"].includes(String(row.status || "").toUpperCase())
                  ? formatDate(row.verified_at)
                  : "—"),
              },
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
              { key: "actions", label: "", render: (row) => <ViewButton onClick={() => openDetail(row)} /> },
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
      {detail ? (
        <Modal title={`Settlement · ${detail.trip_name}`} onClose={() => setDetail(null)}>
          <SettlementDetail row={detail} onClose={() => setDetail(null)} />
        </Modal>
      ) : null}
    </section>
  );
}
