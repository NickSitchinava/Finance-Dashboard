import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
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
  const [clients, setClients] = useState<any[]>([]);

  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"Paid" | "Pending" | "Overdue">("Pending");
  const [clientId, setClientId] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function fetchClients() {
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (data) setClients(data);
    }
    fetchClients();
  }, [user]);

  useEffect(() => {
    if (invoiceToEdit && isOpen) {
      setClientName(invoiceToEdit.client || "");
      setAmount(invoiceToEdit.amount?.toString() || "");
      setInvoiceNumber(invoiceToEdit.invoice || "");
      setDueDate(invoiceToEdit.dueDate || "");
      setStatus(invoiceToEdit.status || "Pending");
      setClientId(invoiceToEdit.client_id || "");
      setErrorMsg("");
    } else if (isOpen) {
      setClientName("");
      setAmount("");
      setInvoiceNumber("");
      setDueDate("");
      setStatus("Pending");
      setClientId("");
      setErrorMsg("");
    }
    setShowConfirm(false);
  }, [invoiceToEdit, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Please enter a valid positive amount.");
      return;
    }

    if (invoiceToEdit) {
      setShowConfirm(true);
      return;
    }

    await performSave();
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
      return true;
    } catch (error: any) {
      console.error("Invoice Save Error:", error);
      setErrorMsg(error.message || "Failed to save invoice.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={invoiceToEdit ? "Edit Invoice" : "New Invoice"}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

        <div className="form-group">
          <label htmlFor="invoice-client">Client Name</label>
          {clients.length > 0 ? (
            <select
              id="invoice-client"
              value={clientId}
              onChange={(e) => {
                const id = e.target.value;
                setClientId(id);
                const client = clients.find((c) => c.id === id);
                if (client) setClientName(client.name);
              }}
            >
              <option value="">-- Select Client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="invoice-client"
              required
              type="text"
              placeholder="e.g. Acme Corp"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          )}
        </div>

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
            <label htmlFor="invoice-amount">Amount ($)</label>
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

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading
              ? "Saving..."
              : invoiceToEdit
              ? "Update Invoice"
              : "Save Invoice"}
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
        onConfirm={async () => {
          setShowConfirm(false);
          await performSave();
        }}
        confirmVariant="primary"
        loading={loading}
      />
    </Modal>
  );
}