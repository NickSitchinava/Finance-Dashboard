export type Stage = "active" | "completed" | "archived" | "lead" | "contacted" | "negotiating";
export type Placement = { id: string; stage: Stage; sort_order: number };
export type NoteBlock = { id: string; type: "paragraph" | "heading" | "bullet" | "number" | "check"; text: string; checked?: boolean };
export type Client = { id: string; user_id: string; name: string; email: string | null; mobile: string | null; address: string | null; notes: string | null; notes_blocks: NoteBlock[] | null; company: string | null; website: string | null; lead_source: string | null; relationship_stage: Stage; sort_order: number | null; board_updated_at: string; follow_up_at: string | null; follow_up_note: string | null; follow_up_priority: "low" | "normal" | "high" | null; follow_up_completed: boolean; created_at: string };
export type Project = { id: string; name: string; client_id: string | null; kind: string };
export const TABS: Record<"clients" | "pipeline", { id: Stage; name: string }[]> = { clients: [{ id: "active", name: "Active" }, { id: "completed", name: "Completed" }, { id: "archived", name: "Archived" }], pipeline: [{ id: "lead", name: "Lead" }, { id: "contacted", name: "Contacted" }, { id: "negotiating", name: "Negotiating" }] };
export const STAGES = [...TABS.clients, ...TABS.pipeline];
export const stageName = (id: Stage) => STAGES.find((s) => s.id === id)?.name || id;
