import { useMemo, useState } from "react";
import { api, DEMO_TOKEN, fetchAll, getToken } from "../api";
import { useAuth } from "../auth";
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
  RowActions,
  SearchField,
  Select,
  StatusPill,
} from "../components/ui";
import { ModuleAccessEditor } from "../components/ModuleAccess";
import { endpoints } from "../api/endpoints";
import {
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  isAdminRole,
  roleLabel,
  usePaged,
  useResource,
} from "../lib";
import { useToast } from "../toast";

const LOCAL_KEY = "tms_local_users";

function readLocalRows() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function readLocalUsers(current) {
  const rows = readLocalRows();
  const overlay = rows.find((row) => row.email === current.email);
  const head = overlay ? { ...current, ...overlay, id: current.id } : current;
  return [head, ...rows.filter((row) => row.email !== current.email && String(row.id) !== String(current.id))];
}

function writeLocalUser(user) {
  const rows = readLocalRows().filter((row) => String(row.id) !== String(user.id) && row.email !== user.email);
  localStorage.setItem(LOCAL_KEY, JSON.stringify([user, ...rows]));
}

function UserForm({ actor, activeCompanyId, initial, onClose, onSaved }) {
  const editing = Boolean(initial);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name || "",
    mobile: initial?.mobile || "",
    email: initial?.email || "",
    password: "",
    status: initial?.status === 0 || initial?.status === "0" ? "0" : "1",
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
      ["email", form.email, "Enter an email"],
    ]);
    if (!editing && !form.password) nextIssues.password = "Enter a password";
    if (!nextIssues.mobile && form.mobile.replace(/\D/g, "").length < 10) {
      nextIssues.mobile = "Enter at least 10 digits";
    }
    if (form.password && (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password))) {
      nextIssues.password = "Use 8+ characters with a letter and a number";
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    // Backend creates COMPANY_USER only, in the creator's company.
    // PATCH accepts name / mobile / email / password; status has its own endpoint.
    const payload = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim().toLowerCase(),
    };
    if (form.password) payload.password = form.password;

    try {
      if (getToken() === DEMO_TOKEN) {
        const saved = {
          id: initial?.id || Date.now(),
          company_id: initial?.company_id || activeCompanyId || actor?.company_id,
          user_type: "COMPANY_USER",
          name: payload.name,
          mobile: payload.mobile,
          email: payload.email,
          status: Number(form.status),
          last_login_at: initial?.last_login_at || null,
          created_at: initial?.created_at || new Date().toISOString(),
        };
        writeLocalUser(saved);
        onSaved(saved, editing);
        return;
      }

      if (editing) {
        const data = await api(endpoints.user(initial.id), { method: "PATCH", body: payload });
        let status = initial.status;
        if (Number(form.status) !== Number(initial.status ?? 1)) {
          await api(`${endpoints.user(initial.id)}/status`, {
            method: "PATCH",
            body: { status: Number(form.status) },
          });
          status = Number(form.status);
        }
        onSaved({ ...initial, ...payload, ...(data.user || {}), status }, true);
        return;
      }

      const data = await api(endpoints.users, {
        method: "POST",
        body: { ...payload, user_type: "COMPANY_USER" },
      });
      onSaved(data.user || { id: data.id, ...payload, user_type: "COMPANY_USER" }, false);
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
        <input value={form.mobile} onChange={set("mobile")} />
      </Field>
      <Field label="Email" required error={issues.email} hint="Needed for desk login">
        <input type="email" value={form.email} onChange={set("email")} autoComplete="off" />
      </Field>
      <Field
        label="Password"
        required={!editing}
        error={issues.password}
        hint={editing ? "Leave blank to keep current" : "Min 8 characters, letter + number"}
      >
        <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
      </Field>
      <Field label="User type" hint="Desk users are always created as Company User">
        <input value="Company User" disabled readOnly />
      </Field>
      {editing ? (
        <Field label="Status">
          <Select value={form.status} onChange={set("status")}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </Select>
        </Field>
      ) : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={editing ? "Save changes" : "Add user"} />
    </form>
  );
}

