import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fetchAll } from "../api";
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
  ViewButton,
} from "../components/ui";
import { blankIssues, formatDate, hasIssues, includesQuery, money, NEXT_STATUS, num, statusList, today, tripLabel, usePaged, useResource, useSearchFocus } from "../lib";
import { useToast } from "../toast";

const DEFAULT_HSN_SAC = "996791";
const TAX_TYPES = [
  { type: "CGST", key: "cgst_rate" },
  { type: "SGST", key: "sgst_rate" },
  { type: "IGST", key: "igst_rate" },
];

function blankItem(description = "") {
  return {
    description,
    hsn_sac: DEFAULT_HSN_SAC,
    trip_id: "",
    bilty_id: "",
    freight: "",
    detention: "",
    hamali: "",
    other_charges: "",
  };
}

function InvoiceForm({ clients, trips, bilties, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState({
    client_id: "",
    invoice_number: "",
    invoice_date: today(),
    due_date: "",
    cgst_rate: "",
    sgst_rate: "",
    igst_rate: "",
    deduction_amount: "",
  });
  const [items, setItems] = useState([blankItem("Freight")]);

  const subtotal = items.reduce(
    (sum, item) => sum + num(item.freight) + num(item.detention) + num(item.hamali) + num(item.other_charges),
    0
  );
  // Tax breakdown: each component is a % of the taxable subtotal; tax_amount is their sum.
  const taxes = TAX_TYPES
    .map(({ type, key }) => ({
      tax_type: type,
      tax_rate: num(header[key]),
      taxable_amount: subtotal,
      tax_amount: Math.round(subtotal * num(header[key])) / 100,
    }))
    .filter((tax) => tax.tax_rate > 0);
  const taxAmount = taxes.reduce((sum, tax) => sum + tax.tax_amount, 0);
  const total = subtotal + taxAmount;

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["client_id", header.client_id, "Select a client"],
      ["invoice_number", header.invoice_number, "Enter an invoice number"],
      ["invoice_date", header.invoice_date, "Choose an invoice date"],
    ]);
    if (header.due_date && header.invoice_date && header.due_date < header.invoice_date) {
      nextIssues.due_date = "Due date cannot be before the invoice date";
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");

    try {
      await api("/api/invoices", {
        method: "POST",
        body: {
          client_id: header.client_id,
          invoice_number: header.invoice_number.trim(),
          invoice_date: header.invoice_date,
          due_date: header.due_date || null,
          tax_amount: taxAmount,
          taxes,
          deduction_amount: num(header.deduction_amount),
          items: items.map((item) => {
            const freight = num(item.freight);
            const detention = num(item.detention);
            const hamali = num(item.hamali);
            const other_charges = num(item.other_charges);
            return {
              description: item.description || null,
              hsn_sac: item.hsn_sac.trim() || DEFAULT_HSN_SAC,
              trip_id: item.trip_id || null,
              bilty_id: item.bilty_id || null,
              freight,
              detention,
              hamali,
              other_charges,
              item_total: freight + detention + hamali + other_charges,
            };
          }),
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (index, key, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  };

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <FormLegend />
      <div className="form-grid">
        <Field label="Client" required error={issues.client_id}>
          <Select
            value={header.client_id}
            onChange={(event) => {
              setHeader({ ...header, client_id: event.target.value });
              setIssues((current) => ({ ...current, client_id: "" }));
            }}
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice number" required error={issues.invoice_number}>
          <input
            value={header.invoice_number}
            onChange={(event) => {
              setHeader({ ...header, invoice_number: event.target.value });
              setIssues((current) => ({ ...current, invoice_number: "" }));
            }}
            placeholder="INV-1001"
          />
        </Field>
        <Field label="Invoice date" required error={issues.invoice_date}>
          <input
            type="date"
            value={header.invoice_date}
            onChange={(event) => {
              setHeader({ ...header, invoice_date: event.target.value });
              setIssues((current) => ({ ...current, invoice_date: "" }));
            }}
          />
        </Field>
        <Field label="Due date" error={issues.due_date}>
          <input
            type="date"
            value={header.due_date}
            onChange={(event) => {
              setHeader({ ...header, due_date: event.target.value });
              setIssues((current) => ({ ...current, due_date: "" }));
            }}
          />
        </Field>
        {TAX_TYPES.map(({ type, key }) => (
          <Field key={key} label={`${type} rate (%)`} hint={`${type} amount ${money(subtotal * num(header[key]) / 100)}`}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={header[key]}
              onChange={(event) => setHeader({ ...header, [key]: event.target.value })}
              placeholder="0"
            />
          </Field>
        ))}
        <Field label="Tax amount" hint="CGST + SGST + IGST · auto">
          <input readOnly value={money(taxAmount)} />
        </Field>
        <Field label="Deduction amount" hint="invoices.deduction_amount · default 0">
          <input
            type="number"
            min="0"
            step="0.01"
            value={header.deduction_amount}
            onChange={(event) => setHeader({ ...header, deduction_amount: event.target.value })}
          />
        </Field>
      </div>
      <p className="form-hint">status always starts as DRAFT · taxable/subtotal/total/balance are calculated from line items</p>
      <p className="form-hint">invoice_items: trip_id, bilty_id, description, freight, detention, hamali, other_charges (item_total auto)</p>
      {items.map((item, index) => (
        <div className="line-card" key={index}>
          <div className="form-grid">
            <Field label="Description">
              <input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} />
            </Field>
            <Field label="HSN / SAC" hint="Default 996791 (goods transport)">
              <input value={item.hsn_sac} onChange={(event) => updateItem(index, "hsn_sac", event.target.value)} />
            </Field>
            <Field label="Freight">
              <input type="number" min="0" step="0.01" value={item.freight} onChange={(event) => updateItem(index, "freight", event.target.value)} />
            </Field>
            <Field label="Detention">
              <input type="number" min="0" step="0.01" value={item.detention} onChange={(event) => updateItem(index, "detention", event.target.value)} />
            </Field>
            <Field label="Hamali">
              <input type="number" min="0" step="0.01" value={item.hamali} onChange={(event) => updateItem(index, "hamali", event.target.value)} />
            </Field>
            <Field label="Other charges">
              <input type="number" min="0" step="0.01" value={item.other_charges} onChange={(event) => updateItem(index, "other_charges", event.target.value)} />
            </Field>
            <Field label="Trip">
              <Select value={item.trip_id} onChange={(event) => updateItem(index, "trip_id", event.target.value)}>
                <option value="">None</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>{trip.source} → {trip.destination}</option>
                ))}
              </Select>
            </Field>
            <Field label="Bilty">
              <Select value={item.bilty_id} onChange={(event) => updateItem(index, "bilty_id", event.target.value)}>
                <option value="">None</option>
                {bilties.map((bilty) => (
                  <option key={bilty.id} value={bilty.id}>{bilty.bilty_number}</option>
                ))}
              </Select>
            </Field>
            <Field label="Line total" hint="auto">
              <input readOnly value={money(num(item.freight) + num(item.detention) + num(item.hamali) + num(item.other_charges))} />
            </Field>
          </div>
        </div>
      ))}

      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => setItems((current) => [...current, blankItem()])}
      >
        Add line
      </button>
      <p className="total-line">
        Taxable {money(subtotal)} · tax {money(taxAmount)} · total {money(total)} · deduction {money(header.deduction_amount)} · balance {money(Math.max(0, total - num(header.deduction_amount)))}
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create invoice" />
    </form>
  );
}

