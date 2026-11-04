import { useMemo, useState } from "react";
import { api, fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
import {
  Banner,
  DataTable,
  Field,
  FormActions,
  FormLegend,
  Modal,
  PageHeader,
  Pager,
  SearchField,
  Select,
} from "../components/ui";
import { blankIssues, hasIssues, includesQuery, usePaged, useResource } from "../lib";
import { useToast } from "../toast";

const FLAGS = [
  "can_view",
  "can_create",
  "can_update",
  "can_delete",
  "can_approve",
  "can_export",
  "can_dispatch",
  "can_close",
];

function AccessForm({ users, modules, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    user_id: users[0] ? String(users[0].id) : "",
    module_id: modules[0] ? String(modules[0].id) : "",
    can_view: true,
    can_create: false,
    can_update: false,
    can_delete: false,
    can_approve: false,
    can_export: false,
    can_dispatch: false,
    can_close: false,
  });

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["user_id", form.user_id, "Select a user"],
      ["module_id", form.module_id, "Select a module"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      const body = {
        user_id: form.user_id,
        module_id: form.module_id,
      };
      for (const flag of FLAGS) body[flag] = form[flag] ? 1 : 0;

      await api(endpoints.userModuleAccess, { method: "POST", body });
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
      <Field label="User" required error={issues.user_id}>
        <Select
          value={form.user_id}
          onChange={(event) => {
            setForm({ ...form, user_id: event.target.value });
            setIssues((current) => ({ ...current, user_id: "" }));
          }}
        >
          <option value="">Select user</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name} · {user.email || user.mobile}</option>
          ))}
        </Select>
      </Field>
      <Field label="Module" required error={issues.module_id}>
        <Select
          value={form.module_id}
          onChange={(event) => {
            setForm({ ...form, module_id: event.target.value });
            setIssues((current) => ({ ...current, module_id: "" }));
          }}
        >
          <option value="">Select module</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>{module.name}</option>
          ))}
        </Select>
      </Field>
      {FLAGS.map((flag) => (
        <label key={flag} className="field checkbox-field">
          <span className="field-label">{flag.replace("can_", "Can ")}</span>
          <input
            type="checkbox"
            checked={Boolean(form[flag])}
            onChange={(event) => setForm({ ...form, [flag]: event.target.checked })}
          />
        </label>
      ))}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Save access" />
    </form>
  );
}

export default function Access() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useResource(async () => {
    const [users, modules] = await Promise.all([
      fetchAll(endpoints.users, "users"),
      fetchAll(endpoints.modules, "modules"),
    ]);
    const target = userId || (users.rows[0] ? String(users.rows[0].id) : "");
    let access = { rows: [], total: 0 };
    if (target) {
      try {
        access = await fetchAll(endpoints.userModuleAccessFor(target), "access");
      } catch {
        const fallback = await api(`${endpoints.userModuleAccess}?limit=100`).catch(() => ({ access: [] }));
        access = {
          rows: (fallback.access || []).filter((row) => String(row.user_id) === String(target)),
          total: 0,
        };
        access.total = access.rows.length;
      }
    }
    return {
      users: users.rows,
      modules: modules.rows,
      access: access.rows,
      selectedUserId: target,
    };
  }, [userId]);

  const moduleName = useMemo(
    () => new Map((data?.modules || []).map((row) => [String(row.id), row.name])),
    [data]
  );
  const userName = useMemo(
    () => new Map((data?.users || []).map((row) => [String(row.id), row.name])),
    [data]
  );

  const filtered = useMemo(
    () => (data?.access || [])
      .map((row) => ({
        ...row,
        module_name: moduleName.get(String(row.module_id)) || `#${row.module_id}`,
        user_name: userName.get(String(row.user_id)) || `#${row.user_id}`,
      }))
      .filter((row) => includesQuery(row, query, ["module_name", "user_name"])),
    [data, moduleName, userName, query]
  );
  const pager = usePaged(filtered);

  return (
    <section>
      <PageHeader title="Module Access" subtitle="user_module_access — view / create / update / delete / approve / export / dispatch / close.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          Grant Access
        </button>
      </PageHeader>
      <Banner>{error}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Access {data ? <span className="count">{filtered.length}</span> : null}</h2>
          <div className="card-head-actions">
            <Select
              value={userId || data?.selectedUserId || ""}
              onChange={(event) => {
                setUserId(event.target.value);
                pager.setPage(1);
              }}
            >
              {(data?.users || []).map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </Select>
            <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
          </div>
        </div>
        {loading ? <p className="muted pad">Loading access...</p> : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No access rows match." : "No module access yet."}
            emptyAction={query ? null : { label: "Grant Access", onClick: () => setOpen(true) }}
            columns={[
              { key: "user", label: "User", render: (row) => row.user_name },
              { key: "module", label: "Module", render: (row) => row.module_name },
              ...FLAGS.map((flag) => ({
                key: flag,
                label: flag.replace("can_", ""),
                render: (row) => (Number(row[flag]) === 1 ? "Yes" : "—"),
              })),
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open && data ? (
        <Modal title="Grant Module Access" onClose={() => setOpen(false)} wide>
          <AccessForm
            users={data.users}
            modules={data.modules}
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("Access saved");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
