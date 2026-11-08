import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, LayoutGrid, List, Plus, X } from "lucide-react";
import { Seek } from "../components/ui/Seek";
import "../components/ui/Seek.css";
import { KanbanBoard, type KanbanColumn } from "../components/ui/kanban-board";
import PillNav from "../components/ui/PillNav";
import RubberSegment from "../components/ui/RubberSegment";
import DashboardContentTransition from "../components/ui/DashboardContentTransition";
import AnimatedMetricValue from "../components/ui/AnimatedMetricValue";
import Modal from "../components/ui/Modal";
import SwipeToast from "../components/ui/SwipeToast";
import CategoryFilter from "../components/ui/CategoryFilter";
import { supabase } from "../lib/supabase";
import { dashboardSnapshot, saveDashboardSnapshot } from "../lib/dashboardCache";
import { useAuth } from "../components/auth/AuthProvider";
import { useCategoryAssignments } from "../hooks/useCategoryAssignments";
import ClientWorkspaceEditor from "./ClientWorkspaceEditor";
import ClientsWorkspaceSkeleton from "./ClientsWorkspaceSkeleton";
import { TABS, STAGES, stageName, type Stage, type Placement, type Client, type Project } from "./clientWorkspaceModel";
import "./ClientsPage.css";
import "./ClientsWorkspace.css";

const tabOf = (id: Stage) => TABS.pipeline.some((s) => s.id === id) ? "pipeline" : "clients";
const normalize = (rows: Placement[]) => STAGES.flatMap((s) => rows.filter((p) => p.stage === s.id).sort((a, b) => a.sort_order - b.sort_order).map((p, i) => ({ ...p, sort_order: i })));
const signature = (rows: Placement[]) => JSON.stringify(normalize(rows).map((p) => [p.id, p.stage, p.sort_order]));
const tone = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 5;
type SharedTouchDrag = { id: string; name: string; pointerId: number; startX: number; startY: number; x: number; y: number; offsetX: number; offsetY: number; width: number; active: boolean; target: Stage | null };
type WorkspaceSnapshot = { clients: Client[]; projects: Project[] };

function sharedStageAt(x: number, y: number): Stage | null {
  const element = document.elementFromPoint(x, y);
  const target = element?.closest<HTMLElement>("[data-shared-stage], [data-kanban-column]");
  const stage = target?.dataset.sharedStage || target?.dataset.kanbanColumn;
  return STAGES.some((item) => item.id === stage) ? stage as Stage : null;
}

