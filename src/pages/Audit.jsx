import { useMemo, useState } from "react";
import { fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import { Banner, DataTable, PageHeader, Pager, SearchField } from "../components/ui";
import { formatDate, includesQuery, isAdminRole, usePaged, useResource } from "../lib";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(value)} ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function Audit() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const isAdmin = isAdminRole(user?.user_type);
  const { data, loading, error } = useResource(async () => {
    if (!isAdmin) return { rows: [], total: 0 };
    const logs = await fetchAll(endpoints.auditLogs, "logs");
    return { rows: logs.rows, total: logs.total };
  }, [isAdmin]);

  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => includesQuery(row, query, [
      "action",
      "entity_type",
      "entity_id",
      "description",
      "user_id",
      "ip_address",
    ])),
    [data, query]
  );
  const pager = usePaged(filtered, 15);

  if (!isAdmin) {
    return (
      <section>
        <PageHeader title="Audit Logs" subtitle="Only a company admin can view audit logs." />
        <Banner>Admin access is required.</Banner>
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Audit Logs" subtitle="Who changed what — bilty, trip, access and status events." />
      <Banner>{error}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Audit trail {data ? <span className="count">{filtered.length}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading audit logs...</p> : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No audit entries match this search." : "No audit entries yet."}
            columns={[
              { key: "created_at", label: "When", render: (row) => formatDateTime(row.created_at) },
              { key: "action", label: "Action", render: (row) => String(row.action || "—").replaceAll("_", " ") },
              {
                key: "entity",
                label: "Entity",
                render: (row) => (row.entity_type ? `${row.entity_type}${row.entity_id ? ` #${row.entity_id}` : ""}` : "—"),
              },
              { key: "user_id", label: "User", render: (row) => (row.user_id ? `#${row.user_id}` : "—") },
              { key: "description", label: "Details", render: (row) => row.description || "—" },
              { key: "ip_address", label: "IP", render: (row) => row.ip_address || "—" },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
    </section>
  );
}
