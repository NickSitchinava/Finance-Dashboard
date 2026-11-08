import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import ClientSelect from "./ClientSelect";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useCurrency } from "../../hooks/useCurrency";
import type { Currency } from "../../lib/finance";
import type { ClientPayment } from "../tables/ClientPaymentsTable";

interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceAdded: () => void;
  invoiceToEdit?: ClientPayment | null;
}

export default function AddInvoiceModal({
  isOpen,
  onClose,
  onInvoiceAdded,
  invoiceToEdit,
}: AddInvoiceModalProps) {
  const { user } = useAuth();
  const { currency: displayCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency | "">("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"Paid" | "Pending" | "Overdue">("Pending");
  const [description, setDescription] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function lookupClientName() {
      if (!clientId) { setClientName(""); return; }
      const { data } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();
      if (data) setClientName(data.name);
    }
    lookupClientName();
  }, [clientId]);

  useEffect(() => {
    if (!isOpen) return;
    if (invoiceToEdit) {
      setClientId(invoiceToEdit.client_id || "");
      setClientName(invoiceToEdit.client || "");
      setAmount(invoiceToEdit.amount?.toString() || "");
      setCurrency(invoiceToEdit.currency || "");
      setInvoiceNumber(invoiceToEdit.invoice || "");
      setDueDate(invoiceToEdit.dueDate || "");
      setStatus(invoiceToEdit.status || "Pending");
      setDescription(invoiceToEdit.description || "");
    } else {
      setClientId("");
      setClientName("");
      setAmount("");
      setCurrency(displayCurrency as Currency);
      setInvoiceNumber("");
      setDueDate("");
      setStatus("Pending");
      setDescription("");
    }
    setErrorMsg("");
    setShowConfirm(false);
  }, [isOpen, invoiceToEdit, displayCurrency]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Please enter a valid positive amount.");
      return;
    }
    if (!clientId) {
      setErrorMsg("Please select or create a client.");
      return;
    }
    if (!currency) { setErrorMsg("Choose the original currency of this invoice."); return; }
    if (invoiceToEdit) {
      setShowConfirm(true);
    } else {
      await performSave();
    }
  }

  async function performSave() {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const payload = {
        user_id: user.id,
        client_name: clientName,
        invoice_number: invoiceNumber,
        amount: Number(amount),
        currency,
        due_date: dueDate,
        status,
        client_id: clientId || null,
        description: description || null,
      };

      if (invoiceToEdit) {
        const { error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", invoiceToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").insert([payload]);
        if (error) throw error;
      }

      await onInvoiceAdded();
      onClose();
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to save invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={invoiceToEdit ? "Edit Invoice" : "New Invoice"}>
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && <div className="modal-alert modal-alert--error">{errorMsg}</div>}

        <ClientSelect
          key={isOpen ? `invoice-${invoiceToEdit?.id || "new"}` : "closed"}
          value={clientId}
          onChange={setClientId}
          required
          label="Client"
          autoSelect={false}
        />

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="invoice-number">Invoice #</label>
            <input
              id="invoice-number"
              required
              type="text"
              placeholder="INV-1234"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="invoice-amount">Amount</label>
            <input
              id="invoice-amount"
              required
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="invoice-date">Due Date</label>
            <input
              id="invoice-date"
              required
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input--dark-date"
            />
          </div>

          <div className="form-group">
            <label htmlFor="invoice-currency">Original currency</label>
            <select id="invoice-currency" required value={currency} onChange={(e) => setCurrency(e.target.value as Currency | "")}>
              {!currency && <option value="">Select currency</option>}
              <option value="USD">USD</option><option value="EUR">EUR</option><option value="GEL">GEL</option>
            </select>
          </div>
        </div>
        {invoiceToEdit && !invoiceToEdit.currency && <p>This older invoice has no saved currency. Choose its original currency before saving.</p>}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="invoice-status">Status</label>
            <select
              id="invoice-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "Paid" | "Pending" | "Overdue")}
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="invoice-description">Description (Optional)</label>
          <textarea
            id="invoice-description"
            rows={3}
            placeholder="e.g. Website redesign — Phase 1 deposit"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Saving..." : invoiceToEdit ? "Update Invoice" : "Save Invoice"}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Changes"
        message="Are you sure you want to save these changes?"
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={async () => { setShowConfirm(false); await performSave(); }}
        confirmVariant="primary"
        loading={loading}
      />
    </Modal>
  );
}
