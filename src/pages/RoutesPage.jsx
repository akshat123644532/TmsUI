import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll, openApiFile } from "../api";
import { endpoints } from "../api/endpoints";
import { Icon } from "../components/Icons";
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
  Tabs,
  ViewButton,
} from "../components/ui";
import {
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  statusList,
  TRIP_STATUSES,
  usePaged,
  useResource,
  useSearchFocus,
} from "../lib";
import Outlook from "./Outlook";
import { useToast } from "../toast";

const STATUSES = TRIP_STATUSES;
const TRIP_DOC_TYPES = ["LR_COPY", "POD", "CHALLAN", "INVOICE", "PERMIT", "OTHER"];

function linkedBiltyIds(trip) {
  if (Array.isArray(trip?.bilty_ids) && trip.bilty_ids.length) {
    return trip.bilty_ids.map(String);
  }
  if (Array.isArray(trip?.bilties) && trip.bilties.length) {
    return trip.bilties.map((row) => String(row.id || row.bilty_id)).filter(Boolean);
  }
  if (trip?.bilty_id) return [String(trip.bilty_id)];
  return [];
}

function linkedBiltyLabels(trip, biltyMap) {
  const fromRows = Array.isArray(trip?.bilties)
    ? trip.bilties.map((row) => row.bilty_number || biltyMap.get(String(row.id)) || `#${row.id}`)
    : [];
  if (fromRows.length) return fromRows;
  return linkedBiltyIds(trip).map((id) => biltyMap.get(String(id)) || `#${id}`);
}

