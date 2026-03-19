import "./MilestoneTimeline.css";
import { supabase } from "../../lib/supabase";
import { useState } from "react";

export interface Milestone {
  id: string;
  title: string;
  date: string;
  completed: boolean;
}

interface MilestoneTimelineProps {
  milestones: Milestone[];
  onEdit?: (m: Milestone) => void;
  onDelete?: (m: Milestone) => void;
  onRefresh?: () => void;
}

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function MilestoneItem({
  m,
  idx,
  total,
  onEdit,
  onDelete,
  onRefresh,
}: {
  m: Milestone;
  idx: number;
  total: number;
  onEdit?: (m: Milestone) => void;
  onDelete?: (m: Milestone) => void;
  onRefresh?: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const isCompleted = m.completed;
  const isCurrent = !isCompleted && (idx === 0 || false);

  async function handleComplete() {
    if (isCompleted) return;
    setCompleting(true);
    await supabase.from("milestones").update({ completed: true }).eq("id", m.id);
    setCompleting(false);
    onRefresh?.();
  }

  let nodeClass = "ms-node--upcoming";
  if (isCompleted) nodeClass = "ms-node--completed";
  else if (isCurrent) nodeClass = "ms-node--current";

  return (
    <li className={`ms-item${isCompleted ? " ms-item--done" : ""}`}>
      {idx < total - 1 && (
        <div className={`ms-connector${isCompleted ? " ms-connector--done" : ""}`} />
      )}

      <div className="ms-node-wrap">
        <div className={`ms-node ${nodeClass}`}>
          {isCompleted ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <div className="ms-node__dot" />
          )}
        </div>
      </div>

      <div className="ms-body">
        <span className="ms-date">{m.date}</span>
        <span className="ms-title">{m.title}</span>

        <div className="ms-footer">
          {!isCompleted && (
            <button
              className="ms-complete-btn"
              onClick={handleComplete}
              disabled={completing}
              title="Mark complete"
            >
              {completing ? "..." : "✓ Done"}
            </button>
          )}
          {isCompleted && (
            <span className="ms-done-label">Completed</span>
          )}
          <div className="ms-actions">
            <button className="action-btn action-btn--edit" onClick={() => onEdit?.(m)} title="Edit">
              <EditIcon />
            </button>
            <button className="action-btn action-btn--delete" onClick={() => onDelete?.(m)} title="Delete">
              <DeleteIcon />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function MilestoneTimeline({
  milestones,
  onEdit,
  onDelete,
  onRefresh,
}: MilestoneTimelineProps) {
  return (
    <div className="card ms-widget">
      <div className="ms-header">
        <h3 className="ms-widget__title">Milestones</h3>
        {milestones.length > 0 && (
          <span className="ms-progress-label">
            {milestones.filter((m) => m.completed).length} / {milestones.length} completed
          </span>
        )}
      </div>

      {milestones.length === 0 ? (
        <p className="ms-empty">No milestones yet. Add one above!</p>
      ) : (
        <div className="ms-scroll">
          <ul className="ms-list">
            {milestones.map((m, idx) => (
              <MilestoneItem
                key={m.id}
                m={m}
                idx={idx}
                total={milestones.length}
                onEdit={onEdit}
                onDelete={onDelete}
                onRefresh={onRefresh}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}