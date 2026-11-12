import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll, openApiFile } from "../api";
import { endpoints } from "../api/endpoints";
import {
  Banner,
  DataTable,
  DeleteButton,
  DetailList,
  Field,
  FormActions,
  FormLegend,
  Modal,
  PageHeader,
  Pager,
  RowActions,
  SearchField,
  Select,
  StatusPill,
  Tabs,
  ViewButton,
} from "../components/ui";
import { blankIssues, formatDate, hasIssues, includesQuery, today, usePaged, useResource, useSearchFocus } from "../lib";
import { useToast } from "../toast";

const VEHICLE_DOC_TYPES = ["RC", "INSURANCE", "FITNESS", "PERMIT", "PUC", "ROAD_TAX"];

function VehicleDocUpload({ vehicleId, onUploaded }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    document_type: "RC",
    document_number: "",
    issue_date: "",
    expiry_date: "",
    file: null,
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["document_type", form.document_type, "Select document type"],
      ["document_number", form.document_number, "Enter document number"],
      ["issue_date", form.issue_date, "Choose issue date"],
      ["expiry_date", form.expiry_date, "Choose expiry date"],
    ]);
    if (!form.file) nextIssues.file = "Choose a PDF / JPG / PNG file";
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("document_type", form.document_type);
      fd.append("document_number", form.document_number.trim());
      fd.append("issue_date", form.issue_date);
      fd.append("expiry_date", form.expiry_date);
      fd.append("file", form.file);
      await api(endpoints.vehicleDocumentsFor(vehicleId), { method: "POST", formData: fd });
      setForm({
        document_type: "RC",
        document_number: "",
        issue_date: "",
        expiry_date: "",
        file: null,
      });
      onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Document type" required error={issues.document_type}>
        <Select value={form.document_type} onChange={set("document_type")}>
          {VEHICLE_DOC_TYPES.map((type) => (
            <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Document number" required error={issues.document_number}>
        <input value={form.document_number} onChange={set("document_number")} placeholder="RC / policy no." />
      </Field>
      <Field label="Issue date" required error={issues.issue_date}>
        <input type="date" value={form.issue_date} onChange={set("issue_date")} />
      </Field>
      <Field label="Expiry date" required error={issues.expiry_date}>
        <input type="date" value={form.expiry_date} onChange={set("expiry_date")} />
      </Field>
      <Field label="File (PDF / JPG / PNG)" required error={issues.file} hint="Upload only — URL paste is not used here">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
          onChange={(event) => {
            setForm((current) => ({ ...current, file: event.target.files?.[0] || null }));
            setIssues((current) => ({ ...current, file: "" }));
          }}
        />
      </Field>
      {form.file ? <p className="muted span-2">Selected: {form.file.name}</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <div className="form-actions span-2">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Uploading..." : "Upload document"}
        </button>
      </div>
    </form>
  );
}

function VehicleDocsPanel({ vehicle, onClose, toast }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const loadDocs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`${endpoints.vehicleDocumentsFor(vehicle.id)}?limit=100`);
      setDocs(data.documents || []);
    } catch (err) {
      setError(err.message);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [vehicle.id]);

  const openFile = async (url) => {
    try {
      await openApiFile(url);
    } catch (err) {
      toast(err.message || "Could not open file");
    }
  };

  return (
    <div className="stack">
      <DetailList rows={[
        ["Type", vehicle.type_name],
        ["Make", vehicle.make],
        ["Model", vehicle.model],
        ["Ownership", vehicle.ownership],
        ["Capacity", vehicle.capacity],
        ["Availability", vehicle.availability_status ? String(vehicle.availability_status).replaceAll("_", " ") : null],
        ["Status", Number(vehicle.status) === 1 ? "Active" : Number(vehicle.status) === 2 ? "Maintenance" : "Inactive"],
      ]} />

      <div className="card-head" style={{ padding: 0 }}>
        <h3 style={{ margin: 0 }}>Documents</h3>
        <button className="btn btn-primary table-action" type="button" onClick={() => setShowUpload((v) => !v)}>
          {showUpload ? "Hide upload" : "Upload document"}
        </button>
      </div>
      <Banner>{error}</Banner>
      {showUpload ? (
        <VehicleDocUpload
          vehicleId={vehicle.id}
          onUploaded={() => {
            setShowUpload(false);
            toast("Document uploaded");
            loadDocs();
          }}
        />
      ) : null}
      {loading ? <p className="muted">Loading documents...</p> : (
        <DataTable
          rows={docs}
          empty="No documents for this vehicle yet."
          emptyAction={{ label: "Upload document", onClick: () => setShowUpload(true) }}
          columns={[
            { key: "type", label: "Type", render: (row) => row.document_type },
            { key: "number", label: "Number", render: (row) => row.document_number || "—" },
            { key: "issue", label: "Issue", render: (row) => formatDate(row.issue_date) },
            { key: "expiry", label: "Expiry", render: (row) => formatDate(row.expiry_date) },
            { key: "verify", label: "Verify", render: (row) => row.verification_status || "—" },
            {
              key: "file",
              label: "File",
              render: (row) => (row.document_url
                ? <button className="btn btn-ghost table-action" type="button" onClick={() => openFile(row.document_url)}>Open</button>
                : "—"),
            },
          ]}
        />
      )}
      <div className="form-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function VehicleForm({ types, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_type_id: types[0] ? String(types[0].id) : "",
    registration_no: "",
    make: "",
    model: "",
    ownership: "OWNED",
    capacity: "",
    status: "1",
  });

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["vehicle_type_id", form.vehicle_type_id, "Select a vehicle type"],
      ["registration_no", form.registration_no, "Enter the registration number"],
      ["make", form.make, "Enter the make"],
      ["model", form.model, "Enter the model"],
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
          make: form.make.trim(),
          model: form.model.trim(),
          ownership: form.ownership,
          capacity: form.capacity === "" ? null : Number(form.capacity),
          status: Number(form.status),
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
      <Field label="Vehicle type" required error={issues.vehicle_type_id}>
        <Select value={form.vehicle_type_id} onChange={(event) => { setForm({ ...form, vehicle_type_id: event.target.value }); setIssues((current) => ({ ...current, vehicle_type_id: "" })); }}>
          <option value="">Select type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Registration no" required error={issues.registration_no}>
        <input value={form.registration_no} onChange={(event) => { setForm({ ...form, registration_no: event.target.value }); setIssues((current) => ({ ...current, registration_no: "" })); }} placeholder="MH01AB1234" />
      </Field>
      <Field label="Make" required error={issues.make}>
        <input value={form.make} onChange={(event) => { setForm({ ...form, make: event.target.value }); setIssues((current) => ({ ...current, make: "" })); }} placeholder="Tata" />
      </Field>
      <Field label="Model" required error={issues.model}>
        <input value={form.model} onChange={(event) => { setForm({ ...form, model: event.target.value }); setIssues((current) => ({ ...current, model: "" })); }} placeholder="Prima 4028" />
      </Field>
      <Field label="Ownership" required>
        <Select value={form.ownership} onChange={(event) => setForm({ ...form, ownership: event.target.value })}>
          <option value="OWNED">Owned</option>
          <option value="HIRED">Hired</option>
        </Select>
      </Field>
      <Field label="Capacity">
        <input type="number" min="0" step="0.01" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="16.00" />
      </Field>
      <Field label="Status">
        <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
          <option value="2">Maintenance</option>
        </Select>
      </Field>
      {types.length === 0 ? <p className="form-error span-2">Add a vehicle type before registering a vehicle.</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy || types.length === 0} submitLabel="Add vehicle" />
    </form>
  );
}

