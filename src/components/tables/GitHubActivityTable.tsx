import "./GitHubActivityTable.css";

export interface GitHubActivity {
  id: string;
  repository: string;
  type: string;
  date: string;
  description: string;
}

interface GitHubActivityTableProps {
  activities: GitHubActivity[];
  onEdit: (activity: GitHubActivity) => void;
  onDelete: (activity: GitHubActivity) => void;
}

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

export default function GitHubActivityTable({
  activities,
  onEdit,
  onDelete,
}: GitHubActivityTableProps) {
  return (
    <div className="card table-card">
      <div className="table-card__header">
        <h3 className="table-card__title">GitHub Activity</h3>
      </div>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Type</th>
              <th>Date</th>
              <th>Description</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={5} className="td--empty">
                  No GitHub activity recorded yet.
                </td>
              </tr>
            ) : (
              activities.map((a) => (
                <tr key={a.id}>
                  <td className="td--bold">{a.repository}</td>
                  <td>
                    <span className="badge badge--in-progress">{a.type}</span>
                  </td>
                  <td className="td--secondary">
                    {new Date(a.date).toLocaleDateString()}
                  </td>
                  <td className="td--description">{a.description}</td>
                  <td className="col-actions">
                    <div className="table-actions">
                      <button
                        className="action-btn action-btn--edit"
                        onClick={() => onEdit(a)}
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="action-btn action-btn--delete"
                        onClick={() => onDelete(a)}
                        title="Delete"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}