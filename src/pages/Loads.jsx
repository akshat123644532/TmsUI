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

const COPY_TYPES = ["CONSIGNOR", "CONSIGNEE", "DRIVER", "TRANSPORT"];
const PAYMENT_MODES = ["TO_PAY", "PAID", "TO_BE_BILLED"];
const GST_PAYERS = ["CONSIGNOR", "CONSIGNEE", "TRANSPORT_OPERATOR"];
const DELIVERY_TYPES = ["DOOR_DELIVERY", "GODOWN"];
const INSURANCE_AT_RISK = ["CARRIER", "OWNER"];
const CHARGE_TYPES = ["FREIGHT", "LABOUR", "SURCHARGE", "ST_CHARGE", "RISK_CHARGE", "GR_CHARGE", "OTHER"];

const DEFAULT_COPY_SETTINGS = [
  { copy_type: "CONSIGNOR", label: "Consignor Copy", color_hex: "#FFFFFF", color_name: "White", sort_order: 1 },
  { copy_type: "CONSIGNEE", label: "Consignee Copy", color_hex: "#F8C8DC", color_name: "Pink", sort_order: 2 },
  { copy_type: "DRIVER", label: "Driver Copy", color_hex: "#FFF59D", color_name: "Yellow", sort_order: 3 },
  { copy_type: "TRANSPORT", label: "Transport Copy", color_hex: "#C8E6C9", color_name: "Green", sort_order: 4 },
];

