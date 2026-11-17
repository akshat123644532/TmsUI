import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAll } from "../api";
import { useAuth } from "../auth";
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

function MiniRow({ icon, title, meta, status, onClick }) {
  return (
    <button type="button" className="mini-row dash-mini-row" onClick={onClick}>
      <span className="dash-mini-icon">
        <Icon name={icon} size={15} />
      </span>
      <span className="dash-mini-copy">
        <strong>{title}</strong>
        <small>{meta}</small>
      </span>
      <StatusPill value={status} />
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, company } = useAuth();
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

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    []
  );

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

  const firstName = (user?.name || "there").split(" ")[0];
  const companyLabel = company?.name || user?.company_name || "your company";

  return (
    <section className="dashboard-page">
      <PageHeader title="Dashboard" subtitle="Live operations snapshot for your transport desk.">
        <button className="btn btn-ghost" type="button" onClick={exportReport} disabled={loading || !data}>
          <Icon name="download" size={16} />
          Download Report
        </button>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Bilty
        </button>
      </PageHeader>

      <Banner>{error}</Banner>

      <div className="dash-hero">
        <div className="dash-hero-copy">
          <p className="dash-hero-kicker">{todayLabel}</p>
          <h2>Good day, {firstName}</h2>
          <p>Here’s how <strong>{companyLabel}</strong> is moving today — trips, bilties, and collections.</p>
        </div>
        <div className="dash-quick">
          <button type="button" className="dash-quick-btn" onClick={() => setOpen(true)}>
            <Icon name="box" size={16} />
            New bilty
          </button>
          <button type="button" className="dash-quick-btn" onClick={() => navigate("/routes")}>
            <Icon name="pin" size={16} />
            Trips
          </button>
          <button type="button" className="dash-quick-btn" onClick={() => navigate("/fleet")}>
            <Icon name="truck" size={16} />
            Fleet
          </button>
          <button type="button" className="dash-quick-btn" onClick={() => navigate("/invoices")}>
            <Icon name="invoice" size={16} />
            Invoices
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {loading
          ? [0, 1, 2, 3].map((item) => <div key={item} className="card kpi skeleton" />)
          : (
            <>
              <KpiCard tone="bilty" icon="box" label="Total Bilties" value={stats.shipments} trend={stats.trends.shipments} />
              <KpiCard tone="delivered" icon="check" label="Delivered" value={stats.delivered} trend={stats.trends.delivered} />
              <KpiCard tone="pending" icon="clock" label="Pending" value={stats.pending} trend={stats.trends.pending} />
              <KpiCard tone="revenue" icon="rupee" label="Total Revenue" value={money(stats.revenue)} trend={stats.trends.revenue} />
            </>
          )}
      </div>

      <div className="chart-grid">
        <article className="card chart-card dash-chart-card">
          <div className="card-head">
            <div>
              <h2>Revenue & bilty volume</h2>
              <p className="card-sub">Track collections against shipment volume</p>
            </div>
            <div className="role-filter" role="group" aria-label="Chart range">
              <button
                type="button"
                className={`role-filter-btn${range === "month" ? " active" : ""}`}
                onClick={() => setRange("month")}
              >
                This month
              </button>
              <button
                type="button"
                className={`role-filter-btn${range === "6m" ? " active" : ""}`}
                onClick={() => setRange("6m")}
              >
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
        <article className="card chart-card dash-chart-card">
          <div className="card-head">
            <div>
              <h2>Trip status</h2>
              <p className="card-sub">Distribution for the selected range</p>
            </div>
          </div>
          <StatusDonut segments={stats.segments} />
          <button className="text-link" type="button" onClick={() => navigate("/routes?tab=board")}>
            Open trip board
          </button>
        </article>
      </div>

      {!loading ? (
        <div className="list-grid">
          <article className="card table-card dash-panel">
            <div className="card-head">
              <div>
                <h2>Recent bilties</h2>
                <p className="card-sub">Latest consignments</p>
              </div>
              <button className="btn btn-ghost table-action" type="button" onClick={() => navigate("/loads")}>
                View all
              </button>
            </div>
            {stats.recent.length === 0 ? (
              <EmptyState title="No bilties yet." actionLabel="New Bilty" onAction={() => setOpen(true)} />
            ) : (
              <div className="mini-list">
                {stats.recent.map((row) => (
                  <MiniRow
                    key={row.id}
                    icon="box"
                    title={row.bilty_number}
                    meta={`${row.client_name} · ${formatDate(row.created_at)}`}
                    status={row.status}
                    onClick={() => navigate(`/loads?q=${encodeURIComponent(row.bilty_number || "")}&focus=${row.id}`)}
                  />
                ))}
              </div>
            )}
          </article>

          <article className="card table-card dash-panel">
            <div className="card-head">
              <div>
                <h2>Today’s trips</h2>
                <p className="card-sub">On the road today</p>
              </div>
              <button className="btn btn-ghost table-action" type="button" onClick={() => navigate("/routes")}>
                View all
              </button>
            </div>
            {stats.todayTrips.length === 0 ? (
              <EmptyState title="No trips scheduled today." actionLabel="Plan a trip" onAction={() => navigate("/routes")} />
            ) : (
              <div className="mini-list">
                {stats.todayTrips.map((trip) => (
                  <MiniRow
                    key={trip.id}
                    icon="pin"
                    title={`${trip.source || "—"} → ${trip.destination || "—"}`}
                    meta={formatDate(trip.start_date || trip.created_at)}
                    status={trip.status}
                    onClick={() => navigate(`/routes?q=${encodeURIComponent(`${trip.source || ""} ${trip.destination || ""}`.trim())}&focus=${trip.id}`)}
                  />
                ))}
              </div>
            )}
          </article>

          <article className="card table-card dash-panel">
            <div className="card-head">
              <div>
                <h2>Unpaid invoices</h2>
                <p className="card-sub">Outstanding collections</p>
              </div>
              <button className="btn btn-ghost table-action" type="button" onClick={() => navigate("/invoices")}>
                View all
              </button>
            </div>
            {stats.unpaid.length === 0 ? (
              <EmptyState title="No unpaid invoices." actionLabel="Open invoicing" onAction={() => navigate("/invoices")} />
            ) : (
              <div className="mini-list">
                {stats.unpaid.map((invoice) => (
                  <MiniRow
                    key={invoice.id}
                    icon="rupee"
                    title={invoice.invoice_number}
                    meta={`${invoice.client_name} · ${money(invoice.balance_amount)}`}
                    status={invoice.status}
                    onClick={() => navigate(`/invoices?q=${encodeURIComponent(invoice.invoice_number || "")}&focus=${invoice.id}`)}
                  />
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {open ? (
        <Modal title="New Bilty" onClose={() => setOpen(false)} wide>
          <ShipmentForm
            onClose={() => setOpen(false)}
            onCreated={(message, bilty) => {
              setOpen(false);
              toast(message || "Bilty created");
              reload();
              if (bilty?.id) navigate(`/loads?print=${bilty.id}`);
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
