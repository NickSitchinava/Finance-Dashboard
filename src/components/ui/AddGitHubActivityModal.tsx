import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface AddGitHubActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivityAdded: () => void;
  activityToEdit?: any | null;
}

export default function AddGitHubActivityModal({
  isOpen,
  onClose,
  onActivityAdded,
  activityToEdit,
}: AddGitHubActivityModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [repository, setRepository] = useState("");
  const [type, setType] = useState("Commit");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (activityToEdit && isOpen) {
      setRepository(activityToEdit.repository || "");
      setType(activityToEdit.type || "Commit");
      setDate(activityToEdit.date || "");
      setDescription(activityToEdit.description || "");
    } else if (isOpen) {
      setRepository("");
      setType("Commit");
      setDate(new Date().toISOString().split("T")[0]);
      setDescription("");
    }
  }, [activityToEdit, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activityToEdit) {
      setShowConfirm(true);
    } else {
      await performSave();
    }
  }

  async function performSave() {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");

    const payload = {
      user_id: user.id,
      repository,
      type,
      date,
      description,
    };

    try {
      if (activityToEdit) {
        const { error } = await supabase
          .from("github_activity")
          .update(payload)
          .eq("id", activityToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("github_activity")
          .insert([payload]);
        if (error) throw error;
      }
      await onActivityAdded();
      onClose();
      return true;
    } catch (err: any) {
      console.error("GitHub Activity Save Error:", err);
      setErrorMsg(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activityToEdit ? "Edit Activity" : "Add GitHub Activity"}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

        <div className="form-group">
          <label>Repository</label>
          <input
            type="text"
            required
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            placeholder="e.g. nick-dashboard"
          />
        </div>

        <div className="form-group">
          <label>Event Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="Commit">Commit</option>
            <option value="Pull Request">Pull Request</option>
            <option value="Issue">Issue</option>
            <option value="Deployment">Deployment</option>
          </select>
        </div>

        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input--dark-date"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was done?"
            rows={3}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Saving..." : "Save Activity"}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Edit"
        message="Save changes to this activity?"
        onConfirm={async () => {
          setShowConfirm(false);
          await performSave();
        }}
        confirmText="Save"
        cancelText="Cancel"
        confirmVariant="primary"
        loading={loading}
      />
    </Modal>
  );
}