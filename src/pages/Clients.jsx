import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
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
  ViewButton,
} from "../components/ui";
import { blankIssues, hasIssues, includesQuery, usePaged, useResource, useSearchFocus } from "../lib";
import { useToast } from "../toast";

function ClientForm({ onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    gst_number: "",
    status: "1",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["name", form.name, "Enter the client name"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      await api("/api/clients", {
        method: "POST",
        body: {
          name: form.name.trim(),
          mobile: form.mobile.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          gst_number: form.gst_number.trim() || null,
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
      <Field label="Client name" required error={issues.name}>
        <input value={form.name} onChange={set("name")} placeholder="Acme Logistics" />
      </Field>
      <Field label="Mobile">
        <input value={form.mobile} onChange={set("mobile")} placeholder="9876543210" />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field label="GST number">
        <input value={form.gst_number} onChange={set("gst_number")} />
      </Field>
      <Field label="Address">
        <input value={form.address} onChange={set("address")} />
      </Field>
      <Field label="Status">
        <Select value={form.status} onChange={set("status")}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </Select>
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add client" />
    </form>
  );
}

export default function Clients() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const { data, loading, error, reload } = useResource(async () => {
    const response = await fetchAll("/api/clients", "clients");
    return {
      rows: response.rows,
      total: response.total,
    };
  }, []);
  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => includesQuery(row, query, ["name", "mobile", "email", "gst_number", "address"])),
    [data, query]
  );
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const removeClient = async (row) => {
    try {
      await api(endpoints.client(row.id), { method: "DELETE" });
      toast("Client deactivated");
      reload();
    } catch (err) {
      toast(err.message || "Could not delete client");
    }
  };

  return (
    <section>
      <PageHeader title="Clients" subtitle="Clients billed for trips and shipments.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Client
        </button>
      </PageHeader>
      <Banner>{error}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Clients {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading clients...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query ? "No clients match this search." : "No clients yet."}
            emptyAction={query ? null : { label: "New Client", onClick: () => setOpen(true) }}
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "mobile", label: "Mobile", render: (row) => row.mobile || "—" },
              { key: "email", label: "Email", render: (row) => row.email || "—" },
              { key: "gst", label: "GST", render: (row) => row.gst_number || "—" },
              { key: "address", label: "Address", render: (row) => row.address || "—" },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <RowActions>
                    <ViewButton onClick={() => setDetail(row)} />
                    <DeleteButton
                      disabled={Number(row.status) === 0}
                      confirmMessage={`Deactivate ${row.name || "this client"}?`}
                      onClick={() => removeClient(row)}
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
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <DetailList rows={[
            ["Mobile", detail.mobile],
            ["Email", detail.email],
            ["GST", detail.gst_number],
            ["Address", detail.address],
            ["Status", Number(detail.status) === 1 ? "Active" : "Inactive"],
          ]} />
        </Modal>
      ) : null}
      {open ? (
        <Modal title="New Client" onClose={() => setOpen(false)}>
          <ClientForm
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("Client added");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
