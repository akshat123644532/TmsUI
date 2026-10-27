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
  StatusPill,
} from "../components/ui";
import { includesQuery, usePaged, useResource } from "../lib";

function ClientForm({ onClose, onCreated }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    gst_number: "",
  });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
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
      <Field label="Client name">
        <input value={form.name} onChange={set("name")} required />
      </Field>
      <Field label="Mobile">
        <input value={form.mobile} onChange={set("mobile")} />
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
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add client" />
    </form>
  );
}

export default function Clients() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useResource(async () => {
    const response = await api("/api/clients?limit=100");
    return {
      rows: response.clients || [],
      total: response.pagination?.total || 0,
    };
  }, []);
  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => includesQuery(row, query, ["name", "mobile", "email", "gst_number", "address"])),
    [data, query]
  );
  const pager = usePaged(filtered);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  return (
    <section>
      <PageHeader title="CRM" subtitle="Clients billed for trips and shipments.">
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
            empty="No clients match this search."
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "mobile", label: "Mobile", render: (row) => row.mobile || "—" },
              { key: "email", label: "Email", render: (row) => row.email || "—" },
              { key: "gst", label: "GST", render: (row) => row.gst_number || "—" },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open ? (
        <Modal title="New Client" onClose={() => setOpen(false)}>
          <ClientForm
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