function normalizeCopySettings(raw) {
  const rows = raw?.copies || raw?.settings || (Array.isArray(raw) ? raw : null) || DEFAULT_COPY_SETTINGS;
  return [...rows]
    .map((row, index) => ({
      copy_type: row.copy_type || COPY_TYPES[index] || `COPY_${index + 1}`,
      label: row.label || `${prettyLabel(row.copy_type || COPY_TYPES[index])} Copy`,
      color_hex: normalizeHex(row.color_hex) || DEFAULT_COPY_SETTINGS[index]?.color_hex || "#FFFFFF",
      color_name: row.color_name || "Custom",
      sort_order: Number(row.sort_order) || index + 1,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeHex(value) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return "";
}

function prettyLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function extractBilty(data, fallback = {}) {
  const bilty = data?.bilty || data?.data || data;
  if (!bilty || typeof bilty !== "object") return fallback;
  return {
    ...fallback,
    ...bilty,
    id: bilty.id || data?.id || fallback.id,
    charges: data?.charges || bilty.charges || fallback.charges,
  };
}

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
      const data = editing
        ? await api(endpoints.bilty(biltyId), { method: "PUT", body })
        : await api(endpoints.bilties, { method: "POST", body });
      const bilty = extractBilty(data, { ...body, id: biltyId });
      onCreated?.(editing ? "Bilty updated" : "Bilty created", bilty);
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

const SECTION_TITLES = {
  header: "Header",
  party_route: "Party & Route",
  goods: "Goods",
  freight: "Freight / Charges",
  insurance_terms: "Insurance / Terms",
  delivery_note: "Delivery note",
};

const DRIVER_HIDDEN_SECTIONS = new Set(["freight", "insurance_terms"]);

function isEmptyField(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function sectionEntries(section, { hideEmpty = true } = {}) {
  if (!section || typeof section !== "object") return [];
  if (Array.isArray(section)) {
    return section.flatMap((row, index) => {
      if (row && typeof row === "object") {
        const label = row.label || row.key || row.charge_type || `Item ${index + 1}`;
        const value = row.value ?? row.amount ?? row.text
          ?? Object.entries(row)
            .filter(([k]) => !["label", "key", "charge_type"].includes(k))
            .map(([, v]) => v)
            .filter((v) => typeof v !== "object")
            .join(" · ");
        if (hideEmpty && isEmptyField(value)) return [];
        return [[label, value]];
      }
      if (hideEmpty && isEmptyField(row)) return [];
      return [[`Item ${index + 1}`, row]];
    });
  }
  return Object.entries(section).flatMap(([key, value]) => {
    if (key === "charges") return [];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = Object.entries(value)
        .filter(([, v]) => !(hideEmpty && isEmptyField(v)))
        .map(([k, v]) => `${prettyLabel(k)}: ${v ?? "—"}`)
        .join(" · ");
      if (hideEmpty && !nested) return [];
      return [[key, nested || "—"]];
    }
    if (Array.isArray(value)) {
      if (hideEmpty && !value.length) return [];
      return [[key, value.map((item) => (typeof item === "object" ? JSON.stringify(item) : item)).join(", ")]];
    }
    if (hideEmpty && isEmptyField(value)) return [];
    return [[key, value]];
  });
}

function prettyKey(key) {
  return prettyLabel(key);
}

function resolveVisibleSections(page) {
  const sections = page?.sections && typeof page.sections === "object" ? page.sections : {};
  const copyType = String(page?.copy_type || "").toUpperCase();
  const isDriver = copyType === "DRIVER";

  let keys = Array.isArray(page?.visible_sections) && page.visible_sections.length
    ? page.visible_sections.map(String)
    : Object.keys(sections);

  // Never invent sections that are not present on this page payload.
  keys = keys.filter((key) => Object.prototype.hasOwnProperty.call(sections, key));

  // Driver copy: never render freight / insurance blocks.
  if (isDriver) {
    keys = keys.filter((key) => !DRIVER_HIDDEN_SECTIONS.has(key));
  }

  return keys;
}

function freightChargeRows(block) {
  if (!block || typeof block !== "object") return [];
  if (Array.isArray(block.charges)) return block.charges;
  if (Array.isArray(block)) return block;
  return [];
}

function BiltyPrintSection({ sectionKey, block, color }) {
  const title = SECTION_TITLES[sectionKey] || prettyLabel(sectionKey);
  const entries = sectionEntries(block, { hideEmpty: true });
  const chargeRows = sectionKey === "freight" ? freightChargeRows(block) : [];
  const total = sectionKey === "freight" && block && typeof block === "object" && !Array.isArray(block)
    ? block.total_amount
    : null;

  if (!entries.length && !chargeRows.length && total == null) {
    // Section key exists but has no usable fields — still show a light shell only for known note blocks.
    if (sectionKey === "delivery_note" && (typeof block === "string" || block == null)) {
      return (
        <section className="bilty-print-section" style={{ borderTopColor: color }}>
          <h2>{title}</h2>
          <p className="bilty-print-note">{block ? String(block) : "—"}</p>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="bilty-print-section" style={{ borderTopColor: color }}>
      <h2 style={{ borderBottomColor: color }}>{title}</h2>
      {chargeRows.length ? (
        <table className="bilty-print-table">
          <thead>
            <tr>
              <th>Charge</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {chargeRows.map((row, index) => (
              <tr key={index}>
                <td>{prettyKey(row.charge_type || row.label || `Charge ${index + 1}`)}</td>
                <td>{isEmptyField(row.amount ?? row.value) ? "—" : money(row.amount ?? row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {entries.length ? (
        <dl className="bilty-print-grid">
          {entries.map(([entryKey, value]) => (
            <div key={String(entryKey)}>
              <dt>{prettyKey(entryKey)}</dt>
              <dd>{isEmptyField(value) ? "—" : String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {total != null && total !== "" ? (
        <p className="bilty-print-total">Total · {money(total)}</p>
      ) : null}
    </section>
  );
}

function BiltyPrintPage({ page }) {
  const sections = page?.sections && typeof page.sections === "object" ? page.sections : {};
  const color = normalizeHex(page?.color_hex) || "#FFFFFF";
  const visible = resolveVisibleSections(page);
  const isDriver = String(page?.copy_type || "").toUpperCase() === "DRIVER";
  const header = sections.header && typeof sections.header === "object" ? sections.header : {};
  const biltyNo = header.bilty_number || page?.bilty_number || "Bilty";
  const biltyDate = header.bilty_date || page?.bilty_date;

  return (
    <article
      className={`bilty-print-sheet bilty-print-page${page?.page_break_after ? " break-after" : ""}${isDriver ? " is-driver" : ""}`}
      data-copy-type={page?.copy_type || ""}
      style={{
        "--copy-color": color,
        borderColor: color,
        background: `linear-gradient(${color} 0%, ${color} 52px, #ffffff 168px)`,
      }}
    >
      <div className="bilty-print-watermark" style={{ color }} aria-hidden="true">
        {page?.title || prettyLabel(page?.copy_type)}
      </div>

      <div className="bilty-print-copy-banner" style={{ background: color, borderColor: color }}>
        <strong className="bilty-print-copy-title">{page?.title || prettyLabel(page?.copy_type)}</strong>
        <span className="bilty-print-copy-sub">
          {page?.color_name || color}
          {isDriver ? " · Limited fields" : ""}
        </span>
      </div>

      <header className="bilty-print-banner" style={{ borderBottomColor: color }}>
        <div>
          <p className="bilty-print-kicker">Lorry receipt / bilty</p>
          <h1>{biltyNo}</h1>
        </div>
        <div className="bilty-print-meta">
          {biltyDate ? <span>{formatDate(biltyDate)}</span> : null}
          <span>{prettyLabel(page?.copy_type)}</span>
        </div>
      </header>

      {visible.map((sectionKey) => (
        <BiltyPrintSection
          key={sectionKey}
          sectionKey={sectionKey}
          block={sections[sectionKey]}
          color={color}
        />
      ))}

      <footer className="bilty-print-sign">
        <div><span>Consignor</span><em /></div>
        <div><span>Driver</span><em /></div>
        <div><span>Authorised signatory</span><em /></div>
      </footer>
    </article>
  );
}

function CopySettingsForm({ copies, onClose, onSaved }) {
  const [rows, setRows] = useState(() => normalizeCopySettings({ copies }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setRow = (index, key, value) => {
    setRows((current) => current.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [key]: value };
      if (key === "color_hex") next.color_hex = normalizeHex(value) || value;
      return next;
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        copies: rows.map((row, index) => ({
          copy_type: row.copy_type,
          label: row.label.trim() || `${prettyLabel(row.copy_type)} Copy`,
          color_hex: normalizeHex(row.color_hex) || "#FFFFFF",
          color_name: row.color_name.trim() || "Custom",
          sort_order: Number(row.sort_order) || index + 1,
        })),
      };
      const data = await api(endpoints.biltyCopySettings, { method: "PUT", body: payload });
      onSaved(normalizeCopySettings(data.copies ? data : payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bilty-copy-settings" noValidate>
      <p className="muted">Confirm final colours with sir — these defaults are fine until then.</p>
      {rows.map((row, index) => (
        <div className="bilty-copy-settings-row" key={row.copy_type}>
          <div className="bilty-copy-swatch" style={{ background: normalizeHex(row.color_hex) || "#fff" }} />
          <Field label="Copy">
            <input value={row.label} onChange={(event) => setRow(index, "label", event.target.value)} />
          </Field>
          <Field label="Color name">
            <input value={row.color_name} onChange={(event) => setRow(index, "color_name", event.target.value)} />
          </Field>
          <Field label="Picker">
            <input
              type="color"
              value={normalizeHex(row.color_hex) || "#FFFFFF"}
              onChange={(event) => setRow(index, "color_hex", event.target.value)}
            />
          </Field>
          <Field label="Hex">
            <input
              value={row.color_hex}
              onChange={(event) => setRow(index, "color_hex", event.target.value)}
              placeholder="#FFFFFF"
            />
          </Field>
        </div>
      ))}
      {error ? <p className="form-error">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Save colours" />
    </form>
  );
}

function PrintScreen({ bilty, onClose }) {
  const biltyId = bilty?.id;
  const [copies, setCopies] = useState(DEFAULT_COPY_SETTINGS);
  const [selected, setSelected] = useState(() => new Set(COPY_TYPES));
  const [print, setPrint] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoadingSettings(true);
    api(endpoints.biltyCopySettings)
      .then((data) => {
        if (!alive) return;
        const next = normalizeCopySettings(data);
        setCopies(next);
        setSelected(new Set(next.map((row) => row.copy_type)));
      })
      .catch(() => {
        if (!alive) return;
        setCopies(DEFAULT_COPY_SETTINGS);
        setSelected(new Set(COPY_TYPES));
      })
      .finally(() => alive && setLoadingSettings(false));
    return () => { alive = false; };
  }, []);

  const selectedList = copies
    .filter((row) => selected.has(row.copy_type))
    .map((row) => row.copy_type);

  const allSelected = copies.length > 0 && selectedList.length === copies.length;

  const toggleCopy = (copyType) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(copyType)) next.delete(copyType);
      else next.add(copyType);
      return next;
    });
    setPrint(null);
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(copies.map((row) => row.copy_type)));
    setPrint(null);
  };

  const loadPreview = async () => {
    if (!biltyId) {
      setError("Missing bilty id");
      return null;
    }
    if (!selectedList.length) {
      setError("Select at least one copy");
      return null;
    }
    setLoadingPreview(true);
    setError("");
    try {
      const data = await api(endpoints.biltyPrint(biltyId), {
        method: "POST",
        body: { copies: selectedList },
      });
      const nextPrint = data.print || data;
      setPrint(nextPrint);
      return nextPrint;
    } catch (err) {
      // Fallback to GET ?copies= for backends that only expose query print.
      try {
        const query = selectedList.length === copies.length ? "ALL" : selectedList.join(",");
        const data = await api(`${endpoints.biltyPrint(biltyId)}?copies=${encodeURIComponent(query)}`);
        const nextPrint = data.print || data;
        setPrint(nextPrint);
        return nextPrint;
      } catch {
        setError(err.message);
        return null;
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePrint = async () => {
    const ready = print?.pages?.length ? print : await loadPreview();
    if (!ready?.pages?.length) return;
    window.setTimeout(() => window.print(), 50);
  };

  const pages = print?.pages || [];
  const title = bilty?.bilty_number || "Bilty";

  return (
    <div className="bilty-print">
      <div className="bilty-print-toolbar no-print">
        <div>
          <strong>Print · {title}</strong>
          <p className="muted">One saved bilty · choose coloured copies · browser print</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
            Copy colours
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loadingPreview || !selectedList.length}
            onClick={loadPreview}
          >
            {loadingPreview ? "Loading..." : "Preview"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loadingPreview || !selectedList.length}
            onClick={handlePrint}
          >
            Print
          </button>
        </div>
      </div>

      <div className="bilty-copy-picker no-print">
        <label className="bilty-copy-check all">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={loadingSettings} />
          <span>Select All</span>
        </label>
        {copies.map((row) => {
          const limited = String(row.copy_type).toUpperCase() === "DRIVER";
          return (
            <label className={`bilty-copy-check${limited ? " limited" : ""}`} key={row.copy_type}>
              <input
                type="checkbox"
                checked={selected.has(row.copy_type)}
                onChange={() => toggleCopy(row.copy_type)}
                disabled={loadingSettings}
              />
              <span className="bilty-copy-dot" style={{ background: row.color_hex }} />
              <span>
                {row.label}
                <small>
                  {row.color_name}
                  {limited ? (
                    <em className="bilty-copy-badge">Limited fields</em>
                  ) : null}
                </small>
              </span>
            </label>
          );
        })}
      </div>

      {error ? <Banner>{error}</Banner> : null}

      {pages.length ? (
        <div className="bilty-print-pages">
          <p className="muted no-print">
            {print.page_count || pages.length} page(s) · layouts follow each copy&apos;s visible sections
          </p>
          {pages.map((page, index) => (
            <BiltyPrintPage
              key={`${page.copy_type || "copy"}-${page.page || index}`}
              page={page}
            />
          ))}
        </div>
      ) : (
        <p className="muted no-print pad">
          Select one or more copies, then Preview or Print. Same bilty id — no extra records.
        </p>
      )}

      {settingsOpen ? (
        <div className="bilty-copy-settings-panel no-print">
          <div className="panel-section-head">
            <div>
              <h3>Copy colours</h3>
              <p className="muted">Saved once for the company · used on every bilty print</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>Hide</button>
          </div>
          <CopySettingsForm
            copies={copies}
            onClose={() => setSettingsOpen(false)}
            onSaved={(next) => {
              setCopies(next);
              setSelected((current) => {
                const allowed = new Set(next.map((row) => row.copy_type));
                const kept = [...current].filter((type) => allowed.has(type));
                return new Set(kept.length ? kept : next.map((row) => row.copy_type));
              });
              setPrint(null);
              setSettingsOpen(false);
            }}
          />
        </div>
      ) : null}
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
  const [printBilty, setPrintBilty] = useState(null);
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

  const openPrint = (row) => {
    setActionError("");
    setDetail(null);
    setPrintBilty(row);
  };

  const afterSave = (message, bilty) => {
    toast(message);
    reload();
    if (bilty?.id) setPrintBilty(extractBilty({ bilty }, bilty));
  };

  useEffect(() => {
    const printId = params.get("print");
    if (!printId || !data?.rows) return;
    const row = data.rows.find((item) => String(item.id) === String(printId));
    if (row) setPrintBilty(row);
  }, [params, data]);

  return (
    <section>
      <PageHeader title="Bilty" subtitle="Save once, then print coloured Consignor / Consignee / Driver / Transport copies.">
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

      {printBilty ? (
        <Modal title={`Print · ${printBilty.bilty_number || "Bilty"}`} onClose={() => setPrintBilty(null)} wide>
          <PrintScreen bilty={printBilty} onClose={() => setPrintBilty(null)} />
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
            onCreated={(message, bilty) => {
              setOpen(false);
              afterSave(message || "Bilty created", bilty);
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
            onCreated={(message, bilty) => {
              setEditRow(null);
              afterSave(message || "Bilty updated", bilty);
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
