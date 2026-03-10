import { useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Client {
  id: string;
  name: string;
}

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  projectToEdit?: any | null;
}

const NEW_CLIENT_VALUE = "__new__";

export default function AddProjectModal({
  isOpen,
  onClose,
  onProjectAdded,
  projectToEdit,
}: AddProjectModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [clients, setClients] = useState<Client[]>([]);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [techStackInput, setTechStackInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("In Progress");
  const [githubLink, setGithubLink] = useState("");
  const [websiteLink, setWebsiteLink] = useState("");
  const [otherLink, setOtherLink] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function fetchClients() {
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (data) {
        setClients(data);
        if (data.length > 0 && !projectToEdit) setClientId(data[0].id);
      }
    }
    fetchClients();
  }, [user, projectToEdit]);

  useEffect(() => {
    if (projectToEdit && isOpen) {
      setName(projectToEdit.name || "");
      setTechStackInput(projectToEdit.techStack?.join(", ") || "");
      setStartDate(projectToEdit.startDate || "");
      setDeadline(projectToEdit.deadline || "");
      setStatus(projectToEdit.status || "In Progress");
      setGithubLink(projectToEdit.github_link || "");
      setWebsiteLink(projectToEdit.website_link || "");
      setOtherLink(projectToEdit.other_link || "");
      if (projectToEdit.client_id) {
        setClientId(projectToEdit.client_id);
      } else {
        const foundClient = clients.find((c) => c.name === projectToEdit.client);
        if (foundClient) setClientId(foundClient.id);
      }
      setErrorMsg("");
    } else if (isOpen) {
      setName("");
      setTechStackInput("");
      setStartDate("");
      setDeadline("");
      setStatus("In Progress");
      setGithubLink("");
      setWebsiteLink("");
      setOtherLink("");
      setNewClientName("");
      setIsAddingClient(false);
      if (clients.length > 0) setClientId(clients[0].id);
      setErrorMsg("");
    }
    setShowConfirm(false);
  }, [projectToEdit, isOpen, clients]);

  async function handleCreateClient() {
    if (!newClientName.trim() || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .insert([{ name: newClientName.trim(), user_id: user.id }])
      .select()
      .single();
    setLoading(false);
    if (data && !error) {
      setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(data.id);
      setNewClientName("");
      setIsAddingClient(false);
    } else {
      setErrorMsg(error?.message || "Failed to create client.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!clientId) {
      setErrorMsg("Please select or create a client first.");
      return;
    }
    if (projectToEdit) {
      setShowConfirm(true);
      return;
    }
    await performSave();
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
        const { error } = await supabase.from("projects").insert([
          {
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
          },
        ]);
        if (error) throw error;
      }

      setName("");
      setTechStackInput("");
      setStartDate("");
      setDeadline("");
      setGithubLink("");
      setWebsiteLink("");
      setOtherLink("");
      setStatus("In Progress");

      await onProjectAdded();
      onClose();
      return true;
    } catch (error: any) {
      console.error("Project Save Error:", error);
      setErrorMsg(error.message || "Failed to save project.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={projectToEdit ? "Edit Project" : "New Project"}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {errorMsg && (
          <div className="modal-alert modal-alert--error">{errorMsg}</div>
        )}

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

        <div className="form-group">
          <label htmlFor="project-client">Client</label>
          {isAddingClient ? (
            <div className="new-client-row">
              <input
                type="text"
                placeholder="New client name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleCreateClient}
                disabled={loading || !newClientName.trim()}
              >
                Add
              </button>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => { setIsAddingClient(false); setNewClientName(""); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <select
              id="project-client"
              value={clientId}
              onChange={(e) => {
                if (e.target.value === NEW_CLIENT_VALUE) {
                  setIsAddingClient(true);
                } else {
                  setClientId(e.target.value);
                }
              }}
            >
              {clients.length === 0 && (
                <option value="" disabled>No clients yet</option>
              )}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW_CLIENT_VALUE}>+ Add New Client</option>
            </select>
          )}
        </div>

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
          <select
            id="project-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
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
            disabled={loading || !clientId}
          >
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