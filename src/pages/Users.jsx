import { useMemo, useState } from "react";
import { api, DEMO_TOKEN, getToken } from "../api";
import { useAuth } from "../auth";
import {
  Banner,
  DataTable,
  Field,
  FormActions,
  Modal,
  PageHeader,
  Pager,
  SearchField,
  Select,
  StatusPill,
} from "../components/ui";
import {
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  roleLabel,
  usePaged,
  useResource,
} from "../lib";
import { useToast } from "../toast";

const LOCAL_KEY = "tms_local_users";

function readLocalUsers(current) {
  try {
    const rows = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return [current, ...rows.filter((row) => row.email !== current.email)];
  } catch {
    return [current];
  }
}

function writeLocalUser(user) {
  let rows = [];
  try {
    rows = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    rows = [];
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify([user, ...rows]));
}

function UserForm({ actor, companies, onClose, onCreated }) {
  const superAdmin = actor?.user_type === "SUPER_ADMIN";
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    password: "",
    user_type: "COMPANY_ADMIN",
    company_id: actor?.company_id ? String(actor.company_id) : "",
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
      ["password", form.password, "Enter a password"],
    ]);
    if (!nextIssues.mobile && form.mobile.replace(/\D/g, "").length < 10) {
      nextIssues.mobile = "Enter at least 10 digits";
    }
    if (!nextIssues.password && form.password.length < 6) {
      nextIssues.password = "Use at least 6 characters";
    }
    if (form.user_type !== "SUPER_ADMIN" && !form.company_id && superAdmin) {
      nextIssues.company_id = "Select a company";
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      user_type: form.user_type,
      company_id: form.user_type === "SUPER_ADMIN" ? null : form.company_id || actor?.company_id,
    };

    try {
      if (getToken() === DEMO_TOKEN) {
        writeLocalUser({
          id: Date.now(),
          company_id: payload.company_id,
          user_type: payload.user_type,
          name: payload.name,
          mobile: payload.mobile,
          email: payload.email,
          status: 1,
          last_login_at: null,
          created_at: new Date().toISOString(),
        });
        onCreated();
        return;
      }

      await api("/api/users", { method: "POST", body: payload });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <Field label="Name" error={issues.name}>
        <input value={form.name} onChange={set("name")} />
      </Field>
      <Field label="Mobile" error={issues.mobile}>
        <input value={form.mobile} onChange={set("mobile")} />
      </Field>
      <Field label="Email" error={issues.email}>
        <input type="email" value={form.email} onChange={set("email")} autoComplete="off" />
      </Field>
      <Field label="Password" error={issues.password}>
        <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
      </Field>
      <Field label="User type">
        <Select value={form.user_type} onChange={set("user_type")}>
          <option value="COMPANY_ADMIN">Company Admin</option>
          <option value="COMPANY_USER">Company User</option>
          {superAdmin ? <option value="SUPER_ADMIN">Super Admin</option> : null}
        </Select>
      </Field>
      {superAdmin && form.user_type !== "SUPER_ADMIN" ? (
        <Field label="Company" error={issues.company_id}>
          <Select value={form.company_id} onChange={set("company_id")}>
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Add user" />
    </form>
  );
}

export default function Users() {
  const { user } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const isAdmin = ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(user?.user_type);
  const demo = getToken() === DEMO_TOKEN;
  const { data, loading, error, reload } = useResource(async () => {
    if (demo) {
      return {
        rows: readLocalUsers(user),
        companies: [],
        total: readLocalUsers(user).length,
      };
    }

    const [users, companies] = await Promise.all([
      api("/api/users?limit=100"),
      api("/api/companies", { auth: false }),
    ]);
    return {
      rows: users.users || [],
      companies: companies.companies || [],
      total: users.pagination?.total || 0,
    };
  }, [demo, user?.email]);

  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => includesQuery(row, query, ["name", "email", "mobile", "user_type"])),
    [data, query]
  );
  const pager = usePaged(filtered);
  const companyNames = useMemo(
    () => new Map((data?.companies || []).map((company) => [String(company.id), company.name])),
    [data]
  );

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
      <PageHeader title="Users" subtitle="Add company admins and desk users. Signup is closed.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          Add Admin
        </button>
      </PageHeader>
      <Banner>{error}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>users {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading users...</p> : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No users match this search." : "No users yet."}
            emptyAction={query ? null : { label: "Add Admin", onClick: () => setOpen(true) }}
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              { key: "email", label: "Email", render: (row) => row.email || "—" },
              { key: "mobile", label: "Mobile", render: (row) => row.mobile || "—" },
              { key: "type", label: "Type", render: (row) => roleLabel(row.user_type) },
              { key: "company", label: "Company", render: (row) => companyNames.get(String(row.company_id)) || row.company_id || "—" },
              { key: "login", label: "Last login", render: (row) => formatDate(row.last_login_at) },
              { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} active /> },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open ? (
        <Modal title="Add Admin" onClose={() => setOpen(false)}>
          <UserForm
            actor={user}
            companies={data?.companies || []}
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("User added");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
