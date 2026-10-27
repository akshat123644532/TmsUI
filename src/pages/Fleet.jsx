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
import { formatDate, includesQuery, today, usePaged, useResource } from "../lib";

function VehicleForm({ types, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_type_id: types[0] ? String(types[0].id) : "",
    registration_no: "",
    capacity: "",
  });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/api/vehicles", {
        method: "POST",
        body: {
          vehicle_type_id: form.vehicle_type_id,
          registration_no: form.registration_no.trim(),
          capacity: form.capacity || null,
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
      <Field label="Type">
        <Select required value={form.vehicle_type_id} onChange={(event) => setForm({ ...form, vehicle_type_id: event.target.value })}>
          <option value="">Select type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Registration">
        <input required value={form.registration_no} onChange={(event) => setForm({ ...form, registration_no: event.target.value })} placeholder="MH01AB1234" />
      </Field>
      <Field label="Capacity">
        <input value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="16 ton" />
      </Field>
      {types.length === 0 ? <p className="form-error span-2">Add a vehicle type before registering a vehicle.</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy || types.length === 0} submitLabel="Add vehicle" />
    </form>
  );
}

function TypeForm({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/api/vehicle-types", { method: "POST", body: { name: name.trim() } });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Type name">
        <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Container" />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add type" />
    </form>
  );
}

function AssignmentForm({ vehicles, drivers, helpers, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "",
    driver_id: "",
    helper_id: "",
    start_date: today(),
    end_date: "",
  });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/api/vehicle-assignments", {
        method: "POST",
        body: {
          vehicle_id: form.vehicle_id,
          driver_id: form.driver_id || null,
          helper_id: form.helper_id || null,
          start_date: form.start_date,
          end_date: form.end_date || null,
          is_active: 1,
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
      <Field label="Vehicle">
        <Select required value={form.vehicle_id} onChange={set("vehicle_id")}>
          <option value="">Select vehicle</option>
          {vehicles.map((row) => <option key={row.id} value={row.id}>{row.registration_no}</option>)}
        </Select>
      </Field>
      <Field label="Driver">
        <Select value={form.driver_id} onChange={set("driver_id")}>
          <option value="">None</option>
          {drivers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select>
      </Field>
      <Field label="Helper">
        <Select value={form.helper_id} onChange={set("helper_id")}>
          <option value="">None</option>
          {helpers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select>
      </Field>
      <Field label="Start date">
        <input type="date" required value={form.start_date} onChange={set("start_date")} />
      </Field>
      <Field label="End date">
        <input type="date" value={form.end_date} onChange={set("end_date")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Assign crew" />
    </form>
  );
}

export default function Fleet() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState("vehicles");
  const [query, setQuery] = useState(params.get("q") || "");
  const [modal, setModal] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [vehicles, types, assignments, drivers, helpers] = await Promise.all([
      api("/api/vehicles?limit=100"),
      api("/api/vehicle-types?limit=100"),
      api("/api/vehicle-assignments?limit=100"),
      api("/api/drivers?limit=100"),
      api("/api/helpers?limit=100"),
    ]);
    return {
      vehicles: vehicles.vehicles || [],
      types: types.vehicleTypes || [],
      assignments: assignments.assignments || [],
      drivers: drivers.drivers || [],
      helpers: helpers.helpers || [],
      vehicleTotal: vehicles.pagination?.total || 0,
    };
  }, []);

  const typeName = useMemo(
    () => new Map((data?.types || []).map((type) => [String(type.id), type.name])),
    [data]
  );
  const vehicleName = useMemo(
    () => new Map((data?.vehicles || []).map((row) => [String(row.id), row.registration_no])),
    [data]
  );
  const driverName = useMemo(
    () => new Map((data?.drivers || []).map((row) => [String(row.id), row.name])),
    [data]
  );
  const helperName = useMemo(
    () => new Map((data?.helpers || []).map((row) => [String(row.id), row.name])),
    [data]
  );

  const rows = useMemo(() => {
    if (tab === "types") {
      return (data?.types || []).filter((row) => includesQuery(row, query, ["name"]));
    }

    if (tab === "assignments") {
      return (data?.assignments || [])
        .map((row) => ({
          ...row,
          vehicle_name: vehicleName.get(String(row.vehicle_id)) || "—",
          driver_name: driverName.get(String(row.driver_id)) || "—",
          helper_name: helperName.get(String(row.helper_id)) || "—",
        }))
        .filter((row) => includesQuery(row, query, ["vehicle_name", "driver_name", "helper_name"]));
    }

    return (data?.vehicles || [])
      .map((row) => ({ ...row, type_name: typeName.get(String(row.vehicle_type_id)) || "—" }))
      .filter((row) => includesQuery(row, query, ["registration_no", "type_name", "capacity"]));
  }, [data, tab, query, typeName, vehicleName, driverName, helperName]);
  const pager = usePaged(rows);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const actionLabel = tab === "types" ? "New Type" : tab === "assignments" ? "Assign Crew" : "New Vehicle";

  return (
    <section>
      <PageHeader title="Dispatcher" subtitle="Vehicles, crew assignments, and the types your company runs.">
        <button className="btn btn-primary" type="button" onClick={() => setModal(tab)}>
          {actionLabel}
        </button>
      </PageHeader>
      <Banner>{error}</Banner>
      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          pager.setPage(1);
        }}
        tabs={[
          { id: "vehicles", label: `Vehicles (${data?.vehicleTotal || 0})` },
          { id: "assignments", label: "Assignments" },
          { id: "types", label: "Types" },
        ]}
      />
      <article className="card table-card">
        <div className="card-head">
          <h2>{tab === "types" ? "Vehicle types" : tab === "assignments" ? "Crew assignments" : "Fleet"}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading fleet...</p> : tab === "types" ? (
          <DataTable
            rows={pager.rows}
            empty="No vehicle types yet."
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
            ]}
          />
        ) : tab === "assignments" ? (
          <DataTable
            rows={pager.rows}
            empty="No crew is assigned."
            columns={[
              { key: "vehicle", label: "Vehicle", render: (row) => row.vehicle_name },
              { key: "driver", label: "Driver", render: (row) => row.driver_name },
              { key: "helper", label: "Helper", render: (row) => row.helper_name },
              { key: "start", label: "Start", render: (row) => formatDate(row.start_date) },
              { key: "active", label: "Active", render: (row) => <StatusPill value={row.is_active} active /> },
            ]}
          />
        ) : (
          <DataTable
            rows={pager.rows}
            empty="No vehicles match this search."
            columns={[
              { key: "reg", label: "Registration", render: (row) => row.registration_no },
              { key: "type", label: "Type", render: (row) => row.type_name },
              { key: "capacity", label: "Capacity", render: (row) => row.capacity || "—" },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>

      {modal === "vehicles" && data ? (
        <Modal title="New Vehicle" onClose={() => setModal("")}>
          <VehicleForm types={data.types} onClose={() => setModal("")} onCreated={() => { setModal(""); reload(); }} />
        </Modal>
      ) : null}
      {modal === "types" ? (
        <Modal title="New Vehicle Type" onClose={() => setModal("")}>
          <TypeForm onClose={() => setModal("")} onCreated={() => { setModal(""); reload(); }} />
        </Modal>
      ) : null}
      {modal === "assignments" && data ? (
        <Modal title="Assign Crew" onClose={() => setModal("")} wide>
          <AssignmentForm
            vehicles={data.vehicles}
            drivers={data.drivers}
            helpers={data.helpers}
            onClose={() => setModal("")}
            onCreated={() => { setModal(""); reload(); }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
