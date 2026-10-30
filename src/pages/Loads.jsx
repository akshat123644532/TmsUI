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
import { blankIssues, formatDate, hasIssues, includesQuery, usePaged, useResource, useSearchFocus } from "../lib";
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
      <Field label="Bilty number" error={issues.bilty_number}>
        <input value={form.bilty_number} onChange={set("bilty_number")} placeholder="BL-1001" />
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
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create bilty" />
    </form>
  );
}

export default function Loads() {
  const [params] = useSearchParams();
  const toast = useToast();
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
          <h2>bilties {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading shipments...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query ? "No bilties match this search." : "No bilties yet."}
            emptyAction={query ? null : { label: "New Bilty", onClick: () => setOpen(true) }}
            columns={[
              { key: "bilty_number", label: "Bilty number", render: (row) => row.bilty_number },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "trip", label: "Trip", render: (row) => row.trip_id || "—" },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
              { key: "created", label: "Created", render: (row) => formatDate(row.created_at) },
              { key: "updated", label: "Updated", render: (row) => formatDate(row.updated_at) },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
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
