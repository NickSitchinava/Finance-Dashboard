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
}

const categoryColors: Record<string, string> = {
  Finance: "rgba(52, 199, 89, 0.2)",
  Career: "rgba(232, 123, 58, 0.2)",
  Health: "rgba(50, 150, 250, 0.2)",
  Learning: "rgba(164, 80, 255, 0.2)",
};

const categoryTextColors: Record<string, string> = {
  Finance: "#34C759",
  Career: "#E87B3A",
  Health: "#3296FA",
  Learning: "#A450FF",
};

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const { title, category, targetDate, percentComplete, notes } = goal;

  const tagStyle = {
    background: categoryColors[category] || "var(--bg-elevated)",
    color: categoryTextColors[category] || "var(--text-primary)",
    border: `1px solid ${categoryColors[category] || "var(--border)"}`,
  };

  const progressFillStyle = {
    width: `${percentComplete}%`,
    background: percentComplete === 100 ? "var(--status-success)" : "var(--accent)",
  };

  return (
    <div className="card goal-card">
      <div className="goal-card__header">
        <h3 className="goal-card__title">{title}</h3>
        <span className="goal-card__tag" style={tagStyle}>
          {category}
        </span>
      </div>

      <div className="goal-card__date">🎯 Target: {targetDate}</div>

      <div className="goal-card__progress">
        <div className="goal-card__progress-header">
          <span className="goal-card__progress-label">Progress</span>
          <span className="goal-card__progress-pct">{percentComplete}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={progressFillStyle} />
        </div>
      </div>

      {notes && <div className="goal-card__notes">{notes}</div>}

      <div className="goal-card__actions">
        <button
          className="action-btn action-btn--edit"
          onClick={() => onEdit?.(goal)}
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          className="action-btn action-btn--delete"
          onClick={() => onDelete?.(goal)}
          title="Delete"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
}