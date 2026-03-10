import "./TopClientsTable.css";

export interface TopClient {
  client: string;
  projectsCompleted: number;
  totalRevenue: string;
  lastActive: string;
}

interface TopClientsTableProps {
  data: TopClient[];
}

export default function TopClientsTable({ data }: TopClientsTableProps) {
  return (
    <div className="card table-card">
      <h3 className="table-card__title">Top Clients by Revenue</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th className="th--center">Projects Completed</th>
              <th>Total Revenue</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="td--empty">
                  No client data yet.
                </td>
              </tr>
            ) : (
              data.map((c) => (
                <tr key={c.client}>
                  <td className="td--bold">{c.client}</td>
                  <td className="td--center">
                    <span className="badge badge--review">
                      {c.projectsCompleted}
                    </span>
                  </td>
                  <td className="td--revenue">{c.totalRevenue}</td>
                  <td className="td--secondary">{c.lastActive}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}