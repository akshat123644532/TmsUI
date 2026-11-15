import { useMemo, useState } from "react";
import { api, fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
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
  StatusPill,
  ViewButton,
} from "../components/ui";
import { blankIssues, hasIssues, includesQuery, isSuperAdminRole, usePaged, useResource } from "../lib";
import { useToast } from "../toast";

function CompanyForm({ onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [form, setForm] = useState({
    name: "",
    admin_name: "",
    admin_mobile: "",
    admin_email: "",
    admin_password: "",
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["name", form.name, "Enter company name"],
      ["admin_name", form.admin_name, "Enter admin name"],
      ["admin_mobile", form.admin_mobile, "Enter admin mobile"],
      ["admin_email", form.admin_email, "Enter admin email"],
      ["admin_password", form.admin_password, "Enter admin password"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      await api(endpoints.companies, {
        method: "POST",
        body: {
          name: form.name.trim(),
          admin_name: form.admin_name.trim(),
          admin_mobile: form.admin_mobile.trim(),
          admin_email: form.admin_email.trim().toLowerCase(),
          admin_password: form.admin_password,
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message || "Could not create company");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Company name" required error={issues.name}>
        <input value={form.name} onChange={set("name")} autoFocus />
      </Field>
      <Field label="Admin name" required error={issues.admin_name}>
        <input value={form.admin_name} onChange={set("admin_name")} />
      </Field>
      <Field label="Admin mobile" required error={issues.admin_mobile}>
        <input value={form.admin_mobile} onChange={set("admin_mobile")} />
      </Field>
      <Field label="Admin email" required error={issues.admin_email}>
        <input type="email" value={form.admin_email} onChange={set("admin_email")} />
      </Field>
      <Field label="Admin password" required error={issues.admin_password} hint="Min 8 characters, letter + number">
        <input type="password" value={form.admin_password} onChange={set("admin_password")} autoComplete="new-password" />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <div className="span-2">
        <FormActions busy={busy} submitLabel="Create company" onCancel={onClose} />
      </div>
    </form>
  );
}

export default function Companies() {
  const { user, selectCompany, company } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const { data, loading, error, reload } = useResource(async () => {
    const listed = await fetchAll(endpoints.companies, "companies");
    return listed.rows || [];
  }, [user?.id]);

  const filtered = useMemo(
    () => (data || []).filter((row) => includesQuery(row, query, ["name", "id"])),
    [data, query]
  );
  const pager = usePaged(filtered);

  if (!isSuperAdminRole(user?.user_type)) {
    return (
      <>
        <PageHeader title="Companies" subtitle="Only a system administrator can manage companies." />
        <Banner>Company admins work inside their own company desk.</Banner>
      </>
    );
  }

  const deactivate = async (row) => {
    try {
      await api(`${endpoints.companies}/${row.id}`, { method: "DELETE" });
      if (String(company?.id) === String(row.id)) {
        selectCompany(null);
      }
      toast("Company deactivated");
      reload();
    } catch (err) {
      toast(err.message || "Could not deactivate company");
    }
  };

  const openDesk = async (row) => {
    if (Number(row.status) !== 1) {
      toast("Activate the company before opening its desk");
      return;
    }
    try {
      await selectCompany({ id: row.id, name: row.name });
      toast(`Opened ${row.name}`);
    } catch (err) {
      toast(err.message || "Could not open company desk");
    }
  };

  return (
    <>
      <PageHeader title="Companies" subtitle="Create companies and open any company desk.">
        <button className="btn btn-primary" type="button" onClick={() => setModal(true)}>
          New company
        </button>
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <section className="panel">
        <div className="panel-head">
          <h2>All companies</h2>
          <SearchField value={query} onChange={setQuery} placeholder="Search companies" />
        </div>

        {loading ? (
          <p className="muted pad">Loading companies...</p>
        ) : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No companies match this search." : "No companies yet."}
            emptyAction={query ? null : { label: "New company", onClick: () => setModal(true) }}
            columns={[
              { key: "name", label: "Name" },
              { key: "id", label: "ID" },
              {
                key: "status",
                label: "Status",
                render: (row) => <StatusPill value={row.status} active />,
              },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <RowActions>
                    <ViewButton onClick={() => setDetail(row)} />
                    {Number(row.status) === 1 ? (
                      <button className="btn btn-ghost" type="button" onClick={() => openDesk(row)}>
                        Open desk
                      </button>
                    ) : null}
                    {Number(row.status) === 1 ? (
                      <DeleteButton
                        label="Deactivate"
                        confirmMessage={`Deactivate ${row.name}?`}
                        onClick={() => deactivate(row)}
                      />
                    ) : null}
                  </RowActions>
                ),
              },
            ]}
          />
        )}
        <Pager {...pager} />
      </section>

      {modal ? (
        <Modal title="New company" onClose={() => setModal(false)}>
          <CompanyForm
            onClose={() => setModal(false)}
            onCreated={() => {
              setModal(false);
              toast("Company created");
              reload();
            }}
          />
        </Modal>
      ) : null}

      {detail ? (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <DetailList
            rows={[
              ["ID", detail.id],
              ["Status", Number(detail.status) === 1 ? "Active" : "Inactive"],
              ["Created", detail.created_at || "—"],
            ]}
          />
          {Number(detail.status) === 1 ? (
            <div className="form-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  openDesk(detail);
                  setDetail(null);
                }}
              >
                Open desk
              </button>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
