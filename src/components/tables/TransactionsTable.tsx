import { useState, useMemo } from "react";
import { useCurrency } from "../../hooks/useCurrency";
import "./TransactionsTable.css";

export interface Transaction {
  id: string;
  type: "Income" | "Expense";
  amount: number;
  description: string;
  date: string;
  category: string;
  client?: string;
}

interface TransactionsTableProps {
  data: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

type SortKey = keyof Transaction;
type SortDir = "asc" | "desc";

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

export default function TransactionsTable({ data, onEdit, onDelete }: TransactionsTableProps) {
  const { symbol } = useCurrency();
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
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
    if (sortKey !== key) return <span className="sort-icon sort-icon--inactive">↕</span>;
    return <span className="sort-icon">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="card table-card">
      <h3 className="table-card__title">Ledger</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable-th" onClick={() => handleSort("date")}>Date {renderSortIcon("date")}</th>
              <th className="sortable-th" onClick={() => handleSort("description")}>Description {renderSortIcon("description")}</th>
              <th className="sortable-th" onClick={() => handleSort("category")}>Category {renderSortIcon("category")}</th>
              <th className="sortable-th" onClick={() => handleSort("amount")}>Amount {renderSortIcon("amount")}</th>
              <th className="sortable-th" onClick={() => handleSort("type")}>Type {renderSortIcon("type")}</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={6} className="td--empty">No transactions found.</td>
              </tr>
            ) : (
              pageData.map((t) => (
                <tr key={t.id}>
                  <td className="td--secondary">{t.date}</td>
                  <td>
                    <span className="td--bold">{t.description}</span>
                    {t.client && <div className="td--client">Client: {t.client}</div>}
                  </td>
                  <td className="td--secondary">{t.category}</td>
                  <td className="td--amount">
                    {symbol}{Number(t.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <span className={`badge ${t.type === "Income" ? "badge--paid" : "badge--overdue"}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="col-actions">
                    <div className="table-actions">
                      <button className="action-btn action-btn--edit" onClick={() => onEdit?.(t)} title="Edit">
                        <EditIcon />
                      </button>
                      <button className="action-btn action-btn--delete" onClick={() => onDelete?.(t)} title="Delete">
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