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
  Tabs,
  ViewButton,
} from "../components/ui";
import { blankIssues, hasIssues, includesQuery, usePaged, useResource, useSearchFocus } from "../lib";
import { useToast } from "../toast";

function PersonForm({ kind, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    license_number: "",
    status: "1",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["name", form.name, "Enter a name"],
      ["mobile", form.mobile, "Enter a mobile number"],
    ]);
    const digits = form.mobile.replace(/\D/g, "");
    if (!nextIssues.mobile && digits.length < 10) nextIssues.mobile = "Enter at least 10 digits";
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    const body = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      status: Number(form.status),
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
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Name" required error={issues.name}>
        <input value={form.name} onChange={set("name")} />
      </Field>
      <Field label="Mobile" required error={issues.mobile}>
        <input value={form.mobile} onChange={set("mobile")} placeholder="9876543210" />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Address">
        <input value={form.address} onChange={set("address")} />
      </Field>
      {kind === "driver" ? (
        <Field label="License number" hint="Saved as driver_documents LICENSE">
          <input value={form.license_number} onChange={set("license_number")} placeholder="DL-..." />
        </Field>
      ) : null}
      <Field label="Status">
        <Select value={form.status} onChange={set("status")}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </Select>
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={kind === "driver" ? "Add driver" : "Add helper"} />
    </form>
  );
}

export default function Staff() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState("drivers");
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const { data, loading, error, reload } = useResource(async () => {
    const [drivers, helpers] = await Promise.all([
      fetchAll("/api/drivers", "drivers"),
      fetchAll("/api/helpers", "helpers"),
    ]);
    return {
      drivers: drivers.rows,
      helpers: helpers.rows,
      driverTotal: drivers.total,
      helperTotal: helpers.total,
    };
  }, []);

  const rows = tab === "drivers" ? data?.drivers || [] : data?.helpers || [];
  const filtered = useMemo(
    () => rows.filter((row) => includesQuery(row, query, ["name", "mobile", "email", "address"])),
    [rows, query]
  );
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const removePerson = async (row) => {
    const path = tab === "drivers" ? endpoints.driver(row.id) : endpoints.helper(row.id);
    try {
      await api(path, { method: "DELETE" });
      toast(tab === "drivers" ? "Driver deactivated" : "Helper deactivated");
      reload();
    } catch (err) {
      toast(err.message || "Could not delete");
    }
  };

  return (
    <section>
      <PageHeader title="Drivers & Helpers" subtitle="People assigned to vehicles and trips.">
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
            highlightId={focus}
            empty={query ? `No ${tab} match this search.` : `No ${tab} yet.`}
            emptyAction={query ? null : { label: tab === "drivers" ? "New Driver" : "New Helper", onClick: () => setOpen(true) }}
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "mobile", label: "Mobile", render: (row) => row.mobile || "—" },
              { key: "email", label: "Email", render: (row) => row.email || "—" },
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
                      confirmMessage={`Deactivate ${row.name || (tab === "drivers" ? "this driver" : "this helper")}?`}
                      onClick={() => removePerson(row)}
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
            ["Address", detail.address],
            ["Status", Number(detail.status) === 1 ? "Active" : "Inactive"],
          ]} />
        </Modal>
      ) : null}
      {open ? (
        <Modal title={tab === "drivers" ? "New Driver" : "New Helper"} onClose={() => setOpen(false)}>
          <PersonForm
            kind={tab === "drivers" ? "driver" : "helper"}
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast(tab === "drivers" ? "Driver added" : "Helper added");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
