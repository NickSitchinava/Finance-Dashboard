"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion } from "motion/react";
import { CalendarClock, FolderKanban, GripVertical } from "lucide-react";

/* ==========================================================================
   KanbanBoard

   A horizontally scrolling board of columns you can drag cards between.

   The drag is built on raw pointer events rather than a drag-and-drop
   library, so the whole gesture is ours to shape: the card lifts out of the
   list into an overlay that tracks the cursor, the gap it left collapses,
   a gap springs open wherever it would land, and every other card slides
   into its new place instead of jumping there.

   The insert position is worked out in a coordinate space that pretends the
   placeholder is not there. Without that the placeholder pushes cards past
   the pointer, which flips the decision back, which moves the placeholder,
   which flips it again. The card would sit and flicker between two slots.

   Everything also works from the keyboard: focus a card, press space to pick
   it up, move it with the arrow keys, space again to drop, escape to put it
   back. Each move is announced to screen readers.
   ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Vertical space between cards, in px. Needed in maths, not just in CSS. */
const GAP = 8;

const LIFT_SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
const FLOW_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;

export interface KanbanTask {
  id: string;
  title: string;
  contact?: string;
  projects?: string;
  industry?: string;
  followUp?: string;
  followUpDue?: boolean;
}

export interface KanbanColumn {
  id: string;
  name: string;
  tasks: KanbanTask[];
}

export interface KanbanBoardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag" | "onChange"
  > {
  columns: KanbanColumn[];
  /** Fires after every move with the whole board. */
  onChange?: (columns: KanbanColumn[]) => void;
  onCardClick?: (id: string, event: React.MouseEvent) => void;
  onTransfer?: (id: string) => void;
  onEdgeChange?: (open: boolean) => void;
  selectedIds?: string[];
  mobileColumnId?: string;
  externalDropStage?: string | null;
  /** Accessible name for the scrolling region. */
  label?: string;
}

type DragState = {
  taskId: string;
  fromCol: string;
  width: number;
  height: number;
  /** Where inside the card the pointer grabbed it. */
  offsetX: number;
  offsetY: number;
};

type Slot = { col: string; index: number };

