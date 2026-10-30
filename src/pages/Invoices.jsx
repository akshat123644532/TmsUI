import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { blankIssues, formatDate, hasIssues, includesQuery, money, NEXT_STATUS, num, today, usePaged, useResource, useSearchFocus } from "../lib";
import { useToast } from "../toast";

function InvoiceForm({ clients, trips, bilties, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
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
    const nextIssues = blankIssues([
      ["client_id", header.client_id, "Select a client"],
      ["invoice_number", header.invoice_number, "Enter an invoice number"],
      ["invoice_date", header.invoice_date, "Choose an invoice date"],
    ]);
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
    <form onSubmit={submit} className="stack" noValidate>
      <div className="form-grid">
        <Field label="Client" error={issues.client_id}>
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
        <Field label="Invoice number" error={issues.invoice_number}>
          <input
            value={header.invoice_number}
            onChange={(event) => {
              setHeader({ ...header, invoice_number: event.target.value });
              setIssues((current) => ({ ...current, invoice_number: "" }));
            }}
            placeholder="INV-1001"
          />
        </Field>
        <Field label="Invoice date" error={issues.invoice_date}>
          <input
            type="date"
            value={header.invoice_date}
            onChange={(event) => {
              setHeader({ ...header, invoice_date: event.target.value });
              setIssues((current) => ({ ...current, invoice_date: "" }));
            }}
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
      <p className="total-line">
        Taxable {money(subtotal)} · tax {money(header.tax_amount)} · total {money(total)} · deduction {money(header.deduction_amount)} · balance {money(Math.max(0, total - num(header.deduction_amount)))}
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
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [invoices, clients, trips, bilties] = await Promise.all([
      api("/api/invoices?limit=100"),
      api("/api/clients?limit=100"),
      api("/api/trips?limit=100"),
      api("/api/bilties?limit=100"),
    ]);
    return {
      invoices: invoices.invoices || [],
      clients: clients.clients || [],
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

  return (
    <section>
      <PageHeader title="Invoices" subtitle="Draft invoices with freight, detention, hamali, tax, and balance.">
        <button className="btn btn-primary" type="button" onClick={() => setModal("invoice")}>New Invoice</button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <article className="card table-card">
        <div className="card-head">
          <h2>invoices {data ? <span className="count">{data.total}</span> : null}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading invoices...</p> : (
          <DataTable
            rows={pager.rows}
            highlightId={focus}
            empty={query ? "No invoices match this search." : "No invoices yet."}
            emptyAction={query ? null : { label: "New Invoice", onClick: () => setModal("invoice") }}
            columns={[
              { key: "no", label: "Invoice no", render: (row) => row.invoice_number },
              { key: "client", label: "Client", render: (row) => row.client_name },
              { key: "date", label: "Date", render: (row) => formatDate(row.invoice_date) },
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
                    onChange={(status) => changeStatus(row, status)}
                  />
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
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
              toast("Invoice created");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
