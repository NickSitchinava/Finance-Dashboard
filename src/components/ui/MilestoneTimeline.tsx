import "./MilestoneTimeline.css";

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
}

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function MilestoneTimeline({
  milestones,
  onEdit,
  onDelete,
}: MilestoneTimelineProps) {
  return (
    <div className="card milestone-timeline-widget">
      <h3 className="milestone-timeline__title">2026 Milestones</h3>
      <div className="milestone-timeline-container">
        <ul className="milestone-timeline">
          {milestones.map((m, idx) => {
            const isCompleted = m.completed;
            const isCurrent =
              !isCompleted && (idx === 0 || milestones[idx - 1].completed);

            let nodeClass = "milestone-node--upcoming";
            if (isCompleted) nodeClass = "milestone-node--completed";
            else if (isCurrent) nodeClass = "milestone-node--current";

            return (
              <li
                key={m.id}
                className={`milestone-item${isCompleted ? " milestone-item--completed" : ""}`}
              >
                <div className="milestone-content">
                  <div className={`milestone-node ${nodeClass}`}>
                    {isCompleted && (
                      <span className="milestone-check">✓</span>
                    )}
                  </div>
                  <div className="milestone-text">
                    <span className="milestone-date">{m.date}</span>
                    <span className="milestone-name">{m.title}</span>
                  </div>
                  <div className="milestone-actions">
                    <button
                      className="action-btn action-btn--edit milestone-action-btn"
                      onClick={() => onEdit?.(m)}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="action-btn action-btn--delete milestone-action-btn"
                      onClick={() => onDelete?.(m)}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}