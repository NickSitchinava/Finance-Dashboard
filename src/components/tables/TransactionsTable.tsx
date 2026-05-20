import { useState, useMemo } from "react";
import { useCurrency } from "../../hooks/useCurrency";
import "./TransactionsTable.css";

export interface Transaction {
  id: string;
  description: string;
  date: string;
  income_amount: number;
  expense_amount: number;
  income_category?: string;
  expense_category?: string;
  income_notes?: string;
  expense_notes?: string;
  client?: string;
  client_id?: string;
}

interface TransactionsTableProps {
  data: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

type SortKey = "date" | "description" | "profit";
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

function InfoTooltip({
  category,
  notes,
  color,
}: {
  category?: string;
  notes?: string;
  color: string;
}) {
  const [visible, setVisible] = useState(false);
  const hasContent = category || notes;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          border: `1px solid ${color}`,
          background: `${color}18`,
          color,
          fontSize: "0.6rem",
          fontWeight: 700,
          cursor: "help",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ?
      </button>

      {visible && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "10px 12px",
            width: "200px",
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            fontSize: "0.8rem",
            color: "var(--text-primary)",
            lineHeight: 1.5,
            pointerEvents: "none",
          }}
        >
          {category && (
            <div style={{ marginBottom: notes ? "8px" : 0 }}>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                Category
              </div>
              <div style={{ fontWeight: 600, color }}>{category}</div>
            </div>
          )}
          {notes && (
            <div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                Notes
              </div>
              <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{notes}</div>
            </div>
          )}
          {!hasContent && (
            <span style={{ color: "var(--text-secondary)" }}>No details added</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function TransactionsTable({ data, onEdit, onDelete }: TransactionsTableProps) {
  const { symbol } = useCurrency();
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "profit") {
        av = a.income_amount - a.expense_amount;
        bv = b.income_amount - b.expense_amount;
      } else {
        av = a[sortKey] || "";
        bv = b[sortKey] || "";
      }
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
      setSortDir(key === "date" ? "desc" : "asc");
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
              <th>Amount</th>
              <th className="sortable-th" onClick={() => handleSort("profit")}>Profit {renderSortIcon("profit")}</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={5} className="td--empty">No transactions found.</td>
              </tr>
            ) : (
              pageData.map((t) => {
                const profit = t.income_amount - t.expense_amount;
                const profitColor = profit >= 0 ? "#34C759" : "#E05252";
                const profitPrefix = profit > 0 ? "+" : "";

                return (
                  <tr key={t.id}>
                    <td className="td--secondary">{t.date}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{t.description}</span>
                      {t.client && (
                        <div className="td--client">Client: {t.client}</div>
                      )}
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {t.income_amount > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#34C759" }}>
                              {symbol}{t.income_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <InfoTooltip
                              category={t.income_category}
                              notes={t.income_notes}
                              color="#34C759"
                            />
                          </div>
                        )}
                        {t.expense_amount > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#E05252" }}>
                              -{symbol}{t.expense_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <InfoTooltip
                              category={t.expense_category}
                              notes={t.expense_notes}
                              color="#E05252"
                            />
                          </div>
                        )}
                        {t.income_amount === 0 && t.expense_amount === 0 && (
                          <span style={{ color: "var(--text-secondary)" }}>—</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600, color: profitColor }}>
                        {profitPrefix}{symbol}{Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                );
              })
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