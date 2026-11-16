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

function personLabel(row, driverName, helperName) {
  const role = String(row.assignment_role || "").toUpperCase();
  if (role === "HELPER") return helperName.get(String(row.helper_id)) || (row.helper_id ? `#${row.helper_id}` : "—");
  return driverName.get(String(row.driver_id)) || (row.driver_id ? `#${row.driver_id}` : "—");
}

function AssignmentForm({
  role,
  vehicles,
  drivers,
  helpers,
  initial = null,
  lockedVehicleId = null,
  onClose,
  onSaved,
}) {
  const editing = Boolean(initial?.id);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: String(lockedVehicleId || initial?.vehicle_id || ""),
    person_id: String(
      role === "HELPER"
        ? initial?.helper_id || ""
        : initial?.driver_id || ""
    ),
    start_date: initial?.start_date ? String(initial.start_date).slice(0, 10) : today(),
    end_date: initial?.end_date ? String(initial.end_date).slice(0, 10) : "",
    is_active: String(initial?.is_active ?? 1),
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["vehicle_id", form.vehicle_id, "Select a vehicle"],
      ["person_id", form.person_id, role === "HELPER" ? "Select a helper" : "Select a driver"],
      ["start_date", form.start_date, "Choose a start date"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    const body = {
      vehicle_id: Number(form.vehicle_id),
      assignment_role: role,
      start_date: form.start_date,
      end_date: form.end_date || null,
      is_active: Number(form.is_active),
      ...(role === "DRIVER"
        ? { driver_id: Number(form.person_id), helper_id: null }
        : { helper_id: Number(form.person_id), driver_id: null }),
    };

    try {
      if (editing) {
        await api(endpoints.vehicleAssignment(initial.id), { method: "PUT", body });
      } else {
        const createBody = {
          vehicle_id: body.vehicle_id,
          assignment_role: body.assignment_role,
          start_date: body.start_date,
          end_date: body.end_date,
          ...(role === "DRIVER"
            ? { driver_id: body.driver_id }
            : { helper_id: body.helper_id }),
        };
        await api(endpoints.vehicleAssignments, { method: "POST", body: createBody });
      }
      onSaved(editing ? "updated" : "created");
    } catch (err) {
      setError(err.message || "Could not save assignment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Vehicle" required error={issues.vehicle_id}>
        <Select
          value={form.vehicle_id}
          onChange={set("vehicle_id")}
          disabled={Boolean(lockedVehicleId)}
        >
          <option value="">Select vehicle</option>
          {vehicles.map((row) => (
            <option key={row.id} value={row.id}>{row.registration_no}</option>
          ))}
        </Select>
      </Field>
      <Field
        label={role === "HELPER" ? "Helper" : "Driver"}
        required
        error={issues.person_id}
      >
        <Select value={form.person_id} onChange={set("person_id")}>
          <option value="">{role === "HELPER" ? "Select helper" : "Select driver"}</option>
          {(role === "HELPER" ? helpers : drivers).map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Start date" required error={issues.start_date}>
        <input type="date" value={form.start_date} onChange={set("start_date")} />
      </Field>
      <Field label="End date" hint="Leave blank while assignment is open">
        <input type="date" value={form.end_date} onChange={set("end_date")} />
      </Field>
      {editing ? (
        <Field label="Active">
          <Select value={form.is_active} onChange={set("is_active")}>
            <option value="1">Active</option>
            <option value="0">Closed</option>
          </Select>
        </Field>
      ) : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions
        onCancel={onClose}
        busy={busy}
        submitLabel={
          busy
            ? "Saving..."
            : editing
              ? `Save ${role === "HELPER" ? "helper" : "driver"} assignment`
              : `Assign ${role === "HELPER" ? "helper" : "driver"}`
        }
      />
    </form>
  );
}

function VehicleAssignmentsPanel({
  vehicle,
  vehicles,
  drivers,
  helpers,
  driverName,
  helperName,
  toast,
  onChanged,
}) {
  const [panel, setPanel] = useState("active");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (panel === "history") {
        const data = await api(
          `${endpoints.vehicleAssignmentHistory}?vehicle_id=${vehicle.id}&limit=100`
        );
        setRows(data.history || data.assignments || []);
      } else {
        const data = await api(
          `${endpoints.vehicleAssignments}?vehicle_id=${vehicle.id}&status=1&limit=100`
        );
        setRows(data.assignments || []);
      }
    } catch (err) {
      setError(err.message || "Could not load assignments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [vehicle.id, panel]);

  const closeAssignment = async (row) => {
    try {
      await api(endpoints.vehicleAssignmentClose(row.id), {
        method: "PATCH",
        body: { end_date: today() },
      });
      toast("Assignment closed");
      onChanged?.();
      load();
    } catch (err) {
      toast(err.message || "Could not close assignment");
    }
  };

  const activeDriver = rows.find(
    (row) => String(row.assignment_role).toUpperCase() === "DRIVER" && Number(row.is_active) === 1
  );
  const activeHelper = rows.find(
    (row) => String(row.assignment_role).toUpperCase() === "HELPER" && Number(row.is_active) === 1
  );

  return (
    <div className="stack">
      <div className="card-head" style={{ padding: 0 }}>
        <Tabs
          value={panel}
          onChange={setPanel}
          tabs={[
            { id: "active", label: "Active now" },
            { id: "history", label: "History" },
          ]}
        />
        <div className="row-actions">
          <button className="btn btn-ghost table-action" type="button" onClick={() => setModal({ role: "DRIVER" })}>
            Assign Driver
          </button>
          <button className="btn btn-primary table-action" type="button" onClick={() => setModal({ role: "HELPER" })}>
            Assign Helper
          </button>
        </div>
      </div>
      <Banner>{error}</Banner>

      {panel === "active" && !loading ? (
        <DetailList
          rows={[
            ["Active driver", activeDriver ? personLabel(activeDriver, driverName, helperName) : "None"],
            ["Driver dates", activeDriver ? `${formatDate(activeDriver.start_date)} → ${formatDate(activeDriver.end_date)}` : "—"],
            ["Active helper", activeHelper ? personLabel(activeHelper, driverName, helperName) : "None"],
            ["Helper dates", activeHelper ? `${formatDate(activeHelper.start_date)} → ${formatDate(activeHelper.end_date)}` : "—"],
          ]}
        />
      ) : null}

      {loading ? <p className="muted">Loading assignments...</p> : (
        <DataTable
          rows={rows}
          empty={panel === "history" ? "No assignment history for this vehicle." : "No active assignments."}
          columns={[
            {
              key: "role",
              label: "Role",
              render: (row) => String(row.assignment_role || "—").replaceAll("_", " "),
            },
            {
              key: "person",
              label: "Person",
              render: (row) => personLabel(row, driverName, helperName),
            },
            { key: "start", label: "Start", render: (row) => formatDate(row.start_date) },
            { key: "end", label: "End", render: (row) => formatDate(row.end_date) },
            {
              key: "status",
              label: "Status",
              render: (row) => <StatusPill value={row.is_active} active />,
            },
            {
              key: "actions",
              label: "",
              render: (row) => (
                <RowActions>
                  <button
                    className="btn btn-ghost table-action"
                    type="button"
                    onClick={() => setModal({
                      role: String(row.assignment_role || "DRIVER").toUpperCase() === "HELPER" ? "HELPER" : "DRIVER",
                      initial: row,
                    })}
                  >
                    Edit
                  </button>
                  {Number(row.is_active) === 1 ? (
                    <DeleteButton
                      label="Close"
                      confirmMessage={`Close this ${String(row.assignment_role || "assignment").toLowerCase()} assignment? History is kept.`}
                      onClick={() => closeAssignment(row)}
                    />
                  ) : null}
                </RowActions>
              ),
            },
          ]}
        />
      )}

      {modal ? (
        <Modal
          title={modal.initial ? `Edit ${modal.role === "HELPER" ? "helper" : "driver"} assignment` : `Assign ${modal.role === "HELPER" ? "helper" : "driver"}`}
          onClose={() => setModal(null)}
        >
          <AssignmentForm
            role={modal.role}
            vehicles={vehicles}
            drivers={drivers}
            helpers={helpers}
            initial={modal.initial || null}
            lockedVehicleId={vehicle.id}
            onClose={() => setModal(null)}
            onSaved={(mode) => {
              setModal(null);
              toast(mode === "updated" ? "Assignment updated" : "Assignment created");
              onChanged?.();
              load();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

export default function Fleet() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState("vehicles");
  const [assignView, setAssignView] = useState("active");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [query, setQuery] = useState(params.get("q") || "");
  const [modal, setModal] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [vehiclePanel, setVehiclePanel] = useState("docs");
  const { data, loading, error, reload } = useResource(async () => {
    const [vehicles, types, active, history, drivers, helpers] = await Promise.all([
      fetchAll("/api/vehicles", "vehicles"),
      fetchAll("/api/vehicle-types", "vehicleTypes"),
      fetchAll(`${endpoints.vehicleAssignments}?status=1`, "assignments"),
      fetchAll(endpoints.vehicleAssignmentHistory, "history"),
      fetchAll("/api/drivers", "drivers"),
      fetchAll("/api/helpers", "helpers"),
    ]);
    return {
      vehicles: vehicles.rows,
      types: types.rows,
      active: active.rows,
      history: history.rows,
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

  const enrichAssignment = (row) => ({
    ...row,
    vehicle_name: vehicleName.get(String(row.vehicle_id)) || "—",
    person_name: personLabel(row, driverName, helperName),
    role_label: String(row.assignment_role || "—").replaceAll("_", " "),
  });

  const rows = useMemo(() => {
    if (tab === "types") {
      return (data?.types || []).filter((row) => includesQuery(row, query, ["name"]));
    }

    if (tab === "assignments") {
      const source = assignView === "history" ? data?.history || [] : data?.active || [];
      return source
        .map(enrichAssignment)
        .filter((row) => {
          if (roleFilter !== "ALL" && String(row.assignment_role || "").toUpperCase() !== roleFilter) {
            return false;
          }
          return includesQuery(row, query, ["vehicle_name", "person_name", "role_label"]);
        });
    }

    return (data?.vehicles || [])
      .map((row) => ({ ...row, type_name: typeName.get(String(row.vehicle_type_id)) || "—" }))
      .filter((row) => includesQuery(row, query, ["registration_no", "type_name", "capacity", "make", "model", "ownership"]));
  }, [data, tab, query, typeName, vehicleName, driverName, helperName, assignView, roleFilter]);
  const pager = usePaged(rows);
  const focus = useSearchFocus(params, rows, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const removeRow = async (row) => {
    if (tab === "assignments") {
      try {
        await api(endpoints.vehicleAssignmentClose(row.id), {
          method: "PATCH",
          body: { end_date: today() },
        });
        toast("Assignment closed");
        if (editRow?.id === row.id) setEditRow(null);
        reload();
      } catch (err) {
        toast(err.message || "Could not close assignment");
      }
      return;
    }

    const path = tab === "types" ? endpoints.vehicleType(row.id) : endpoints.vehicle(row.id);
    const label = tab === "types" ? "Vehicle type deactivated" : "Vehicle deactivated";
    const confirmName = tab === "types" ? row.name || "this type" : row.registration_no || "this vehicle";

    try {
      await api(path, { method: "DELETE" });
      toast(label);
      if (detail?.row?.id === row.id) setDetail(null);
      reload();
    } catch (err) {
      toast(err.message || `Could not delete ${confirmName}`);
    }
  };

  return (
    <section>
      <PageHeader title="Vehicles" subtitle="Vehicles, types, and separate driver or helper assignments.">
        {tab === "assignments" ? (
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setModal("assign-driver")}>
              Assign Driver
            </button>
            <button className="btn btn-primary" type="button" onClick={() => setModal("assign-helper")}>
              Assign Helper
            </button>
          </>
        ) : (
          <button className="btn btn-primary" type="button" onClick={() => setModal(tab)}>
            {tab === "types" ? "New Type" : "New Vehicle"}
          </button>
        )}
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
          <h2>
            {tab === "types"
              ? "Vehicle types"
              : tab === "assignments"
                ? assignView === "history"
                  ? "Assignment history"
                  : "Active assignments"
                : "Fleet"}
          </h2>
          <div className="row-actions">
            {tab === "assignments" ? (
              <>
                <Tabs
                  value={assignView}
                  onChange={(next) => {
                    setAssignView(next);
                    pager.setPage(1);
                  }}
                  tabs={[
                    { id: "active", label: "Active now" },
                    { id: "history", label: "History" },
                  ]}
                />
                <Select
                  value={roleFilter}
                  onChange={(event) => {
                    setRoleFilter(event.target.value);
                    pager.setPage(1);
                  }}
                >
                  <option value="ALL">All roles</option>
                  <option value="DRIVER">Driver</option>
                  <option value="HELPER">Helper</option>
                </Select>
              </>
            ) : null}
            <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
          </div>
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
            empty={
              query
                ? "No assignments match this search."
                : assignView === "history"
                  ? "No assignment history yet."
                  : "No active driver or helper assignments."
            }
            emptyAction={
              query || assignView === "history"
                ? null
                : { label: "Assign Driver", onClick: () => setModal("assign-driver") }
            }
            columns={[
              { key: "vehicle", label: "Vehicle", render: (row) => row.vehicle_name },
              { key: "role", label: "Role", render: (row) => row.role_label },
              { key: "person", label: "Person", render: (row) => row.person_name },
              { key: "start", label: "Start", render: (row) => formatDate(row.start_date) },
              { key: "end", label: "End", render: (row) => formatDate(row.end_date) },
              { key: "active", label: "Status", render: (row) => <StatusPill value={row.is_active} active /> },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <RowActions>
                    <button
                      className="btn btn-ghost table-action"
                      type="button"
                      onClick={() => setEditRow(row)}
                    >
                      Edit
                    </button>
                    <DeleteButton
                      label="Close"
                      disabled={Number(row.is_active) === 0}
                      confirmMessage={`Close ${row.role_label || "assignment"} on ${row.vehicle_name || "this vehicle"}? History is kept.`}
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
                    <ViewButton onClick={() => { setVehiclePanel("docs"); setDetail({ kind: "vehicle", row }); }} />
                    <button
                      className="btn btn-ghost table-action"
                      type="button"
                      onClick={() => { setVehiclePanel("assignments"); setDetail({ kind: "vehicle", row }); }}
                    >
                      Assignments
                    </button>
                    <button className="btn btn-ghost table-action" type="button" onClick={() => { setVehiclePanel("docs"); setDetail({ kind: "vehicle", row }); }}>
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

      {detail?.kind === "vehicle" && data ? (
        <Modal title={detail.row.registration_no} onClose={() => setDetail(null)} wide>
          <Tabs
            value={vehiclePanel}
            onChange={setVehiclePanel}
            tabs={[
              { id: "docs", label: "Documents" },
              { id: "assignments", label: "Assignments" },
            ]}
          />
          {vehiclePanel === "assignments" ? (
            <VehicleAssignmentsPanel
              vehicle={detail.row}
              vehicles={data.vehicles}
              drivers={data.drivers}
              helpers={data.helpers}
              driverName={driverName}
              helperName={helperName}
              toast={toast}
              onChanged={reload}
            />
          ) : (
            <VehicleDocsPanel vehicle={detail.row} onClose={() => setDetail(null)} toast={toast} />
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
      {modal === "assign-driver" && data ? (
        <Modal title="Assign Driver" onClose={() => setModal("")}>
          <AssignmentForm
            role="DRIVER"
            vehicles={data.vehicles}
            drivers={data.drivers}
            helpers={data.helpers}
            onClose={() => setModal("")}
            onSaved={() => { setModal(""); toast("Driver assigned"); reload(); }}
          />
        </Modal>
      ) : null}
      {modal === "assign-helper" && data ? (
        <Modal title="Assign Helper" onClose={() => setModal("")}>
          <AssignmentForm
            role="HELPER"
            vehicles={data.vehicles}
            drivers={data.drivers}
            helpers={data.helpers}
            onClose={() => setModal("")}
            onSaved={() => { setModal(""); toast("Helper assigned"); reload(); }}
          />
        </Modal>
      ) : null}
      {editRow && data ? (
        <Modal
          title={`Edit ${String(editRow.assignment_role || "").toUpperCase() === "HELPER" ? "helper" : "driver"} assignment`}
          onClose={() => setEditRow(null)}
        >
          <AssignmentForm
            role={String(editRow.assignment_role || "DRIVER").toUpperCase() === "HELPER" ? "HELPER" : "DRIVER"}
            vehicles={data.vehicles}
            drivers={data.drivers}
            helpers={data.helpers}
            initial={editRow}
            onClose={() => setEditRow(null)}
            onSaved={() => { setEditRow(null); toast("Assignment updated"); reload(); }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
