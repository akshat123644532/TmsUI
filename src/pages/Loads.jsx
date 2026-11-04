import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import {
  Banner,
  ChipFilter,
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
  StatusPill,
  ViewButton,
} from "../components/ui";
import { blankIssues, formatDate, hasIssues, includesQuery, statusList, tripLabel, usePaged, useResource, useSearchFocus } from "../lib";
import { useToast } from "../toast";

const STATUSES = ["RESERVED", "CREATED", "CANCELLED", "COMPLETED"];

export function ShipmentForm({ onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    bilty_number: "",
    client_id: "",
    trip_id: "",
    status: "RESERVED",
  });

  useEffect(() => {
    api("/api/clients?limit=100").then((data) => setClients(data.clients || [])).catch((err) => setError(err.message));
    api("/api/trips?limit=100").then((data) => setTrips(data.trips || [])).catch(() => {});
  }, []);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["bilty_number", form.bilty_number, "Enter a bilty number"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      await api("/api/bilties", {
        method: "POST",
        body: {
          bilty_number: form.bilty_number.trim(),
          client_id: form.client_id || null,
          trip_id: form.trip_id || null,
          status: form.status,
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
      <Field label="Bilty number" required error={issues.bilty_number}>
        <input value={form.bilty_number} onChange={set("bilty_number")} placeholder="BL-1001" />
      </Field>
      <Field label="Status" hint="bilties.status default RESERVED">
        <Select value={form.status} onChange={set("status")}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </Select>
      </Field>
      <Field label="Client">
        <Select value={form.client_id} onChange={set("client_id")}>
          <option value="">None</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Trip">
        <Select value={form.trip_id} onChange={set("trip_id")}>
          <option value="">None</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.source} → {trip.destination}
            </option>
          ))}
        </Select>
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create bilty" />
    </form>
  );
}

export default function Loads() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState(null);
  const { data, loading, error, reload } = useResource(async () => {
    const [bilties, clients, trips] = await Promise.all([
      fetchAll("/api/bilties", "bilties"),
      fetchAll("/api/clients", "clients"),
      fetchAll("/api/trips", "trips"),
    ]);
    const names = new Map(clients.rows.map((client) => [String(client.id), client.name]));
    const tripsById = new Map(trips.rows.map((trip) => [String(trip.id), tripLabel(trip)]));
    return {
      rows: bilties.rows.map((row) => ({
        ...row,
        client_name: names.get(String(row.client_id)) || "—",
        trip_name: tripsById.get(String(row.trip_id)) || (row.trip_id ? `#${row.trip_id}` : "—"),
      })),
      total: bilties.total,
    };
  }, []);

  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => (
      (!status || String(row.status) === status)
      && includesQuery(row, query, ["bilty_number", "status", "client_name", "trip_name"])
    )),
    [data, query, status]
  );
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  return (
    <section>
      <PageHeader title="Bilty" subtitle="Company bilties with client, trip, and status.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Bilty
        </button>
      </PageHeader>
      <Banner>{error}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Bilties {data ? <span className="count">{filtered.length}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        <ChipFilter options={statusList(data?.rows)} value={status} onChange={(value) => { setStatus(value); pager.setPage(1); }} />
        {loading ? <p className="muted pad">Loading shipments...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query || status ? "No bilties match this search." : "No bilties yet."}
            emptyAction={query || status ? null : { label: "New Bilty", onClick: () => setOpen(true) }}
            columns={[
              { key: "bilty_number", label: "Bilty number", render: (row) => row.bilty_number },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "trip", label: "Trip", render: (row) => row.trip_name },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
              { key: "created", label: "Created", render: (row) => formatDate(row.created_at) },
              { key: "actions", label: "", render: (row) => <ViewButton onClick={() => setDetail(row)} /> },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {detail ? (
        <Modal title={detail.bilty_number} onClose={() => setDetail(null)}>
          <DetailList rows={[
            ["Client", detail.client_name],
            ["Trip", detail.trip_name],
            ["Status", detail.status],
            ["Created", formatDate(detail.created_at)],
            ["Updated", formatDate(detail.updated_at)],
          ]} />
        </Modal>
      ) : null}
      {open ? (
        <Modal title="New Bilty" onClose={() => setOpen(false)}>
          <ShipmentForm
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("Bilty created");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
