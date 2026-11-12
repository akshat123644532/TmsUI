import { useEffect, useState } from "react";
import { fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Banner, Field, PageHeader, Select } from "../components/ui";
import { ModuleAccessEditor } from "../components/ModuleAccess";
import { isAdminRole, useResource } from "../lib";
import { useToast } from "../toast";

export default function Access() {
  const { user } = useAuth();
  const toast = useToast();
  const [userId, setUserId] = useState("");
  const isAdmin = isAdminRole(user?.user_type);
  const { data, loading, error } = useResource(async () => {
    if (!isAdmin) return { users: [] };
    const users = await fetchAll(endpoints.users, "users");
    // Admins always have full access, so only company users need a checklist.
    return { users: users.rows.filter((row) => String(row.user_type) === "COMPANY_USER") };
  }, [isAdmin]);

  const users = data?.users || [];

  useEffect(() => {
    if (!users.length) return;
    if (!userId || !users.some((row) => String(row.id) === String(userId))) setUserId(String(users[0].id));
  }, [users, userId]);

  if (!isAdmin) {
    return (
      <section>
        <PageHeader title="Module Access" subtitle="Only a company admin can manage module access." />
        <Banner>Admin access is required.</Banner>
      </section>
    );
  }

  const selected = users.find((row) => String(row.id) === String(userId));

  return (
    <section>
      <PageHeader title="Module Access" subtitle="No roles — tick the modules and actions each user can use, then save to replace their access." />
      <Banner>{error}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Checklist</h2>
          <div className="card-head-actions">
            <Field label="User">
              <Select value={userId} onChange={(event) => setUserId(event.target.value)} disabled={!users.length}>
                {!users.length ? <option value="">No company users</option> : null}
                {users.map((row) => (
                  <option key={row.id} value={row.id}>{row.name} · {row.email || row.mobile}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        {loading ? <p className="muted pad">Loading users...</p> : !selected ? (
          <p className="muted pad">Add a company user first, then set their module access here.</p>
        ) : (
          <ModuleAccessEditor
            key={selected.id}
            userId={selected.id}
            toast={toast}
            submitLabel={`Save access for ${selected.name}`}
          />
        )}
      </article>
    </section>
  );
}
