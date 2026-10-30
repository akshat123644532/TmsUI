import { useEffect } from "react";
import { Icon } from "./Icons";
import { statusTone } from "../lib";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </div>
  );
}

export function Banner({ children }) {
  if (!children) return null;
  return <div className="banner">{children}</div>;
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className={`field${error ? " invalid" : ""}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

export function TextInput(props) {
  return <input {...props} />;
}

export function Select({ children, ...props }) {
  return <select {...props}>{children}</select>;
}

export function StatusNext({ value, next = [], onChange }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value={value}>{String(value || "—").replaceAll("_", " ")}</option>
      {next.filter((status) => status !== value).map((status) => (
        <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
      ))}
    </Select>
  );
}

export function FormActions({ onCancel, busy, submitLabel = "Save" }) {
  return (
    <div className="form-actions">
      <button className="btn btn-ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

export function StatusPill({ value, active = false }) {
  const label = active
    ? Number(value) === 1
      ? "Active"
      : "Inactive"
    : String(value || "—").replaceAll("_", " ");
  const tone = active ? (Number(value) === 1 ? "good" : "mute") : statusTone(value);

  return <span className={`pill ${tone}`}>{label}</span>;
}

export function Trend({ value }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const up = value >= 0;

  return (
    <span className={`trend ${up ? "up" : "down"}`}>
      <Icon name={up ? "trend-up" : "trend-down"} size={12} />
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function EmptyState({ title, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      {actionLabel ? (
        <button className="btn btn-primary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function DataTable({ columns, rows, empty = "No records yet.", emptyAction, highlightId }) {
  useEffect(() => {
    if (!highlightId) return;
    const row = document.querySelector(`[data-row-id="${CSS.escape(String(highlightId))}"]`);
    row?.scrollIntoView({ block: "center" });
  }, [highlightId, rows]);

  if (!rows?.length) {
    return (
      <EmptyState
        title={empty}
        actionLabel={emptyAction?.label}
        onAction={emptyAction?.onClick}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align || ""}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row._key || row.id}
              data-row-id={row.id ?? ""}
              className={highlightId && String(row.id) === String(highlightId) ? "row-hit" : ""}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.align || ""} data-label={column.label || ""}>
                  {column.render ? column.render(row) : row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, totalPages, rangeLabel, onPage }) {
  return (
    <div className="pager">
      <span>{rangeLabel}</span>
      <div>
        <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={tab.id === value ? "tab active" : "tab"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search records..." }) {
  return (
    <label className="table-search">
      <Icon name="search" size={16} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function KpiCard({ icon, label, value, trend }) {
  return (
    <article className="card kpi">
      <div className="kpi-top">
        <span className="kpi-icon">
          <Icon name={icon} />
        </span>
        <Trend value={trend} />
      </div>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
    </article>
  );
}