export const KanbanBoard = React.forwardRef<HTMLDivElement, KanbanBoardProps>(
  function KanbanBoard(
    { columns, onChange, onCardClick, onTransfer, onEdgeChange, selectedIds = [], mobileColumnId, externalDropStage, label = "Client board", className, style, ...props },
    ref,
  ) {
    const [cols, setCols] = React.useState<KanbanColumn[]>(columns);
    const [drag, setDrag] = React.useState<DragState | null>(null);
    const [slot, setSlot] = React.useState<Slot | null>(null);
    const [grabbed, setGrabbed] = React.useState<string | null>(null);
    const [announcement, setAnnouncement] = React.useState("");
    const reduceMotion = useReducedMotion();

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const trackRef = React.useRef<HTMLDivElement>(null);
    const listRefs = React.useRef(new Map<string, HTMLDivElement>());
    const colRefs = React.useRef(new Map<string, HTMLDivElement>());
    const cardRefs = React.useRef(new Map<string, HTMLDivElement>());
    const dragRef = React.useRef<DragState | null>(null);
    const slotRef = React.useRef<Slot | null>(null);
    const autoScroll = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);
    const movedRef = React.useRef(false);
    const edgeRef = React.useRef(false);
    const pointerRef = React.useRef({ x: 0, y: 0 });
    const modifierRef = React.useRef({ ctrlKey: false, metaKey: false });

    React.useEffect(() => setCols(columns), [columns]);

    /*
      A keyboard move re-mounts the card inside another column, which drops
      focus on the floor and swallows every key after the first. Put it back
      on the card that is still being carried.
    */
    React.useEffect(() => {
      if (!grabbed) return;
      const el = cardRefs.current.get(grabbed);
      if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    }, [cols, grabbed]);

    /* ---------------------------------------------------------------- move */

    const locate = React.useCallback(
      (list: KanbanColumn[], taskId: string) => {
        for (const c of list) {
          const i = c.tasks.findIndex((t) => t.id === taskId);
          if (i > -1) return { col: c.id, index: i, task: c.tasks[i] };
        }
        return null;
      },
      [],
    );

    const move = React.useCallback(
      (taskId: string, to: Slot) => {
        const found = locate(cols, taskId);
        if (!found || (found.col === to.col && found.index === to.index)) return;
        const next = cols.map((c) => ({ ...c, tasks: [...c.tasks] }));
        const from = next.find((c) => c.id === found.col)!;
        from.tasks.splice(found.index, 1);
        const dest = next.find((c) => c.id === to.col)!;
        dest.tasks.splice(Math.min(to.index, dest.tasks.length), 0, found.task);
        setCols(next);
        onChange?.(next);
      },
      [cols, locate, onChange],
    );

    /* -------------------------------------------------------- hit testing */

    /**
     * Card midpoints per column, measured once at drag start and stored as
     * offsets from the top of each list.
     *
     * Measuring live during the drag looks simpler and is wrong twice over.
     * The cards are mid-spring, so their boxes are somewhere between where
     * they were and where they are going; and the placeholder pushes them
     * past the pointer, which flips the decision, which moves the
     * placeholder, which flips it back. A snapshot of the layout without
     * the dragged card in it has neither problem.
     */
    const snapRef = React.useRef(new Map<string, number[]>());

    const snapshot = React.useCallback((taskId: string, fromCol: string) => {
      const map = new Map<string, number[]>();
      listRefs.current.forEach((list, colId) => {
        const listTop = list.getBoundingClientRect().top;
        const cards = Array.from(list.querySelectorAll<HTMLElement>("[data-kanban-card]"));
        let removed = -1;
        let removedH = 0;
        const rows = cards.map((el, i) => {
          const r = el.getBoundingClientRect();
          const isDragged = colId === fromCol && el.dataset.kanbanCard === taskId;
          if (isDragged) {
            removed = i;
            removedH = r.height;
          }
          return { top: r.top - listTop, h: r.height, isDragged };
        });
        const mids = rows
          .filter((row) => !row.isDragged)
          .map((row, i) => {
            // close the gap the dragged card leaves behind
            const shift = removed > -1 && i >= removed ? removedH + GAP : 0;
            return row.top - shift + row.h / 2;
          });
        map.set(colId, mids);
      });
      snapRef.current = map;
    }, []);

    /** Which slot is the pointer over? */
    const slotAt = React.useCallback((clientX: number, clientY: number): Slot | null => {
      const d = dragRef.current;
      if (!d) return null;

      let inside = "";
      let nearestId = "";
      let nearest = Infinity;
      colRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right) inside = id;
        const dx = Math.abs(clientX - (r.left + r.width / 2));
        if (dx < nearest) {
          nearest = dx;
          nearestId = id;
        }
      });
      const colId = inside || nearestId;
      if (!colId) return null;

      const list = listRefs.current.get(colId);
      if (!list) return { col: colId, index: 0 };

      const listTop = list.getBoundingClientRect().top;
      const mids = snapRef.current.get(colId) ?? [];

      let index = mids.length;
      for (let i = 0; i < mids.length; i++) {
        if (clientY < listTop + mids[i]) {
          index = i;
          break;
        }
      }
      return { col: colId, index };
    }, []);

    /* ------------------------------------------------------ pointer drag */

    const endDrag = React.useCallback(() => {
      const d = dragRef.current;
      const s = slotRef.current;
      if (d && movedRef.current && edgeRef.current && onTransfer) onTransfer(d.taskId);
      else if (d && movedRef.current && s) move(d.taskId, s);
      else if (d) onCardClick?.(d.taskId, modifierRef.current as React.MouseEvent);
      dragRef.current = null;
      slotRef.current = null;
      autoScroll.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setDrag(null);
      setSlot(null);
      edgeRef.current = false;
      onEdgeChange?.(false);
    }, [move, onTransfer, onCardClick, onEdgeChange]);

    React.useEffect(() => {
      if (!drag) return;
      document.body.classList.add("crm-card-dragging");

      const onMove = (e: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        if (e.cancelable) e.preventDefault();
        if (Math.abs(e.clientX - pointerRef.current.x) + Math.abs(e.clientY - pointerRef.current.y) > 5) movedRef.current = true;
        const panelRect = document.querySelector<HTMLElement>(".crm-shared")?.getBoundingClientRect();
        const overPanel = !!panelRect && e.clientX >= panelRect.left && e.clientX <= panelRect.right && e.clientY >= panelRect.top && e.clientY <= panelRect.bottom;
        const contentRight = trackRef.current?.getBoundingClientRect().right ?? window.innerWidth;
        const atEdge = e.clientX >= contentRight - 86;
        const edge = movedRef.current && (overPanel || atEdge);
        if (edge !== edgeRef.current) { edgeRef.current = edge; onEdgeChange?.(edge); }
        x.set(e.clientX - d.offsetX);
        y.set(e.clientY - d.offsetY);

        const next = slotAt(e.clientX, e.clientY);
        const cur = slotRef.current;
        if (next && (!cur || cur.col !== next.col || cur.index !== next.index)) {
          slotRef.current = next;
          setSlot(next);
        }

        // nudge the track along when you drag near either edge
        const track = trackRef.current;
        if (track) {
          const r = track.getBoundingClientRect();
          const edge = 72;
          autoScroll.current =
            e.clientX < r.left + edge ? -14 : e.clientX > r.right - edge ? 14 : 0;
        }
      };

      const onUp = () => endDrag();

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      const tick = () => {
        if (autoScroll.current && trackRef.current) {
          trackRef.current.scrollLeft += autoScroll.current;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        document.body.classList.remove("crm-card-dragging");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [drag, endDrag, slotAt, x, y, onEdgeChange]);

    const startDrag = (e: React.PointerEvent, task: KanbanTask, colId: string, index: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const state: DragState = {
        taskId: task.id,
        fromCol: colId,
        width: r.width,
        height: r.height,
        offsetX: e.clientX - r.left,
        offsetY: e.clientY - r.top,
      };
      movedRef.current = false;
      pointerRef.current = { x: e.clientX, y: e.clientY };
      modifierRef.current = { ctrlKey: e.ctrlKey, metaKey: e.metaKey };
      x.set(r.left);
      y.set(r.top);
      snapshot(task.id, colId);
      dragRef.current = state;
      slotRef.current = { col: colId, index };
      setDrag(state);
      setSlot({ col: colId, index });
      setGrabbed(null);
    };

    /* ---------------------------------------------------------- keyboard */

    const originRef = React.useRef<Slot | null>(null);

    const onCardKeyDown = (e: React.KeyboardEvent, task: KanbanTask) => {
      const isGrabbed = grabbed === task.id;

      if (e.key === "Enter" && !isGrabbed) {
        e.preventDefault();
        onCardClick?.(task.id, e as unknown as React.MouseEvent);
        return;
      }

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (isGrabbed) {
          setGrabbed(null);
          const at = locate(cols, task.id);
          setAnnouncement(
            at ? `Dropped ${task.title} in ${colName(cols, at.col)}, position ${at.index + 1}.` : "",
          );
        } else {
          const at = locate(cols, task.id);
          originRef.current = at ? { col: at.col, index: at.index } : null;
          setGrabbed(task.id);
          setAnnouncement(`Picked up ${task.title}. Use the arrow keys to move it.`);
        }
        return;
      }

      if (e.key === "Escape" && isGrabbed) {
        e.preventDefault();
        if (originRef.current) move(task.id, originRef.current);
        setGrabbed(null);
        setAnnouncement(`Cancelled. ${task.title} is back where it started.`);
        return;
      }

      if (!isGrabbed) return;
      const at = locate(cols, task.id);
      if (!at) return;
      const colIndex = cols.findIndex((c) => c.id === at.col);

      let to: Slot | null = null;
      if (e.key === "ArrowUp") to = { col: at.col, index: Math.max(0, at.index - 1) };
      if (e.key === "ArrowDown")
        to = { col: at.col, index: Math.min(cols[colIndex].tasks.length - 1, at.index + 1) };
      if (e.key === "ArrowLeft" && colIndex > 0)
        to = { col: cols[colIndex - 1].id, index: Math.min(at.index, cols[colIndex - 1].tasks.length) };
      if (e.key === "ArrowRight" && colIndex < cols.length - 1)
        to = { col: cols[colIndex + 1].id, index: Math.min(at.index, cols[colIndex + 1].tasks.length) };

      if (to) {
        e.preventDefault();
        move(task.id, to);
        setAnnouncement(
          `${task.title} moved to ${colName(cols, to.col)}, position ${to.index + 1}.`,
        );
      }
    };

    /* ------------------------------------------------------------ render */

    const dragged = drag ? locate(cols, drag.taskId) : null;

    return (
      <div
        ref={ref}
        style={style}
        className={cn("crm-kanban", className)}
        {...props}
      >
        <div
          ref={trackRef}
          role="group"
          aria-label={label}
          className="crm-kanban__track"
        >
          <LayoutGroup>
            {cols.map((col) => {
              const isTarget = slot?.col === col.id && !!drag;
              const isExternalTarget = externalDropStage === col.id;
              return (
                <div
                  key={col.id}
                  data-kanban-column={col.id}
                  ref={(el) => {
                    if (el) colRefs.current.set(col.id, el);
                    else colRefs.current.delete(col.id);
                  }}
                  className={cn("crm-kanban__column", mobileColumnId && mobileColumnId !== col.id && "crm-mobile-other-column", (isTarget || isExternalTarget) && "is-target")}
                >
                  <ColumnHeader
                    col={col}
                    /* while a card is in the air the counts show where it
                       would land, not where it came from */
                    count={
                      col.tasks.length -
                      (drag && drag.fromCol === col.id ? 1 : 0) +
                      (drag && slot?.col === col.id ? 1 : 0) +
                      (isExternalTarget ? 1 : 0)
                    }
                  />

                  <div
                    ref={(el) => {
                      if (el) listRefs.current.set(col.id, el);
                      else listRefs.current.delete(col.id);
                    }}
                    className="crm-kanban__list"
                  >
                    {/*
                      The card in the air is taken out of the list, so the
                      placeholder has to be placed against the list without
                      it. Measuring in one index space and rendering in the
                      other is what makes same-column reordering quietly do
                      nothing.
                    */}
                    {col.tasks
                      .filter((t) => t.id !== drag?.taskId)
                      .map((task, i) => {
                      return (
                        <React.Fragment key={task.id}>
                          {isTarget && slot!.index === i && (
                            <Placeholder height={drag!.height} />
                          )}
                          {(
                            <Card
                              task={task}
                              grabbed={grabbed === task.id}
                              reduceMotion={!!reduceMotion}
                              elRef={(el) => {
                                if (el) cardRefs.current.set(task.id, el);
                                else cardRefs.current.delete(task.id);
                              }}
                              onPointerDown={(e) => startDrag(e, task, col.id, i)}
                              onKeyDown={(e) => onCardKeyDown(e, task)}
                              selected={selectedIds.includes(task.id)}
                              onClick={(e) => {
                                if (!movedRef.current) onCardClick?.(task.id, e);
                              }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                    {isTarget &&
                      slot!.index >=
                        col.tasks.filter((t) => t.id !== drag?.taskId).length && (
                        <Placeholder height={drag!.height} />
                      )}
                    {isExternalTarget && <Placeholder height={96} />}
                  </div>

                  {col.tasks.length === 0 && !isExternalTarget && <div className="crm-kanban__empty"><span>No clients in {col.name.toLowerCase()}</span><small>Move a card here to update its stage.</small></div>}
                </div>
              );
            })}
          </LayoutGroup>
        </div>

        {/* the card riding the cursor */}
        <AnimatePresence>
          {drag && dragged && (
            <motion.div
              style={{ x, y, width: drag.width }}
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: reduceMotion ? 1 : 1.03, rotate: reduceMotion ? 0 : 1.6 }}
              exit={{ scale: 1, rotate: 0, opacity: 0 }}
              transition={LIFT_SPRING}
              className="crm-kanban__floating"
            >
              <CardShell task={dragged.task} floating />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    );
  },
);

function colName(cols: KanbanColumn[], id: string) {
  return cols.find((c) => c.id === id)?.name ?? id;
}

/* The page owns the CRM presentation. The pointer and keyboard move mechanics above
   retain the supplied lift, insertion math, and spring displacement. */
function ColumnHeader({ col, count }: { col: KanbanColumn; count: number }) {
  return <div className="crm-kanban__column-head">
    <div className="crm-kanban__column-title"><h3>{col.name}</h3><span aria-label={`${count} clients`}>{count}</span></div>
    <p>{col.id === "active" ? "Current relationships" : col.id === "completed" ? "Work finished, ready to reconnect" : col.id === "archived" ? "Inactive, always recoverable" : col.id === "lead" ? "Identified prospects" : col.id === "contacted" ? "Conversation started" : "Discussing the next step"}</p>
  </div>;
}

function Placeholder({ height }: { height: number }) {
  return <motion.div layout data-kanban-placeholder aria-hidden="true" className="crm-kanban__placeholder"
    initial={{ opacity: 0, scaleY: .8 }} animate={{ opacity: 1, scaleY: 1 }}
    exit={{ opacity: 0, scaleY: .8 }} transition={FLOW_SPRING} style={{ height }} />;
}

function Card({ task, grabbed, reduceMotion, elRef, onPointerDown, onKeyDown, onClick, selected }: {
  task: KanbanTask;
  grabbed: boolean;
  reduceMotion: boolean;
  elRef: (element: HTMLDivElement | null) => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onClick: (event: React.MouseEvent) => void;
  selected: boolean;
}) {
  return <motion.div ref={elRef} layout data-kanban-card={task.id} tabIndex={0} role="button"
    aria-roledescription="Draggable client" aria-grabbed={grabbed}
    aria-label={`${task.title}. Press Enter for details or Space to move.`}
    onPointerDown={onPointerDown} onKeyDown={onKeyDown} onClick={onClick}
    transition={reduceMotion ? { duration: 0 } : FLOW_SPRING}
    whileHover={reduceMotion ? undefined : { y: -2 }}
    className={cn("crm-kanban__card", selected && "is-selected", grabbed && "is-grabbed")}>
    <CardShell task={task} />
  </motion.div>;
}

function CardShell({ task, floating }: { task: KanbanTask; floating?: boolean }) {
  let hash = 0;
  for (const char of task.title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return <div className={cn("crm-kanban__card-shell", floating && "is-floating")}>
    <div className="crm-kanban__identity">
      <span className={`crm-avatar tone-${hash % 5}`} aria-hidden="true">{task.title.trim().charAt(0).toUpperCase() || "?"}</span>
      <span className="crm-kanban__identity-text"><strong>{task.title}</strong><small>{task.contact || "No contact details"}</small></span>
      <GripVertical size={15} aria-hidden="true" className="crm-kanban__grip" />
    </div>
    {(task.projects || task.industry || task.followUp) && <div className="crm-kanban__meta">
      {task.projects && <span className="crm-kanban__project"><FolderKanban size={13} aria-hidden="true" />{task.projects}</span>}
      {task.industry && <span className="crm-kanban__industry">{task.industry}</span>}
      {task.followUp && <span className={cn("crm-kanban__followup", task.followUpDue && "is-due")}><CalendarClock size={13} aria-hidden="true" />{task.followUp}</span>}
    </div>}
  </div>;
}

export default KanbanBoard;
export { KanbanBoard as Component };
