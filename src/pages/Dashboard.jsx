import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAll } from "../api";
import { RevenueChart, StatusDonut, statusColor } from "../components/Charts";
import { Icon } from "../components/Icons";
import { Banner, EmptyState, KpiCard, Modal, PageHeader, StatusPill } from "../components/ui";
import { downloadCsv, formatDate, lastMonths, money, monthKey, periodTrend, useResource } from "../lib";
import { ShipmentForm } from "./Loads";
import { useToast } from "../toast";

const TRIP_ORDER = ["DELIVERED", "COMPLETED", "IN_TRANSIT", "DISPATCHED", "CREATED", "CANCELLED"];
const DELIVERED = new Set(["DELIVERED", "COMPLETED"]);
const PENDING = new Set(["CREATED", "DISPATCHED", "IN_TRANSIT"]);

function inSpan(value, start, end) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function sameDay(value, now = new Date()) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState("6m");
  const { data, loading, error, reload } = useResource(async () => {
    const [bilties, trips, invoices, clients] = await Promise.all([
      fetchAll("/api/bilties", "bilties"),
      fetchAll("/api/trips", "trips"),
      fetchAll("/api/invoices", "invoices"),
      fetchAll("/api/clients", "clients"),
    ]);
    return { bilties, trips, invoices, clients };
  }, []);

  const stats = useMemo(() => {
    const bilties = data?.bilties.rows || [];
    const trips = data?.trips.rows || [];
    const invoices = data?.invoices.rows || [];
    const clients = new Map((data?.clients.rows || []).map((client) => [String(client.id), client.name]));
    const delivered = trips.filter((trip) => DELIVERED.has(trip.status));
    const pending = trips.filter((trip) => PENDING.has(trip.status));
    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const now = new Date();
    const windowStart = range === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const rangedBilties = bilties.filter((row) => inSpan(row.created_at, windowStart, windowEnd));
    const rangedTrips = trips.filter((row) => inSpan(row.start_date || row.created_at, windowStart, windowEnd));
    const rangedInvoices = invoices.filter((row) => inSpan(row.invoice_date || row.created_at, windowStart, windowEnd));

    const points = range === "month"
      ? [0, 1, 2, 3].map((week) => {
        const start = new Date(now.getFullYear(), now.getMonth(), week * 7 + 1);
        const end = new Date(now.getFullYear(), now.getMonth(), week * 7 + 8);
        return {
          label: `W${week + 1}`,
          revenue: rangedInvoices
            .filter((invoice) => inSpan(invoice.invoice_date || invoice.created_at, start, end))
            .reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0),
          shipments: rangedBilties.filter((bilty) => inSpan(bilty.created_at, start, end)).length,
        };
      })
      : lastMonths(6).map((month) => ({
        label: month.label,
        revenue: rangedInvoices
          .filter((invoice) => monthKey(invoice.invoice_date || invoice.created_at) === month.key)
          .reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0),
        shipments: rangedBilties.filter((bilty) => monthKey(bilty.created_at) === month.key).length,
      }));

    const counts = new Map();
    for (const trip of rangedTrips) {
      counts.set(trip.status, (counts.get(trip.status) || 0) + 1);
    }

    const segments = TRIP_ORDER.filter((status) => counts.get(status)).map((status, index) => ({
      label: status,
      value: counts.get(status),
      color: statusColor(status, index),
    }));

    const recent = [...bilties]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 5)
      .map((row) => ({ ...row, client_name: clients.get(String(row.client_id)) || "—" }));

    const todayTrips = trips
      .filter((trip) => sameDay(trip.start_date || trip.created_at))
      .slice(0, 5);

    const unpaid = invoices
      .filter((invoice) => {
        const status = String(invoice.status || "").toUpperCase();
        if (status === "PAID" || status === "CANCELLED") return false;
        const balance = Number(invoice.balance_amount);
        return Number.isFinite(balance) ? balance > 0 : true;
      })
      .slice(0, 5)
      .map((row) => ({ ...row, client_name: clients.get(String(row.client_id)) || "—" }));

    return {
      shipments: data?.bilties.total || bilties.length,
      delivered: delivered.length,
      pending: pending.length,
      revenue,
      points,
      segments,
      recent,
      todayTrips,
      unpaid,
      trends: {
        shipments: periodTrend(bilties, "created_at"),
        delivered: periodTrend(delivered, "created_at"),
        pending: periodTrend(pending, "created_at"),
        revenue: periodTrend(invoices, "invoice_date", (invoice) => Number(invoice.total_amount || 0)),
      },
    };
  }, [data, range]);

  const exportReport = () => {
    downloadCsv("tms-executive-overview.csv", [
      ["Metric", "Value"],
      ["Total Shipments", stats.shipments],
      ["Delivered", stats.delivered],
      ["Pending", stats.pending],
      ["Total Revenue", stats.revenue],
      ...stats.segments.map((segment) => [segment.label, segment.value]),
    ]);
  };

  return (
    <section>
      <PageHeader title="Executive Overview" subtitle="Real-time performance metrics for your transport operation.">
        <button className="btn btn-ghost" type="button" onClick={exportReport} disabled={loading || !data}>
          <Icon name="download" size={16} />
          Download Report
        </button>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Bilty
        </button>
      </PageHeader>

      <Banner>{error}</Banner>

      <div className="kpi-grid">
        {loading
          ? [0, 1, 2, 3].map((item) => <div key={item} className="card kpi skeleton" />)
          : (
            <>
              <KpiCard icon="box" label="Total Bilties" value={stats.shipments} trend={stats.trends.shipments} />
              <KpiCard icon="check" label="Delivered" value={stats.delivered} trend={stats.trends.delivered} />
              <KpiCard icon="clock" label="Pending" value={stats.pending} trend={stats.trends.pending} />
              <KpiCard icon="rupee" label="Total Revenue" value={money(stats.revenue)} trend={stats.trends.revenue} />
            </>
          )}
      </div>

      <div className="chart-grid">
        <article className="card chart-card">
          <div className="card-head">
            <h2>Revenue & Bilty Volume</h2>
            <div className="range-toggle" role="group" aria-label="Chart range">
              <button type="button" className={range === "month" ? "active" : ""} onClick={() => setRange("month")}>
                This month
              </button>
              <button type="button" className={range === "6m" ? "active" : ""} onClick={() => setRange("6m")}>
                Last 6 months
              </button>
            </div>
          </div>
          <div className="legend">
            <span><i className="swatch gold" /> Revenue</span>
            <span><i className="swatch gray" /> Bilties</span>
          </div>
          <RevenueChart points={stats.points} />
        </article>
        <article className="card chart-card">
          <div className="card-head">
            <h2>Trip Status Distribution</h2>
          </div>
          <StatusDonut segments={stats.segments} />
          <button className="text-link" type="button" onClick={() => navigate("/outlook")}>
            Open carrier outlook
          </button>
        </article>
      </div>

      {!loading ? (
        <div className="list-grid">
          <article className="card table-card">
            <div className="card-head"><h2>Recent bilties</h2></div>
            {stats.recent.length === 0 ? (
              <EmptyState title="No bilties yet." actionLabel="New Bilty" onAction={() => setOpen(true)} />
            ) : (
              <div className="mini-list">
                {stats.recent.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="mini-row"
                    onClick={() => navigate(`/loads?q=${encodeURIComponent(row.bilty_number || "")}&focus=${row.id}`)}
                  >
                    <span>
                      <strong>{row.bilty_number}</strong>
                      <small>{row.client_name} · {formatDate(row.created_at)}</small>
                    </span>
                    <StatusPill value={row.status} />
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="card table-card">
            <div className="card-head"><h2>Today's trips</h2></div>
            {stats.todayTrips.length === 0 ? (
              <EmptyState title="No trips scheduled today." actionLabel="Plan a trip" onAction={() => navigate("/routes")} />
            ) : (
              <div className="mini-list">
                {stats.todayTrips.map((trip) => (
                  <button
                    key={trip.id}
                    type="button"
                    className="mini-row"
                    onClick={() => navigate(`/routes?q=${encodeURIComponent(`${trip.source || ""} ${trip.destination || ""}`.trim())}&focus=${trip.id}`)}
                  >
                    <span>
                      <strong>{trip.source} → {trip.destination}</strong>
                      <small>{formatDate(trip.start_date || trip.created_at)}</small>
                    </span>
                    <StatusPill value={trip.status} />
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="card table-card">
            <div className="card-head"><h2>Unpaid invoices</h2></div>
            {stats.unpaid.length === 0 ? (
              <EmptyState title="No unpaid invoices." actionLabel="Open invoicing" onAction={() => navigate("/invoices")} />
            ) : (
              <div className="mini-list">
                {stats.unpaid.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    className="mini-row"
                    onClick={() => navigate(`/invoices?q=${encodeURIComponent(invoice.invoice_number || "")}&focus=${invoice.id}`)}
                  >
                    <span>
                      <strong>{invoice.invoice_number}</strong>
                      <small>{invoice.client_name} · {money(invoice.balance_amount)}</small>
                    </span>
                    <StatusPill value={invoice.status} />
                  </button>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {open ? (
        <Modal title="New Bilty" onClose={() => setOpen(false)}>
          <ShipmentForm
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              toast("Bilty created");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