export default function ClientsWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { categories, fetchAll: fetchCategories, getCategoriesForClient, saveAssignmentsForClient } = useCategoryAssignments();
  const fetchCategoriesRef = useRef(fetchCategories);
  fetchCategoriesRef.current = fetchCategories;
  const cached = dashboardSnapshot<WorkspaceSnapshot>(`${user?.id}|clients-workspace`);
  const initialPlaces = () => normalize((cached?.clients ?? []).map((row) => ({ id: row.id, stage: row.relationship_stage || "active", sort_order: row.sort_order ?? 0 })));
  const [clients, setClients] = useState<Client[]>(() => cached?.clients ?? []), [projects, setProjects] = useState<Project[]>(() => cached?.projects ?? []);
  const [baseline, setBaseline] = useState<Placement[]>(initialPlaces), [draft, setDraft] = useState<Placement[]>(initialPlaces);
  const [history, setHistory] = useState<{ board: Placement[]; shared: string[] }[]>([]), [future, setFuture] = useState<{ board: Placement[]; shared: string[] }[]>([]);
  const [shared, setShared] = useState<string[]>([]), [origins, setOrigins] = useState<Record<string, Stage>>({});
  const [sharedOpen, setSharedOpen] = useState(false), [edgeOpen, setEdgeOpen] = useState(false);
  const [sharedTouchDrag, setSharedTouchDrag] = useState<SharedTouchDrag | null>(null);
  const [tab, setTab] = useState<"clients" | "pipeline">("clients"), [view, setView] = useState<"kanban" | "list">("kanban"), [mobileStage, setMobileStage] = useState<Stage>("active");
  const [search, setSearch] = useState(""), [categoryIds, setCategoryIds] = useState<string[]>([]), [uncategorized, setUncategorized] = useState(false);
  const [multi, setMulti] = useState(false), [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null), [newOpen, setNewOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false), [discardOpen, setDiscardOpen] = useState(false), [saving, setSaving] = useState(false), [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState(""), [toast, setToast] = useState("");
  const [toastSequence, setToastSequence] = useState(0);
  const notify = (message: string) => { setToast(message); setToastSequence((sequence) => sequence + 1); };
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const sharedRef = useRef<string[]>([]), navigationAfterSave = useRef(false);
  const touchDragId = sharedTouchDrag?.id, touchPointerId = sharedTouchDrag?.pointerId, touchStartX = sharedTouchDrag?.startX, touchStartY = sharedTouchDrag?.startY;
  const swipeStart = useRef<number | null>(null);
  const guardActive = useRef(false), bypassHistory = useRef(false);
  const dirty = signature(draft) !== signature(baseline) || shared.length > 0;
  const blocker = { state: pendingPath ? "blocked" : "unblocked", reset: () => setPendingPath(null), proceed: () => { if (pendingPath) { const path = pendingPath; setPendingPath(null); if (path === "__history_back__") { bypassHistory.current = true; window.history.go(-2); } else navigate(path); } } };
  useEffect(() => {
    if (dirty && !guardActive.current) { window.history.pushState({ crmBoardGuard: true }, "", window.location.href); guardActive.current = true; }
    if (!dirty) guardActive.current = false;
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const onPop = () => {
      if (bypassHistory.current) return;
      window.history.pushState({ crmBoardGuard: true }, "", location.pathname);
      setPendingPath("__history_back__");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty, location.pathname]);
  useEffect(() => {
    if (!dirty) return;
    const intercept = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.origin !== window.location.origin || link.pathname === location.pathname || event.metaKey || event.ctrlKey) return;
      event.preventDefault(); event.stopPropagation();
      setPendingPath(`${link.pathname}${link.search}${link.hash}`);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [dirty, location.pathname]);

  const load = useCallback(async (resetBoard = true) => {
    if (!user) return;
    if (!dashboardSnapshot<WorkspaceSnapshot>(`${user.id}|clients-workspace`)) setLoading(true);
    try {
      const [c, p] = await Promise.all([supabase.from("clients").select("*").eq("user_id", user.id), supabase.from("projects").select("id,name,client_id,kind").eq("user_id", user.id)]);
      if (c.error || p.error) { setError(c.error?.message || p.error?.message || "Could not load clients."); return; }
      const rows = (c.data || []) as Client[];
      const projectRows = (p.data || []) as Project[];
      saveDashboardSnapshot(`${user.id}|clients-workspace`, { clients: rows, projects: projectRows });
      setClients(rows); setProjects(projectRows);
      if (resetBoard) { const places = normalize(rows.map((row) => ({ id: row.id, stage: row.relationship_stage || "active", sort_order: row.sort_order ?? 0 }))); setBaseline(places); setDraft(places); setHistory([]); setFuture([]); setShared([]); sharedRef.current = []; }
      await fetchCategoriesRef.current();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load clients.");
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { sharedRef.current = shared; }, [shared]);
  useEffect(() => { setMobileStage(tab === "clients" ? "active" : "lead"); }, [tab]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [dirty]);

  const push = useCallback((next: Placement[], nextShared = sharedRef.current) => { const previousShared = sharedRef.current; if (signature(draft) === signature(next) && previousShared.join() === nextShared.join()) return; setHistory((h) => [...h.slice(-49), { board: draft, shared: previousShared }]); setFuture([]); setDraft(normalize(next)); sharedRef.current = nextShared; setShared(nextShared); }, [draft]);
  const move = useCallback((ids: string[], stage: Stage, index?: number) => { const rest = draft.filter((p) => !ids.includes(p.id)); const target = rest.filter((p) => p.stage === stage).sort((a, b) => a.sort_order - b.sort_order); target.splice(index ?? target.length, 0, ...ids.map((id) => ({ id, stage, sort_order: 0 }))); push([...rest.filter((p) => p.stage !== stage), ...target.map((p, i) => ({ ...p, sort_order: i }))], sharedRef.current.filter((id) => !ids.includes(id))); setSelected([]); }, [draft, push]);
  const transfer = useCallback((id: string) => { if (sharedRef.current.includes(id)) return; const origin = draft.find((p) => p.id === id)?.stage; if (!origin) return; setOrigins((v) => ({ ...v, [id]: origin })); push(draft.filter((p) => p.id !== id), [...sharedRef.current, id]); setSharedOpen(true); }, [draft, push]);
  useEffect(() => {
    if (!touchDragId || touchPointerId == null || touchStartX == null || touchStartY == null) return;
    const id = touchDragId, pointerId = touchPointerId, startX = touchStartX, startY = touchStartY;
    let active = false;
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (event.cancelable) event.preventDefault();
      if (!active && Math.hypot(event.clientX - startX, event.clientY - startY) > 6) {
        active = true;
        setSharedOpen(false);
        document.body.classList.add("crm-card-dragging");
      }
      if (active) setSharedTouchDrag((current) => current?.id === id ? { ...current, x: event.clientX, y: event.clientY, active: true, target: sharedStageAt(event.clientX, event.clientY) } : current);
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const target = active && event.type === "pointerup" ? sharedStageAt(event.clientX, event.clientY) : null;
      if (target) move([id], target);
      else if (active) setSharedOpen(true);
      document.body.classList.remove("crm-card-dragging");
      setSharedTouchDrag(null);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.body.classList.remove("crm-card-dragging");
    };
  }, [touchDragId, touchPointerId, touchStartX, touchStartY, move]);
  function startSharedTouchDrag(event: React.PointerEvent, id: string, name: string) {
    if (event.pointerType === "mouse" || event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.closest(".crm-shared-card")?.getBoundingClientRect();
    if (!rect) return;
    setSharedTouchDrag({ id, name, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, active: false, target: null });
  }
  const undo = useCallback(() => { if (!history.length) return; setFuture((f) => [{ board: draft, shared }, ...f]); const previous = history[history.length - 1]; setDraft(previous.board); setShared(previous.shared); sharedRef.current = previous.shared; setHistory((h) => h.slice(0, -1)); }, [draft, shared, history]);
  const redo = useCallback(() => { if (!future.length) return; setHistory((h) => [...h, { board: draft, shared }]); setDraft(future[0].board); setShared(future[0].shared); sharedRef.current = future[0].shared; setFuture((f) => f.slice(1)); }, [draft, shared, future]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return; if (!(e.ctrlKey || e.metaKey)) return; if (e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } else if (e.key.toLowerCase() === "y") { e.preventDefault(); redo(); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [undo, redo]);
  const changed = useMemo(() => { const base = new Map(baseline.map((p) => [p.id, p])); return normalize(draft).filter((p) => { const old = base.get(p.id); return !old || old.stage !== p.stage || old.sort_order !== p.sort_order; }); }, [baseline, draft]);
  const movedCount = changed.filter((p) => baseline.find((b) => b.id === p.id)?.stage !== p.stage).length;
  async function saveBoard() { if (shared.length) { setError("Place every card from the Shared Panel into a destination stage before saving."); setSharedOpen(true); setSaveOpen(false); return; } if (!changed.length) { setSaveOpen(false); return; } setSaving(true); setError(""); const payload = changed.map((p) => ({ ...p, board_updated_at: clients.find((c) => c.id === p.id)?.board_updated_at })); const result = await supabase.rpc("save_client_board", { p_changes: payload }); setSaving(false); if (result.error) { setError(result.error.message); return; } setSaveOpen(false); notify("Client changes saved"); await load(true); if (navigationAfterSave.current && blocker.state === "blocked") { navigationAfterSave.current = false; blocker.proceed(); } }
  function discard() { setDraft(baseline); setShared([]); sharedRef.current = []; setHistory([]); setFuture([]); setSelected([]); setDiscardOpen(false); if (blocker.state === "blocked") blocker.proceed(); }
  const visible = useMemo(() => clients.filter((c) => { const place = draft.find((p) => p.id === c.id); if (!place || tabOf(place.stage) !== tab) return false; const term = search.trim().toLowerCase(); if (term && ![c.name, c.email, c.mobile, c.company, ...projects.filter((p) => p.client_id === c.id).map((p) => p.name)].some((v) => v?.toLowerCase().includes(term))) return false; const cats = getCategoriesForClient(c.id); if (uncategorized && cats.length) return false; if (categoryIds.length && !categoryIds.some((id) => cats.some((cat) => cat.id === id))) return false; return true; }), [clients, draft, tab, search, projects, getCategoriesForClient, categoryIds, uncategorized]);
  const columns: KanbanColumn[] = TABS[tab].map((stage) => ({ id: stage.id, name: stage.name, tasks: normalize(draft).filter((p) => p.stage === stage.id).map((p) => visible.find((c) => c.id === p.id)).filter((c): c is Client => !!c).map((c) => { const count = projects.filter((p) => p.client_id === c.id).length; const followUp = c.follow_up_at && !c.follow_up_completed ? new Date(c.follow_up_at) : null; return { id: c.id, title: c.name, contact: c.email || c.mobile || c.company || undefined, projects: count ? `${count} project${count === 1 ? "" : "s"}` : undefined, industry: getCategoriesForClient(c.id)[0]?.name, followUp: followUp ? `Follow up ${followUp.toLocaleDateString()}` : undefined, followUpDue: !!followUp && followUp.getTime() < Date.now() + 86400000 }; }) }));
  function boardChanged(next: KanbanColumn[]) { const ids = new Set(next.flatMap((col) => col.tasks.map((t) => t.id))); push([...draft.filter((p) => !ids.has(p.id)), ...next.flatMap((col) => col.tasks.map((task, i) => ({ id: task.id, stage: col.id as Stage, sort_order: i })))]); }
  function cardClick(id: string, e: React.MouseEvent) { if (multi || e.ctrlKey || e.metaKey) setSelected((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]); else setDetailId(id); }
  function swipeStage(direction: number) { const stages = TABS[tab]; const index = stages.findIndex((s) => s.id === mobileStage); setMobileStage(stages[Math.max(0, Math.min(2, index + direction))].id); }
  if (loading) return <ClientsWorkspaceSkeleton view={view} tab={tab} />;
  const detail = clients.find((c) => c.id === detailId) || null;
  const headerActions = document.getElementById("clients-header-actions");
  return <div className="page crm-page">
    {headerActions && createPortal(<><button className="crm-button crm-button--subtle" onClick={() => setNewOpen(true)}><Plus size={16}/> New Client</button><button className={`crm-button crm-button--save ${dirty ? "is-dirty" : ""}`} disabled={!dirty || saving} onClick={() => setSaveOpen(true)}>{dirty && <span className="crm-unsaved-dot"/>}Save Changes</button></>, headerActions)}
    <div className="crm-overview-row"><div className="crm-tabs"><PillNav className="crm-pill-tabs" items={[{ label: `Clients ${draft.filter((p) => tabOf(p.stage) === "clients").length}` }, { label: `Pipeline ${draft.filter((p) => tabOf(p.stage) === "pipeline").length}` }]} selectedIndex={tab === "clients" ? 0 : 1} onItemClick={(_, index) => setTab(index === 0 ? "clients" : "pipeline")} theme="light" size="md" layout="joined" surface="glass" itemStyle="plain" hoverEffect="glide" indicator="pill" collapse="never" intro ariaLabel="Client workspace" /></div><div className="crm-stats"><span><strong><AnimatedMetricValue value={draft.length + shared.length}/></strong> Total clients</span><span><strong><AnimatedMetricValue value={draft.filter((p) => p.stage === "active").length}/></strong> Active</span><span><strong><AnimatedMetricValue value={draft.filter((p) => tabOf(p.stage) === "pipeline").length}/></strong> Pipeline prospects</span></div></div>
    <div className="crm-controls"><Seek width={280} height={38} ariaLabel="Search clients" placeholder="Search clients or projects" value={search} onChange={setSearch}/><CategoryFilter categories={categories} selected={categoryIds} onChange={(ids) => { setCategoryIds(ids); setUncategorized(false); }}/><label className="crm-check"><input type="checkbox" checked={uncategorized} onChange={(e) => { setUncategorized(e.target.checked); setCategoryIds([]); }}/> Uncategorized</label><label className="crm-check"><input type="checkbox" checked={multi} onChange={(e) => { setMulti(e.target.checked); setSelected([]); }}/> Select Multiple</label><RubberSegment className="crm-rubber-view" aria-label="Client view" items={[{ value: "kanban", label: <span className="rubber-segment__sr-only">Kanban view</span>, icon: <LayoutGrid size={16}/> }, { value: "list", label: <span className="rubber-segment__sr-only">List view</span>, icon: <List size={16}/> }]} value={view} onChange={value => setView(value as typeof view)} trackColor="#f1effb" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" size="md" /></div>
    <div className="crm-utility"><button disabled={!history.length} onClick={undo}><CornerUpLeft size={15}/> Undo</button><button disabled={!future.length} onClick={redo}><CornerUpRight size={15}/> Redo</button><button disabled={!dirty} onClick={() => setDiscardOpen(true)}>Discard</button><button className={shared.length ? "has-shared" : ""} onClick={() => setSharedOpen(true)}>Shared Panel {shared.length ? `(${shared.length})` : ""}<ArrowRight size={14}/></button></div>
    {selected.length > 0 && <div className="crm-bulk"><strong>{selected.length} selected</strong><select aria-label="Move selected clients" defaultValue="" onChange={(e) => { if (e.target.value) move(selected, e.target.value as Stage); e.target.value = ""; }}><option value="">Move to stage…</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button onClick={() => move(selected, "archived")}>Archive</button><button onClick={() => setSelected([])}>Clear</button></div>}
    {error && <div className="crm-alert" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15}/></button></div>}
    <DashboardContentTransition transitionKey={`${tab}-${view}`}>
    {view === "kanban" ? <><div className="crm-mobile-stage"><button aria-label="Previous stage" onClick={() => swipeStage(-1)}><ArrowLeft size={16}/></button><span>{stageName(mobileStage)}</span><button aria-label="Next stage" onClick={() => swipeStage(1)}><ArrowRight size={16}/></button></div><div onTouchStart={(e) => { swipeStart.current = (e.target as Element).closest("[data-kanban-card]") ? null : e.touches[0].clientX; }} onTouchEnd={(e) => { if (swipeStart.current == null) return; const delta = e.changedTouches[0].clientX - swipeStart.current; if (Math.abs(delta) > 70) swipeStage(delta < 0 ? 1 : -1); swipeStart.current = null; }} onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-crm-client")) e.preventDefault(); }} onDrop={(e) => { const id = e.dataTransfer.getData("application/x-crm-client"); const col = (e.target as Element).closest("[data-kanban-column]") as HTMLElement | null; if (id && col) { e.preventDefault(); move([id], col.dataset.kanbanColumn as Stage); } }}><KanbanBoard key={tab} columns={columns} onChange={boardChanged} onCardClick={cardClick} onTransfer={transfer} onEdgeChange={setEdgeOpen} selectedIds={selected} mobileColumnId={mobileStage} externalDropStage={sharedTouchDrag?.active ? sharedTouchDrag.target : null} className="crm-board" label={`${tab} board`}/></div></> : <div className="crm-list"><div className="crm-list-head" role="row"><span>Client</span><span>Email</span><span>Phone</span><span>Industry</span><span>Projects</span><span>Stage</span></div>{normalize(draft).filter((p) => visible.some((c) => c.id === p.id)).map((p) => { const c = clients.find((item) => item.id === p.id)!; const count = projects.filter((project) => project.client_id === c.id).length; return <div className={`crm-list-row stage-${p.stage}`} key={c.id}><button onClick={(e) => cardClick(c.id, e)}><span className={`crm-avatar tone-${tone(c.name)}`}>{c.name.charAt(0).toUpperCase()}</span><strong>{c.name}</strong></button><span>{c.email || "—"}</span><span>{c.mobile || "—"}</span><span className="crm-list-industry">{getCategoriesForClient(c.id)[0]?.name || "Uncategorized"}</span><span className="crm-list-projects">{count} project{count === 1 ? "" : "s"}</span><select aria-label={`Move ${c.name}`} value={p.stage} onChange={(e) => move([c.id], e.target.value as Stage)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>; })}{visible.length === 0 && <div className="crm-empty">No clients match this view.</div>}</div>}
    </DashboardContentTransition>
    <div className={`crm-shared-hotspot ${edgeOpen || sharedOpen ? "is-inactive" : ""}`} aria-hidden="true" onPointerEnter={() => { if (!edgeOpen) setSharedOpen(true); }}/>
    <AnimatePresence>{(edgeOpen || sharedOpen) && <motion.aside initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 340, opacity: 0 }} transition={{ type: "spring", stiffness: 360, damping: 34 }} className={`crm-shared ${edgeOpen ? "is-target" : ""}`} aria-label="Shared Panel" onPointerLeave={() => { if (!edgeOpen && !sharedTouchDrag) setSharedOpen(false); }}><div className="crm-shared-head"><h2>Shared Panel</h2><button onClick={() => setSharedOpen(false)} aria-label="Close Shared Panel"><X size={18}/></button></div><p>Move a card here, switch tabs, then place it in a destination stage. Transfers remain unsaved until you confirm.</p>{shared.length === 0 ? <div className="crm-shared-empty">Drag a card to the right edge or use Move To in its details.</div> : shared.map((id) => { const c = clients.find((item) => item.id === id); return c && <div className="crm-shared-card" key={id} draggable={!window.matchMedia("(pointer: coarse)").matches} onDragStart={(e) => e.dataTransfer.setData("application/x-crm-client", id)}><div className="crm-shared-card__grab" onPointerDown={(event) => startSharedTouchDrag(event, id, c.name)}><strong>{c.name}</strong><small>From {stageName(origins[id] || c.relationship_stage)}</small></div><select aria-label={`Destination for ${c.name}`} defaultValue="" onChange={(e) => { if (e.target.value) move([id], e.target.value as Stage); }}><option value="">Place in stage…</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button onClick={() => move([id], origins[id] || c.relationship_stage)}>Return to original stage</button></div>; })}</motion.aside>}</AnimatePresence>
    {sharedTouchDrag?.active && <><div className="crm-shared-drop-dock" aria-label="Drop client into a stage">{STAGES.map((stage) => <div key={stage.id} data-shared-stage={stage.id} className={`crm-shared-drop-stage ${sharedTouchDrag.target === stage.id ? "is-target" : ""}`}>{stage.name}</div>)}</div><div className="crm-shared-touch-ghost" style={{ left: sharedTouchDrag.x - sharedTouchDrag.offsetX, top: sharedTouchDrag.y - sharedTouchDrag.offsetY, width: sharedTouchDrag.width }} aria-hidden="true"><strong>{sharedTouchDrag.name}</strong><small>Drop onto a column or stage below</small></div></>}
    {createPortal(<div className="app-toast-viewport" aria-label="Notifications"><AnimatePresence initial={false}>{toast && <SwipeToast key={`notice-${toastSequence}`} kind="success" message={toast} onClose={() => setToast("")} />}</AnimatePresence></div>, document.body)}
    <Modal isOpen={saveOpen} onClose={() => setSaveOpen(false)} title="Save client changes?"><div className="crm-dialog"><p>You have {changed.length} unsaved changes across Clients and Pipeline.</p><ul><li>{movedCount} clients moved to different stages</li><li>{Math.max(0, changed.length - movedCount)} clients reordered</li></ul>{shared.length > 0 && <p className="crm-inline-error">Place all cards from the Shared Panel first.</p>}<div className="crm-dialog-actions"><button className="crm-button crm-button--subtle" onClick={() => setSaveOpen(false)}>Cancel</button><button className="crm-button crm-button--confirm" onClick={saveBoard} disabled={saving || !!shared.length}>{saving ? "Saving…" : "Confirm & Save"}</button></div></div></Modal>
    <Modal isOpen={discardOpen} onClose={() => setDiscardOpen(false)} title="Discard client changes?"><div className="crm-dialog"><p>All unsaved stage changes and transfers will return to their last saved positions.</p><div className="crm-dialog-actions"><button className="crm-button crm-button--subtle" onClick={() => setDiscardOpen(false)}>Keep editing</button><button className="crm-button crm-button--danger" onClick={discard}>Discard Changes</button></div></div></Modal>
    <Modal isOpen={blocker.state === "blocked"} onClose={() => blocker.reset?.()} title="You have unsaved changes"><div className="crm-dialog"><p>Your client placements have not been saved yet.</p><div className="crm-dialog-actions"><button className="crm-button crm-button--subtle" onClick={() => blocker.reset?.()}>Stay Here</button><button className="crm-button crm-button--danger" onClick={discard}>Discard Changes</button><button className="crm-button crm-button--confirm" onClick={() => { navigationAfterSave.current = true; setSaveOpen(true); }}>Save Changes</button></div></div></Modal>
    <ClientWorkspaceEditor key={detailId || (newOpen ? `new-${tab}` : "closed")} client={detail} isOpen={!!detailId || newOpen} onClose={() => { setDetailId(null); setNewOpen(false); }} userId={user?.id || ""} categories={categories} initialCategoryIds={detail ? getCategoriesForClient(detail.id).map((cat) => cat.id) : []} saveAssignments={saveAssignmentsForClient} projects={projects} stage={detail ? draft.find((p) => p.id === detail.id)?.stage || detail.relationship_stage : tab === "clients" ? "active" : "lead"} onMove={(stage) => { if (detail) move([detail.id], stage); }} onTransfer={() => { if (detail) transfer(detail.id); }} onSaved={async (created, id, stage) => { await load(!dirty); if (created && dirty) { const added = { id, stage, sort_order: 9999 }; setDraft((rows) => normalize([...rows, added])); setBaseline((rows) => normalize([...rows, added])); } notify(created ? "Client created" : "Client updated"); setDetailId(null); setNewOpen(false); }}/>
  </div>;
}
