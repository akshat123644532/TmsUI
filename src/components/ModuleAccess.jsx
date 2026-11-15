import { useEffect, useMemo, useState } from "react";
import { api, fetchAll } from "../api";
import { endpoints } from "../api/endpoints";
import { useResource } from "../lib";
import { DataTable } from "./ui";

export const ACCESS_FLAGS = [
  "can_view",
  "can_create",
  "can_update",
  "can_delete",
  "can_approve",
  "can_export",
  "can_dispatch",
  "can_close",
];

/**
 * BRD §3.2 — View | Create/Edit | Approve/Other
 * Mirrors backend utils/moduleActions.js
 */
const MODULE_ACTIONS = {
  Vehicles: ["can_view", "can_create", "can_update", "can_delete", "can_export", "can_approve"],
  "Drivers & Helpers": ["can_view", "can_create", "can_update", "can_delete", "can_export"],
  Bilty: ["can_view", "can_create", "can_update", "can_delete"],
  Trips: ["can_view", "can_create", "can_update", "can_delete", "can_dispatch", "can_close", "can_approve"],
  "Trip Expenses": ["can_view", "can_create", "can_update", "can_approve"],
  "Trip Settlement": ["can_view", "can_create", "can_approve"],
  Clients: ["can_view", "can_create", "can_update", "can_delete"],
  Invoices: ["can_view", "can_create", "can_update", "can_delete", "can_approve"],
  Payments: ["can_view", "can_create", "can_approve"],
  Reports: ["can_view", "can_export"],
  "Audit Logs": ["can_view"],
};

const MODULE_ALIASES = {
  Drivers: "Drivers & Helpers",
  Helpers: "Drivers & Helpers",
  Bilties: "Bilty",
  Documents: "Vehicles",
  "Vehicle Types": "Vehicles",
  "Vehicle Assignments": "Vehicles",
};

const FLAG_META = {
  can_view: { label: "View", group: "View" },
  can_create: { label: "Create", group: "Create/Edit" },
  can_update: { label: "Edit", group: "Create/Edit" },
  can_delete: { label: "Cancel/Delete", group: "Create/Edit" },
  can_approve: { label: "Approve/Other", group: "Approve/Other" },
  can_export: { label: "Export", group: "Approve/Other" },
  can_dispatch: { label: "Dispatch", group: "Approve/Other" },
  can_close: { label: "Close", group: "Approve/Other" },
};

export function allowedActions(moduleName) {
  return MODULE_ACTIONS[MODULE_ALIASES[moduleName] || moduleName] || null;
}

function flagLabel(flag) {
  return FLAG_META[flag]?.label || flag.replace("can_", "");
}

/**
 * Direct module/action checklist for one user (no Roles).
 * GET modules + access, save with PUT { modules: [{ module_id, actions }] }.
 */
export function ModuleAccessEditor({ userId, onSaved, onCancel, submitLabel = "Save access", toast }) {
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  const { data, loading, error } = useResource(async () => {
    if (!userId) return { modules: [], access: [] };
    const [modules, access] = await Promise.all([
      fetchAll(endpoints.modules, "modules"),
      fetchAll(endpoints.userModuleAccessFor(userId), "access"),
    ]);
    return { modules: modules.rows, access: access.rows };
  }, [userId]);

  const modules = useMemo(
    () => (data?.modules || [])
      .filter((row) => Number(row.status ?? 1) === 1)
      .map((row) => ({ ...row, actions: allowedActions(row.name) }))
      .filter((row) => row.actions),
    [data]
  );

  useEffect(() => {
    if (!data) return;
    const next = {};
    for (const row of data.access || []) {
      const actions = ACCESS_FLAGS.filter((flag) => Number(row[flag]) === 1);
      if (actions.length) next[String(row.module_id)] = new Set(actions);
    }
    setChecked(next);
    setSaveError("");
  }, [data]);

  const toggle = (moduleId, flag, on) => {
    setChecked((current) => {
      const set = new Set(current[String(moduleId)] || []);
      if (on) {
        set.add(flag);
        if (flag !== "can_view") set.add("can_view");
      } else if (flag === "can_view") {
        set.clear();
      } else {
        set.delete(flag);
      }
      return { ...current, [String(moduleId)]: set };
    });
  };

  const save = async () => {
    setBusy(true);
    setSaveError("");
    try {
      const body = {
        modules: modules
          .map((row) => ({
            module_id: Number(row.id),
            actions: row.actions.filter((flag) => checked[String(row.id)]?.has(flag)),
          }))
          .filter((entry) => entry.actions.length > 0),
      };
      await api(endpoints.userModuleAccessFor(userId), { method: "PUT", body });
      if (toast) toast("Module access saved");
      onSaved?.();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="muted pad">Loading module access...</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div className="access-editor">
      <p className="muted pad" style={{ paddingTop: 0 }}>
        BRD checklist — <strong>View</strong>, <strong>Create/Edit</strong> (create · edit · cancel/delete),
        and <strong>Approve/Other</strong> (approve · export · dispatch · close). Only allowed actions show per module. No roles.
      </p>
      <DataTable
        rows={modules.map((row) => ({ ...row, _key: row.id }))}
        empty="No modules are available. Seed module_definitions on the API first."
        columns={[
          { key: "name", label: "Module", render: (row) => row.name },
          ...ACCESS_FLAGS.map((flag) => ({
            key: flag,
            label: flagLabel(flag),
            render: (row) => (
              row.actions.includes(flag) ? (
                <input
                  type="checkbox"
                  aria-label={`${row.name} ${flagLabel(flag)}`}
                  title={FLAG_META[flag]?.group || flag}
                  checked={Boolean(checked[String(row.id)]?.has(flag))}
                  onChange={(event) => toggle(row.id, flag, event.target.checked)}
                />
              ) : "—"
            ),
          })),
        ]}
      />
      {saveError ? <p className="form-error">{saveError}</p> : null}
      <div className="form-actions">
        {onCancel ? (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Skip
          </button>
        ) : null}
        <button className="btn btn-primary" type="button" disabled={busy || !modules.length} onClick={save}>
          {busy ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
