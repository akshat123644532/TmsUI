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
  StatusPill,
} from "../components/ui";
import { formatDate, includesQuery, money, num, today, usePaged, useResource } from "../lib";

const NEXT = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["PARTIAL", "PAID", "CANCELLED"],
  PARTIAL: ["PAID", "CANCELLED"],
  PAID: ["CANCELLED"],
  CANCELLED: [],
};

const METHODS = ["CASH", "UPI", "NEFT", "CHEQUE", "BANK_TRANSFER"];

function InvoiceForm({ clients, trips, bilties, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState({
    client_id: "",
    invoice_number: "",
    invoice_date: today(),
    tax_amount: "",
    deduction_amount: "",
  });
  const [items, setItems] = useState([
    { description: "Freight", trip_id: "", bilty_id: "", freight: "", detention: "", hamali: "", other_charges: "" },
  ]);

  const subtotal = items.reduce(
    (sum, item) => sum + num(item.freight) + num(item.detention) + num(item.hamali) + num(item.other_charges),
    0
  );
  const total = subtotal + num(header.tax_amount);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/api/invoices", {
        method: "POST",
        body: {
          client_id: header.client_id,
          invoice_number: header.invoice_number.trim(),
          invoice_date: header.invoice_date,
          tax_amount: num(header.tax_amount),
          deduction_amount: num(header.deduction_amount),
          items: items.map((item) => ({
            description: item.description || null,
            trip_id: item.trip_id || null,
            bilty_id: item.bilty_id || null,
            freight: num(item.freight),
            detention: num(item.detention),
            hamali: num(item.hamali),
            other_charges: num(item.other_charges),
          })),
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
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <Field label="Client">
          <Select
            required
            value={header.client_id}
            onChange={(event) => setHeader({ ...header, client_id: event.target.value })}
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice number">
          <input
            required
            value={header.invoice_number}
            onChange={(event) => setHeader({ ...header, invoice_number: event.target.value })}
            placeholder="INV-1001"
          />
        </Field>
        <Field label="Invoice date">
          <input
            type="date"
            required
            value={header.invoice_date}
            onChange={(event) => setHeader({ ...header, invoice_date: event.target.value })}
          />
        </Field>
        <Field label="Tax">
          <input
            type="number"
            min="0"
            step="0.01"
            value={header.tax_amount}
            onChange={(event) => setHeader({ ...header, tax_amount: event.target.value })}
          />
        </Field>
        <Field label="Deduction">
          <input
            type="number"
            min="0"
            step="0.01"
            value={header.deduction_amount}
            onChange={(event) => setHeader({ ...header, deduction_amount: event.target.value })}
          />
        </Field>
      </div>

      {items.map((item, index) => (
        <div className="line-card" key={index}>
          <div className="form-grid">
            <Field label="Description">
              <input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} />
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
          </div>
        </div>
      ))}

      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => setItems((current) => [...current, { description: "", trip_id: "", bilty_id: "", freight: "", detention: "", hamali: "", other_charges: "" }])}
      >
        Add line
      </button>
      <p className="total-line">Invoice total {money(total)} · charges {money(subtotal)}</p>
      {error ? <p className="form-error">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy} submitLabel="Create invoice" />
    </form>
  );
}