export default function Invoices() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get("q") || "");
  const [modal, setModal] = useState("");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState(null);
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [invoices, clients, trips, bilties] = await Promise.all([
      fetchAll("/api/invoices", "invoices"),
      fetchAll("/api/clients", "clients"),
      fetchAll("/api/trips", "trips"),
      fetchAll("/api/bilties", "bilties"),
    ]);
    return {
      invoices: invoices.rows,
      clients: clients.rows,
      trips: trips.rows,
      bilties: bilties.rows,
      total: invoices.total,
    };
  }, []);

  const names = useMemo(
    () => new Map((data?.clients || []).map((client) => [String(client.id), client.name])),
    [data]
  );
  const filtered = useMemo(() => {
    const rows = (data?.invoices || []).map((invoice) => ({
      ...invoice,
      client_name: names.get(String(invoice.client_id)) || "—",
    }));
    return rows.filter((row) => (
      (!status || String(row.status) === status)
      && includesQuery(row, query, ["invoice_number", "status", "client_name"])
    ));
  }, [data, names, query, status]);
  const pager = usePaged(filtered);
  const focus = useSearchFocus(params, filtered, pager.setPage);

  useEffect(() => setQuery(params.get("q") || ""), [params]);

  const changeStatus = async (invoice, status) => {
    setActionError("");
    try {
      await api(`/api/invoices/${invoice.id}/status`, { method: "PATCH", body: { status } });
      toast("Invoice updated");
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const openInvoice = async (row) => {
    try {
      const response = await api(`/api/invoices/${row.id}`);
      setDetail(response.invoice || { ...row, items: [] });
    } catch {
      setDetail(row);
    }
  };

  return (
    <section>
      <PageHeader title="Invoices" subtitle="Draft invoices with freight, detention, hamali, tax, and balance.">
        <button className="btn btn-primary" type="button" onClick={() => setModal("invoice")}>New Invoice</button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Invoices {data ? <span className="count">{filtered.length}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        <ChipFilter options={statusList(data?.invoices)} value={status} onChange={(value) => { setStatus(value); pager.setPage(1); }} />
        {loading ? <p className="muted pad">Loading invoices...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query || status ? "No invoices match this search." : "No invoices yet."}
            emptyAction={query || status ? null : { label: "New Invoice", onClick: () => setModal("invoice") }}
            columns={[
              { key: "no", label: "Invoice no", render: (row) => row.invoice_number },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "date", label: "Date", render: (row) => formatDate(row.invoice_date) },
              { key: "due", label: "Due", render: (row) => formatDate(row.due_date) },
              { key: "taxable", label: "Taxable", align: "right", render: (row) => money(row.taxable_amount) },
              { key: "subtotal", label: "Subtotal", align: "right", render: (row) => money(row.subtotal) },
              { key: "tax", label: "Tax", align: "right", render: (row) => money(row.tax_amount) },
              { key: "total", label: "Total", align: "right", render: (row) => money(row.total_amount) },
              { key: "deduction", label: "Deduction", align: "right", render: (row) => money(row.deduction_amount) },
              { key: "balance", label: "Balance", align: "right", render: (row) => money(row.balance_amount) },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusNext
                    value={row.status}
                    next={NEXT_STATUS.invoice[row.status] || []}
                    onChange={(next) => changeStatus(row, next)}
                  />
                ),
              },
              { key: "actions", label: "", render: (row) => <ViewButton onClick={() => openInvoice(row)} /> },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>

      {detail ? (
        <Modal title={detail.invoice_number || "Invoice"} onClose={() => setDetail(null)} wide>
          <DetailList rows={[
            ["Client", names.get(String(detail.client_id)) || detail.client_name],
            ["Date", formatDate(detail.invoice_date)],
            ["Due date", detail.due_date ? formatDate(detail.due_date) : null],
            ["Status", detail.status],
            ["Subtotal", money(detail.subtotal)],
            ["Tax", money(detail.tax_amount)],
            ...(detail.taxes || []).map((tax) => [`${tax.tax_type} @ ${tax.tax_rate}%`, money(tax.tax_amount)]),
            ["Total", money(detail.total_amount)],
            ["Balance", money(detail.balance_amount)],
          ]} />
          {(detail.items || []).length ? (
            <table className="line-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Trip</th>
                  <th>Bilty</th>
                  <th>Freight</th>
                  <th>Detention</th>
                  <th>Hamali</th>
                  <th>Other</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id || `${item.trip_id}-${item.description}`}>
                    <td>{item.description || "—"}</td>
                    <td>{item.trip_id ? tripLabel((data?.trips || []).find((trip) => String(trip.id) === String(item.trip_id))) : "—"}</td>
                    <td>{(data?.bilties || []).find((bilty) => String(bilty.id) === String(item.bilty_id))?.bilty_number || item.bilty_id || "—"}</td>
                    <td>{money(item.freight)}</td>
                    <td>{money(item.detention)}</td>
                    <td>{money(item.hamali)}</td>
                    <td>{money(item.other_charges)}</td>
                    <td>{money(item.item_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">No line items on this invoice.</p>}
        </Modal>
      ) : null}

      {modal === "invoice" && data ? (
        <Modal title="New Invoice" onClose={() => setModal("")} wide>
          <InvoiceForm
            clients={data.clients}
            trips={data.trips}
            bilties={data.bilties}
            onClose={() => setModal("")}
            onCreated={() => {
              setModal("");
              toast("Invoice created");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
