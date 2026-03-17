import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import ClientSelect from "./ClientSelect";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  projectToEdit?: any | null;
}

export default function AddProjectModal({
  isOpen,
  onClose,
  onProjectAdded,
  projectToEdit,
}: AddProjectModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [techStackInput, setTechStackInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("In Progress");
  const [githubLink, setGithubLink] = useState("");
  const [websiteLink, setWebsiteLink] = useState("");
  const [otherLink, setOtherLink] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (projectToEdit) {
      setName(projectToEdit.name || "");
      setClientId(projectToEdit.client_id || "");
      setTechStackInput(projectToEdit.techStack?.join(", ") || "");
      setStartDate(projectToEdit.startDate || "");
      setDeadline(projectToEdit.deadline || "");
      setStatus(projectToEdit.status || "In Progress");
      setGithubLink(projectToEdit.github_link || "");
      setWebsiteLink(projectToEdit.website_link || "");
      setOtherLink(projectToEdit.other_link || "");
    } else {
      setName("");
      setClientId("");
      setTechStackInput("");
      setStartDate("");
      setDeadline("");
      setStatus("In Progress");
      setGithubLink("");
      setWebsiteLink("");
      setOtherLink("");
    }
    setErrorMsg("");
    setShowConfirm(false);
  }, [isOpen, projectToEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setErrorMsg("Please select or create a client.");
      return;
    }
    if (projectToEdit) {
      setShowConfirm(true);
    } else {
      await performSave();
    }
  }

  async function performSave() {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");

    const techStackArray = techStackInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      if (projectToEdit) {
        const { error } = await supabase
          .from("projects")
          .update({
            name,
            client_id: clientId,
            tech_stack: techStackArray,
            start_date: startDate,
            deadline,
            status,
            github_link: githubLink || null,
            website_link: websiteLink || null,
            other_link: otherLink || null,
          })
          .eq("id", projectToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert([{
          user_id: user.id,
          name,
          client_id: clientId,
          tech_stack: techStackArray,
          start_date: startDate,
          deadline,
          hours_logged: 0,
          percent_complete: 0,
          status,
          github_link: githubLink || null,
          website_link: websiteLink || null,
          other_link: otherLink || null,
        }]);
        if (error) throw error;
      }
      await onProjectAdded();
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to save project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={projectToEdit ? "Edit Project" : "New Project"}>
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && <div className="modal-alert modal-alert--error">{errorMsg}</div>}

        <div className="form-group">
          <label htmlFor="project-name">Project Name</label>
          <input
            id="project-name"
            required
            type="text"
            placeholder="e.g. E-Commerce Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <ClientSelect
          value={clientId}
          onChange={setClientId}
          required
        />

        <div className="form-group">
          <label htmlFor="project-tech">Tech Stack (comma separated)</label>
          <input
            id="project-tech"
            type="text"
            placeholder="React, Node.js, Stripe"
            value={techStackInput}
            onChange={(e) => setTechStackInput(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="project-status">Project Status</label>
          <select id="project-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="In Progress">In Progress</option>
            <option value="Coming Soon">Coming Soon</option>
            <option value="Completed">Completed</option>
            <option value="Paused">Paused</option>
          </select>
        </div>

        <div className="form-group">
          <label>Project Links (Optional)</label>
          <div className="links-stack">
            <input
              type="url"
              placeholder="GitHub Repository URL"
              value={githubLink}
              onChange={(e) => setGithubLink(e.target.value)}
            />
            <input
              type="url"
              placeholder="Live Website URL"
              value={websiteLink}
              onChange={(e) => setWebsiteLink(e.target.value)}
            />
            <input
              type="url"
              placeholder="Other Link (e.g. Design, Docs)"
              value={otherLink}
              onChange={(e) => setOtherLink(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="project-startDate">Start Date</label>
            <input
              id="project-startDate"
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input--dark-date"
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-deadline">Deadline</label>
            <input
              id="project-deadline"
              required
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input--dark-date"
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading || !clientId}>
            {loading ? "Saving..." : projectToEdit ? "Update Project" : "Create Project"}
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