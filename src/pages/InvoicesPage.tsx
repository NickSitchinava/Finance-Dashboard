import { useState, useEffect } from "react";
import StatCard from "../components/ui/StatCard";
import ClientPaymentsTable from "../components/tables/ClientPaymentsTable";
import type { ClientPayment } from "../components/tables/ClientPaymentsTable";
import AddInvoiceModal from "../components/ui/AddInvoiceModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";
import { useCurrency } from "../hooks/useCurrency";

export default function InvoicesPage() {
  const { user } = useAuth();
  const { format } = useCurrency();
  const [invoices, setInvoices] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<ClientPayment | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ClientPayment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [kpis, setKpis] = useState([
    { label: "Total Invoiced", value: format(0) },
    { label: "Outstanding", value: format(0) },
    { label: "Paid to Date", value: format(0) },
  ]);

  async function fetchInvoices() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("due_date", { ascending: false });

    if (error) {
      console.error("Error fetching invoices:", error);
      setLoading(false);
      return;
    }

    if (data) {
      const formatted: ClientPayment[] = data.map((d) => ({
        id: d.id,
        client: d.client_name,
        invoice: d.invoice_number,
        amount: Number(d.amount),
        dueDate: d.due_date,
        status: d.status,
        client_id: d.client_id,
        description: d.description || "", // add this line
      }));
      setInvoices(formatted);

      const total = formatted.reduce((sum, inv) => sum + inv.amount, 0);
      const outstanding = formatted
        .filter((inv) => inv.status !== "Paid")
        .reduce((sum, inv) => sum + inv.amount, 0);
      const paid = formatted
        .filter((inv) => inv.status === "Paid")
        .reduce((sum, inv) => sum + inv.amount, 0);

      setKpis([
        { label: "Total Invoiced", value: format(total) },
        { label: "Outstanding", value: format(outstanding) },
        { label: "Paid to Date", value: format(paid) },
      ]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  function openAddModal() {
    setInvoiceToEdit(null);
    setIsModalOpen(true);
  }

  function openEditModal(invoice: ClientPayment) {
    setInvoiceToEdit(invoice);
    setIsModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!itemToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from("invoices").delete().eq("id", itemToDelete.id);
    if (error) console.error("Error deleting invoice:", error);
    else fetchInvoices();
    setIsDeleting(false);
    setItemToDelete(null);
  }

  return (
    <div className="page">
      <div className="page__toolbar">
        <button className="btn btn--primary" onClick={openAddModal}>
          + New Invoice
        </button>
      </div>

      <div className="page__row page__row--3">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="page__row page__row--full">
        {loading ? (
          <div className="page-loading">Loading invoices...</div>
        ) : (
          <ClientPaymentsTable
            data={invoices}
            onEdit={openEditModal}
            onDelete={(inv) => setItemToDelete(inv)}
          />
        )}
      </div>

      <AddInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onInvoiceAdded={fetchInvoices}
        invoiceToEdit={invoiceToEdit}
      />

      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        confirmVariant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
