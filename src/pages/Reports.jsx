import { useMemo, useState } from "react";
import { api } from "../api";
import {
  Banner,
  DataTable,
  Field,
  FormActions,
  Modal,
  PageHeader,
  Pager,
  SearchField,
  Select,
  StatusNext,
} from "../components/ui";
import {
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  NEXT_STATUS,
  num,
  tripLabel,
  usePaged,
  useResource,
} from "../lib";
import { useToast } from "../toast";

function ReportForm({ trips, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    trip_id: "",
    report_no: "",
    final_odometer_start: "",
    final_odometer_end: "",
    total_distance_km: "",
    loading_date: "",
    unloading_date: "",
    remarks: "",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["trip_id", form.trip_id, "Select a trip"],
      ["report_no", form.report_no, "Enter the report number"],
    ]);
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      await api("/api/trip-final-reports", {
        method: "POST",
        body: {
          trip_id: form.trip_id,
          report_no: form.report_no.trim(),
          final_odometer_start: form.final_odometer_start === "" ? null : num(form.final_odometer_start),
          final_odometer_end: form.final_odometer_end === "" ? null : num(form.final_odometer_end),
          total_distance_km: form.total_distance_km === "" ? null : num(form.total_distance_km),
          loading_date: form.loading_date || null,
          unloading_date: form.unloading_date || null,
          remarks: form.remarks.trim() || null,
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <Field label="Trip" error={issues.trip_id}>
        <Select value={form.trip_id} onChange={set("trip_id")}>
          <option value="">Select trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{tripLabel(trip)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Report no" error={issues.report_no}>
        <input value={form.report_no} onChange={set("report_no")} placeholder="FR-1001" />
      </Field>
      <Field label="Odometer start">
        <input type="number" min="0" step="0.01" value={form.final_odometer_start} onChange={set("final_odometer_start")} />
      </Field>
      <Field label="Odometer end">
        <input type="number" min="0" step="0.01" value={form.final_odometer_end} onChange={set("final_odometer_end")} />
      </Field>
      <Field label="Distance (km)">
        <input type="number" min="0" step="0.01" value={form.total_distance_km} onChange={set("total_distance_km")} />
      </Field>
      <Field label="Loading date">
        <input type="datetime-local" value={form.loading_date} onChange={set("loading_date")} />
      </Field>
      <Field label="Unloading date">
        <input type="datetime-local" value={form.unloading_date} onChange={set("unloading_date")} />
      </Field>
      <Field label="Remarks">
        <input value={form.remarks} onChange={set("remarks")} />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Submit report" />
    </form>
  );
}

export default function Reports() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [reports, trips] = await Promise.all([
      api("/api/trip-final-reports?limit=100"),
      api("/api/trips?limit=100"),
    ]);
    return {
      reports: reports.reports || [],
      trips: trips.trips || [],
    };
  }, []);

  const tripNames = useMemo(
    () => new Map((data?.trips || []).map((trip) => [String(trip.id), tripLabel(trip)])),
    [data]
  );
  const filtered = useMemo(
    () => (data?.reports || [])
      .map((row) => ({ ...row, trip_name: tripNames.get(String(row.trip_id)) || `#${row.trip_id}` }))
      .filter((row) => includesQuery(row, query, ["report_no", "trip_name", "status", "remarks"])),
    [data, query, tripNames]
  );
  const pager = usePaged(filtered);

  const patch = async (row, status) => {
    setActionError("");
    try {
      await api(`/api/trip-final-reports/${row.id}/status`, { method: "PATCH", body: { status } });
      toast(`Report ${status.toLowerCase()}`);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <section>
      <PageHeader title="Reports" subtitle="Final trip reports with odometer, loading, and unloading dates.">
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Final Report
        </button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>trip_final_reports {data ? <span className="count">{data.reports.length}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading reports...</p> : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No reports match this search." : "No final reports yet."}
            emptyAction={query ? null : { label: "New Final Report", onClick: () => setOpen(true) }}
            columns={[
              { key: "no", label: "Report no", render: (row) => row.report_no },
              { key: "trip", label: "Trip", render: (row) => row.trip_name },
              { key: "start", label: "Odo start", render: (row) => row.final_odometer_start ?? "—" },
              { key: "end", label: "Odo end", render: (row) => row.final_odometer_end ?? "—" },
              { key: "km", label: "Distance km", render: (row) => row.total_distance_km ?? "—" },
              { key: "load", label: "Loading", render: (row) => formatDate(row.loading_date) },
              { key: "unload", label: "Unloading", render: (row) => formatDate(row.unloading_date) },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusNext
                    value={row.status}
                    next={NEXT_STATUS.report[row.status] || []}
                    onChange={(status) => patch(row, status)}
                  />
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>
      {open && data ? (
        <Modal title="New Final Report" onClose={() => setOpen(false)} wide>
          <ReportForm
            trips={data.trips}
            onClose={() => setOpen(false)}
            onCreated={() => { setOpen(false); toast("Report submitted"); reload(); }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
