import { useState } from "react";
import Modal from "../components/ui/Modal";
import { supabase } from "../lib/supabase";
import { STAGES, stageName, type Client, type NoteBlock, type Project, type Stage } from "./clientWorkspaceModel";

function links(text: string) {
  return text.split(/(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z\d-]+(?:\.[a-z\d-]+)+)/gi).map((part, i) => {
    if (!/^(?:https?:\/\/|www\.|[a-z\d-]+\.[a-z]{2,})/i.test(part)) return <span key={i}>{part}</span>;
    try { const url = new URL(/^https?:\/\//i.test(part) ? part : `https://${part}`); return ["http:", "https:"].includes(url.protocol) ? <a key={i} href={url.href} target="_blank" rel="noopener noreferrer">{part}</a> : <span key={i}>{part}</span>; } catch { return <span key={i}>{part}</span>; }
  });
}
function localDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function inline(text: string) {
  return text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part, i) => {
    const explicit = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    if (explicit) { try { const url = new URL(explicit[2]); if (["http:", "https:"].includes(url.protocol)) return <a key={i} href={url.href} target="_blank" rel="noopener noreferrer">{explicit[1]}</a>; } catch { /* render as text */ } }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{links(part)}</span>;
  });
}

export default function ClientWorkspaceEditor({ client, isOpen, onClose, userId, categories, initialCategoryIds, saveAssignments, projects, stage, onMove, onTransfer, onSaved }: {
  client: Client | null; isOpen: boolean; onClose: () => void; userId: string;
  categories: { id: string; name: string }[]; initialCategoryIds: string[];
  saveAssignments: (id: string, ids: string[]) => Promise<boolean>; projects: Project[]; stage: Stage;
  onMove: (stage: Stage) => void; onTransfer: () => void; onSaved: (created: boolean, id: string, stage: Stage) => Promise<void>;
}) {
  const initial = { name: client?.name || "", email: client?.email || "", mobile: client?.mobile || "", address: client?.address || "", company: client?.company || "", website: client?.website || "", lead_source: client?.lead_source || "", notes: client?.notes || "", follow_up_at: localDateTime(client?.follow_up_at), follow_up_note: client?.follow_up_note || "", follow_up_priority: client?.follow_up_priority || "normal", follow_up_completed: client?.follow_up_completed || false };
  const [form, setForm] = useState(initial);
  const [blocks, setBlocks] = useState<NoteBlock[]>(client?.notes_blocks || []);
  const [categoryIds, setCategoryIds] = useState(initialCategoryIds);
  const [projectIds, setProjectIds] = useState<string[]>(projects.filter((p) => p.client_id === client?.id).map((p) => p.id));
  const [initialStage, setInitialStage] = useState<Stage>(stage);
  const [notesOpen, setNotesOpen] = useState(false), [advanced, setAdvanced] = useState(false), [closeConfirm, setCloseConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const set = (key: keyof typeof form, value: string | boolean) => setForm((old) => ({ ...old, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || JSON.stringify(blocks) !== JSON.stringify(client?.notes_blocks || []) || categoryIds.join() !== initialCategoryIds.join() || projectIds.join() !== projects.filter((p) => p.client_id === client?.id).map((p) => p.id).join();
  function close() { if (dirty) setCloseConfirm(true); else onClose(); }
  async function save() {
    if (!form.name.trim()) { setError("Client name is required."); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Enter a valid email address."); return; }
    if (form.website) { try { const url = new URL(/^https?:\/\//.test(form.website) ? form.website : `https://${form.website}`); if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error(); } catch { setError("Enter a valid website URL."); return; } }
    setBusy(true); setError("");
    const payload = { name: form.name.trim(), email: form.email.trim() || null, mobile: form.mobile.trim() || null, address: form.address.trim() || null, company: form.company.trim() || null, website: form.website.trim() || null, lead_source: form.lead_source.trim() || null, notes: form.notes || null, notes_blocks: blocks, follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null, follow_up_note: form.follow_up_note.trim() || null, follow_up_priority: form.follow_up_priority, follow_up_completed: form.follow_up_completed };
    const result = client ? await supabase.from("clients").update(payload).eq("id", client.id).eq("user_id", userId).select("id").single() : await supabase.from("clients").insert({ ...payload, user_id: userId, relationship_stage: initialStage, active: initialStage !== "archived", sort_order: 9999 }).select("id").single();
    if (result.error || !result.data) { setError(result.error?.message || "Could not save client."); setBusy(false); return; }
    const id = result.data.id;
    if (!await saveAssignments(id, categoryIds)) { setError("Client saved, but Industry Categories could not be updated."); setBusy(false); return; }
    for (const project of projects) {
      const was = project.client_id === id, now = projectIds.includes(project.id);
      if (was === now) continue;
      const { error: projectError } = await supabase.from("projects").update({ client_id: now ? id : null, kind: now ? "client" : project.kind }).eq("id", project.id).eq("user_id", userId);
      if (projectError) { setError(`Client saved, but project assignment failed: ${projectError.message}`); setBusy(false); return; }
    }
    setBusy(false); window.dispatchEvent(new Event("client-follow-up-updated")); await onSaved(!client, id, initialStage);
  }
  if (!isOpen) return null;
  return <Modal isOpen={isOpen} onClose={close} title={client ? "Client details" : "New Client"} maxWidth={680}><div className="crm-editor"><div className="crm-editor-intro"><div><strong>{client ? form.name || "Client profile" : "Contact details"}</strong><small>{client ? `${stageName(stage)} · Profile changes save separately from board changes` : "Add the information you need to manage this relationship."}</small></div></div>
    <div className="crm-form-grid"><label>Client name *<input maxLength={160} value={form.name} onChange={(e) => set("name", e.target.value)}/></label><label>Email<input type="email" maxLength={254} value={form.email} onChange={(e) => set("email", e.target.value)}/></label><label>Phone<input type="tel" maxLength={50} value={form.mobile} onChange={(e) => set("mobile", e.target.value)}/></label><label>Industry Category<select value={categoryIds[0] || ""} onChange={(e) => setCategoryIds(e.target.value ? [e.target.value] : [])}><option value="">Uncategorized</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>{!client && <label>Initial stage<select value={initialStage} onChange={(e) => setInitialStage(e.target.value as Stage)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}<label>Address<input maxLength={240} value={form.address} onChange={(e) => set("address", e.target.value)}/></label></div>
    <button className="crm-expand" onClick={() => setAdvanced((v) => !v)}>Business information <span>{advanced ? "−" : "+"}</span></button>{advanced && <div className="crm-form-grid"><label>Company<input maxLength={160} value={form.company} onChange={(e) => set("company", e.target.value)}/></label><label>Website<input maxLength={500} value={form.website} onChange={(e) => set("website", e.target.value)}/></label><label>Lead Source<input maxLength={120} value={form.lead_source} onChange={(e) => set("lead_source", e.target.value)}/></label></div>}
    {client && <><div className="crm-section-title">Projects <span>{projectIds.length}</span></div><div className="crm-projects">{projects.length ? projects.map((p) => <label key={p.id}><input type="checkbox" checked={projectIds.includes(p.id)} onChange={(e) => setProjectIds((ids) => e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id))}/>{p.name}{p.client_id && p.client_id !== client.id && <small>Assigned elsewhere</small>}</label>) : <p>No projects yet.</p>}</div><div className="crm-section-title">Move relationship</div><div className="crm-move"><select value={stage} onChange={(e) => onMove(e.target.value as Stage)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button onClick={onTransfer}>Move to Shared Panel</button></div></>}
    <button className="crm-expand" onClick={() => setNotesOpen((v) => !v)}>Notes <span>{notesOpen ? "−" : "+"}</span></button>{!notesOpen && (form.notes || blocks.length > 0) && <div className="crm-note-preview">{form.notes && links(form.notes)}{blocks.map((block, i) => <div key={block.id} className={`crm-render-block crm-render-${block.type}`}>{block.type === "check" && <input type="checkbox" checked={!!block.checked} readOnly/>}{block.type === "bullet" && "• "}{block.type === "number" && `${i + 1}. `}{inline(block.text)}</div>)}</div>}{notesOpen && <div className="crm-notes"><label>Existing notes<textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Write notes. URLs become clickable in the preview."/></label>{form.notes && <div className="crm-note-preview">{links(form.notes)}</div>}<div className="crm-section-title">Rich notes</div>{blocks.map((block, index) => <div className="crm-note-block" key={block.id}><select aria-label="Note type" value={block.type} onChange={(e) => setBlocks((rows) => rows.map((row, i) => i === index ? { ...row, type: e.target.value as NoteBlock["type"] } : row))}><option value="paragraph">Text</option><option value="heading">Heading</option><option value="bullet">Bullet</option><option value="number">Numbered</option><option value="check">Checklist</option></select>{block.type === "check" && <input type="checkbox" checked={!!block.checked} onChange={(e) => setBlocks((rows) => rows.map((row, i) => i === index ? { ...row, checked: e.target.checked } : row))}/>}<input aria-label="Note text" value={block.text} onChange={(e) => setBlocks((rows) => rows.map((row, i) => i === index ? { ...row, text: e.target.value } : row))}/><button onClick={() => setBlocks((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove note"><XIcon/></button></div>)}<button className="crm-add-block" onClick={() => setBlocks((rows) => [...rows, { id: crypto.randomUUID(), type: "paragraph", text: "" }])}>+ Add note block</button><p className="crm-hint">Use **bold** or *italic* in note text.</p></div>}
    <div className="crm-section-title">Follow-up</div><div className="crm-form-grid"><label>Date and time<input type="datetime-local" value={form.follow_up_at} onChange={(e) => set("follow_up_at", e.target.value)}/></label><label>Priority<select value={form.follow_up_priority} onChange={(e) => set("follow_up_priority", e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label className="crm-wide">Reminder description<input maxLength={300} value={form.follow_up_note} onChange={(e) => set("follow_up_note", e.target.value)}/></label></div><label className="crm-check"><input type="checkbox" checked={form.follow_up_completed} onChange={(e) => set("follow_up_completed", e.target.checked)}/>Completed</label>{form.follow_up_at && <button className="crm-clear-followup" onClick={() => { set("follow_up_at", ""); set("follow_up_note", ""); }}>Remove follow-up</button>}
    {error && <div className="crm-inline-error" role="alert">{error}</div>}<div className="crm-dialog-actions"><button className="crm-button crm-button--subtle" onClick={close}>Cancel</button><button className="crm-button crm-button--save is-dirty" disabled={busy} onClick={save}>{busy ? "Saving…" : client ? "Save Profile" : "Create Client"}</button></div></div><Modal isOpen={closeConfirm} onClose={() => setCloseConfirm(false)} title="Discard profile edits?"><div className="crm-dialog"><p>Your profile changes have not been saved.</p><div className="crm-dialog-actions"><button className="crm-button crm-button--subtle" onClick={() => setCloseConfirm(false)}>Keep editing</button><button className="crm-button crm-button--danger" onClick={onClose}>Discard edits</button></div></div></Modal></Modal>;
}

function XIcon() { return <span aria-hidden>×</span>; }
