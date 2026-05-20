import { useState, useEffect } from "react";
import StatCard from "../components/ui/StatCard";
import IncomeExpenseBarChart from "../components/charts/IncomeExpenseBarChart";
import PortfolioDonutChart from "../components/charts/PortfolioDonutChart";
import TransactionsTable from "../components/tables/TransactionsTable";
import type { Transaction } from "../components/tables/TransactionsTable";
import AddTransactionModal from "../components/ui/AddTransactionModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";
import { useCurrency } from "../hooks/useCurrency";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLORS = ["#8A8A9A", "#E87B3A", "#4A4A56", "#D06A2E", "#3296FA", "#34C759"];

export default function FinancesPage() {
  const { user } = useAuth();
  const { format } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [incomeVsExpenses, setIncomeVsExpenses] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<any[]>([]);

  async function fetchTransactions() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*, clients(name)")
      .order("date", { ascending: false });

    if (data) {
      const formatted: Transaction[] = data.map((d) => ({
        id: d.id,
        description: d.description,
        date: d.date,
        client: d.clients?.name,
        client_id: d.client_id,
        income_amount: Number(d.income_amount) || (d.type === "Income" ? Number(d.amount) : 0),
        expense_amount: Number(d.expense_amount) || (d.type === "Expense" ? Number(d.amount) : 0),
        income_category: d.income_category || (d.type === "Income" ? d.category : undefined),
        expense_category: d.expense_category || (d.type === "Expense" ? d.category : undefined),
        income_notes: d.income_notes,
        expense_notes: d.expense_notes,
      }));

      setTransactions(formatted);

      const monMap: Record<string, { income: number; expenses: number }> = {};
      const expCatMap: Record<string, number> = {};
      const incCatMap: Record<string, number> = {};

      formatted.forEach((t) => {
        const mStr = MONTHS[new Date(t.date).getUTCMonth()];
        if (!monMap[mStr]) monMap[mStr] = { income: 0, expenses: 0 };
        monMap[mStr].income += t.income_amount;
        monMap[mStr].expenses += t.expense_amount;

        if (t.income_amount > 0) {
          const cat = t.income_category || "Uncategorized";
          incCatMap[cat] = (incCatMap[cat] || 0) + t.income_amount;
        }
        if (t.expense_amount > 0) {
          const cat = t.expense_category || "Uncategorized";
          expCatMap[cat] = (expCatMap[cat] || 0) + t.expense_amount;
        }
      });

      const curMonth = new Date().getUTCMonth();
      const last6 = [];
      for (let i = 5; i >= 0; i--) {
        let mIndex = curMonth - i;
        if (mIndex < 0) mIndex += 12;
        const label = MONTHS[mIndex];
        last6.push({ month: label, income: monMap[label]?.income || 0, expenses: monMap[label]?.expenses || 0 });
      }
      setIncomeVsExpenses(last6);

      setIncomeBreakdown(
        Object.keys(incCatMap)
          .map((cat, idx) => ({ name: cat, value: incCatMap[cat], color: COLORS[idx % COLORS.length] }))
          .filter((item) => item.value > 0)
      );
      setExpenseBreakdown(
        Object.keys(expCatMap)
          .map((cat, idx) => ({ name: cat, value: expCatMap[cat], color: COLORS[idx % COLORS.length] }))
          .filter((item) => item.value > 0)
      );
    }
    setLoading(false);
  }

  async function handleDeleteConfirm() {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    await supabase.from("transactions").delete().eq("id", transactionToDelete.id);
    setIsDeleting(false);
    setTransactionToDelete(null);
    fetchTransactions();
  }

  function openEditModal(t: Transaction) {
    setTransactionToEdit(t);
    setIsModalOpen(true);
  }

  function openAddModal() {
    setTransactionToEdit(null);
    setIsModalOpen(true);
  }

  useEffect(() => { fetchTransactions(); }, [user]);

  const totalIncome = transactions.reduce((sum, t) => sum + t.income_amount, 0);
  const totalExpenses = transactions.reduce((sum, t) => sum + t.expense_amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const liveStats = [
    { label: "Total Revenue", value: format(totalIncome), trend: "up" as const, change: 0 },
    { label: "Total Expenses", value: format(totalExpenses), trend: "down" as const, change: 0 },
    { label: "Net Profit", value: format(netProfit) },
  ];

  return (
    <div className="page">
      <div className="page__toolbar">
        <button className="btn btn--primary" onClick={openAddModal}>
          <span className="btn__icon">+</span> Add Transaction
        </button>
      </div>

      <div className="page__row page__row--3">
        {liveStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="page__row page__row--full">
        <IncomeExpenseBarChart data={incomeVsExpenses} />
      </div>

      <div className="page__row page__row--1-1">
        <PortfolioDonutChart data={incomeBreakdown} title="Income Breakdown" />
        <PortfolioDonutChart data={expenseBreakdown} title="Expense Breakdown" />
      </div>

      <div className="page__row page__row--full">
        {loading ? (
          <div className="page-loading">Loading ledger...</div>
        ) : (
          <TransactionsTable
            data={transactions}
            onEdit={openEditModal}
            onDelete={(t) => setTransactionToDelete(t)}
          />
        )}
      </div>

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTransactionAdded={fetchTransactions}
        transactionToEdit={transactionToEdit}
      />

      <ConfirmModal
        isOpen={!!transactionToDelete}
        onClose={() => setTransactionToDelete(null)}
        title="Delete Transaction"
        message="Are you sure you want to delete this? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        confirmVariant="danger"
        loading={isDeleting}
      />
    </div>
  );
}