import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll, getActiveCompany } from "../api";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../auth";
import {
  Banner,
  ChipFilter,
  DataTable,
  DetailList,
  Field,
  FormActions,
  FormLegend,
  Modal,
  PageHeader,
  Pager,
  SearchField,
  Select,
  StatusNext,
  StatusPill,
  ViewButton,
} from "../components/ui";
import {
  BILTY_STATUSES,
  NEXT_STATUS,
  blankIssues,
  formatDate,
  hasIssues,
  includesQuery,
  money,
  statusList,
  usePaged,
  useResource,
  useSearchFocus,
} from "../lib";
import { useToast } from "../toast";

const STATUSES = BILTY_STATUSES;
const CREATE_STATUSES = ["RESERVED", "DRAFT", "CONFIRMED"];
const MAX_RANGE = 100;

const COPY_TYPES = ["CONSIGNOR", "CONSIGNEE", "DRIVER", "OFFICE"];
const PAYMENT_MODES = ["TO_PAY", "PAID", "TO_BE_BILLED"];
const GST_PAYERS = ["CONSIGNOR", "CONSIGNEE", "TRANSPORT_OPERATOR"];
const DELIVERY_TYPES = ["DOOR_DELIVERY", "GODOWN"];
const INSURANCE_AT_RISK = ["CARRIER", "OWNER"];
const CHARGE_TYPES = ["FREIGHT", "LABOUR", "SURCHARGE", "ST_CHARGE", "RISK_CHARGE", "GR_CHARGE", "OTHER"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyCharge(charge_type = "FREIGHT") {
  return { charge_type, amount: "" };
}

function emptyForm(overrides = {}) {
  return {
    bilty_number: "",
    bilty_date: todayIso(),
    copy_type: "CONSIGNOR",
    status: "DRAFT",
    consignor: "",
    consignor_address: "",
    consignee: "",
    consignee_address: "",
    pickup_location: "",
    drop_location: "",
    truck_no: "",
    vehicle_id: "",
    packages: "",
    packages_label: "CBOX",
    goods_description: "",
    weight_kg: "",
    charged_weight_kg: "",
    rate_remark: "",
    invoice_no: "",
    invoice_value: "",
    payment_mode: "TO_BE_BILLED",
    gst_payer: "CONSIGNOR",
    delivery_type: "DOOR_DELIVERY",
    insurance_at_risk: "OWNER",
    insurance_company: "",
    insurance_policy_no: "",
    insurance_date: "",
    insurance_amount: "",
    terms_notes: "",
    charges: [emptyCharge("FREIGHT"), emptyCharge("LABOUR")],
    ...overrides,
  };
}

function formFromBilty(bilty) {
  const charges = Array.isArray(bilty?.charges) && bilty.charges.length
    ? bilty.charges.map((row) => ({
        charge_type: row.charge_type || "OTHER",
        amount: row.amount === null || row.amount === undefined ? "" : String(row.amount),
      }))
    : [emptyCharge("FREIGHT"), emptyCharge("LABOUR")];

  return emptyForm({
    bilty_number: bilty.bilty_number || "",
    bilty_date: bilty.bilty_date ? String(bilty.bilty_date).slice(0, 10) : todayIso(),
    copy_type: bilty.copy_type || "CONSIGNOR",
    status: bilty.status || "DRAFT",
    consignor: bilty.consignor || "",
    consignor_address: bilty.consignor_address || "",
    consignee: bilty.consignee || "",
    consignee_address: bilty.consignee_address || "",
    pickup_location: bilty.pickup_location || "",
    drop_location: bilty.drop_location || "",
    truck_no: bilty.truck_no || "",
    vehicle_id: bilty.vehicle_id ? String(bilty.vehicle_id) : "",
    packages: bilty.packages === null || bilty.packages === undefined ? "" : String(bilty.packages),
    packages_label: bilty.packages_label || "CBOX",
    goods_description: bilty.goods_description || "",
    weight_kg: bilty.weight_kg === null || bilty.weight_kg === undefined ? "" : String(bilty.weight_kg),
    charged_weight_kg: bilty.charged_weight_kg === null || bilty.charged_weight_kg === undefined ? "" : String(bilty.charged_weight_kg),
    rate_remark: bilty.rate_remark || "",
    invoice_no: bilty.invoice_no || "",
    invoice_value: bilty.invoice_value || "",
    payment_mode: bilty.payment_mode || "TO_BE_BILLED",
    gst_payer: bilty.gst_payer || "CONSIGNOR",
    delivery_type: bilty.delivery_type || "DOOR_DELIVERY",
    insurance_at_risk: bilty.insurance_at_risk || "OWNER",
    insurance_company: bilty.insurance_company || "",
    insurance_policy_no: bilty.insurance_policy_no || "",
    insurance_date: bilty.insurance_date ? String(bilty.insurance_date).slice(0, 10) : "",
    insurance_amount: bilty.insurance_amount === null || bilty.insurance_amount === undefined ? "" : String(bilty.insurance_amount),
    terms_notes: bilty.terms_notes || "",
    charges,
  });
}

function numOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(value) {
  const next = String(value ?? "").trim();
  return next || null;
}

function chargesTotal(charges) {
  return (charges || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function SectionCard({ step, title, hint, children }) {
  return (
    <section className="bilty-section">
      <header className="bilty-section-head">
        <span className="bilty-section-step">{step}</span>
        <div>
          <h3>{title}</h3>
          {hint ? <p className="muted">{hint}</p> : null}
        </div>
      </header>
      <div className="form-grid">{children}</div>
    </section>
  );
}

function buildPayload(form) {
  return {
    bilty_number: form.bilty_number.trim(),
    bilty_date: form.bilty_date || null,
    copy_type: form.copy_type,
    status: form.status,
    consignor: strOrNull(form.consignor),
    consignor_address: strOrNull(form.consignor_address),
    consignee: strOrNull(form.consignee),
    consignee_address: strOrNull(form.consignee_address),
    pickup_location: strOrNull(form.pickup_location),
    drop_location: strOrNull(form.drop_location),
    truck_no: strOrNull(form.truck_no),
    vehicle_id: form.vehicle_id ? Number(form.vehicle_id) : null,
    packages: numOrNull(form.packages),
    packages_label: strOrNull(form.packages_label),
    goods_description: strOrNull(form.goods_description),
    weight_kg: numOrNull(form.weight_kg),
    charged_weight_kg: numOrNull(form.charged_weight_kg),
    rate_remark: strOrNull(form.rate_remark),
    invoice_no: strOrNull(form.invoice_no),
    invoice_value: strOrNull(form.invoice_value),
    payment_mode: form.payment_mode,
    gst_payer: form.gst_payer,
    delivery_type: form.delivery_type,
    insurance_at_risk: form.insurance_at_risk,
    insurance_company: strOrNull(form.insurance_company),
    insurance_policy_no: strOrNull(form.insurance_policy_no),
    insurance_date: form.insurance_date || null,
    insurance_amount: numOrNull(form.insurance_amount),
    terms_notes: strOrNull(form.terms_notes),
    charges: (form.charges || [])
      .filter((row) => row.charge_type)
      .map((row) => ({
        charge_type: row.charge_type,
        amount: Number(row.amount) || 0,
      })),
  };
}

export function ShipmentForm({ onClose, onCreated, initial = null, biltyId = null }) {
  const { company, user } = useAuth();
  const companyName = company?.name || user?.company_name || getActiveCompany()?.name || "";
  const editing = Boolean(biltyId);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => (initial ? formFromBilty(initial) : emptyForm()));

  useEffect(() => {
    api(`${endpoints.vehicles}?limit=100`)
      .then((data) => setVehicles(data.vehicles || data.rows || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!biltyId || initial) return;
    let alive = true;
    api(endpoints.bilty(biltyId))
      .then((data) => {
        if (!alive) return;
        const bilty = data.bilty || data;
        setForm(formFromBilty({ ...bilty, charges: data.charges || bilty.charges || [] }));
      })
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [biltyId, initial]);

  const set = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "vehicle_id" && value) {
        const vehicle = vehicles.find((row) => String(row.id) === String(value));
        if (vehicle?.registration_no && !current.truck_no) {
          next.truck_no = vehicle.registration_no;
        }
      }
      return next;
    });
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const setCharge = (index, key, value) => {
    setForm((current) => ({
      ...current,
      charges: current.charges.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  };

  const addCharge = () => {
    setForm((current) => ({
      ...current,
      charges: [...current.charges, emptyCharge("OTHER")],
    }));
  };

  const removeCharge = (index) => {
    setForm((current) => ({
      ...current,
      charges: current.charges.length <= 1
        ? current.charges
        : current.charges.filter((_, i) => i !== index),
    }));
  };

  const total = chargesTotal(form.charges);

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["bilty_number", form.bilty_number, "Enter a bilty number"],
    ]);
    for (const key of ["packages", "weight_kg", "charged_weight_kg", "insurance_amount"]) {
      if (form[key] !== "" && (!Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
        nextIssues[key] = "Enter a valid number";
      }
    }
    form.charges.forEach((row, index) => {
      if (row.amount !== "" && (!Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)) {
        nextIssues[`charge_${index}`] = "Enter a valid amount";
      }
    });
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      const body = buildPayload(form);
      if (editing) {
        await api(endpoints.bilty(biltyId), { method: "PUT", body });
      } else {
        await api(endpoints.bilties, { method: "POST", body });
      }
      onCreated?.(editing ? "Bilty updated" : "Bilty created");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bilty-form" noValidate>
      <FormLegend />

      <SectionCard step="1" title="Header" hint="LR / bilty identity and copy type">
        <Field label="Company" hint="From logged-in company context">
          <input value={companyName || "—"} readOnly className="readonly-input" />
        </Field>
        <Field label="Bilty number" required error={issues.bilty_number}>
          <input
            value={form.bilty_number}
            onChange={set("bilty_number")}
            placeholder="68256"
            disabled={editing}
          />
        </Field>
        <Field label="Bilty date">
          <input type="date" value={form.bilty_date} onChange={set("bilty_date")} />
        </Field>
        <Field label="Copy type">
          <Select value={form.copy_type} onChange={set("copy_type")}>
            {COPY_TYPES.map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" hint={editing ? "Use status advance on the list or detail" : "New bilties start as Reserved, Draft or Confirmed"}>
          <Select value={form.status} onChange={set("status")} disabled={editing}>
            {(editing ? [form.status] : CREATE_STATUSES).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </Field>
      </SectionCard>

      <SectionCard step="2" title="Party & Route" hint="Consignor, consignee, from / to and truck">
        <Field label="Consignor">
          <input value={form.consignor} onChange={set("consignor")} placeholder="Symphony Limited" />
        </Field>
        <Field label="Consignee">
          <input value={form.consignee} onChange={set("consignee")} placeholder="Gupta Electronics" />
        </Field>
        <Field label="Consignor address" className="span-2">
          <textarea rows={2} value={form.consignor_address} onChange={set("consignor_address")} placeholder="Dadri" />
        </Field>
        <Field label="Consignee address" className="span-2">
          <textarea rows={2} value={form.consignee_address} onChange={set("consignee_address")} placeholder="Biharsharif" />
        </Field>
        <Field label="From (pickup)">
          <input value={form.pickup_location} onChange={set("pickup_location")} placeholder="Dadri" />
        </Field>
        <Field label="To (drop)">
          <input value={form.drop_location} onChange={set("drop_location")} placeholder="Biharsharif" />
        </Field>
        <Field label="Vehicle">
          <Select value={form.vehicle_id} onChange={set("vehicle_id")}>
            <option value="">Optional — pick registration</option>
            {vehicles.map((row) => (
              <option key={row.id} value={row.id}>
                {row.registration_no || `Vehicle #${row.id}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Truck no">
          <input value={form.truck_no} onChange={set("truck_no")} placeholder="HR68C9561" />
        </Field>
      </SectionCard>

      <SectionCard step="3" title="Goods" hint="Packages, description, weight and invoice">
        <Field label="Packages" error={issues.packages}>
          <input type="number" min="0" step="1" value={form.packages} onChange={set("packages")} placeholder="128" />
        </Field>
        <Field label="Packages label">
          <input value={form.packages_label} onChange={set("packages_label")} placeholder="CBOX" />
        </Field>
        <Field label="Goods description" className="span-2">
          <input value={form.goods_description} onChange={set("goods_description")} placeholder="Air Cooler" />
        </Field>
        <Field label="Weight (kg)" error={issues.weight_kg}>
          <input type="number" min="0" step="0.01" value={form.weight_kg} onChange={set("weight_kg")} />
        </Field>
        <Field label="Charged weight (kg)" error={issues.charged_weight_kg}>
          <input type="number" min="0" step="0.01" value={form.charged_weight_kg} onChange={set("charged_weight_kg")} />
        </Field>
        <Field label="Rate / remark" className="span-2">
          <input value={form.rate_remark} onChange={set("rate_remark")} placeholder="Rate note" />
        </Field>
        <Field label="Invoice no">
          <input value={form.invoice_no} onChange={set("invoice_no")} placeholder="GT26866714" />
        </Field>
        <Field label="Invoice value">
          <input value={form.invoice_value} onChange={set("invoice_value")} placeholder="AS PER INVOICE" />
        </Field>
      </SectionCard>

      <SectionCard step="4" title="Freight / Charges" hint="Charge rows, payment mode and GST payer">
        <div className="span-2 bilty-charges">
          {form.charges.map((row, index) => (
            <div className="bilty-charge-row" key={`charge-${index}`}>
              <Field label={index === 0 ? "Charge type" : ""}>
                <Select value={row.charge_type} onChange={(event) => setCharge(index, "charge_type", event.target.value)}>
                  {CHARGE_TYPES.map((type) => (
                    <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                  ))}
                </Select>
              </Field>
              <Field label={index === 0 ? "Amount" : ""} error={issues[`charge_${index}`]}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(event) => setCharge(index, "amount", event.target.value)}
                />
              </Field>
              <button
                type="button"
                className="btn btn-ghost bilty-charge-remove"
                onClick={() => removeCharge(index)}
                disabled={form.charges.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="bilty-charges-foot">
            <button type="button" className="btn btn-ghost" onClick={addCharge}>Add charge</button>
            <p className="total-line">Total amount · {money(total)}</p>
          </div>
        </div>
        <Field label="Payment mode">
          <Select value={form.payment_mode} onChange={set("payment_mode")}>
            {PAYMENT_MODES.map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="GST payer">
          <Select value={form.gst_payer} onChange={set("gst_payer")}>
            {GST_PAYERS.map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </Select>
        </Field>
      </SectionCard>

      <SectionCard step="5" title="Insurance / Terms / Signature" hint="Delivery, insurance and print signature area">
        <Field label="Delivery type">
          <Select value={form.delivery_type} onChange={set("delivery_type")}>
            {DELIVERY_TYPES.map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Insurance at risk">
          <Select value={form.insurance_at_risk} onChange={set("insurance_at_risk")}>
            {INSURANCE_AT_RISK.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
        </Field>
        <Field label="Insurance company">
          <input value={form.insurance_company} onChange={set("insurance_company")} />
        </Field>
        <Field label="Policy no">
          <input value={form.insurance_policy_no} onChange={set("insurance_policy_no")} />
        </Field>
        <Field label="Insurance date">
          <input type="date" value={form.insurance_date} onChange={set("insurance_date")} />
        </Field>
        <Field label="Insurance amount" error={issues.insurance_amount}>
          <input type="number" min="0" step="0.01" value={form.insurance_amount} onChange={set("insurance_amount")} />
        </Field>
        <Field label="Terms / notes" className="span-2">
          <textarea rows={3} value={form.terms_notes} onChange={set("terms_notes")} placeholder="Carrier liability / delivery terms" />
        </Field>
        <div className="span-2 bilty-sign-box" aria-hidden="true">
          <span>Authorised signatory</span>
          <em>Signature on print copy</em>
        </div>
      </SectionCard>

      {error ? <p className="form-error">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={editing ? "Save bilty" : "Create bilty"} />
    </form>
  );
}

function ReserveForm({ onClose, onReserved }) {
  const [mode, setMode] = useState("single");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [form, setForm] = useState({ bilty_number: "", prefix: "", from: "", to: "" });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const reserve = (bilty_number) => api(endpoints.biltyReserve, { method: "POST", body: { bilty_number } });

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (mode === "single") {
      const nextIssues = blankIssues([["bilty_number", form.bilty_number, "Enter a bilty number"]]);
      setIssues(nextIssues);
      if (hasIssues(nextIssues)) return;

      setBusy(true);
      try {
        await reserve(form.bilty_number.trim());
        onReserved("Bilty number reserved");
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    const nextIssues = blankIssues([
      ["from", form.from, "Enter the first number"],
      ["to", form.to, "Enter the last number"],
    ]);
    const start = Number(form.from);
    const end = Number(form.to);
    if (!nextIssues.from && (!Number.isInteger(start) || start < 0)) nextIssues.from = "Use whole numbers";
    if (!nextIssues.to && (!Number.isInteger(end) || end < 0)) nextIssues.to = "Use whole numbers";
    if (!nextIssues.from && !nextIssues.to) {
      if (end < start) nextIssues.to = "Must be greater than or equal to the first number";
      else if (end - start + 1 > MAX_RANGE) nextIssues.to = `Reserve at most ${MAX_RANGE} numbers at a time`;
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    const width = Math.max(form.from.trim().length, form.to.trim().length);
    const prefix = form.prefix.trim();
    const from = `${prefix}${String(start).padStart(width, "0")}`;
    const to = `${prefix}${String(end).padStart(width, "0")}`;

    setBusy(true);
    setProgress("Reserving range...");
    try {
      const result = await api(endpoints.biltyReserveRange, { method: "POST", body: { from, to } });
      const done = result.reserved?.length || 0;
      const skipped = result.skipped?.length || 0;
      if (done) onReserved(`${done} bilty number${done === 1 ? "" : "s"} reserved${skipped ? `, ${skipped} skipped` : ""}`);
      else setError(skipped ? `All ${skipped} numbers already exist` : "No numbers reserved");
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress("");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <FormLegend />
      <Field label="Reserve">
        <Select value={mode} onChange={(event) => { setMode(event.target.value); setIssues({}); setError(""); }}>
          <option value="single">Single number</option>
          <option value="range">Number range</option>
        </Select>
      </Field>
      {mode === "single" ? (
        <Field label="Bilty number" required error={issues.bilty_number}>
          <input value={form.bilty_number} onChange={set("bilty_number")} placeholder="68256" autoFocus />
        </Field>
      ) : (
        <>
          <Field label="Prefix" hint="Optional, e.g. BL-">
            <input value={form.prefix} onChange={set("prefix")} placeholder="BL-" />
          </Field>
          <Field label="From" required error={issues.from} hint="Leading zeros are kept, e.g. 0001">
            <input value={form.from} onChange={set("from")} inputMode="numeric" placeholder="1001" />
          </Field>
          <Field label="To" required error={issues.to} hint={`Up to ${MAX_RANGE} numbers`}>
            <input value={form.to} onChange={set("to")} inputMode="numeric" placeholder="1010" />
          </Field>
        </>
      )}
      {progress ? <p className="form-hint span-2">{progress}</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel={mode === "single" ? "Reserve" : "Reserve range"} />
    </form>
  );
}

function sectionEntries(section) {
  if (!section || typeof section !== "object") return [];
  if (Array.isArray(section)) {
    return section.map((row, index) => {
      if (row && typeof row === "object") {
        const label = row.label || row.key || row.charge_type || `Item ${index + 1}`;
        const value = row.value ?? row.amount ?? row.text ?? Object.values(row).filter((v) => typeof v !== "object").join(" · ");
        return [label, value];
      }
      return [`Item ${index + 1}`, row];
    });
  }
  return Object.entries(section).map(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return [key, Object.entries(value).map(([k, v]) => `${k}: ${v ?? "—"}`).join(" · ")];
    }
    if (Array.isArray(value)) {
      return [key, value.map((item) => (typeof item === "object" ? JSON.stringify(item) : item)).join(", ")];
    }
    return [key, value];
  });
}

function prettyKey(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function PrintView({ print, bilty, onClose }) {
  const sections = print?.sections || {};
  const order = [
    ["header", "Header"],
    ["party_route", "Party & Route"],
    ["goods", "Goods"],
    ["freight", "Freight / Charges"],
    ["insurance_terms", "Insurance / Terms"],
  ];
  const title = bilty?.bilty_number || print?.bilty?.bilty_number || "Bilty";

  return (
    <div className="bilty-print">
      <div className="bilty-print-toolbar no-print">
        <div>
          <strong>{title}</strong>
          <p className="muted">Print-friendly LR layout from API sections</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <article className="bilty-print-sheet">
        <header className="bilty-print-banner">
          <div>
            <p className="bilty-print-kicker">Lorry receipt / bilty</p>
            <h1>{title}</h1>
          </div>
          <div className="bilty-print-meta">
            <span>{bilty?.copy_type || "—"}</span>
            <span>{formatDate(bilty?.bilty_date)}</span>
            <StatusPill value={bilty?.status} />
          </div>
        </header>

        {order.map(([key, label]) => {
          const entries = sectionEntries(sections[key]);
          if (!entries.length && !sections[key]) return null;
          return (
            <section key={key} className="bilty-print-section">
              <h2>{label}</h2>
              {key === "freight" && Array.isArray(sections.freight?.charges || sections.freight) ? (
                <table className="bilty-print-table">
                  <thead>
                    <tr>
                      <th>Charge</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sections.freight?.charges || sections.freight || []).map((row, index) => (
                      <tr key={index}>
                        <td>{prettyKey(row.charge_type || row.label || `Charge ${index + 1}`)}</td>
                        <td>{money(row.amount ?? row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <dl className="bilty-print-grid">
                  {entries.map(([entryKey, value]) => (
                    <div key={String(entryKey)}>
                      <dt>{prettyKey(entryKey)}</dt>
                      <dd>{value === null || value === undefined || value === "" ? "—" : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {key === "freight" && (sections.freight?.total_amount != null || bilty?.total_amount != null) ? (
                <p className="bilty-print-total">Total · {money(sections.freight?.total_amount ?? bilty?.total_amount)}</p>
              ) : null}
            </section>
          );
        })}

        <footer className="bilty-print-sign">
          <div>
            <span>Consignor</span>
            <em />
          </div>
          <div>
            <span>Driver</span>
            <em />
          </div>
          <div>
            <span>Authorised signatory</span>
            <em />
          </div>
        </footer>
      </article>
    </div>
  );
}

function BiltyDetail({ row, onClose, onEdit, onPrint, onCancel, onStatus, busy }) {
  const next = NEXT_STATUS.bilty[row.status] || [];
  const route = row.pickup_location || row.drop_location
    ? `${row.pickup_location || "?"} → ${row.drop_location || "?"}`
    : "—";

  return (
    <div className="stack">
      <DetailList rows={[
        ["Bilty number", row.bilty_number],
        ["Date", formatDate(row.bilty_date)],
        ["Copy", row.copy_type],
        ["Status", row.status],
        ["Consignor", row.consignor],
        ["Consignee", row.consignee],
        ["Route", route],
        ["Truck no", row.truck_no],
        ["Packages", row.packages != null ? `${row.packages}${row.packages_label ? ` ${row.packages_label}` : ""}` : "—"],
        ["Goods", row.goods_description],
        ["Weight (kg)", row.weight_kg],
        ["Charged weight", row.charged_weight_kg],
        ["Payment", row.payment_mode],
        ["GST payer", row.gst_payer],
        ["Total", row.total_amount != null ? money(row.total_amount) : "—"],
        ["Delivery", row.delivery_type],
        ["Insurance risk", row.insurance_at_risk],
        ["Created", formatDate(row.created_at)],
        ["Updated", formatDate(row.updated_at)],
      ]} />

      {next.length ? (
        <Field label="Advance status">
          <StatusNext
            value={row.status}
            next={next}
            onChange={onStatus}
          />
        </Field>
      ) : null}

      <div className="page-actions bilty-detail-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Close</button>
        {row.status !== "CANCELLED" ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel bilty</button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onPrint} disabled={busy}>Print</button>
        <button type="button" className="btn btn-primary" onClick={onEdit} disabled={busy}>Edit</button>
      </div>
    </div>
  );
}

export default function Loads() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useResource(async () => {
    const bilties = await fetchAll(endpoints.bilties, "bilties");
    return {
      rows: bilties.rows,
      total: bilties.total,
    };
  }, []);

  const filtered = useMemo(
    () => (data?.rows || []).filter((row) => (
      (!status || String(row.status) === status)
      && includesQuery(row, query, [
        "bilty_number",
        "status",
        "consignor",
        "consignee",
        "pickup_location",
        "drop_location",
        "truck_no",
        "goods_description",
      ])
    )),
    [data, query, status]
  );
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const statusOptions = useMemo(() => {
    const present = statusList(data?.rows);
    return [...STATUSES, ...present.filter((value) => !STATUSES.includes(value))];
  }, [data]);

  const route = (row) => (row.pickup_location || row.drop_location
    ? `${row.pickup_location || "?"} → ${row.drop_location || "?"}`
    : "—");

  const openDetail = async (row) => {
    setActionError("");
    setBusy(true);
    try {
      const data = await api(endpoints.bilty(row.id));
      const bilty = data.bilty || data;
      setDetail({ ...row, ...bilty, charges: data.charges || bilty.charges || [] });
    } catch (err) {
      setDetail(row);
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (row, nextStatus) => {
    setBusy(true);
    setActionError("");
    try {
      await api(endpoints.bilty(row.id), { method: "PUT", body: { status: nextStatus } });
      toast(`Status → ${nextStatus.replaceAll("_", " ")}`);
      reload();
      if (detail?.id === row.id) {
        setDetail((current) => ({ ...current, status: nextStatus }));
      }
    } catch (err) {
      setActionError(err.message);
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelBilty = async (row) => {
    if (!window.confirm(`Cancel bilty ${row.bilty_number}?`)) return;
    setBusy(true);
    setActionError("");
    try {
      await api(endpoints.bilty(row.id), { method: "DELETE" });
      toast("Bilty cancelled");
      setDetail(null);
      reload();
    } catch (err) {
      setActionError(err.message);
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openPrint = async (row) => {
    setBusy(true);
    setActionError("");
    try {
      const data = await api(endpoints.biltyPrint(row.id));
      setPrintData({
        print: data.print || data,
        bilty: data.print?.bilty || data.bilty || row,
      });
      setDetail(null);
    } catch (err) {
      setActionError(err.message);
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <PageHeader title="Bilty" subtitle="Physical LR layout — header, party & route, goods, freight, insurance / terms.">
        <button className="btn btn-ghost" type="button" onClick={() => setReserveOpen(true)}>
          Reserve
        </button>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          New Bilty
        </button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Bilties {data ? <span className="count">{filtered.length}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        <ChipFilter options={statusOptions} value={status} onChange={(value) => { setStatus(value); pager.setPage(1); }} />
        {loading ? <p className="muted pad">Loading bilties...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query || status ? "No bilties match this search." : "No bilties yet."}
            emptyAction={query || status ? null : { label: "New Bilty", onClick: () => setOpen(true) }}
            columns={[
              { key: "bilty_number", label: "Bilty number", render: (row) => row.bilty_number },
              { key: "route", label: "From → To", render: route },
              { key: "truck", label: "Truck no", render: (row) => row.truck_no || "—" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusNext
                    value={row.status}
                    next={NEXT_STATUS.bilty[row.status] || []}
                    onChange={(next) => changeStatus(row, next)}
                  />
                ),
              },
              { key: "created", label: "Created", render: (row) => formatDate(row.created_at) },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost table-action" onClick={() => openPrint(row)}>Print</button>
                    <ViewButton onClick={() => openDetail(row)} />
                  </div>
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>

      {detail ? (
        <Modal title={detail.bilty_number} onClose={() => setDetail(null)} wide>
          <BiltyDetail
            row={detail}
            busy={busy}
            onClose={() => setDetail(null)}
            onEdit={() => {
              setEditRow(detail);
              setDetail(null);
            }}
            onPrint={() => openPrint(detail)}
            onCancel={() => cancelBilty(detail)}
            onStatus={(next) => changeStatus(detail, next)}
          />
        </Modal>
      ) : null}

      {printData ? (
        <Modal title={`Print · ${printData.bilty?.bilty_number || "Bilty"}`} onClose={() => setPrintData(null)} wide>
          <PrintView
            print={printData.print}
            bilty={printData.bilty}
            onClose={() => setPrintData(null)}
          />
        </Modal>
      ) : null}

      {reserveOpen ? (
        <Modal title="Reserve bilty numbers" onClose={() => setReserveOpen(false)}>
          <ReserveForm
            onClose={() => setReserveOpen(false)}
            onReserved={(message) => {
              setReserveOpen(false);
              toast(message);
              reload();
            }}
          />
        </Modal>
      ) : null}

      {open ? (
        <Modal title="New Bilty" onClose={() => setOpen(false)} wide>
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

      {editRow ? (
        <Modal title={`Edit · ${editRow.bilty_number}`} onClose={() => setEditRow(null)} wide>
          <ShipmentForm
            biltyId={editRow.id}
            initial={editRow}
            onClose={() => setEditRow(null)}
            onCreated={(message) => {
              setEditRow(null);
              toast(message || "Bilty updated");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
