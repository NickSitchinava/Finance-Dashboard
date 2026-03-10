import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Client {
  id: string;
  name: string;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionAdded: () => void;
  transactionToEdit?: any | null;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  onTransactionAdded,
  transactionToEdit,
}: AddTransactionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [clients, setClients] = useState<Client[]>([]);

  const [type, setType] = useState<"Income" | "Expense">("Income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Client Work");
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
    if (transactionToEdit && isOpen) {
      setType(transactionToEdit.type || "Income");
      setAmount(transactionToEdit.amount?.toString() || "");
      setDescription(transactionToEdit.description || "");
      setDate(transactionToEdit.date || "");
      setCategory(
        transactionToEdit.category ||
          (transactionToEdit.type === "Income" ? "Client Work" : "Software")
      );
      const foundClient = clients.find(
        (c) => c.name === transactionToEdit.client
      );
      setClientId(foundClient ? foundClient.id : "");
      setErrorMsg("");
    } else if (isOpen) {
      setType("Income");
      setAmount("");
      setDescription("");
      setDate("");
      setCategory("Client Work");
      setClientId("");
      setErrorMsg("");
    }
    setShowConfirm(false);
  }, [transactionToEdit, isOpen, clients]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Please enter a valid positive amount.");
      return;
    }

    if (transactionToEdit) {
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
      if (transactionToEdit) {
        const { error } = await supabase
          .from("transactions")
          .update({
            type,
            amount: Number(amount),
            description,
            date,
            category,
            client_id: type === "Income" && clientId ? clientId : null,
          })
          .eq("id", transactionToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert([
          {
            user_id: user.id,
            type,
            amount: Number(amount),
            description,
            date,
            category,
            client_id: type === "Income" && clientId ? clientId : null,
          },
        ]);
        if (error) throw error;
      }

      setType("Income");
      setAmount("");
      setDescription("");
      setDate("");
      setCategory("Client Work");
      setClientId("");

      onTransactionAdded();
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to add transaction.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transactionToEdit ? "Edit Transaction" : "New Transaction"}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="tx-type">Transaction Type</label>
            <select
              id="tx-type"
              value={type}
              onChange={(e) => setType(e.target.value as "Income" | "Expense")}
            >
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tx-amount">Amount ($)</label>
            <input
              id="tx-amount"
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

        <div className="form-group">
          <label htmlFor="tx-description">Description</label>
          <input
            id="tx-description"
            required
            type="text"
            placeholder="e.g. Website Deposit"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="tx-date">Date</label>
            <input
              id="tx-date"
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input--dark-date"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tx-category">Category</label>
            <select
              id="tx-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {type === "Income" ? (
                <>
                  <option value="Client Work">Client Work</option>
                  <option value="Retainer">Retainer</option>
                  <option value="Product Sale">Product Sale</option>
                  <option value="Other">Other</option>
                </>
              ) : (
                <>
                  <option value="Software">Software & SaaS</option>
                  <option value="Server">Servers & Hosting</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </>
              )}
            </select>
          </div>
        </div>

        {type === "Income" && clients.length > 0 && (
          <div className="form-group">
            <label htmlFor="tx-client">Associated Client (Optional)</label>
            <select
              id="tx-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">-- No Client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
              : transactionToEdit
              ? "Update Transaction"
              : "Save Transaction"}
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
        onConfirm={() => {
          setShowConfirm(false);
          performSave();
        }}
        confirmVariant="primary"
      />
    </Modal>
  );
}