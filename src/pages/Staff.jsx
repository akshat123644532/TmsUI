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
  Tabs,
} from "../components/ui";
import { includesQuery, usePaged, useResource } from "../lib";

function PersonForm({ kind, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    license_number: "",
  });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const body = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    };

    if (kind === "driver" && form.license_number.trim()) {
      body.license_number = form.license_number.trim();
    }

    try {
      await api(kind === "driver" ? "/api/drivers" : "/api/helpers", { method: "POST", body });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Name">
        <input value={form.name} onChange={set("name")} required />
      </Field>
      <Field label="Mobile">
        <input value={form.mobile} onChange={set("mobile")} required />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Address">
        <input value={form.address} onChange={set("address")} />
      </Field>
      {kind === "driver" ? (
        <Field label="License number">
          <input value={form.license_number} onChange={set("license_number")} placeholder="Saved as a license document" />
        </Field>
      ) : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={kind === "driver" ? "Add driver" : "Add helper"} />
    </form>
  );
}

export default function Staff() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState("drivers");
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useResource(async () => {
    const [drivers, helpers] = await Promise.all([
      api("/api/drivers?limit=100"),
      api("/api/helpers?limit=100"),
    ]);
    return {
      drivers: drivers.drivers || [],
      helpers: helpers.helpers || [],
      driverTotal: drivers.pagination?.total || 0,
      helperTotal: helpers.pagination?.total || 0,
    };
  }, []);

  const rows = tab === "drivers" ? data?.drivers || [] : data?.helpers || [];
  const filtered = useMemo(
    () => rows.filter((row) => includesQuery(row, query, ["name", "mobile", "email", "address"])),
    [rows, query]
  );
  const pager = usePaged(filtered);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  return (
    <section>
      <PageHeader title="Staff Management" subtitle="Drivers and helpers assigned to your fleet.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          {tab === "drivers" ? "New Driver" : "New Helper"}
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
          { id: "drivers", label: `Drivers (${data?.driverTotal || 0})` },
          { id: "helpers", label: `Helpers (${data?.helperTotal || 0})` },
        ]}
      />
      <article className="card table-card">
        <div className="card-head">
          <h2>{tab === "drivers" ? "Drivers" : "Helpers"}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading staff...</p> : (
          <DataTable
            rows={pager.rows}
            empty={`No ${tab} match this search.`}
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "mobile", label: "Mobile", render: (row) => row.mobile || "—" },
              { key: "email", label: "Email", render: (row) => row.email || "—" },
              { key: "address", label: "Address", render: (row) => row.address || "—" },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open ? (
        <Modal title={tab === "drivers" ? "New Driver" : "New Helper"} onClose={() => setOpen(false)}>
          <PersonForm
            kind={tab === "drivers" ? "driver" : "helper"}
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
