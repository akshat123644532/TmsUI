import { useMemo, useState } from "react";
import { api, fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
import {
  Banner,
  DataTable,
  DeleteButton,
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
import { blankIssues, formatDate, hasIssues, includesQuery, usePaged, useResource } from "../lib";
import { useToast } from "../toast";

async function loadOwnedDocs(people, path, label) {
  const groups = await Promise.all(
    people.slice(0, 40).map(async (person) => {
      try {
        const data = await api(`${path}/${person.id}?limit=50`);
        return (data.documents || []).map((doc) => ({
          ...doc,
          owner: person.name,
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
  const [form, setForm] = useState({
    owner_id: owners[0]?.id ? String(owners[0].id) : "",
    document_type: "",
    document_number: "",
    document_url: "",
    issue_date: "",
    expiry_date: "",
    status: "1",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["owner_id", form.owner_id, "Select who this document belongs to"],
      ["document_type", form.document_type, "Enter the document type"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    const body = {
      document_type: form.document_type.trim(),
      document_number: form.document_number.trim() || null,
      document_url: form.document_url.trim() || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      status: Number(form.status),
      vehicle_id: kind === "vehicle" ? form.owner_id : undefined,
    };

    const path = kind === "vehicle"
      ? "/api/vehicle-documents"
      : kind === "driver"
        ? `/api/driver-documents/${form.owner_id}`
        : `/api/helper-documents/${form.owner_id}`;

    try {
      await api(path, { method: "POST", body });
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
      <Field label="Document type" required error={issues.document_type}>
        <input value={form.document_type} onChange={set("document_type")} placeholder="RC, INSURANCE, LICENSE" />
      </Field>
      <Field label="Document number">
        <input value={form.document_number} onChange={set("document_number")} />
      </Field>
      <Field label="Document URL">
        <input value={form.document_url} onChange={set("document_url")} placeholder="https://" />
      </Field>
      <Field label="Issue date">
        <input type="date" value={form.issue_date} onChange={set("issue_date")} />
      </Field>
      <Field label="Expiry date">
        <input type="date" value={form.expiry_date} onChange={set("expiry_date")} />
      </Field>
      <Field label="Status">
        <Select value={form.status} onChange={set("status")}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </Select>
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Save document" />
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
    const [vehicles, drivers, helpers, vehicleDocs] = await Promise.all([
      fetchAll("/api/vehicles", "vehicles"),
      fetchAll("/api/drivers", "drivers"),
      fetchAll("/api/helpers", "helpers"),
      fetchAll("/api/vehicle-documents", "documents"),
    ]);
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

  return (
    <section>
      <PageHeader title="Documents" subtitle="vehicle_documents, driver_documents, and helper_documents.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          Add Document
        </button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
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
            emptyAction={query ? null : { label: "Add Document", onClick: () => setOpen(true) }}
            columns={[
              { key: "owner", label: "Owner", render: (row) => row.owner },
              { key: "type", label: "Type", render: (row) => row.document_type },
              { key: "number", label: "Number", render: (row) => row.document_number || "—" },
              { key: "issue", label: "Issue", render: (row) => formatDate(row.issue_date) },
              { key: "expiry", label: "Expiry", render: (row) => formatDate(row.expiry_date) },
              { key: "url", label: "File", render: (row) => row.document_url ? <a className="text-link" href={row.document_url} target="_blank" rel="noreferrer">Open</a> : "—" },
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
        <Modal title="Add Document" onClose={() => setOpen(false)} wide>
          <DocumentForm
            kind={tab}
            owners={data.owners[tab]}
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("Document saved");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
