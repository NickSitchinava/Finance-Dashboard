import { useState, useEffect, useMemo } from "react";
import AddClientModal from "../components/ui/AddClientModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import CategoryFilter from "../components/ui/CategoryFilter";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";
import { useCategoryAssignments } from "../hooks/useCategoryAssignments";
import "./ClientsPage.css";

interface Client {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  address?: string;
  notes?: string;
  active: boolean;
  created_at: string;
}

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const MailIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.4 3.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17.92z" />
  </svg>
);

const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

function parseNotes(text: string) {
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      const href = /^https?:\/\//.test(part) ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="client-card__note-link">
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);

  const {
    categories,
    fetchAll: fetchCategories,
    saveAssignmentsForClient,
    getCategoriesForClient,
  } = useCategoryAssignments();

  async function fetchClients() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });
    if (data) setClients(data);
    setLoading(false);
  }

  async function refresh() {
    await Promise.all([fetchClients(), fetchCategories()]);
  }

  useEffect(() => { refresh(); }, [user]);

  async function handleDelete() {
    if (!clientToDelete) return;
    setIsDeleting(true);
    await supabase.from("clients").update({ active: false }).eq("id", clientToDelete.id);
    setIsDeleting(false);
    setClientToDelete(null);
    fetchClients();
  }

  function openAdd() { setClientToEdit(null); setIsModalOpen(true); }
  function openEdit(c: Client) { setClientToEdit(c); setIsModalOpen(true); }

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.mobile?.includes(search);

      if (!matchesSearch) return false;

      if (filterCategoryIds.length === 0) return true;

      const clientCatIds = getCategoriesForClient(c.id).map((cat) => cat.id);
      return filterCategoryIds.every((id) => clientCatIds.includes(id));
    });
  }, [clients, search, filterCategoryIds, getCategoriesForClient]);

  const initialSelectedCategories = clientToEdit
    ? getCategoriesForClient(clientToEdit.id)
    : [];

  return (
    <div className="page">
      <div className="page__toolbar">
        <button className="btn btn--primary" onClick={openAdd}>
          + New Client
        </button>
      </div>

      <div className="clients-stats">
        <div className="clients-stat">
          <span className="clients-stat__value">{clients.length}</span>
          <span className="clients-stat__label">Total Clients</span>
        </div>
        <div className="clients-stat clients-stat--accent">
          <span className="clients-stat__value">{clients.filter((c) => c.email).length}</span>
          <span className="clients-stat__label">With Email</span>
        </div>
        <div className="clients-stat clients-stat--success">
          <span className="clients-stat__value">{clients.filter((c) => c.mobile).length}</span>
          <span className="clients-stat__label">With Mobile</span>
        </div>
      </div>

      <div className="clients-toolbar">
        <div className="clients-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="clients-search__icon">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clients-search__input"
          />
        </div>

        <CategoryFilter
          categories={categories}
          selected={filterCategoryIds}
          onChange={setFilterCategoryIds}
        />
      </div>

      {loading ? (
        <div className="page-loading">Loading clients...</div>
      ) : filtered.length === 0 ? (
        <div className="page-loading">
          {search || filterCategoryIds.length > 0
            ? "No clients match your filters."
            : "No clients yet. Add one above!"}
        </div>
      ) : (
        <div className="clients-grid">
          {filtered.map((c) => {
            const clientCategories = getCategoriesForClient(c.id);
            return (
              <div key={c.id} className="client-card card">
                <div className="client-card__header">
                  <div className="client-card__avatar">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="client-card__info">
                    <h3 className="client-card__name">{c.name}</h3>
                    <span className="client-card__since">
                      Since {new Date(c.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="client-card__actions">
                    <button className="action-btn action-btn--edit" onClick={() => openEdit(c)} title="Edit">
                      <EditIcon />
                    </button>
                    <button className="action-btn action-btn--delete" onClick={() => setClientToDelete(c)} title="Delete">
                      <DeleteIcon />
                    </button>
                  </div>
                </div>

                {clientCategories.length > 0 && (
                  <div className="client-card__categories">
                    {clientCategories.map((cat) => (
                      <span
                        key={cat.id}
                        className="client-card__cat-chip"
                        style={{ borderColor: cat.color, color: cat.color, background: `${cat.color}18` }}
                      >
                        <span className="client-card__cat-dot" style={{ background: cat.color }} />
                        {cat.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="client-card__contact">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="client-card__contact-item">
                      <MailIcon />
                      <span>{c.email}</span>
                    </a>
                  )}
                  {c.mobile && (
                    <a href={`tel:${c.mobile}`} className="client-card__contact-item">
                      <PhoneIcon />
                      <span>{c.mobile}</span>
                    </a>
                  )}
                  {c.address && (
                    <div className="client-card__contact-item">
                      <PinIcon />
                      <span>{c.address}</span>
                    </div>
                  )}
                </div>

                {c.notes && (
                  <div className="client-card__notes">
                    {parseNotes(c.notes)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={refresh}
        clientToEdit={clientToEdit}
        allCategories={categories}
        initialSelectedCategories={initialSelectedCategories}
        onSaveAssignments={saveAssignmentsForClient}
      />

      <ConfirmModal
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        title="Remove Client"
        message={`Are you sure you want to remove ${clientToDelete?.name}? They will still appear in your analytics history.`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleDelete}
        confirmVariant="danger"
        loading={isDeleting}
      />
    </div>
  );
}