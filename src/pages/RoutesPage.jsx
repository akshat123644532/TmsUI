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
  Tabs,
} from "../components/ui";
import { blankIssues, formatDate, hasIssues, includesQuery, usePaged, useResource, useSearchFocus } from "../lib";
import Outlook from "./Outlook";
import { useToast } from "../toast";

const STATUSES = ["CREATED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED"];

function TripForm({ options, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "",
    driver_id: "",
    helper_id: "",
    bilty_id: "",
    client_id: "",
    source: "",
    destination: "",
    start_date: "",
    end_date: "",
    status: "CREATED",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["vehicle_id", form.vehicle_id, "Select a vehicle"],
      ["driver_id", form.driver_id, "Select a driver"],
      ["source", form.source, "Enter the source"],
      ["destination", form.destination, "Enter the destination"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      await api("/api/trips", {
        method: "POST",
        body: {
          vehicle_id: form.vehicle_id,
          driver_id: form.driver_id,
          helper_id: form.helper_id || null,
          bilty_id: form.bilty_id || null,
          client_id: form.client_id || null,
          source: form.source.trim(),
          destination: form.destination.trim(),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
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
      <Field label="Vehicle" error={issues.vehicle_id}>
        <Select value={form.vehicle_id} onChange={set("vehicle_id")}>
          <option value="">Select vehicle</option>
          {options.vehicles.map((row) => (
            <option key={row.id} value={row.id}>{row.registration_no}</option>
          ))}
        </Select>
      </Field>
      <Field label="Driver" error={issues.driver_id}>
        <Select value={form.driver_id} onChange={set("driver_id")}>
          <option value="">Select driver</option>
          {options.drivers.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Helper">
        <Select value={form.helper_id} onChange={set("helper_id")}>
          <option value="">None</option>
          {options.helpers.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Client">
        <Select value={form.client_id} onChange={set("client_id")}>
          <option value="">None</option>
          {options.clients.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Bilty">
        <Select value={form.bilty_id} onChange={set("bilty_id")}>
          <option value="">None</option>
          {options.bilties.map((row) => (
            <option key={row.id} value={row.id}>{row.bilty_number}</option>
          ))}
        </Select>
      </Field>
      <Field label="Status">
        <Select value={form.status} onChange={set("status")}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Source" error={issues.source}>
        <input value={form.source} onChange={set("source")} placeholder="Mumbai" />
      </Field>
      <Field label="Destination" error={issues.destination}>
        <input value={form.destination} onChange={set("destination")} placeholder="Delhi" />
      </Field>
      <Field label="Start date">
        <input type="date" value={form.start_date} onChange={set("start_date")} />
      </Field>
      <Field label="End date">
        <input type="date" value={form.end_date} onChange={set("end_date")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create trip" />
    </form>
  );
}

export default function RoutesPage() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get("q") || "");
  const [tab, setTab] = useState(params.get("tab") || "trips");
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useResource(async () => {
    const [trips, vehicles, drivers, helpers, clients, bilties] = await Promise.all([
      api("/api/trips?limit=100"),
      api("/api/vehicles?limit=100"),
      api("/api/drivers?limit=100"),
      api("/api/helpers?limit=100"),
      api("/api/clients?limit=100"),
      api("/api/bilties?limit=100"),
    ]);
    return {
      trips: trips.trips || [],
      total: trips.pagination?.total || 0,
      vehicles: vehicles.vehicles || [],
      drivers: drivers.drivers || [],
      helpers: helpers.helpers || [],
      clients: clients.clients || [],
      bilties: bilties.bilties || [],
    };
  }, []);

  const names = useMemo(() => {
    const vehicle = new Map((data?.vehicles || []).map((row) => [String(row.id), row.registration_no]));
    const driver = new Map((data?.drivers || []).map((row) => [String(row.id), row.name]));
    const helper = new Map((data?.helpers || []).map((row) => [String(row.id), row.name]));
    const client = new Map((data?.clients || []).map((row) => [String(row.id), row.name]));
    const bilty = new Map((data?.bilties || []).map((row) => [String(row.id), row.bilty_number]));
    return { vehicle, driver, helper, client, bilty };
  }, [data]);

  const filtered = useMemo(() => {
    const rows = (data?.trips || []).map((trip) => ({
      ...trip,
      vehicle_name: names.vehicle.get(String(trip.vehicle_id)) || "—",
      driver_name: names.driver.get(String(trip.driver_id)) || "—",
      helper_name: names.helper.get(String(trip.helper_id)) || "—",
      client_name: names.client.get(String(trip.client_id)) || "—",
      bilty_number: names.bilty.get(String(trip.bilty_id)) || "—",
      route: `${trip.source || ""} ${trip.destination || ""}`,
    }));
    return rows.filter((row) => includesQuery(row, query, ["route", "status", "vehicle_name", "driver_name", "helper_name", "client_name", "bilty_number", "source", "destination"]));
  }, [data, names, query]);
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => {
    setQuery(params.get("q") || "");
    if (params.get("tab")) setTab(params.get("tab"));
  }, [params]);

  return (
    <section>
      <PageHeader title="Trips" subtitle="Vehicle, driver, helper, client, source, and destination.">
        {tab === "trips" ? (
          <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
            New Trip
          </button>
        ) : null}
      </PageHeader>
      <Banner>{error}</Banner>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "trips", label: "trips" },
          { id: "board", label: "Status board" },
        ]}
      />
      {tab === "board" ? <Outlook embedded /> : (
      <article className="card table-card">
        <div className="card-head">
          <h2>trips {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading trips...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query ? "No trips match this search." : "No trips yet."}
            emptyAction={query ? null : { label: "New Trip", onClick: () => setOpen(true) }}
            columns={[
              { key: "route", label: "Source → Destination", render: (row) => `${row.source} → ${row.destination}` },
              { key: "vehicle", label: "Vehicle", render: (row) => row.vehicle_name },
              { key: "driver", label: "Driver", render: (row) => row.driver_name },
              { key: "helper", label: "Helper", render: (row) => row.helper_name },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "bilty", label: "Bilty", render: (row) => row.bilty_number },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
              { key: "start", label: "Start", render: (row) => formatDate(row.start_date) },
              { key: "end", label: "End", render: (row) => formatDate(row.end_date) },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      )}
      {open && data ? (
        <Modal title="New Trip" onClose={() => setOpen(false)} wide>
          <TripForm
            options={data}
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("Trip created");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
