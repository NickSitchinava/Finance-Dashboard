import { useState } from "react";
import Modal from "./Modal";
import { supabase } from "../../lib/supabase";

interface LogHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  project: { id: string; name: string; hoursLogged: number } | null;
}

export default function LogHoursModal({
  isOpen,
  onClose,
  onSaved,
  project,
}: LogHoursModalProps) {
  const [hours, setHours] = useState("");
  const [mode, setMode] = useState<"add" | "set">("add");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;

    const val = Number(hours);
    if (isNaN(val) || val < 0) {
      setErrorMsg("Please enter a valid number of hours.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const newTotal =
      mode === "add" ? project.hoursLogged + val : val;

    const { error } = await supabase
      .from("projects")
      .update({ hours_logged: newTotal })
      .eq("id", project.id);

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setHours("");
      onSaved();
      onClose();
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Hours — ${project?.name ?? ""}`}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

        <div className="form-group">
          <label>Current Hours Logged</label>
          <input
            type="text"
            value={project?.hoursLogged ?? 0}
            disabled
            className="input--disabled"
          />
        </div>

        <div className="form-group">
          <label htmlFor="log-mode">Mode</label>
          <select
            id="log-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "add" | "set")}
          >
            <option value="add">Add hours</option>
            <option value="set">Set total manually</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="log-hours">
            {mode === "add" ? "Hours to Add" : "New Total Hours"}
          </label>
          <input
            id="log-hours"
            required
            type="number"
            min="0"
            step="0.5"
            placeholder={mode === "add" ? "e.g. 2.5" : "e.g. 40"}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
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
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Hours"}
          </button>
        </div>
      </form>
    </Modal>
  );
}