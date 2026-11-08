import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Goal, GoalStatus } from "../lib/goals";

const stages: GoalStatus[] = ["not_started", "in_progress", "completed"];
const names: Record<GoalStatus, string> = { not_started: "Not started", in_progress: "In progress", completed: "Completed" };
const spring = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;
type Slot = { status: GoalStatus; index: number };
type Drag = { goal: Goal; width: number; height: number; offsetX: number; offsetY: number };

export default function GoalsBoard({ goals, renderCard, onStatus, onMove: onBoardMove }: {
  goals: Goal[];
  renderCard: (goal: Goal) => ReactNode;
  onStatus: (goal: Goal, status: GoalStatus) => void;
  onMove: (goal: Goal, status: GoalStatus, index: number, orderedIds: string[]) => void;
}) {
  const ordered = goals;
  const [drag, setDrag] = useState<Drag | null>(null);
  const [active, setActive] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const slotRef = useRef<Slot | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const suppressClick = useRef(false);
  const columns = useRef(new Map<GoalStatus, HTMLDivElement>());
  const lists = useRef(new Map<GoalStatus, HTMLDivElement>());
  const midpoints = useRef(new Map<GoalStatus, number[]>());
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const reducedMotion = useReducedMotion();

  const begin = (event: PointerEvent<HTMLDivElement>, goal: Goal, status: GoalStatus) => {
    if (event.button !== 0 || (event.target as Element).closest("select, option, footer button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const state = { goal, width: rect.width, height: rect.height, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    const snapshot = new Map<GoalStatus, number[]>();
    lists.current.forEach((list, stage) => {
      const top = list.getBoundingClientRect().top;
      let removed = -1;
      let removedHeight = 0;
      const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-goal-card]")).map((element, index) => {
        const box = element.getBoundingClientRect();
        if (element.dataset.goalCard === goal.id) { removed = index; removedHeight = box.height + 10; }
        return { top: box.top - top, height: box.height, id: element.dataset.goalCard };
      });
      snapshot.set(stage, rows.filter(row => row.id !== goal.id).map((row, index) => row.top - (stage === status && removed >= 0 && index >= removed ? removedHeight : 0) + row.height / 2));
    });
    midpoints.current = snapshot;
    startRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    x.set(rect.left);
    y.set(rect.top);
    dragRef.current = state;
    slotRef.current = { status, index: ordered.filter(item => item.status === status).findIndex(item => item.id === goal.id) };
    setDrag(state);
    setSlot(slotRef.current);
  };

  useEffect(() => {
    if (!drag) return;
    const findSlot = (clientX: number, clientY: number, goal: Goal): Slot | null => {
      let nearest: GoalStatus | null = null;
      let distance = Infinity;
      columns.current.forEach((column, status) => {
        if (goal.recurrence && status === "completed") return;
        const rect = column.getBoundingClientRect();
        const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
        if (dx < distance) { nearest = status; distance = dx; }
      });
      if (!nearest) return null;
      const stage: GoalStatus = nearest;
      const list = lists.current.get(stage);
      const top = list?.getBoundingClientRect().top ?? 0;
      const mids = midpoints.current.get(stage) ?? [];
      const index = mids.findIndex(mid => clientY < top + mid);
      return { status: stage, index: index < 0 ? mids.length : index };
    };
    const onMove = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      if (!movedRef.current && Math.abs(event.clientX - startRef.current.x) + Math.abs(event.clientY - startRef.current.y) > 5) { movedRef.current = true; setActive(true); }
      if (!movedRef.current) return;
      event.preventDefault();
      x.set(event.clientX - current.offsetX);
      y.set(event.clientY - current.offsetY);
      const next = findSlot(event.clientX, event.clientY, current.goal);
      if (next && (next.status !== slotRef.current?.status || next.index !== slotRef.current.index)) { slotRef.current = next; setSlot(next); }
    };
    const finish = () => {
      const current = dragRef.current;
      const destination = slotRef.current;
      if (current && destination && movedRef.current) {
        const source = ordered.filter(goal => goal.id !== current.goal.id);
        const next = [...source];
        const stageIds = next.filter(goal => goal.status === destination.status).map(goal => goal.id);
        const insertBefore = stageIds[destination.index];
        const position = insertBefore ? next.findIndex(goal => goal.id === insertBefore) : (() => { let last = -1; next.forEach((goal, index) => { if (goal.status === destination.status) last = index; }); return last < 0 ? next.length : last + 1; })();
        next.splice(position, 0, { ...current.goal, status: destination.status });
        onBoardMove(current.goal, destination.status, destination.index, next.map(goal => goal.id));
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }
      dragRef.current = null;
      slotRef.current = null;
      setDrag(null);
      setActive(false);
      setSlot(null);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [drag, onBoardMove, ordered, x, y]);

  const blockClick = (event: MouseEvent) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } };

  return <div className="goals-board" role="group" aria-label="Goals board" onClickCapture={blockClick}>
    <LayoutGroup>
      {stages.map(status => {
        const items = ordered.filter(goal => goal.status === status);
        const visible = items.filter(goal => !active || goal.id !== drag?.goal.id);
        const target = active && slot?.status === status;
        const placeholder = <motion.div key="placeholder" layout aria-hidden="true" className="goals-board__placeholder" initial={{ opacity: 0, scaleY: 0.8 }} animate={{ opacity: 1, scaleY: 1 }} transition={reducedMotion ? { duration: 0 } : spring} style={{ height: drag?.height }} />;
        return <div key={status} ref={element => { if (element) columns.current.set(status, element); else columns.current.delete(status); }} className={target ? "goals-board__column is-target" : "goals-board__column"}>
          <h4>{names[status]} <span>{items.length - (active && drag?.goal.status === status ? 1 : 0) + (target ? 1 : 0)}</span></h4>
          <div ref={element => { if (element) lists.current.set(status, element); else lists.current.delete(status); }} className="goals-board__list">
            {visible.map((goal, index) => <div key={goal.id}>
              {target && slot.index === index && placeholder}
              <motion.div layout data-goal-card={goal.id} className="goals-board__item" transition={reducedMotion ? { duration: 0 } : spring} onPointerDown={event => begin(event, goal, status)}>{renderCard(goal)}<select value={goal.status} aria-label={`Move ${goal.title}`} onChange={event => onStatus(goal, event.target.value as GoalStatus)}><option value="not_started">Not started</option><option value="in_progress">In progress</option>{!goal.recurrence && <option value="completed">Completed</option>}</select></motion.div>
            </div>)}
            {target && slot.index >= visible.length && placeholder}
          </div>
        </div>;
      })}
    </LayoutGroup>
    {createPortal(<AnimatePresence>{active && drag && <motion.div className="goals-board__floating" style={{ x, y, width: drag.width }} initial={{ scale: 1, rotate: 0 }} animate={{ scale: reducedMotion ? 1 : 1.03, rotate: reducedMotion ? 0 : 1.6 }} exit={{ opacity: 0, scale: 1 }} transition={spring}>{renderCard(drag.goal)}</motion.div>}</AnimatePresence>, document.body)}
  </div>;
}
