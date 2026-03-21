import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import ClientSelect from "./ClientSelect";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceAdded: () => void;
  invoiceToEdit?: any | null;
}

export default function AddInvoiceModal({
  isOpen,
  onClose,
  onInvoiceAdded,
  invoiceToEdit,
}: AddInvoiceModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
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
      setInvoiceNumber(invoiceToEdit.invoice || "");
      setDueDate(invoiceToEdit.dueDate || "");
      setStatus(invoiceToEdit.status || "Pending");
      setDescription(invoiceToEdit.description || "");
    } else {
      setClientId("");
      setClientName("");
      setAmount("");
      setInvoiceNumber("");
      setDueDate("");
      setStatus("Pending");
      setDescription("");
    }
    setErrorMsg("");
    setShowConfirm(false);
  }, [isOpen, invoiceToEdit]);

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
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to save invoice.");
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
            <label htmlFor="invoice-status">Status</label>
            <select
              id="invoice-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
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