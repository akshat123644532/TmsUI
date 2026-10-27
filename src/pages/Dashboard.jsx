import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAll } from "../api";
import { RevenueChart, StatusDonut, statusColor } from "../components/Charts";
import { Icon } from "../components/Icons";
import { Banner, KpiCard, Modal, PageHeader } from "../components/ui";
import { downloadCsv, lastMonths, money, monthKey, periodTrend, useResource } from "../lib";
import { ShipmentForm } from "./Loads";

const TRIP_ORDER = ["DELIVERED", "COMPLETED", "IN_TRANSIT", "DISPATCHED", "CREATED", "CANCELLED"];
const DELIVERED = new Set(["DELIVERED", "COMPLETED"]);
const PENDING = new Set(["CREATED", "DISPATCHED", "IN_TRANSIT"]);

export default function Dashboard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useResource(async () => {
    const [bilties, trips, invoices] = await Promise.all([
      fetchAll("/api/bilties", "bilties"),
      fetchAll("/api/trips", "trips"),
      fetchAll("/api/invoices", "invoices"),
    ]);
    return { bilties, trips, invoices };
  }, []);

  const stats = useMemo(() => {
    const bilties = data?.bilties.rows || [];
    const trips = data?.trips.rows || [];
    const invoices = data?.invoices.rows || [];
    const delivered = trips.filter((trip) => DELIVERED.has(trip.status));
    const pending = trips.filter((trip) => PENDING.has(trip.status));
    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const months = lastMonths(6);
    const points = months.map((month) => ({
      label: month.label,
      revenue: invoices
        .filter((invoice) => monthKey(invoice.invoice_date || invoice.created_at) === month.key)
        .reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0),
      shipments: bilties.filter((bilty) => monthKey(bilty.created_at) === month.key).length,
    }));
    const counts = new Map();

    for (const trip of trips) {
      counts.set(trip.status, (counts.get(trip.status) || 0) + 1);
    }

    const segments = TRIP_ORDER.filter((status) => counts.get(status)).map((status, index) => ({
      label: status,
      value: counts.get(status),
      color: statusColor(status, index),
    }));

    return {
      shipments: data?.bilties.total || bilties.length,
      delivered: delivered.length,
      pending: pending.length,
      revenue,
      points,
      segments,
      trends: {
        shipments: periodTrend(bilties, "created_at"),
        delivered: periodTrend(delivered, "created_at"),
        pending: periodTrend(pending, "created_at"),
        revenue: periodTrend(invoices, "invoice_date", (invoice) => Number(invoice.total_amount || 0)),
      },
    };
  }, [data]);

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
          New Shipment
        </button>
      </PageHeader>

      <Banner>{error}</Banner>

      <div className="kpi-grid">
        {loading
          ? [0, 1, 2, 3].map((item) => <div key={item} className="card kpi skeleton" />)
          : (
            <>
              <KpiCard icon="box" label="Total Shipments" value={stats.shipments} trend={stats.trends.shipments} />
              <KpiCard icon="check" label="Delivered" value={stats.delivered} trend={stats.trends.delivered} />
              <KpiCard icon="clock" label="Pending" value={stats.pending} trend={stats.trends.pending} />
              <KpiCard icon="rupee" label="Total Revenue" value={money(stats.revenue)} trend={stats.trends.revenue} />
            </>
          )}
      </div>

      <div className="chart-grid">
        <article className="card chart-card">
          <div className="card-head">
            <h2>Revenue & Shipment Volume</h2>
            <div className="legend">
              <span><i className="swatch gold" /> Revenue</span>
              <span><i className="swatch gray" /> Shipments</span>
            </div>
          </div>
          <RevenueChart points={stats.points} />
        </article>
        <article className="card chart-card">
          <div className="card-head">
            <h2>Shipment Status Distribution</h2>
          </div>
          <StatusDonut segments={stats.segments} />
          <button className="text-link" type="button" onClick={() => navigate("/outlook")}>
            Open carrier outlook
          </button>
        </article>
      </div>

      {open ? (
        <Modal title="New Shipment" onClose={() => setOpen(false)}>
          <ShipmentForm
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
