import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
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
import {
  BILTY_STATUSES,
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  statusList,
  tripLabel,
  usePaged,
  useResource,
  useSearchFocus,
} from "../lib";
import { useToast } from "../toast";

// BRD bilty lifecycle. Legacy CREATED / COMPLETED still display on existing rows.
const STATUSES = BILTY_STATUSES;
// The backend only accepts these as the starting status of a new bilty.
const CREATE_STATUSES = ["RESERVED", "DRAFT", "CONFIRMED"];
const MAX_RANGE = 100;

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
    status: "DRAFT",
    consignor: "",
    consignee: "",
    pickup_location: "",
    drop_location: "",
    goods_description: "",
    weight_kg: "",
    packages: "",
    freight_amount: "",
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
    for (const key of ["weight_kg", "packages", "freight_amount"]) {
      if (form[key] !== "" && (!Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
        nextIssues[key] = "Enter a valid number";
      }
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      await api(endpoints.bilties, {
        method: "POST",
        body: {
          bilty_number: form.bilty_number.trim(),
          client_id: form.client_id || null,
          trip_id: form.trip_id || null,
          status: form.status,
          consignor: form.consignor.trim() || null,
          consignee: form.consignee.trim() || null,
          pickup_location: form.pickup_location.trim() || null,
          drop_location: form.drop_location.trim() || null,
          goods_description: form.goods_description.trim() || null,
          weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg),
          packages: form.packages === "" ? null : Number(form.packages),
          freight_amount: form.freight_amount === "" ? null : Number(form.freight_amount),
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
      <Field label="Status" hint="New bilties start as Reserved, Draft or Confirmed">
        <Select value={form.status} onChange={set("status")}>
          {CREATE_STATUSES.map((status) => (
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
      <Field label="Consignor">
        <input value={form.consignor} onChange={set("consignor")} placeholder="Sender name" />
      </Field>
      <Field label="Consignee">
        <input value={form.consignee} onChange={set("consignee")} placeholder="Receiver name" />
      </Field>
      <Field label="Pickup location">
        <input value={form.pickup_location} onChange={set("pickup_location")} placeholder="Mumbai" />
      </Field>
      <Field label="Drop location">
        <input value={form.drop_location} onChange={set("drop_location")} placeholder="Delhi" />
      </Field>
      <Field label="Goods description">
        <input value={form.goods_description} onChange={set("goods_description")} placeholder="Cotton bales" />
      </Field>
      <Field label="Weight (kg)" error={issues.weight_kg}>
        <input type="number" min="0" step="0.01" value={form.weight_kg} onChange={set("weight_kg")} />
      </Field>
      <Field label="Packages" error={issues.packages}>
        <input type="number" min="0" step="1" value={form.packages} onChange={set("packages")} />
      </Field>
      <Field label="Freight amount" error={issues.freight_amount}>
        <input type="number" min="0" step="0.01" value={form.freight_amount} onChange={set("freight_amount")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create bilty" />
    </form>
  );
}

function ReserveForm({ onClose, onReserved }) {
  const [mode, setMode] = useState("single");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [form, setForm] = useState({ bilty_number: "", prefix: "", from: "", to: "" });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const reserve = (bilty_number) => api(endpoints.biltyReserve, { method: "POST", body: { bilty_number } });

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (mode === "single") {
      const nextIssues = blankIssues([["bilty_number", form.bilty_number, "Enter a bilty number"]]);
      setIssues(nextIssues);
      if (hasIssues(nextIssues)) return;

      setBusy(true);
      try {
        await reserve(form.bilty_number.trim());
        onReserved("Bilty number reserved");
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    const nextIssues = blankIssues([
      ["from", form.from, "Enter the first number"],
      ["to", form.to, "Enter the last number"],
    ]);
    const start = Number(form.from);
    const end = Number(form.to);
    if (!nextIssues.from && (!Number.isInteger(start) || start < 0)) nextIssues.from = "Use whole numbers";
    if (!nextIssues.to && (!Number.isInteger(end) || end < 0)) nextIssues.to = "Use whole numbers";
    if (!nextIssues.from && !nextIssues.to) {
      if (end < start) nextIssues.to = "Must be greater than or equal to the first number";
      else if (end - start + 1 > MAX_RANGE) nextIssues.to = `Reserve at most ${MAX_RANGE} numbers at a time`;
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    const width = Math.max(form.from.trim().length, form.to.trim().length);
    const prefix = form.prefix.trim();
    const from = `${prefix}${String(start).padStart(width, "0")}`;
    const to = `${prefix}${String(end).padStart(width, "0")}`;

    setBusy(true);
    setProgress("Reserving range...");
    try {
      const result = await api(endpoints.biltyReserveRange, { method: "POST", body: { from, to } });
      const done = result.reserved?.length || 0;
      const skipped = result.skipped?.length || 0;
      if (done) onReserved(`${done} bilty number${done === 1 ? "" : "s"} reserved${skipped ? `, ${skipped} skipped` : ""}`);
      else setError(skipped ? `All ${skipped} numbers already exist` : "No numbers reserved");
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress("");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Reserve">
        <Select value={mode} onChange={(event) => { setMode(event.target.value); setIssues({}); setError(""); }}>
          <option value="single">Single number</option>
          <option value="range">Number range</option>
        </Select>
      </Field>
      {mode === "single" ? (
        <Field label="Bilty number" required error={issues.bilty_number}>
          <input value={form.bilty_number} onChange={set("bilty_number")} placeholder="BL-1001" autoFocus />
        </Field>
      ) : (
        <>
          <Field label="Prefix" hint="Optional, e.g. BL-">
            <input value={form.prefix} onChange={set("prefix")} placeholder="BL-" />
          </Field>
          <Field label="From" required error={issues.from} hint="Leading zeros are kept, e.g. 0001">
            <input value={form.from} onChange={set("from")} inputMode="numeric" placeholder="1001" />
          </Field>
          <Field label="To" required error={issues.to} hint={`Up to ${MAX_RANGE} numbers`}>
            <input value={form.to} onChange={set("to")} inputMode="numeric" placeholder="1010" />
          </Field>
        </>
      )}
      {progress ? <p className="form-hint span-2">{progress}</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={mode === "single" ? "Reserve" : "Reserve range"} />
    </form>
  );
}

export default function Loads() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState(null);
  const { data, loading, error, reload } = useResource(async () => {
    const [bilties, clients, trips] = await Promise.all([
      fetchAll(endpoints.bilties, "bilties"),
      fetchAll(endpoints.clients, "clients"),
      fetchAll(endpoints.trips, "trips"),
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
      && includesQuery(row, query, [
        "bilty_number",
        "status",
        "client_name",
        "trip_name",
        "consignor",
        "consignee",
        "pickup_location",
        "drop_location",
        "goods_description",
      ])
    )),
    [data, query, status]
  );
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const statusOptions = useMemo(() => {
    const present = statusList(data?.rows);
    return [...STATUSES, ...present.filter((value) => !STATUSES.includes(value))];
  }, [data]);

  const route = (row) => (row.pickup_location || row.drop_location
    ? `${row.pickup_location || "?"} → ${row.drop_location || "?"}`
    : "—");

  return (
    <section>
      <PageHeader title="Bilty" subtitle="Reserve bilty numbers, then create bilties with parties, route, goods and freight.">
        <button className="btn btn-ghost" type="button" onClick={() => setReserveOpen(true)}>
          Reserve
        </button>
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
        <ChipFilter options={statusOptions} value={status} onChange={(value) => { setStatus(value); pager.setPage(1); }} />
        {loading ? <p className="muted pad">Loading shipments...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query || status ? "No bilties match this search." : "No bilties yet."}
            emptyAction={query || status ? null : { label: "New Bilty", onClick: () => setOpen(true) }}
            columns={[
              { key: "bilty_number", label: "Bilty number", render: (row) => row.bilty_number },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "consignor", label: "Consignor", render: (row) => row.consignor || "—" },
              { key: "consignee", label: "Consignee", render: (row) => row.consignee || "—" },
              { key: "route", label: "Pickup → Drop", render: route },
              { key: "weight", label: "Weight (kg)", render: (row) => row.weight_kg ?? "—" },
              { key: "packages", label: "Packages", render: (row) => row.packages ?? "—" },
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
            ["Consignor", detail.consignor],
            ["Consignee", detail.consignee],
            ["Pickup location", detail.pickup_location],
            ["Drop location", detail.drop_location],
            ["Goods description", detail.goods_description],
            ["Weight (kg)", detail.weight_kg],
            ["Packages", detail.packages],
            ["Freight amount", detail.freight_amount],
            ["Created", formatDate(detail.created_at)],
            ["Updated", formatDate(detail.updated_at)],
          ]} />
        </Modal>
      ) : null}
      {reserveOpen ? (
        <Modal title="Reserve bilty numbers" onClose={() => setReserveOpen(false)}>
          <ReserveForm
            onClose={() => setReserveOpen(false)}
            onReserved={(message) => {
              setReserveOpen(false);
              toast(message);
              reload();
            }}
          />
        </Modal>
      ) : null}
      {open ? (
        <Modal title="New Bilty" onClose={() => setOpen(false)} wide>
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
