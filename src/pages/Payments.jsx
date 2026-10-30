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
  Tabs,
} from "../components/ui";
import {
  blankIssues,
  DEDUCTION_TYPES,
  formatDate,
  hasIssues,
  includesQuery,
  money,
  NEXT_STATUS,
  num,
  PAYMENT_METHODS,
  today,
  usePaged,
  useResource,
} from "../lib";
import { useToast } from "../toast";

function PaymentForm({ invoices, onClose, onCreated }) {
  const payable = invoices.filter((invoice) => !["DRAFT", "CANCELLED"].includes(invoice.status));
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    invoice_id: payable[0] ? String(payable[0].id) : "",
    payment_date: today(),
    gross_amount: "",
    deduction_amount: "",
    payment_method: "NEFT",
    reference_no: "",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };
  const net = Math.max(0, num(form.gross_amount) - num(form.deduction_amount));

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["invoice_id", form.invoice_id, "Select an invoice"],
      ["payment_date", form.payment_date, "Choose a payment date"],
      ["gross_amount", form.gross_amount, "Enter the gross amount"],
      ["payment_method", form.payment_method, "Select a method"],
    ]);
    if (!nextIssues.gross_amount && num(form.gross_amount) <= 0) {
      nextIssues.gross_amount = "Enter an amount greater than 0";
    }
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      await api("/api/invoice-payments", {
        method: "POST",
        body: {
          invoice_id: form.invoice_id,
          payment_date: form.payment_date,
          gross_amount: num(form.gross_amount),
          deduction_amount: num(form.deduction_amount),
          net_received_amount: net,
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
    <form onSubmit={submit} className="form-grid" noValidate>
      <Field label="Invoice" error={issues.invoice_id}>
        <Select value={form.invoice_id} onChange={set("invoice_id")}>
          <option value="">Select a sent invoice</option>
          {payable.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoice_number} · due {money(invoice.balance_amount)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Payment date" error={issues.payment_date}>
        <input type="date" value={form.payment_date} onChange={set("payment_date")} />
      </Field>
      <Field label="Gross amount" error={issues.gross_amount}>
        <input type="number" min="0.01" step="0.01" value={form.gross_amount} onChange={set("gross_amount")} />
      </Field>
      <Field label="Deduction amount">
        <input type="number" min="0" step="0.01" value={form.deduction_amount} onChange={set("deduction_amount")} />
      </Field>
      <Field label="Net received">
        <input value={money(net)} readOnly />
      </Field>
      <Field label="Method" error={issues.payment_method}>
        <Select value={form.payment_method} onChange={set("payment_method")}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>{method.replaceAll("_", " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Reference no">
        <input value={form.reference_no} onChange={set("reference_no")} />
      </Field>
      {payable.length === 0 ? <p className="form-error span-2">Send an invoice before recording a payment.</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy || payable.length === 0} submitLabel="Record payment" />
    </form>
  );
}

function DeductionForm({ payments, onClose, onCreated }) {
  const [error, setError] = useState("");
  const [issues, setIssues] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    invoice_payment_id: payments[0] ? String(payments[0].id) : "",
    deduction_type: "TDS",
    amount: "",
    remarks: "",
  });
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setIssues((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextIssues = blankIssues([
      ["invoice_payment_id", form.invoice_payment_id, "Select a payment"],
      ["deduction_type", form.deduction_type, "Select a type"],
      ["amount", form.amount, "Enter the amount"],
    ]);
    if (!nextIssues.amount && num(form.amount) <= 0) nextIssues.amount = "Enter an amount greater than 0";
    setIssues(nextIssues);
    if (hasIssues(nextIssues)) return;

    setBusy(true);
    setError("");
    try {
      await api("/api/invoice-payment-deductions", {
        method: "POST",
        body: {
          invoice_payment_id: form.invoice_payment_id,
          deduction_type: form.deduction_type,
          amount: num(form.amount),
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
      <Field label="Payment" error={issues.invoice_payment_id}>
        <Select value={form.invoice_payment_id} onChange={set("invoice_payment_id")}>
          <option value="">Select payment</option>
          {payments.map((payment) => (
            <option key={payment.id} value={payment.id}>
              #{payment.id} · {money(payment.gross_amount || payment.net_received_amount)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Deduction type" error={issues.deduction_type}>
        <Select value={form.deduction_type} onChange={set("deduction_type")}>
          {DEDUCTION_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" error={issues.amount}>
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} />
      </Field>
      <Field label="Remarks">
        <input value={form.remarks} onChange={set("remarks")} />
      </Field>
      {payments.length === 0 ? <p className="form-error span-2">Record a payment before adding a deduction.</p> : null}
      {error ? <p className="form-error span-2">{error}</p> : null}
      <FormActions onCancel={onClose} busy={busy || payments.length === 0} submitLabel="Add deduction" />
    </form>
  );
}

export default function Payments() {
  const toast = useToast();
  const [tab, setTab] = useState("payments");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useResource(async () => {
    const [payments, deductions, invoices] = await Promise.all([
      api("/api/invoice-payments?limit=100"),
      api("/api/invoice-payment-deductions?limit=100"),
      api("/api/invoices?limit=100"),
    ]);
    return {
      payments: payments.payments || [],
      deductions: deductions.deductions || [],
      invoices: invoices.invoices || [],
    };
  }, []);

  const invoiceNames = useMemo(
    () => new Map((data?.invoices || []).map((invoice) => [String(invoice.id), invoice.invoice_number])),
    [data]
  );

  const rows = useMemo(() => {
    if (tab === "deductions") {
      return (data?.deductions || [])
        .map((row) => ({ ...row, payment_label: `#${row.invoice_payment_id}` }))
        .filter((row) => includesQuery(row, query, ["deduction_type", "remarks", "payment_label"]));
    }
    return (data?.payments || [])
      .map((row) => ({ ...row, invoice_number: invoiceNames.get(String(row.invoice_id)) || `#${row.invoice_id}` }))
      .filter((row) => includesQuery(row, query, ["invoice_number", "status", "payment_method", "reference_no"]));
  }, [data, tab, query, invoiceNames]);
  const pager = usePaged(rows);

  const patch = async (row, status) => {
    setActionError("");
    try {
      await api(`/api/invoice-payments/${row.id}/status`, { method: "PATCH", body: { status } });
      toast("Payment updated");
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <section>
      <PageHeader title="Payments" subtitle="Invoice receipts, then TDS or other deductions against each payment.">
        <button className="btn btn-primary" type="button" onClick={() => setModal(tab)}>
          {tab === "deductions" ? "New Deduction" : "New Payment"}
        </button>
      </PageHeader>
      <Banner>{error || actionError}</Banner>
      <Tabs
        value={tab}
        onChange={(next) => { setTab(next); pager.setPage(1); }}
        tabs={[
          { id: "payments", label: `Payments (${data?.payments.length || 0})` },
          { id: "deductions", label: `Deductions (${data?.deductions.length || 0})` },
        ]}
      />
      <article className="card table-card">
        <div className="card-head">
          <h2>{tab === "deductions" ? "invoice_payment_deductions" : "invoice_payments"}</h2>
          <SearchField value={query} onChange={(value) => { setQuery(value); pager.setPage(1); }} />
        </div>
        {loading ? <p className="muted pad">Loading...</p> : tab === "deductions" ? (
          <DataTable
            rows={pager.rows}
            empty={query ? "No deductions match this search." : "No payment deductions yet."}
            emptyAction={query ? null : { label: "New Deduction", onClick: () => setModal("deductions") }}
            columns={[
              { key: "payment", label: "Payment", render: (row) => row.payment_label },
              { key: "type", label: "Type", render: (row) => row.deduction_type },
              { key: "amount", label: "Amount", align: "right", render: (row) => money(row.amount) },
              { key: "remarks", label: "Remarks", render: (row) => row.remarks || "—" },
              { key: "created", label: "Created", render: (row) => formatDate(row.created_at) },
            ]}
          />
        ) : (
          <DataTable
            rows={pager.rows}
            empty={query ? "No payments match this search." : "No payments recorded."}
            emptyAction={query ? null : { label: "New Payment", onClick: () => setModal("payments") }}
            columns={[
              { key: "invoice", label: "Invoice", render: (row) => row.invoice_number },
              { key: "date", label: "Date", render: (row) => formatDate(row.payment_date) },
              { key: "gross", label: "Gross", align: "right", render: (row) => money(row.gross_amount) },
              { key: "deduction", label: "Deduction", align: "right", render: (row) => money(row.deduction_amount) },
              { key: "net", label: "Net received", align: "right", render: (row) => money(row.net_received_amount) },
              { key: "method", label: "Method", render: (row) => String(row.payment_method || "—").replaceAll("_", " ") },
              { key: "ref", label: "Reference", render: (row) => row.reference_no || "—" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusNext
                    value={row.status}
                    next={NEXT_STATUS.payment[row.status] || []}
                    onChange={(status) => patch(row, status)}
                  />
                ),
              },
            ]}
          />
        )}
        <Pager page={pager.page} totalPages={pager.totalPages} rangeLabel={pager.rangeLabel} onPage={pager.setPage} />
      </article>

      {modal === "payments" && data ? (
        <Modal title="New Payment" onClose={() => setModal("")} wide>
          <PaymentForm invoices={data.invoices} onClose={() => setModal("")} onCreated={() => { setModal(""); toast("Payment recorded"); reload(); }} />
        </Modal>
      ) : null}
      {modal === "deductions" && data ? (
        <Modal title="New Deduction" onClose={() => setModal("")}>
          <DeductionForm payments={data.payments} onClose={() => setModal("")} onCreated={() => { setModal(""); toast("Deduction added"); reload(); }} />
        </Modal>
      ) : null}
    </section>
  );
}
