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
import { blankIssues, formatDate, hasIssues, includesQuery, today, usePaged, useResource, useSearchFocus } from "../lib";
import { useToast } from "../toast";

function VehicleForm({ types, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_type_id: types[0] ? String(types[0].id) : "",
    registration_no: "",
    capacity: "",
  });

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["vehicle_type_id", form.vehicle_type_id, "Select a vehicle type"],
      ["registration_no", form.registration_no, "Enter the registration number"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      await api("/api/vehicles", {
        method: "POST",
        body: {
          vehicle_type_id: form.vehicle_type_id,
          registration_no: form.registration_no.trim(),
          capacity: form.capacity === "" ? null : Number(form.capacity),
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
      <Field label="Type" error={issues.vehicle_type_id}>
        <Select value={form.vehicle_type_id} onChange={(event) => { setForm({ ...form, vehicle_type_id: event.target.value }); setIssues((current) => ({ ...current, vehicle_type_id: "" })); }}>
          <option value="">Select type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Registration" error={issues.registration_no}>
        <input value={form.registration_no} onChange={(event) => { setForm({ ...form, registration_no: event.target.value }); setIssues((current) => ({ ...current, registration_no: "" })); }} placeholder="MH01AB1234" />
      </Field>
      <Field label="Capacity">
        <input type="number" min="0" step="0.01" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="16.00" />
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
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([["name", name, "Enter a type name"]]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

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
    <form onSubmit={submit} className="form-grid" noValidate>
      <Field label="Type name" error={issues.name}>
        <input value={name} onChange={(event) => { setName(event.target.value); setIssues({}); }} placeholder="Container" />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add type" />
    </form>
  );
}

function AssignmentForm({ vehicles, drivers, helpers, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "",
    driver_id: "",
    helper_id: "",
    start_date: today(),
    end_date: "",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["vehicle_id", form.vehicle_id, "Select a vehicle"],
      ["start_date", form.start_date, "Choose a start date"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

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
    <form onSubmit={submit} className="form-grid" noValidate>
      <Field label="Vehicle" error={issues.vehicle_id}>
        <Select value={form.vehicle_id} onChange={set("vehicle_id")}>
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
      <Field label="Start date" error={issues.start_date}>
        <input type="date" value={form.start_date} onChange={set("start_date")} />
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
  const toast = useToast();
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
  const focus = useSearchFocus(params, rows, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const actionLabel = tab === "types" ? "New Type" : tab === "assignments" ? "Assign Crew" : "New Vehicle";

  return (
    <section>
      <PageHeader title="Vehicles" subtitle="Vehicles, types, and driver or helper assignments.">
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
            highlightId={focus}
            empty={query ? "No vehicle types match this search." : "No vehicle types yet."}
            emptyAction={query ? null : { label: "New Type", onClick: () => setModal("types") }}
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
            ]}
          />
        ) : tab === "assignments" ? (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query ? "No assignments match this search." : "No crew is assigned."}
            emptyAction={query ? null : { label: "Assign Crew", onClick: () => setModal("assignments") }}
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
            highlightId={focus}
            empty={query ? "No vehicles match this search." : "No vehicles yet."}
            emptyAction={query ? null : { label: "New Vehicle", onClick: () => setModal("vehicles") }}
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
          <VehicleForm types={data.types} onClose={() => setModal("")} onCreated={() => { setModal(""); toast("Vehicle added"); reload(); }} />
        </Modal>
      ) : null}
      {modal === "types" ? (
        <Modal title="New Vehicle Type" onClose={() => setModal("")}>
          <TypeForm onClose={() => setModal("")} onCreated={() => { setModal(""); toast("Vehicle type added"); reload(); }} />
        </Modal>
      ) : null}
      {modal === "assignments" && data ? (
        <Modal title="Assign Crew" onClose={() => setModal("")} wide>
          <AssignmentForm
            vehicles={data.vehicles}
            drivers={data.drivers}
            helpers={data.helpers}
            onClose={() => setModal("")}
            onCreated={() => { setModal(""); toast("Crew assigned"); reload(); }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
