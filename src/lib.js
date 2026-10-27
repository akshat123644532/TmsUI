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

export function roleLabel(type) {
  if (type === "SUPER_ADMIN") return "System Administrator";
  if (type === "COMPANY_ADMIN") return "Company Administrator";
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

  if (["IN_TRANSIT", "DISPATCHED", "SENT", "PARTIAL", "PENDING", "RESERVED", "SUBMITTED"].includes(value)) {
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

export function includesQuery(row, query, fields) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => String(row[field] ?? "").toLowerCase().includes(needle));
}

export function usePaged(items, pageSize = 8) {
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

export function num(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
