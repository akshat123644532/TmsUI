import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  StatusPill,
} from "../components/ui";
import { formatDate, includesQuery, usePaged, useResource } from "../lib";

const STATUSES = ["CREATED", "RESERVED", "COMPLETED", "CANCELLED"];

export function ShipmentForm({ onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    bilty_number: "",
    client_id: "",
    trip_id: "",
    status: "CREATED",
  });

  useEffect(() => {
    api("/api/clients?limit=100").then((data) => setClients(data.clients || [])).catch((err) => setError(err.message));
    api("/api/trips?limit=100").then((data) => setTrips(data.trips || [])).catch(() => {});
  }, []);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
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
    <form onSubmit={submit} className="form-grid">
      <Field label="Bilty number">
        <input value={form.bilty_number} onChange={set("bilty_number")} required placeholder="BL-1001" />
      </Field>
      <Field label="Status">
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
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create shipment" />
    </form>
  );
}

export default function Loads() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useResource(async () => {
    const [bilties, clients] = await Promise.all([
      api("/api/bilties?limit=100"),
      api("/api/clients?limit=100"),
    ]);
    const names = new Map((clients.clients || []).map((client) => [String(client.id), client.name]));
    return {
      rows: (bilties.bilties || []).map((row) => ({
        ...row,
        client_name: names.get(String(row.client_id)) || "—",
      })),
      total: bilties.pagination?.total || 0,
    };
  }, []);

  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => includesQuery(row, query, ["bilty_number", "status", "client_name"])),
    [data, query]
  );
  const pager = usePaged(filtered);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  return (
    <section>
      <PageHeader title="Load Management" subtitle="Bilties raised for your company.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Shipment
        </button>
      </PageHeader>
      <Banner>{error}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Shipments {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading shipments...</p> : (
          <DataTable
            rows={pager.rows}
            empty="No bilties match this search."
            columns={[
              { key: "bilty_number", label: "Bilty", render: (row) => row.bilty_number },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
              { key: "trip", label: "Trip", render: (row) => row.trip_id || "—" },
              { key: "created", label: "Created", render: (row) => formatDate(row.created_at) },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open ? (
        <Modal title="New Shipment" onClose={() => setOpen(false)}>
          <ShipmentForm
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
