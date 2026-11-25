import { useEffect, useState } from "react";
import { api } from "../api";
import { endpoints } from "../api/endpoints";
import { Banner, StatusPill } from "../components/ui";
import { formatDate } from "../lib";

export default function MobileVehicle() {
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api(endpoints.myVehicle)
      .then((data) => {
        if (!live) return;
        setVehicle(data.vehicle || data);
      })
      .catch((err) => {
        if (!live) return;
        const message = String(err?.message || "");
        if (/\b404\b|no active vehicle/i.test(message)) {
          setError("");
          setVehicle(null);
        } else {
          setError(message || "Could not load vehicle");
          setVehicle(null);
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="mobile-page stack">
      <div className="mobile-page-head">
        <h1>My Vehicle</h1>
        <p className="page-sub">Currently assigned vehicle only.</p>
      </div>
      <Banner>{error}</Banner>

      {loading ? <p className="muted">Loading vehicle…</p> : null}

      {!loading && !vehicle ? (
        <div className="mobile-empty">
          <strong>No vehicle assigned</strong>
          <p className="muted">When office assigns you to a vehicle, it will show here.</p>
        </div>
      ) : null}

      {vehicle ? (
        <>
          <div className="mobile-detail-card">
            <div className="mobile-detail-row">
              <span>Registration</span>
              <strong>{vehicle.registration_no || "—"}</strong>
            </div>
            <div className="mobile-detail-row">
              <span>Make / model</span>
              <strong>{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}</strong>
            </div>
            <div className="mobile-detail-row">
              <span>Capacity</span>
              <strong>{vehicle.capacity || "—"}</strong>
            </div>
            <div className="mobile-detail-row">
              <span>Status</span>
              <StatusPill value={vehicle.availability_status || vehicle.status || "—"} />
            </div>
            <div className="mobile-detail-row">
              <span>Assignment from</span>
              <strong>{formatDate(vehicle.assignment_start_date)}</strong>
            </div>
            <div className="mobile-detail-row">
              <span>Assignment to</span>
              <strong>{vehicle.assignment_end_date ? formatDate(vehicle.assignment_end_date) : "Open"}</strong>
            </div>
          </div>
          <p className="muted">
            Vehicle document files (RC, insurance, fitness…) are managed by office.
            Ask your company admin if you need a copy on this device.
          </p>
        </>
      ) : null}
    </section>
  );
}