function BiltyMultiSelect({ options, value, onChange, disabled = false }) {
  const [search, setSearch] = useState("");
  const selected = new Set((value || []).map(String));
  const byId = useMemo(
    () => new Map((options || []).map((row) => [String(row.id), row])),
    [options]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = options || [];
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.bilty_number,
        row.status,
        row.pickup_location,
        row.drop_location,
        row.consignor,
        row.consignee,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [options, search]);

  const toggle = (id) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(String(id))) next.delete(String(id));
    else next.add(String(id));
    onChange([...next]);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div className="bilty-picker">
      <div className="bilty-picker-toolbar">
        <div className="bilty-picker-search">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={search}
            disabled={disabled}
            placeholder="Search bilty no / route / party"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="bilty-picker-count">
          {selected.size ? `${selected.size} selected` : "None selected"}
        </span>
        {selected.size ? (
          <button type="button" className="btn btn-ghost table-action" disabled={disabled} onClick={clearAll}>
            Clear
          </button>
        ) : null}
      </div>

      {selected.size ? (
        <div className="bilty-picker-chips">
          {[...selected].map((id) => {
            const row = byId.get(String(id));
            return (
              <button
                key={id}
                type="button"
                className="bilty-picker-chip"
                disabled={disabled}
                onClick={() => toggle(id)}
                title="Remove"
              >
                {row?.bilty_number || `#${id}`}
                <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="bilty-picker-empty muted">Select one or more bilties for part load</p>
      )}

      <div className="bilty-picker-list" role="listbox" aria-multiselectable="true">
        {filtered.length ? filtered.map((row) => {
          const active = selected.has(String(row.id));
          const route = [row.pickup_location, row.drop_location].filter(Boolean).join(" → ");
          return (
            <button
              key={row.id}
              type="button"
              role="option"
              aria-selected={active}
              disabled={disabled}
              className={`bilty-picker-row${active ? " active" : ""}`}
              onClick={() => toggle(row.id)}
            >
              <span className={`bilty-picker-check${active ? " on" : ""}`} aria-hidden="true" />
              <span className="bilty-picker-copy">
                <strong>{row.bilty_number}</strong>
                <small>{route || "No route yet"}</small>
              </span>
              <StatusPill value={row.status} />
            </button>
          );
        }) : (
          <p className="muted pad">No bilties match “{search.trim()}”.</p>
        )}
      </div>
    </div>
  );
}

function TripForm({ options, onClose, onCreated, initial = null }) {
  const editing = Boolean(initial?.id);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: initial?.vehicle_id ? String(initial.vehicle_id) : "",
    driver_id: initial?.driver_id ? String(initial.driver_id) : "",
    helper_id: initial?.helper_id ? String(initial.helper_id) : "",
    client_id: initial?.client_id ? String(initial.client_id) : "",
    bilty_ids: linkedBiltyIds(initial),
    source: initial?.source || "",
    destination: initial?.destination || "",
    start_date: initial?.start_date ? String(initial.start_date).slice(0, 16) : "",
    end_date: initial?.end_date ? String(initial.end_date).slice(0, 16) : "",
    status: initial?.status || "DRAFT",
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const setBilties = (ids) => {
    setForm((current) => ({
      ...current,
      bilty_ids: ids,
      status: ids.length && current.status === "DRAFT" ? "BILTY_LINKED" : current.status,
    }));
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
    const bilty_ids = form.bilty_ids.map(Number).filter((id) => Number.isFinite(id));
    const body = {
      vehicle_id: Number(form.vehicle_id),
      driver_id: Number(form.driver_id),
      helper_id: form.helper_id ? Number(form.helper_id) : null,
      client_id: form.client_id ? Number(form.client_id) : null,
      bilty_ids,
      source: form.source.trim(),
      destination: form.destination.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: bilty_ids.length && form.status === "DRAFT" ? "BILTY_LINKED" : form.status,
    };

    try {
      if (editing) {
        await api(endpoints.trip(initial.id), { method: "PUT", body });
      } else {
        await api(endpoints.trips, { method: "POST", body });
      }
      onCreated(editing ? "Trip updated" : "Trip created");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Vehicle" required error={issues.vehicle_id}>
        <Select value={form.vehicle_id} onChange={set("vehicle_id")}>
          <option value="">Select vehicle</option>
          {options.vehicles.map((row) => (
            <option key={row.id} value={row.id}>{row.registration_no}</option>
          ))}
        </Select>
      </Field>
      <Field label="Driver" required error={issues.driver_id}>
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
      <div className="span-2 bilty-picker-field">
        <div className="bilty-picker-label">
          <span>Bilties</span>
          <small>Part load — tap rows to link</small>
        </div>
        <BiltyMultiSelect options={options.bilties} value={form.bilty_ids} onChange={setBilties} />
        {form.bilty_ids.length ? (
          <p className="field-hint">Linked → status hint <strong>BILTY_LINKED</strong></p>
        ) : null}
      </div>
      <Field label="Status" hint="Default DRAFT · becomes BILTY_LINKED when bilties linked">
        <Select value={form.status} onChange={set("status")}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Source" required error={issues.source}>
        <input value={form.source} onChange={set("source")} placeholder="Mumbai" />
      </Field>
      <Field label="Destination" required error={issues.destination}>
        <input value={form.destination} onChange={set("destination")} placeholder="Delhi" />
      </Field>
      <Field label="Start date">
        <input type="datetime-local" value={form.start_date} onChange={set("start_date")} />
      </Field>
      <Field label="End date">
        <input type="datetime-local" value={form.end_date} onChange={set("end_date")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={editing ? "Save trip" : "Create trip"} />
    </form>
  );
}

function TripDocsPanel({ tripId, toast }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState({ document_type: "POD", file: null });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`${endpoints.tripDocuments}?trip_id=${tripId}&limit=100`);
      setDocs(data.documents || data.rows || []);
    } catch (err) {
      setError(err.message);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tripId]);

  const takeFile = (file) => {
    if (!file) return;
    setForm((current) => ({ ...current, file }));
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!form.file) {
      setError("Choose a file");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("trip_id", String(tripId));
      fd.append("document_type", form.document_type);
      fd.append("file", form.file);
      await api(endpoints.tripDocuments, { method: "POST", formData: fd });
      setForm({ document_type: "POD", file: null });
      toast("Trip document uploaded");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (row) => {
    if (!window.confirm(`Remove ${row.document_type || "document"}?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(endpoints.tripDocument(row.id), { method: "DELETE" });
      toast("Document removed");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Banner>{error}</Banner>
      <form onSubmit={upload} className="doc-upload" noValidate>
        <div className="doc-upload-head">
          <span className="doc-upload-icon"><Icon name="file" size={18} /></span>
          <div>
            <strong>Upload trip document</strong>
            <p>POD, challan, LR copy and more.</p>
          </div>
        </div>
        <div className="chip-row" role="group" aria-label="Document type">
          {TRIP_DOC_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`chip-btn${form.document_type === type ? " active" : ""}`}
              onClick={() => setForm((current) => ({ ...current, document_type: type }))}
            >
              {type.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <label
          className={`dropzone${dragOver ? " drag" : ""}${form.file ? " has-file" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            takeFile(event.dataTransfer.files?.[0] || null);
          }}
        >
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            hidden
            onChange={(event) => takeFile(event.target.files?.[0] || null)}
          />
          <span className="dropzone-icon"><Icon name="download" size={22} /></span>
          {form.file ? (
            <>
              <strong>{form.file.name}</strong>
              <small>{Math.max(1, Math.round(form.file.size / 1024))} KB · click to replace</small>
            </>
          ) : (
            <>
              <strong>Drop file here or browse</strong>
              <small>PDF, JPG, PNG, WEBP</small>
            </>
          )}
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy || !form.file}>
            {busy ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>

      {loading ? <p className="muted">Loading documents...</p> : (
        <DataTable
          rows={docs}
          empty="No trip documents yet."
          columns={[
            { key: "type", label: "Type", render: (row) => row.document_type || "—" },
            { key: "name", label: "File", render: (row) => row.file_name || row.document_number || "—" },
            { key: "created", label: "Uploaded", render: (row) => formatDate(row.created_at) },
            {
              key: "open",
              label: "",
              render: (row) => (row.document_url || row.file_url
                ? <button type="button" className="btn btn-ghost table-action" onClick={() => openApiFile(row.document_url || row.file_url)}>Open</button>
                : "—"),
            },
            {
              key: "remove",
              label: "",
              render: (row) => (
                <button type="button" className="btn btn-ghost table-action" disabled={busy} onClick={() => removeDoc(row)}>
                  Remove
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

function TripDetail({ trip, biltyMap, onClose, onEdit, toast }) {
  const [tab, setTab] = useState("overview");
  const [full, setFull] = useState(trip);
  const labels = linkedBiltyLabels(full, biltyMap);

  useEffect(() => {
    let alive = true;
    api(endpoints.trip(trip.id))
      .then((data) => {
        if (!alive) return;
        const next = data.trip || data;
        setFull({ ...trip, ...next, bilties: data.bilties || next.bilties || trip.bilties });
      })
      .catch(() => setFull(trip));
    return () => { alive = false; };
  }, [trip.id]);

  return (
    <div className="stack">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "documents", label: "Documents" },
        ]}
      />
      {tab === "overview" ? (
        <>
          <DetailList rows={[
            ["Vehicle", full.vehicle_name || full.vehicle_id],
            ["Driver", full.driver_name || full.driver_id],
            ["Helper", full.helper_name || full.helper_id || "—"],
            ["Client", full.client_name || full.client_id || "—"],
            ["Bilties", labels.length ? labels.join(", ") : "—"],
            ["Status", full.status],
            ["Start", formatDate(full.start_date)],
            ["End", formatDate(full.end_date)],
          ]} />
          {labels.length ? (
            <div className="trip-bilty-chips">
              {labels.map((label) => (
                <span className="doc-type-pill" key={label}>{label}</span>
              ))}
            </div>
          ) : null}
          <div className="page-actions bilty-detail-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary" onClick={() => onEdit(full)}>Edit</button>
          </div>
        </>
      ) : (
        <TripDocsPanel tripId={trip.id} toast={toast} />
      )}
    </div>
  );
}

export default function RoutesPage() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get("q") || "");
  const [tab, setTab] = useState(params.get("tab") || "trips");
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState(null);
  const { data, loading, error, reload } = useResource(async () => {
    const [trips, vehicles, drivers, helpers, clients, bilties] = await Promise.all([
      fetchAll(endpoints.trips, "trips"),
      fetchAll(endpoints.vehicles, "vehicles"),
      fetchAll(endpoints.drivers, "drivers"),
      fetchAll(endpoints.helpers, "helpers"),
      fetchAll(endpoints.clients, "clients"),
      fetchAll(endpoints.bilties, "bilties"),
    ]);
    return {
      trips: trips.rows,
      total: trips.total,
      vehicles: vehicles.rows,
      drivers: drivers.rows,
      helpers: helpers.rows,
      clients: clients.rows,
      bilties: bilties.rows,
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
    const rows = (data?.trips || []).map((trip) => {
      const labels = linkedBiltyLabels(trip, names.bilty);
      return {
        ...trip,
        vehicle_name: names.vehicle.get(String(trip.vehicle_id)) || "—",
        driver_name: names.driver.get(String(trip.driver_id)) || "—",
        helper_name: names.helper.get(String(trip.helper_id)) || "—",
        client_name: names.client.get(String(trip.client_id)) || "—",
        bilty_number: labels.join(", ") || "—",
        bilty_labels: labels,
        route: `${trip.source || ""} ${trip.destination || ""}`,
      };
    });
    return rows.filter((row) => (
      (!status || String(row.status) === status)
      && includesQuery(row, query, ["route", "status", "vehicle_name", "driver_name", "helper_name", "client_name", "bilty_number", "source", "destination"])
    ));
  }, [data, names, query, status]);
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => {
    setQuery(params.get("q") || "");
    if (params.get("tab")) setTab(params.get("tab"));
  }, [params]);

  return (
    <section>
      <PageHeader title="Trips" subtitle="Multi-bilty part load, trip documents, vehicle and crew.">
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
        <ChipFilter options={statusList(data?.trips)} value={status} onChange={(value) => { setStatus(value); pager.setPage(1); }} />
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
              { key: "bilty", label: "Bilties", render: (row) => row.bilty_number },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
              { key: "start", label: "Start", render: (row) => formatDate(row.start_date) },
              { key: "end", label: "End", render: (row) => formatDate(row.end_date) },
              { key: "actions", label: "", render: (row) => <ViewButton onClick={() => setDetail(row)} /> },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      )}
      {detail ? (
        <Modal title={`${detail.source} → ${detail.destination}`} onClose={() => setDetail(null)} wide>
          <TripDetail
            trip={detail}
            biltyMap={names.bilty}
            toast={toast}
            onClose={() => setDetail(null)}
            onEdit={(row) => {
              setEditRow(row);
              setDetail(null);
            }}
          />
        </Modal>
      ) : null}
      {open && data ? (
        <Modal title="New Trip" onClose={() => setOpen(false)} wide>
          <TripForm
            options={data}
            onClose={() => setOpen(false)}
            onCreated={(message) => {
              setOpen(false);
              toast(message || "Trip created");
              reload();
            }}
          />
        </Modal>
      ) : null}
      {editRow && data ? (
        <Modal title={`Edit trip · ${editRow.source} → ${editRow.destination}`} onClose={() => setEditRow(null)} wide>
          <TripForm
            options={data}
            initial={editRow}
            onClose={() => setEditRow(null)}
            onCreated={(message) => {
              setEditRow(null);
              toast(message || "Trip updated");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
