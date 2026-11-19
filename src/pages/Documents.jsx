import { useMemo, useState } from "react";
import { api, fetchAll, openApiFile } from "../api";
import { endpoints } from "../api/endpoints";
import { Icon } from "../components/Icons";
import {
  Banner,
  DataTable,
  DeleteButton,
  ExpiresInFields,
  ExpiryBadge,
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
} from "../components/ui";
import {
  DEFAULT_EXPIRES_IN_DAYS,
  blankIssues,
  calcExpiryDate,
  formatDate,
  hasIssues,
  includesQuery,
  usePaged,
  useResource,
} from "../lib";
import { useToast } from "../toast";

const VEHICLE_TYPES = ["RC", "INSURANCE", "FITNESS", "PERMIT", "PUC", "ROAD_TAX"];
const PEOPLE_TYPES = ["LICENSE", "AADHAAR", "PAN", "OTHER"];

async function loadOwnedDocs(people, path, label) {
  const groups = await Promise.all(
    people.slice(0, 40).map(async (person) => {
      try {
        const data = await api(`${path}/${person.id}?limit=50`);
        return (data.documents || []).map((doc) => ({
          ...doc,
          owner: person.name || person.registration_no,
          ownerKind: label,
          _key: `${label}-${doc.id}`,
        }));
      } catch {
        return [];
      }
    })
  );
  return groups.flat();
}

