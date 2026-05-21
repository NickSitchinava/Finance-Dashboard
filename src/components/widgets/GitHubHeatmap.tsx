import './GitHubHeatmap.css';

interface GitHubHeatmapProps {
  commits: number[];
  totalCommits: number;
  streak: number;
}

function getIntensity(count: number): string {
  if (count === 0) return 'heatmap__cell--0';
  if (count <= 2) return 'heatmap__cell--1';
  if (count <= 4) return 'heatmap__cell--2';
  if (count <= 6) return 'heatmap__cell--3';
  return 'heatmap__cell--4';
}

export default function GitHubHeatmap({ commits, totalCommits, streak }: GitHubHeatmapProps) {
  const rows = 5;
  const cols = 7;

  return (
    <div className="card heatmap-widget">
      <h3 className="heatmap-widget__title">GitHub Activity</h3>

      <div className="heatmap-grid">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="heatmap-grid__row">
            {Array.from({ length: cols }).map((_, col) => {
              const idx = row * cols + col;
              const count = idx < commits.length ? commits[idx] : -1;
              if (count < 0) return <span key={col} className="heatmap__cell heatmap__cell--empty" />;
              return (
                <span
                  key={col}
                  className={`heatmap__cell ${getIntensity(count)}`}
                  title={`${count} commits`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="heatmap-stats">
        <div className="heatmap-stat">
          <span className="heatmap-stat__value">{totalCommits}</span>
          <span className="heatmap-stat__label">Commits this month</span>
        </div>
        <div className="heatmap-stat">
          <span className="heatmap-stat__value">{streak} days</span>
          <span className="heatmap-stat__label">Current streak</span>
        </div>
      </div>
    </div>
  );
}
