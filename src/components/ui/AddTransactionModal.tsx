import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import ClientSelect from "./ClientSelect";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionAdded: () => void;
  transactionToEdit?: any | null;
}

const INCOME_CATS = ["Client Work", "Retainer", "Product Sale"];
const EXPENSE_CATS = ["Software & SaaS", "Office Supplies", "Marketing"];

const IncomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ExpenseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

function CategoryPicker({
  categories,
  selected,
  onSelect,
  color,
}: {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onSelect(selected === cat ? "" : cat)}
          style={{
            padding: "3px 10px",
            borderRadius: "20px",
            border: `1px solid ${selected === cat ? color : "var(--border)"}`,
            background: selected === cat ? `${color}22` : "transparent",
            color: selected === cat ? color : "var(--text-secondary)",
            fontSize: "0.72rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
            fontFamily: "inherit",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
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
  const [showConfirm, setShowConfirm] = useState(false);

  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [clientId, setClientId] = useState("");

  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("");
  const [incomeNotes, setIncomeNotes] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (transactionToEdit) {
      setDescription(transactionToEdit.description || "");
      setDate(transactionToEdit.date || "");
      setClientId(transactionToEdit.client_id || "");
      setIncomeAmount(transactionToEdit.income_amount > 0 ? transactionToEdit.income_amount.toString() : "");
      setExpenseAmount(transactionToEdit.expense_amount > 0 ? transactionToEdit.expense_amount.toString() : "");
      setIncomeNotes(transactionToEdit.income_notes || "");
      setExpenseNotes(transactionToEdit.expense_notes || "");

      const incCat = transactionToEdit.income_category || "";
      setIncomeCategory(INCOME_CATS.includes(incCat) ? incCat : "");

      const expCat = transactionToEdit.expense_category || "";
      setExpenseCategory(EXPENSE_CATS.includes(expCat) ? expCat : "");
    } else {
      setDescription("");
      setDate("");
      setClientId("");
      setIncomeAmount("");
      setIncomeCategory("");
      setIncomeNotes("");
      setExpenseAmount("");
      setExpenseCategory("");
      setExpenseNotes("");
    }
    setErrorMsg("");
    setShowConfirm(false);
  }, [isOpen, transactionToEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!incomeAmount && !expenseAmount) {
      setErrorMsg("Please enter at least an income or expense amount.");
      return;
    }
    if (incomeAmount && (isNaN(Number(incomeAmount)) || Number(incomeAmount) < 0)) {
      setErrorMsg("Please enter a valid income amount.");
      return;
    }
    if (expenseAmount && (isNaN(Number(expenseAmount)) || Number(expenseAmount) < 0)) {
      setErrorMsg("Please enter a valid expense amount.");
      return;
    }
    if (transactionToEdit) { setShowConfirm(true); } else { await performSave(); }
  }

  async function performSave() {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");

    const inc = incomeAmount ? Number(incomeAmount) : 0;
    const exp = expenseAmount ? Number(expenseAmount) : 0;

    try {
      const payload = {
        user_id: user.id,
        description,
        date,
        client_id: clientId || null,
        income_amount: inc,
        expense_amount: exp,
        income_category: incomeCategory || null,
        expense_category: expenseCategory || null,
        income_notes: incomeNotes || null,
        expense_notes: expenseNotes || null,
        type: inc > 0 ? "Income" : "Expense",
        amount: inc > 0 ? inc : exp,
        category: incomeCategory || expenseCategory || null,
      };

      if (transactionToEdit) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", transactionToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert([payload]);
        if (error) throw error;
      }

      onTransactionAdded();
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to save transaction.");
    } finally {
      setLoading(false);
    }
  }

  const panelBase: React.CSSProperties = {
    flex: 1,
    background: "var(--bg-elevated)",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: "4px",
    display: "block",
  };

  const optionalStyle: React.CSSProperties = { opacity: 0.5, fontWeight: 400 };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "8px 10px",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "8px 10px",
    fontSize: "0.8rem",
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    minHeight: "72px",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={transactionToEdit ? "Edit Transaction" : "New Transaction"} maxWidth={700}>
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && <div className="modal-alert modal-alert--error">{errorMsg}</div>}

        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ ...panelBase, border: "1px solid rgba(52,199,89,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#34C759" }}>
              <IncomeIcon />
              Income
            </div>

            <div>
              <label style={labelStyle}>Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Category <span style={optionalStyle}>(optional)</span></label>
              <CategoryPicker
                categories={INCOME_CATS}
                selected={incomeCategory}
                onSelect={setIncomeCategory}
                color="#34C759"
              />
            </div>

            <div>
              <label style={labelStyle}>Notes <span style={optionalStyle}>(optional)</span></label>
              <textarea
                rows={3}
                placeholder={"e.g. $500 website design,\n$200 logo work..."}
                value={incomeNotes}
                onChange={(e) => setIncomeNotes(e.target.value)}
                style={textareaStyle}
              />
            </div>
          </div>

          <div style={{ ...panelBase, border: "1px solid rgba(224,82,82,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#E05252" }}>
              <ExpenseIcon />
              Expense
            </div>

            <div>
              <label style={labelStyle}>Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Category <span style={optionalStyle}>(optional)</span></label>
              <CategoryPicker
                categories={EXPENSE_CATS}
                selected={expenseCategory}
                onSelect={setExpenseCategory}
                color="#E05252"
              />
            </div>

            <div>
              <label style={labelStyle}>Notes <span style={optionalStyle}>(optional)</span></label>
              <textarea
                rows={3}
                placeholder={"e.g. $30 gas,\n$50 hosting, $20 lunch..."}
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                style={textareaStyle}
              />
            </div>
          </div>
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
            <label htmlFor="tx-description">Description</label>
            <input
              id="tx-description"
              required
              type="text"
              placeholder="e.g. October Freelance"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <ClientSelect
          key={isOpen ? `tx-${transactionToEdit?.id || "new"}` : "closed"}
          value={clientId}
          onChange={setClientId}
          label="Associated Client (Optional)"
          autoSelect={false}
        />

        <div className="modal-actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Saving..." : transactionToEdit ? "Update Transaction" : "Save Transaction"}
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
        onConfirm={() => { setShowConfirm(false); performSave(); }}
        confirmVariant="primary"
        loading={loading}
      />
    </Modal>
  );
}