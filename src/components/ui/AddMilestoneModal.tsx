import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface AddMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMilestoneAdded: () => void;
  milestoneToEdit?: any | null;
}

export default function AddMilestoneModal({
  isOpen,
  onClose,
  onMilestoneAdded,
  milestoneToEdit,
}: AddMilestoneModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [completed, setCompleted] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (milestoneToEdit && isOpen) {
      setTitle(milestoneToEdit.title || "");
      setTargetDate(milestoneToEdit.target_date || "");
      setCompleted(milestoneToEdit.completed || false);
    } else if (isOpen) {
      setTitle("");
      setTargetDate("");
      setCompleted(false);
    }
    setShowConfirm(false);
  }, [milestoneToEdit, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (milestoneToEdit) {
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
      if (milestoneToEdit) {
        const { error } = await supabase
          .from("milestones")
          .update({ title, target_date: targetDate, completed })
          .eq("id", milestoneToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("milestones").insert([
          {
            user_id: user.id,
            title,
            target_date: targetDate,
            completed,
          },
        ]);
        if (error) throw error;
      }

      setTitle("");
      setTargetDate("");
      setCompleted(false);

      await onMilestoneAdded();
      onClose();
      return true;
    } catch (error: any) {
      console.error("Milestone Save Error:", error);
      setErrorMsg(error.message || "Failed to save milestone.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={milestoneToEdit ? "Edit Milestone" : "New Milestone"}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

        <div className="form-group">
          <label htmlFor="milestone-title">Milestone Title</label>
          <input
            id="milestone-title"
            required
            type="text"
            placeholder="e.g. $40K Saved"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="milestone-targetDate">Target Date</label>
          <input
            id="milestone-targetDate"
            required
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="input--dark-date"
          />
        </div>

        <div className="form-group form-group--checkbox">
          <input
            type="checkbox"
            id="milestone-completed"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            className="checkbox-input"
          />
          <label htmlFor="milestone-completed" className="checkbox-label">
            Mark as Completed
          </label>
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
            {loading
              ? "Saving..."
              : milestoneToEdit
              ? "Update Milestone"
              : "Add Milestone"}
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