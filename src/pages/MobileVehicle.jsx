import { useEffect, useState } from "react";
import { api, openApiFile, pickList } from "../api";
import { endpoints } from "../api/endpoints";
import { Banner, StatusPill } from "../components/ui";
import { formatDate } from "../lib";
import { useToast } from "../toast";

export default function MobileVehicle() {
  const toast = useToast();
  const [vehicle, setVehicle] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");

    Promise.all([
      api(endpoints.mobileVehicle).catch(() => api(endpoints.myVehicle)),
      api(endpoints.mobileVehicleDocuments).catch(() => ({ documents: [] })),
    ])
      .then(([vehicleData, docsData]) => {
        if (!live) return;
        setVehicle(vehicleData.vehicle || null);
        setDocuments(pickList(docsData, "documents", "rows"));
      })
      .catch((err) => {
        if (!live) return;
        const message = String(err?.message || "");
        if (/\b404\b|no active vehicle/i.test(message)) {
          setError("");
          setVehicle(null);
          setDocuments([]);
        } else {
          setError(message || "Could not load vehicle");
          setVehicle(null);
          setDocuments([]);
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
        <p className="page-sub">Assigned vehicle and documents.</p>
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

          <div className="mobile-expense-panel">
            <h2>Vehicle documents</h2>
            {documents.length === 0 ? (
              <p className="muted">No active vehicle documents.</p>
            ) : (
              <ul className="mobile-trip-list">
                {documents.map((doc) => (
                  <li key={doc.id || `${doc.document_type}-${doc.document_number}`}>
                    <div className="mobile-trip-card">
                      <div>
                        <strong>{doc.document_type || "Document"}</strong>
                        <small>
                          {doc.document_number || "—"}
                          {doc.expiry_date ? ` · Exp ${formatDate(doc.expiry_date)}` : ""}
                        </small>
                      </div>
                      <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                        <StatusPill value={doc.verification_status || doc.status || "—"} />
                        {doc.document_url ? (
                          <button
                            type="button"
                            className="btn btn-ghost table-action"
                            onClick={() => openApiFile(doc.document_url).catch((err) => toast(err.message))}
                          >
                            Open
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
