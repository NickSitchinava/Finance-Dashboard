import { useState } from "react";
import { supabase } from "../../lib/supabase";
import "./GoalCard.css";

export interface Goal {
  id?: string;
  title: string;
  category: string;
  targetDate: string;
  percentComplete: number;
  notes?: string;
}

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  onRefresh?: () => void;
}

const categoryConfig: Record<string, { bg: string; color: string; border: string }> = {
  Finance:  { bg: "rgba(52, 199, 89, 0.1)",  color: "#34C759", border: "rgba(52, 199, 89, 0.25)" },
  Career:   { bg: "rgba(232, 123, 58, 0.1)", color: "#E87B3A", border: "rgba(232, 123, 58, 0.25)" },
  Health:   { bg: "rgba(50, 150, 250, 0.1)", color: "#3296FA", border: "rgba(50, 150, 250, 0.25)" },
  Learning: { bg: "rgba(164, 80, 255, 0.1)", color: "#A450FF", border: "rgba(164, 80, 255, 0.25)" },
};

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export default function GoalCard({ goal, onEdit, onDelete, onRefresh }: GoalCardProps) {
  const { title, category, targetDate, percentComplete, notes } = goal;
  const [completing, setCompleting] = useState(false);

  const config = categoryConfig[category] || {
    bg: "var(--bg-elevated)",
    color: "var(--text-secondary)",
    border: "var(--border)",
  };

  const isComplete = percentComplete === 100;

  async function handleMarkComplete() {
    if (!goal.id || isComplete) return;
    setCompleting(true);
    await supabase
      .from("goals")
      .update({ percent_complete: 100 })
      .eq("id", goal.id);
    setCompleting(false);
    onRefresh?.();
  }

  return (
    <div className={`goal-card${isComplete ? " goal-card--complete" : ""}`}>
      {/* Top accent line */}
      <div className="goal-card__accent" style={{ background: config.color }} />

      <div className="goal-card__body">
        {/* Header */}
        <div className="goal-card__header">
          <span
            className="goal-card__tag"
            style={{ background: config.bg, color: config.color, borderColor: config.border }}
          >
            {category}
          </span>
          {isComplete && (
            <span className="goal-card__complete-badge">Completed</span>
          )}
        </div>

        {/* Title */}
        <h3 className="goal-card__title">{title}</h3>

        {/* Date */}
        <div className="goal-card__date">
          <CalendarIcon />
          <span>Target: {targetDate}</span>
        </div>

        {/* Notes */}
        {notes && <div className="goal-card__notes">{notes}</div>}

        {/* Progress */}
        <div className="goal-card__progress">
          <div className="goal-card__progress-header">
            <span className="goal-card__progress-label">Progress</span>
            <span
              className="goal-card__progress-pct"
              style={{ color: isComplete ? "var(--status-success)" : config.color }}
            >
              {percentComplete}%
            </span>
          </div>
          <div className="goal-card__progress-track">
            <div
              className="goal-card__progress-fill"
              style={{
                width: `${percentComplete}%`,
                background: isComplete ? "var(--status-success)" : config.color,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="goal-card__actions">
          <div className="goal-card__action-left">
            {!isComplete && (
              <button
                className="goal-card__complete-btn"
                onClick={handleMarkComplete}
                disabled={completing}
                title="Mark as complete"
              >
                <CheckIcon />
                {completing ? "Saving..." : "Mark Complete"}
              </button>
            )}
          </div>
          <div className="goal-card__action-right">
            <button className="action-btn action-btn--edit" onClick={() => onEdit?.(goal)} title="Edit">
              <EditIcon />
            </button>
            <button className="action-btn action-btn--delete" onClick={() => onDelete?.(goal)} title="Delete">
              <DeleteIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}