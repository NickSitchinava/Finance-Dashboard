import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Client {
  id: string;
  name: string;
}

interface ClientSelectProps {
  value: string;
  onChange: (clientId: string) => void;
  required?: boolean;
  label?: string;
  autoSelect?: boolean;
}

const NEW_CLIENT_VALUE = "__new__";

export default function ClientSelect({
  value,
  onChange,
  required = false,
  label = "Client",
  autoSelect = true,
}: ClientSelectProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchClients() {
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (data) {
        setClients(data);
        if (autoSelect && !value && data.length > 0) {
          onChange(data[0].id);
        }
      }
    }
    fetchClients();
  }, [user]);

  async function handleCreateClient() {
    if (!newName.trim() || !user) return;
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("clients")
      .insert([{ name: newName.trim(), user_id: user.id }])
      .select()
      .single();
    setSaving(false);
    if (data && !err) {
      const updated = [...clients, data].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setClients(updated);
      onChange(data.id);
      setNewName("");
      setIsAdding(false);
    } else {
      setError(err?.message || "Failed to create client.");
    }
  }

  // When no value selected, the select itself gets a muted style
  const selectStyle: React.CSSProperties = !value && !isAdding
    ? { color: "var(--text-secondary)" }
    : {};

  return (
    <div className="form-group">
      <label>{label}</label>

      <select
        value={isAdding ? NEW_CLIENT_VALUE : value || ""}
        required={required && !isAdding}
        style={selectStyle}
        onChange={(e) => {
          if (e.target.value === NEW_CLIENT_VALUE) {
            setIsAdding(true);
          } else {
            setIsAdding(false);
            onChange(e.target.value);
          }
        }}
      >
        {/* Placeholder — only shown when nothing selected, disabled so it can't be re-picked */}
        {!value && (
          <option value="" disabled style={{ color: "var(--text-secondary)" }}>
            -- Select Client --
          </option>
        )}

        {clients.length === 0 ? (
          <option value="" disabled>No clients yet</option>
        ) : (
          clients.map((c) => (
            <option key={c.id} value={c.id} style={{ color: "var(--text-primary)" }}>
              {c.name}
            </option>
          ))
        )}

        <option value={NEW_CLIENT_VALUE} style={{ color: "var(--accent)" }}>
          + Add New Client
        </option>
      </select>

      {isAdding && (
        <div className="client-select__new">
          <input
            type="text"
            placeholder="New client name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateClient();
              }
            }}
            autoFocus
          />
          <div className="client-select__new-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleCreateClient}
              disabled={saving || !newName.trim()}
            >
              {saving ? "Adding..." : "Add Client"}
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => {
                setIsAdding(false);
                setNewName("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
          {error && <div className="client-select__error">{error}</div>}
        </div>
      )}
    </div>
  );
}