export default function Users() {
  const { user, applyUser, company } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(undefined);
  const [accessUser, setAccessUser] = useState(null);
  const isAdmin = isAdminRole(user?.user_type);
  const demo = getToken() === DEMO_TOKEN;
  const { data, loading, error, reload } = useResource(async () => {
    if (demo) {
      const rows = readLocalUsers(user);
      return {
        rows,
        companies: [],
        total: rows.length,
      };
    }

    let users = { rows: [], total: 0 };
    let loadError = "";

    try {
      users = await fetchAll(endpoints.users, "users");
    } catch (err) {
      loadError = err.message || "Could not load users";
    }

    let companies = [];
    try {
      const companyData = await api(endpoints.companies);
      companies = companyData.companies || [];
    } catch {
      companies = [];
    }

    const rows = [...(users.rows || [])];
    if (user?.id != null && !rows.some((row) => String(row.id) === String(user.id) || row.email === user.email)) {
      rows.unshift({
        id: user.id,
        company_id: user.company_id,
        user_type: user.user_type || "COMPANY_ADMIN",
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        status: user.status ?? 1,
        last_login_at: user.last_login_at || null,
      });
    }

    if (!rows.length && loadError) {
      throw new Error(loadError);
    }

    return {
      rows,
      companies,
      total: Math.max(users.total || 0, rows.length),
      warning: loadError,
    };
  }, [demo, user?.id, user?.email, user?.name, user?.mobile, user?.user_type, user?.company_id]);

  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => includesQuery(row, query, ["name", "email", "mobile", "user_type"])),
    [data, query]
  );
  const pager = usePaged(filtered);
  const companyNames = useMemo(
    () => new Map((data?.companies || []).map((row) => [String(row.id), row.name])),
    [data]
  );

  const closeForm = () => setEditing(undefined);

  const saved = (row, wasEdit) => {
    if (row && (String(row.id) === String(user?.id) || row.email === user?.email)) {
      applyUser({
        ...user,
        name: row.name,
        mobile: row.mobile,
        email: row.email,
        user_type: row.user_type || user.user_type,
        company_id: row.company_id ?? user.company_id,
        status: row.status ?? user.status,
      });
    }
    setEditing(undefined);
    toast(wasEdit ? "User updated" : "User added");
    reload();

    // Module access is a direct checklist (no roles). Offer it right after save.
    // Company admins always have full access, so skip them and the offline demo.
    if (!demo && row?.id && String(row.user_type || "COMPANY_USER") === "COMPANY_USER") {
      setAccessUser(row);
    }
  };

  const removeUser = async (row) => {
    if (String(row.id) === String(user?.id) || row.email === user?.email) {
      toast("You cannot delete your own account");
      return;
    }

    try {
      if (demo) {
        const rows = readLocalRows().filter((item) => String(item.id) !== String(row.id) && item.email !== row.email);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
      } else {
        await api(endpoints.user(row.id), { method: "DELETE" });
      }
      toast("User deactivated");
      reload();
    } catch (err) {
      toast(err.message || "Could not delete user");
    }
  };

  if (!isAdmin) {
    return (
      <section>
        <PageHeader title="Users" subtitle="Only a company admin can add users." />
        <Banner>Admin access is required.</Banner>
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Users" subtitle="Add company users and set what each can do with a direct module/action checklist — no roles.">
        <button className="btn btn-primary" type="button" onClick={() => setEditing(null)}>
          Add User
        </button>
      </PageHeader>
      <Banner>{error || data?.warning}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>users {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading users...</p> : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No users match this search." : "No users yet."}
            emptyAction={query ? null : { label: "Add User", onClick: () => setEditing(null) }}
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "email", label: "Email", render: (row) => row.email || "—" },
              { key: "mobile", label: "Mobile", render: (row) => row.mobile || "—" },
              { key: "type", label: "Type", render: (row) => roleLabel(row.user_type) },
              { key: "company", label: "Company", render: (row) => companyNames.get(String(row.company_id)) || row.company_id || "—" },
              { key: "login", label: "Last login", render: (row) => formatDate(row.last_login_at) },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) => {
                  const self = String(row.id) === String(user?.id) || row.email === user?.email;
                  return (
                    <RowActions>
                      <button className="btn btn-ghost table-action" type="button" onClick={() => setEditing(row)}>
                        Edit
                      </button>
                      {!demo && !self && String(row.user_type) === "COMPANY_USER" ? (
                        <button className="btn btn-ghost table-action" type="button" onClick={() => setAccessUser(row)}>
                          Access
                        </button>
                      ) : null}
                      <DeleteButton
                        disabled={self || Number(row.status) === 0}
                        confirmMessage={`Deactivate ${row.name || "this user"}? They will no longer be able to sign in.`}
                        onClick={() => removeUser(row)}
                      />
                    </RowActions>
                  );
                },
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {editing !== undefined ? (
        <Modal title={editing ? "Edit user" : "Add User"} onClose={closeForm}>
          <UserForm
            actor={user}
            activeCompanyId={company?.id}
            initial={editing}
            onClose={closeForm}
            onSaved={saved}
          />
        </Modal>
      ) : null}
      {accessUser ? (
        <Modal title={`Module access — ${accessUser.name || "User"}`} onClose={() => setAccessUser(null)} wide>
          <ModuleAccessEditor
            userId={accessUser.id}
            toast={toast}
            submitLabel="Save access"
            onCancel={() => setAccessUser(null)}
            onSaved={() => setAccessUser(null)}
          />
        </Modal>
      ) : null}
    </section>
  );
}
