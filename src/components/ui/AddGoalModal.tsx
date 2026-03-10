import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalAdded: () => void;
  goalToEdit?: any | null;
}

export default function AddGoalModal({
  isOpen,
  onClose,
  onGoalAdded,
  goalToEdit,
}: AddGoalModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Learning");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (goalToEdit && isOpen) {
      setTitle(goalToEdit.title || "");
      setCategory(goalToEdit.category || "Learning");
      setTargetDate(goalToEdit.targetDate || "");
      setNotes(goalToEdit.notes || "");
    } else if (isOpen) {
      setTitle("");
      setCategory("Learning");
      setTargetDate("");
      setNotes("");
    }
    setShowConfirm(false);
  }, [goalToEdit, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (goalToEdit) {
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
      if (goalToEdit) {
        const { error } = await supabase
          .from("goals")
          .update({
            title,
            category,
            target_date: targetDate,
            notes: notes || null,
          })
          .eq("id", goalToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert([
          {
            user_id: user.id,
            title,
            category,
            target_date: targetDate,
            notes: notes || null,
            percent_complete: 0,
          },
        ]);
        if (error) throw error;
      }

      setTitle("");
      setCategory("Learning");
      setTargetDate("");
      setNotes("");

      await onGoalAdded();
      onClose();
      return true;
    } catch (error: any) {
      console.error("Goal Save Error:", error);
      setErrorMsg(error.message || "Failed to save goal.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goalToEdit ? "Edit Goal" : "New Goal"}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

        <div className="form-group">
          <label htmlFor="goal-title">Goal Title</label>
          <input
            id="goal-title"
            required
            type="text"
            placeholder="e.g. Master Three.js"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="goal-category">Category</label>
          <select
            id="goal-category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="Finance">Finance</option>
            <option value="Career">Career</option>
            <option value="Health">Health</option>
            <option value="Learning">Learning</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="goal-targetDate">Target Date</label>
          <input
            id="goal-targetDate"
            required
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="input--dark-date"
          />
        </div>

        <div className="form-group">
          <label htmlFor="goal-notes">Notes (Optional)</label>
          <textarea
            id="goal-notes"
            rows={3}
            placeholder="Any context or success criteria..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

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
            {loading ? "Saving..." : goalToEdit ? "Update Goal" : "Add Goal"}
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
        onConfirm={async () => {
          setShowConfirm(false);
          await performSave();
        }}
        confirmVariant="primary"
        loading={loading}
      />
    </Modal>
  );
}