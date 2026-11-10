import { useCallback, useEffect, useState } from "react";

export function useResource(loader, deps) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    let live = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    loader()
      .then((data) => {
        if (live) setState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (live) {
          setState({
            loading: false,
            error: error.message || "Something went wrong",
            data: null,
          });
        }
      });

    return () => {
      live = false;
    };
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { ...state, reload };
}

export function normalizeRole(type) {
  return String(type || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export function isAdminRole(type) {
  return ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(normalizeRole(type));
}

export function isSuperAdminRole(type) {
  return normalizeRole(type) === "SUPER_ADMIN";
}

export function roleLabel(type) {
  const normalized = normalizeRole(type);
  if (normalized === "SUPER_ADMIN") return "System Administrator";
  if (normalized === "COMPANY_ADMIN") return "Company Administrator";
  return String(type || "User")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function initials(name) {
  const parts = String(name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function compactMoney(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${Math.round(amount / 1000)}k`;
  return `₹${Math.round(amount)}`;
}

export function statusTone(status) {
  const value = String(status ?? "").toUpperCase();

  if (["DELIVERED", "COMPLETED", "PAID", "VERIFIED", "APPROVED", "CONFIRMED", "SETTLED", "ACTIVE", "1"].includes(value)) {
    return "good";
  }

  if (["CANCELLED", "REJECTED", "INACTIVE", "0"].includes(value)) {
    return "bad";
  }

  if (["IN_TRANSIT", "DISPATCHED", "SENT", "PARTIAL", "PENDING", "RESERVED", "SUBMITTED", "CARRY_FORWARD"].includes(value)) {
    return "warn";
  }

  return "mute";
}

export function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export function lastMonths(count = 6) {
  const now = new Date();
  const items = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    items.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString("en-US", { month: "short" }),
    });
  }

  return items;
}

export function periodTrend(rows, dateKey, valueFn = () => 1) {
  const now = Date.now();
  const day = 86400000;
  let current = 0;
  let previous = 0;

  for (const row of rows || []) {
    const time = new Date(row[dateKey] || 0).getTime();
    if (!time) continue;
    const value = Number(valueFn(row)) || 0;

    if (time >= now - 30 * day) current += value;
    else if (time >= now - 60 * day) previous += value;
  }

  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function byId(rows) {
  const map = new Map();
  for (const row of rows || []) map.set(String(row.id), row);
  return map;
}

export function lookup(map, id, field = "name") {
  if (id === undefined || id === null || id === "") return "—";
  const row = map.get(String(id));
  return row?.[field] || `#${id}`;
}

export function blankIssues(fields) {
  const issues = {};

  for (const [key, value, message] of fields) {
    if (!String(value ?? "").trim()) issues[key] = message;
  }

  return issues;
}

export function hasIssues(issues) {
  return Object.values(issues || {}).some(Boolean);
}

export function useSearchFocus(params, items, setPage, pageSize = 8) {
  const focus = params.get("focus") || "";

  useEffect(() => {
    if (!focus) return;
    const index = (items || []).findIndex((row) => String(row.id) === String(focus));
    if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
  }, [focus, items, setPage, pageSize]);

  return focus;
}

export function includesQuery(row, query, fields) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => String(row[field] ?? "").toLowerCase().includes(needle));
}

export function prettyStatus(value) {
  return String(value ?? "—").replaceAll("_", " ");
}

export function statusList(rows, key = "status") {
  return [...new Set((rows || []).map((row) => row[key]).filter((value) => value !== undefined && value !== null && value !== ""))].map(String);
}

export function usePaged(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    totalPages,
    rows: (items || []).slice(start, start + pageSize),
    setPage,
    rangeLabel: items?.length
      ? `${start + 1}–${Math.min(start + pageSize, items.length)} of ${items.length}`
      : "0 records",
  };
}

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function tripLabel(trip) {
  if (!trip) return "—";
  return `${trip.source || "?"} → ${trip.destination || "?"}`;
}

export const PAYMENT_METHODS = ["CASH", "UPI", "NEFT", "CHEQUE", "BANK_TRANSFER"];
export const EXPENSE_TYPES = ["FUEL", "TOLL", "PARKING", "FOOD", "REPAIR", "OTHER"];
export const DEDUCTION_TYPES = ["TDS", "OTHER"];

/** Create-form required fields from phpMyAdmin `tms` dump (NOT NULL, no useful default). */
export const TABLE_REQUIRED = {
  clients: ["name"],
  drivers: ["name", "mobile"],
  helpers: ["name", "mobile"],
  vehicles: ["vehicle_type_id", "registration_no"],
  vehicle_types: ["name"],
  vehicle_assignments: ["vehicle_id", "start_date"],
  documents: ["owner_id", "document_type"],
  bilties: ["bilty_number"],
  trips: ["vehicle_id", "driver_id", "source", "destination"],
  trip_advances: ["trip_id", "amount"],
  trip_expenses: ["trip_id", "expense_type", "requested_amount"],
  trip_settlements: ["trip_id"],
  trip_final_reports: ["trip_id", "report_no"],
  invoices: ["client_id", "invoice_number", "invoice_date"],
  invoice_payments: ["invoice_id", "payment_date", "gross_amount"],
  invoice_payment_deductions: ["invoice_payment_id", "deduction_type", "amount"],
  users: ["name", "mobile", "password", "user_type"],
};

export const NEXT_STATUS = {
  invoice: {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["PARTIAL", "PAID", "CANCELLED"],
    PARTIAL: ["PAID", "CANCELLED"],
    PAID: ["CANCELLED"],
    CANCELLED: [],
  },
  payment: {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["CANCELLED"],
    CANCELLED: [],
  },
  advance: {
    PENDING: ["APPROVED", "CANCELLED"],
    APPROVED: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  },
  expense: {
    PENDING: ["APPROVED", "REJECTED"],
    APPROVED: [],
    REJECTED: [],
  },
  settlement: {
    PENDING: ["SETTLED", "CARRY_FORWARD"],
    SETTLED: [],
    CARRY_FORWARD: ["SETTLED"],
  },
  report: {
    SUBMITTED: ["VERIFIED", "REJECTED"],
    VERIFIED: [],
    REJECTED: [],
  },
};

export function num(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