function DocumentForm({ kind, owners, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const typeOptions = kind === "vehicle" ? VEHICLE_TYPES : PEOPLE_TYPES;
  const [form, setForm] = useState({
    owner_id: owners[0]?.id ? String(owners[0].id) : "",
    document_type: typeOptions[0] || "",
    document_number: "",
    issue_date: "",
    expires_in_days: DEFAULT_EXPIRES_IN_DAYS,
    expiry_date: calcExpiryDate("", DEFAULT_EXPIRES_IN_DAYS),
    file: null,
  });
  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "issue_date") {
        next.expiry_date = calcExpiryDate(value, current.expires_in_days);
      }
      return next;
    });
    setIssues((current) => ({ ...current, [key]: "", expiry_date: key === "issue_date" ? "" : current.expiry_date }));
  };

  const setExpiresIn = (days) => {
    setForm((current) => ({
      ...current,
      expires_in_days: days,
      expiry_date: calcExpiryDate(current.issue_date, days),
    }));
    setIssues((current) => ({ ...current, expiry_date: "" }));
  };

  const takeFile = (file) => {
    if (!file) return;
    setForm((current) => ({ ...current, file }));
    setIssues((current) => ({ ...current, file: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["owner_id", form.owner_id, "Select who this document belongs to"],
      ["document_type", form.document_type, "Select the document type"],
      ["document_number", form.document_number, "Enter document number"],
      ["issue_date", form.issue_date, "Choose issue date"],
      ["expiry_date", form.expiry_date, "Choose expiry date"],
    ]);
    if (!form.file) nextIssues.file = "Choose a PDF / JPG / PNG file";
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    const path = kind === "vehicle"
      ? endpoints.vehicleDocumentsFor(form.owner_id)
      : kind === "driver"
        ? endpoints.driverDocument(form.owner_id)
        : endpoints.helperDocument(form.owner_id);

    try {
      const fd = new FormData();
      fd.append("document_type", form.document_type);
      fd.append("document_number", form.document_number.trim());
      fd.append("issue_date", form.issue_date);
      fd.append("expiry_date", form.expiry_date);
      fd.append("file", form.file);
      if (kind === "vehicle") fd.append("vehicle_id", form.owner_id);
      await api(path, { method: "POST", formData: fd });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="doc-upload" noValidate>
      <div className="doc-upload-head">
        <span className="doc-upload-icon">
          <Icon name="file" size={18} />
        </span>
        <div>
          <strong>Upload {kind} document</strong>
          <p>Pick owner and type, then drop the file below.</p>
        </div>
      </div>

      <FormLegend />

      <div className="form-grid">
        <Field label={kind === "vehicle" ? "Vehicle" : kind === "driver" ? "Driver" : "Helper"} required error={issues.owner_id}>
          <Select value={form.owner_id} onChange={set("owner_id")}>
            <option value="">Select</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.registration_no || owner.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Document number" required error={issues.document_number}>
          <input value={form.document_number} onChange={set("document_number")} placeholder="Number / ID" />
        </Field>
        <Field label="Issue date" required error={issues.issue_date}>
          <input type="date" value={form.issue_date} onChange={set("issue_date")} />
        </Field>
        <ExpiresInFields
          issueDate={form.issue_date}
          expiresInDays={form.expires_in_days}
          expiryDate={form.expiry_date}
          onExpiresInChange={setExpiresIn}
          error={issues.expiry_date}
        />
      </div>

      <div className={`field${issues.document_type ? " invalid" : ""}`}>
        <span className="field-label">Document type <span className="req">*</span></span>
        <div className="chip-row" role="group" aria-label="Document type">
          {typeOptions.map((type) => (
            <button
              key={type}
              type="button"
              className={`chip-btn${form.document_type === type ? " active" : ""}`}
              onClick={() => {
                setForm((current) => ({ ...current, document_type: type }));
                setIssues((current) => ({ ...current, document_type: "" }));
              }}
            >
              {type.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        {issues.document_type ? <small className="field-error">{issues.document_type}</small> : null}
      </div>

      <div className={`field${issues.file ? " invalid" : ""}`}>
        <span className="field-label">File <span className="req">*</span></span>
        <label
          className={`dropzone${dragOver ? " drag" : ""}${issues.file ? " invalid" : ""}${form.file ? " has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
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
          <span className="dropzone-icon">
            <Icon name="download" size={22} />
          </span>
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
        {issues.file ? <small className="field-error">{issues.file}</small> : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={busy ? "Uploading..." : "Upload document"} />
    </form>
  );
}

export default function Documents() {
  const toast = useToast();
  const [tab, setTab] = useState("vehicle");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const settled = await Promise.allSettled([
      fetchAll("/api/vehicles", "vehicles"),
      fetchAll("/api/drivers", "drivers"),
      fetchAll("/api/helpers", "helpers"),
      fetchAll("/api/vehicle-documents", "documents"),
    ]);

    const value = (result, fallback) => (result.status === "fulfilled" ? result.value : fallback);
    const vehicles = value(settled[0], { rows: [], total: 0 });
    const drivers = value(settled[1], { rows: [], total: 0 });
    const helpers = value(settled[2], { rows: [], total: 0 });
    const vehicleDocs = value(settled[3], { rows: [], total: 0 });
    const loadErrors = settled
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason?.message || "Request failed");

    if (
      settled[0].status === "rejected"
      && settled[1].status === "rejected"
      && settled[2].status === "rejected"
      && settled[3].status === "rejected"
    ) {
      throw new Error(loadErrors[0] || "Could not load documents");
    }

    const vehicleRows = vehicles.rows;
    const regs = new Map(vehicleRows.map((row) => [String(row.id), row.registration_no]));
    const [driverDocs, helperDocs] = await Promise.all([
      loadOwnedDocs(drivers.rows, "/api/driver-documents", "Driver"),
      loadOwnedDocs(helpers.rows, "/api/helper-documents", "Helper"),
    ]);

    return {
      vehicle: (vehicleDocs.rows || []).map((doc) => ({
        ...doc,
        owner: regs.get(String(doc.vehicle_id)) || `#${doc.vehicle_id}`,
        _key: `v-${doc.id}`,
      })),
      driver: driverDocs,
      helper: helperDocs,
      owners: {
        vehicle: vehicleRows,
        driver: drivers.rows,
        helper: helpers.rows,
      },
      warning: loadErrors[0] || "",
    };
  }, []);

  const filtered = useMemo(
    () => (data?.[tab] || []).filter((row) => includesQuery(row, query, ["owner", "document_type", "document_number"])),
    [data, tab, query]
  );
  const pager = usePaged(filtered);

  const removeDocument = async (row) => {
    setActionError("");
    const path =
      tab === "vehicle"
        ? endpoints.vehicleDocument(row.id)
        : tab === "driver"
          ? endpoints.driverDocument(row.id)
          : endpoints.helperDocument(row.id);

    try {
      await api(path, { method: "DELETE" });
      toast("Document deactivated");
      reload();
    } catch (err) {
      setActionError(err.message || "Could not delete document");
      toast(err.message || "Could not delete document");
    }
  };

  const openFile = async (url) => {
    try {
      await openApiFile(url);
    } catch (err) {
      toast(err.message || "Could not open file");
    }
  };

  return (
    <section>
      <PageHeader title="Documents" subtitle="Upload RC, insurance, license and other compliance files (PDF / JPG / PNG).">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          Upload Document
        </button>
      </PageHeader>
      <Banner>{error || actionError || data?.warning}</Banner>
      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          pager.setPage(1);
        }}
        tabs={[
          { id: "vehicle", label: "Vehicles" },
          { id: "driver", label: "Drivers" },
          { id: "helper", label: "Helpers" },
        ]}
      />
      <article className="card table-card">
        <div className="card-head">
          <h2>Records</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading documents...</p> : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No documents match this search." : "No documents in this folder."}
            emptyAction={query ? null : { label: "Upload Document", onClick: () => setOpen(true) }}
            columns={[
              { key: "owner", label: "Owner", render: (row) => row.owner },
              { key: "type", label: "Type", render: (row) => row.document_type },
              { key: "number", label: "Number", render: (row) => row.document_number || "—" },
              { key: "issue", label: "Issue", render: (row) => formatDate(row.issue_date) },
              { key: "expiry", label: "Expiry", render: (row) => <ExpiryBadge expiryDate={row.expiry_date} /> },
              {
                key: "url",
                label: "File",
                render: (row) => (row.document_url
                  ? <button className="btn btn-ghost table-action" type="button" onClick={() => openFile(row.document_url)}>Open</button>
                  : "—"),
              },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <DeleteButton
                    disabled={Number(row.status) === 0}
                    confirmMessage={`Deactivate ${row.document_type || "this document"} for ${row.owner || "this owner"}?`}
                    onClick={() => removeDocument(row)}
                  />
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open && data ? (
        <Modal title="Upload Document" onClose={() => setOpen(false)} wide>
          <DocumentForm
            kind={tab}
            owners={data.owners[tab]}
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("Document uploaded");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