function TypeForm({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("1");
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
      await api("/api/vehicle-types", { method: "POST", body: { name: name.trim(), status: Number(status) } });
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
      <Field label="Type name" required error={issues.name}>
        <input value={name} onChange={(event) => { setName(event.target.value); setIssues({}); }} placeholder="Container" />
      </Field>
      <Field label="Status">
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </Select>
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
    is_active: "1",
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
          is_active: Number(form.is_active),
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
      <Field label="Vehicle" required error={issues.vehicle_id}>
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
      <Field label="Start date" required error={issues.start_date}>
        <input type="date" value={form.start_date} onChange={set("start_date")} />
      </Field>
      <Field label="End date">
        <input type="date" value={form.end_date} onChange={set("end_date")} />
      </Field>
      <Field label="Active">
        <Select value={form.is_active} onChange={set("is_active")}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </Select>
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
  const [detail, setDetail] = useState(null);
  const { data, loading, error, reload } = useResource(async () => {
    const [vehicles, types, assignments, drivers, helpers] = await Promise.all([
      fetchAll("/api/vehicles", "vehicles"),
      fetchAll("/api/vehicle-types", "vehicleTypes"),
      fetchAll("/api/vehicle-assignments", "assignments"),
      fetchAll("/api/drivers", "drivers"),
      fetchAll("/api/helpers", "helpers"),
    ]);
    return {
      vehicles: vehicles.rows,
      types: types.rows,
      assignments: assignments.rows,
      drivers: drivers.rows,
      helpers: helpers.rows,
      vehicleTotal: vehicles.total,
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
      .filter((row) => includesQuery(row, query, ["registration_no", "type_name", "capacity", "make", "model", "ownership"]));
  }, [data, tab, query, typeName, vehicleName, driverName, helperName]);
  const pager = usePaged(rows);
  const focus = useSearchFocus(params, rows, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const removeRow = async (row) => {
    const path =
      tab === "types"
        ? endpoints.vehicleType(row.id)
        : tab === "assignments"
          ? endpoints.vehicleAssignment(row.id)
          : endpoints.vehicle(row.id);
    const label =
      tab === "types" ? "Vehicle type deactivated" : tab === "assignments" ? "Assignment closed" : "Vehicle deactivated";
    const confirmName =
      tab === "types"
        ? row.name || "this type"
        : tab === "assignments"
          ? row.vehicle_name || "this assignment"
          : row.registration_no || "this vehicle";

    try {
      await api(path, { method: "DELETE" });
      toast(label);
      if (detail?.row?.id === row.id) setDetail(null);
      reload();
    } catch (err) {
      toast(err.message || `Could not delete ${confirmName}`);
    }
  };

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
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <DeleteButton
                    disabled={Number(row.status) === 0}
                    confirmMessage={`Deactivate ${row.name || "this vehicle type"}?`}
                    onClick={() => removeRow(row)}
                  />
                ),
              },
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
              { key: "end", label: "End", render: (row) => formatDate(row.end_date) },
              { key: "active", label: "Active", render: (row) => <StatusPill value={row.is_active} active /> },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <RowActions>
                    <ViewButton onClick={() => setDetail({ kind: "assignment", row })} />
                    <DeleteButton
                      disabled={Number(row.is_active) === 0}
                      confirmMessage={`Close assignment for ${row.vehicle_name || "this vehicle"}?`}
                      onClick={() => removeRow(row)}
                    />
                  </RowActions>
                ),
              },
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
              { key: "make", label: "Make / Model", render: (row) => [row.make, row.model].filter(Boolean).join(" ") || "—" },
              { key: "ownership", label: "Ownership", render: (row) => row.ownership ? String(row.ownership).replaceAll("_", " ") : "—" },
              { key: "capacity", label: "Capacity", render: (row) => row.capacity || "—" },
              ...(data?.vehicles?.some((row) => row.availability_status)
                ? [{ key: "availability", label: "Availability", render: (row) => (row.availability_status ? <StatusPill value={row.availability_status} /> : "—") }]
                : []),
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <RowActions>
                    <ViewButton onClick={() => setDetail({ kind: "vehicle", row })} />
                    <button className="btn btn-ghost table-action" type="button" onClick={() => setDetail({ kind: "vehicle", row, docs: true })}>
                      Docs
                    </button>
                    <DeleteButton
                      disabled={Number(row.status) === 0}
                      confirmMessage={`Deactivate ${row.registration_no || "this vehicle"}?`}
                      onClick={() => removeRow(row)}
                    />
                  </RowActions>
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>

      {detail ? (
        <Modal
          title={detail.kind === "vehicle" ? detail.row.registration_no : detail.row.vehicle_name}
          onClose={() => setDetail(null)}
          wide={detail.kind === "vehicle"}
        >
          {detail.kind === "vehicle" ? (
            <VehicleDocsPanel vehicle={detail.row} onClose={() => setDetail(null)} toast={toast} />
          ) : (
            <DetailList rows={[
              ["Vehicle", detail.row.vehicle_name],
              ["Driver", detail.row.driver_name],
              ["Helper", detail.row.helper_name],
              ["Start", formatDate(detail.row.start_date)],
              ["End", formatDate(detail.row.end_date)],
              ["Active", Number(detail.row.is_active) === 1 ? "Yes" : "No"],
            ]} />
          )}
        </Modal>
      ) : null}

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