function PaymentForm({ invoices, onClose, onCreated }) {
  const payable = invoices.filter((invoice) => !["DRAFT", "CANCELLED"].includes(invoice.status));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    invoice_id: payable[0] ? String(payable[0].id) : "",
    payment_date: today(),
    amount: "",
    payment_method: "NEFT",
    reference_no: "",
  });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/api/invoice-payments", {
        method: "POST",
        body: {
          invoice_id: form.invoice_id,
          payment_date: form.payment_date,
          amount: num(form.amount),
          payment_method: form.payment_method,
          reference_no: form.reference_no.trim() || null,
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
    <form onSubmit={submit} className="form-grid">
      <Field label="Invoice">
        <Select required value={form.invoice_id} onChange={(event) => setForm({ ...form, invoice_id: event.target.value })}>
          <option value="">Select a sent invoice</option>
          {payable.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoice_number} · due {money(invoice.balance_amount)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date">
        <input type="date" required value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} />
      </Field>
      <Field label="Amount">
        <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
      </Field>
      <Field label="Method">
        <Select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}>
          {METHODS.map((method) => (
            <option key={method} value={method}>{method.replaceAll("_", " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Reference">
        <input value={form.reference_no} onChange={(event) => setForm({ ...form, reference_no: event.target.value })} />
      </Field>
      {payable.length === 0 ? <p className="form-error span-2">Send an invoice before recording a payment.</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy || payable.length === 0} submitLabel="Record payment" />
    </form>
  );
}

export default function Invoices() {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [invoices, clients, payments, trips, bilties] = await Promise.all([
      api("/api/invoices?limit=100"),
      api("/api/clients?limit=100"),
      api("/api/invoice-payments?limit=100"),
      api("/api/trips?limit=100"),
      api("/api/bilties?limit=100"),
    ]);
    return {
      invoices: invoices.invoices || [],
      clients: clients.clients || [],
      payments: payments.payments || [],
      trips: trips.trips || [],
      bilties: bilties.bilties || [],
      total: invoices.pagination?.total || 0,
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
    return rows.filter((row) => includesQuery(row, query, ["invoice_number", "status", "client_name"]));
  }, [data, names, query]);
  const pager = usePaged(filtered);

  const changeStatus = async (invoice, status) => {
    setActionError("");
    try {
      await api(`/api/invoices/${invoice.id}/status`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const confirmPayment = async (payment) => {
    setActionError("");
    try {
      await api(`/api/invoice-payments/${payment.id}/status`, {
        method: "PATCH",
        body: { status: "CONFIRMED" },
      });
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <section>
      <PageHeader title="Invoicing" subtitle="Draft invoices, send them, then confirm payments against the balance.">
        <button className="btn btn-ghost" type="button" onClick={() => setModal("payment")}>Record Payment</button>
        <button className="btn btn-primary" type="button" onClick={() => setModal("invoice")}>New Invoice</button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>Invoices {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading invoices...</p> : (
          <DataTable
            rows={pager.rows}
            empty="No invoices yet."
            columns={[
              { key: "no", label: "Invoice", render: (row) => row.invoice_number },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "date", label: "Date", render: (row) => formatDate(row.invoice_date) },
              { key: "total", label: "Total", align: "right", render: (row) => money(row.total_amount) },
              { key: "balance", label: "Balance", align: "right", render: (row) => money(row.balance_amount) },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Select value={row.status} onChange={(event) => changeStatus(row, event.target.value)}>
                    <option value={row.status}>{row.status}</option>
                    {(NEXT[row.status] || []).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </Select>
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>

      <article className="card table-card">
        <div className="card-head">
          <h2>Payments</h2>
        </div>
        <DataTable
          rows={data?.payments || []}
          empty="No payments recorded."
          columns={[
            { key: "invoice", label: "Invoice", render: (row) => row.invoice_id },
            { key: "date", label: "Date", render: (row) => formatDate(row.payment_date) },
            { key: "method", label: "Method", render: (row) => String(row.payment_method || "—").replaceAll("_", " ") },
            { key: "amount", label: "Net", align: "right", render: (row) => money(row.net_received_amount) },
            { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
            {
              key: "action",
              label: "",
              render: (row) => row.status === "PENDING" ? (
                <button className="btn btn-ghost" type="button" onClick={() => confirmPayment(row)}>
                  Confirm
                </button>
              ) : "—",
            },
          ]}
        />
      </article>

      {modal === "invoice" && data ? (
        <Modal title="New Invoice" onClose={() => setModal("")} wide>
          <InvoiceForm
            clients={data.clients}
            trips={data.trips}
            bilties={data.bilties}
            onClose={() => setModal("")}
            onCreated={() => {
              setModal("");
              reload();
            }}
          />
        </Modal>
      ) : null}
      {modal === "payment" && data ? (
        <Modal title="Record Payment" onClose={() => setModal("")}>
          <PaymentForm
            invoices={data.invoices}
            onClose={() => setModal("")}
            onCreated={() => {
              setModal("");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
