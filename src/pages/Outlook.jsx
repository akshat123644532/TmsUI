import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAll } from "../api";
import { Banner, EmptyState, PageHeader, StatusPill } from "../components/ui";
import { formatDate, TRIP_STATUSES, useResource } from "../lib";

const COLUMNS = TRIP_STATUSES;
// Legacy statuses map onto the BRD columns.
const LEGACY = { CREATED: "DRAFT", COMPLETED: "CLOSED" };

export default function Outlook({ embedded = false }) {
  const navigate = useNavigate();
  const { data, loading, error } = useResource(async () => {
    const [trips, vehicles, drivers] = await Promise.all([
      fetchAll("/api/trips", "trips"),
      fetchAll("/api/vehicles", "vehicles"),
      fetchAll("/api/drivers", "drivers"),
    ]);
    return {
      trips: trips.rows,
      vehicles: new Map(vehicles.rows.map((row) => [String(row.id), row.registration_no])),
      drivers: new Map(drivers.rows.map((row) => [String(row.id), row.name])),
    };
  }, []);

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(COLUMNS.map((status) => [status, []]));

    for (const trip of data?.trips || []) {
      const status = LEGACY[trip.status] || trip.status;
      const key = buckets[status] ? status : "DRAFT";
      buckets[key].push(trip);
    }

    return buckets;
  }, [data]);

  return (
    <section>
      {embedded ? null : (
        <PageHeader
          title="Trips"
          subtitle="Live trip board from dispatch through delivery."
        />
      )}
      {embedded ? null : <Banner>{error}</Banner>}
      {loading ? <p className="muted">Loading the board...</p> : !data ? null : data.trips.length === 0 ? (
        <article className="card table-card">
          <EmptyState title="No trips on the board yet." actionLabel="Plan a trip" onAction={() => navigate("/routes")} />
        </article>
      ) : (
        <div className="board">
          {COLUMNS.map((status) => (
            <div className="column" key={status}>
              <div className="column-head">
                <StatusPill value={status} />
                <span className="count">{grouped[status].length}</span>
              </div>
              {grouped[status].length === 0 ? <p className="muted small">Empty</p> : null}
              {grouped[status].map((trip) => (
                <article className="job" key={trip.id}>
                  <strong>{trip.source} → {trip.destination}</strong>
                  <p>{data.vehicles.get(String(trip.vehicle_id)) || "Vehicle"} · {data.drivers.get(String(trip.driver_id)) || "Driver"}</p>
                  <p>{formatDate(trip.start_date)}</p>
                </article>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
