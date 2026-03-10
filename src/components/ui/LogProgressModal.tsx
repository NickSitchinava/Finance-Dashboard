import { useState } from "react";
import Modal from "./Modal";
import { supabase } from "../../lib/supabase";

interface LogProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  project: { id: string; name: string; percentComplete: number } | null;
}

export default function LogProgressModal({
  isOpen,
  onClose,
  onSaved,
  project,
}: LogProgressModalProps) {
  const [percent, setPercent] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;

    const val = Number(percent);
    if (isNaN(val) || val < 0 || val > 100) {
      setErrorMsg("Please enter a value between 0 and 100.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase
      .from("projects")
      .update({ percent_complete: val })
      .eq("id", project.id);

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setPercent("");
      onSaved();
      onClose();
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Update Progress — ${project?.name ?? ""}`}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

        <div className="form-group">
          <label>Current Progress</label>
          <input
            type="text"
            value={project ? `${project.percentComplete}%` : ""}
            disabled
            className="input--disabled"
          />
        </div>

        <div className="form-group">
          <label htmlFor="progress-percent">New Progress (%)</label>
          <input
            id="progress-percent"
            required
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="e.g. 75"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
        </div>

        {percent !== "" && !isNaN(Number(percent)) && (
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{
                width: `${Math.min(100, Math.max(0, Number(percent)))}%`,
                background:
                  Number(percent) === 100
                    ? "var(--status-success)"
                    : "var(--accent)",
              }}
            />
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Progress"}
          </button>
        </div>
      </form>
    </Modal>
  );
}