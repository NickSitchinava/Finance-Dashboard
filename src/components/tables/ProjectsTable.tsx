import "./ProjectsTable.css";

export interface FullProject {
  id?: string;
  name: string;
  client: string;
  techStack: string[];
  startDate: string;
  deadline: string;
  hoursLogged: number;
  percentComplete: number;
  status: string;
  github_link?: string;
  website_link?: string;
  other_link?: string;
}

interface ProjectsTableProps {
  data: FullProject[];
  onEdit?: (project: FullProject) => void;
  onDelete?: (project: FullProject) => void;
}

const statusClass: Record<string, string> = {
  "In Progress": "badge--in-progress",
  Review: "badge--review",
  Overdue: "badge--overdue",
  "Coming Soon": "badge--coming-soon",
  Completed: "badge--completed",
  Paused: "badge--paused",
};

const GitHubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const WebIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

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

export default function ProjectsTable({
  data,
  onEdit,
  onDelete,
}: ProjectsTableProps) {
  return (
    <div className="card table-card">
      <h3 className="table-card__title">All Projects</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Client</th>
              <th>Tech Stack</th>
              <th>Start Date</th>
              <th>Deadline</th>
              <th>Hours</th>
              <th>Progress</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id || p.name}>
                <td>
                  <div className="project-name-cell">
                    {p.website_link ? (
                      <a
                        href={p.website_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-name-link"
                      >
                        {p.name}
                      </a>
                    ) : (
                      <span className="project-name-text">{p.name}</span>
                    )}
                    <div className="project-links">
                      {p.github_link && (
                        <a
                          href={p.github_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-icon"
                          title="GitHub"
                        >
                          <GitHubIcon />
                        </a>
                      )}
                      {p.website_link && (
                        <a
                          href={p.website_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-icon"
                          title="Website"
                        >
                          <WebIcon />
                        </a>
                      )}
                      {p.other_link && (
                        <a
                          href={p.other_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-icon"
                          title="Other Link"
                        >
                          <LinkIcon />
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="td--secondary">{p.client}</td>
                <td>
                  <div className="tech-tags">
                    {p.techStack.map((t) => (
                      <span key={t} className="tech-tag">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="td--secondary">{p.startDate}</td>
                <td className="td--secondary">{p.deadline}</td>
                <td>{p.hoursLogged}h</td>
                <td className="td--progress">
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{ width: `${p.percentComplete}%` }}
                    />
                  </div>
                  <span className="progress-bar__label">
                    {p.percentComplete}%
                  </span>
                </td>
                <td>
                  <span className={`badge ${statusClass[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="col-actions">
                  <div className="table-actions">
                    <button
                      className="action-btn action-btn--edit"
                      onClick={() => onEdit?.(p)}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="action-btn action-btn--delete"
                      onClick={() => onDelete?.(p)}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}