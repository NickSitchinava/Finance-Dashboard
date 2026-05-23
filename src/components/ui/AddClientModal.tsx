import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import CategoryCombobox from "./CategoryCombobox";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import type { ClientCategory } from "../../hooks/useCategoryAssignments";

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  clientToEdit?: any | null;
  allCategories: ClientCategory[];
  initialSelectedCategories?: ClientCategory[];
  onSaveAssignments: (clientId: string, categoryIds: string[]) => Promise<boolean>;
}

export default function AddClientModal({
  isOpen,
  onClose,
  onSaved,
  clientToEdit,
  allCategories,
  initialSelectedCategories = [],
  onSaveAssignments,
}: AddClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<ClientCategory[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (clientToEdit) {
      setName(clientToEdit.name || "");
      setEmail(clientToEdit.email || "");
      setMobile(clientToEdit.mobile || "");
      setAddress(clientToEdit.address || "");
      setNotes(clientToEdit.notes || "");
      setSelectedCategories(initialSelectedCategories);
    } else {
      setName("");
      setEmail("");
      setMobile("");
      setAddress("");
      setNotes("");
      setSelectedCategories([]);
    }
    setErrorMsg("");
    setShowConfirm(false);
  }, [isOpen, clientToEdit]);

  useEffect(() => {
    if (isOpen && clientToEdit) {
      setSelectedCategories(initialSelectedCategories);
    }
  }, [initialSelectedCategories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Client name is required.");
      return;
    }
    if (clientToEdit) {
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
        name: name.trim(),
        email: email.trim() || null,
        mobile: mobile.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        user_id: user.id,
        active: true,
      };

      let clientId = clientToEdit?.id;

      if (clientToEdit) {
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", clientToEdit.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        clientId = data.id;
      }

      await onSaveAssignments(clientId, selectedCategories.map((c) => c.id));

      await onSaved();
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to save client.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={clientToEdit ? "Edit Client" : "New Client"}>
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && <div className="modal-alert modal-alert--error">{errorMsg}</div>}

        <div className="form-group">
          <label htmlFor="client-name">Name *</label>
          <input
            id="client-name"
            required
            type="text"
            placeholder="e.g. Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="client-email">Email</label>
            <input
              id="client-email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="client-mobile">Mobile</label>
            <input
              id="client-mobile"
              type="tel"
              placeholder="+1 234 567 890"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="client-address">Address</label>
          <input
            id="client-address"
            type="text"
            placeholder="123 Main St, City, Country"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="client-notes">Notes</label>
          <textarea
            id="client-notes"
            rows={4}
            placeholder="Any notes about this client... URLs will be clickable."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <CategoryCombobox
          categories={allCategories}
          selected={selectedCategories}
          onChange={setSelectedCategories}
        />

        <div className="modal-actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Saving..." : clientToEdit ? "Update Client" : "Add Client"}
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