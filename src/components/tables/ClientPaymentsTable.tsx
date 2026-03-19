import { useState, useMemo } from "react";
import { useCurrency } from "../../hooks/useCurrency";
import "./ClientPaymentsTable.css";

export interface ClientPayment {
  id: string;
  client: string;
  invoice: string;
  amount: number;
  dueDate: string;
  status: "Paid" | "Pending" | "Overdue";
  client_id?: string;
  description?: string;
}

interface ClientPaymentsTableProps {
  data: ClientPayment[];
  onEdit?: (payment: ClientPayment) => void;
  onDelete?: (payment: ClientPayment) => void;
}

type SortKey = keyof ClientPayment;
type SortDir = "asc" | "desc";

const statusClass: Record<string, string> = {
  Paid: "badge--paid",
  Pending: "badge--pending",
  Overdue: "badge--overdue",
};

const PAGE_SIZE = 5;

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function ClientPaymentsTable({
  data,
  onEdit,
  onDelete,
}: ClientPaymentsTableProps) {
  const { symbol } = useCurrency();
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey] || "";
      const bv = b[sortKey] || "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function renderSortIcon(key: SortKey) {
    if (sortKey !== key)
      return <span className="sort-icon sort-icon--inactive">↕</span>;
    return <span className="sort-icon">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="card table-card">
      <h3 className="table-card__title">Client Payments</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable-th" onClick={() => handleSort("client")}>
                Client {renderSortIcon("client")}
              </th>
              <th className="sortable-th" onClick={() => handleSort("invoice")}>
                Invoice # {renderSortIcon("invoice")}
              </th>
              <th>Description</th>
              <th className="sortable-th" onClick={() => handleSort("amount")}>
                Amount {renderSortIcon("amount")}
              </th>
              <th className="sortable-th" onClick={() => handleSort("dueDate")}>
                Due Date {renderSortIcon("dueDate")}
              </th>
              <th className="sortable-th" onClick={() => handleSort("status")}>
                Status {renderSortIcon("status")}
              </th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={7} className="td--empty">No payments found.</td>
              </tr>
            ) : (
              pageData.map((p) => (
                <tr key={p.id}>
                  <td className="td--bold">{p.client}</td>
                  <td className="td--secondary">{p.invoice}</td>
                  <td className="td--secondary">
                    {p.description ? (
                      <span className="invoice-desc">{p.description}</span>
                    ) : (
                      <span className="td--muted">—</span>
                    )}
                  </td>
                  <td className="td--amount">
                    {symbol}{Number(p.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="td--secondary">{p.dueDate}</td>
                  <td>
                    <span className={`badge ${statusClass[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="col-actions">
                    <div className="table-actions">
                      <button
                        className="action-btn action-btn--edit"
                        onClick={() => onEdit?.(p)}
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="action-btn action-btn--delete"
                        onClick={() => onDelete?.(p)}
                        title="Delete"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="pagination__btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="pagination__info">Page {page + 1} of {totalPages}</span>
          <button className="pagination__btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}