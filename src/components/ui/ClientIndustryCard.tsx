import AnimatedMetricValue from './AnimatedMetricValue';
import './ClientIndustryCard.css';

type Segment = { id: string; name: string; color: string; count: number };
type Summary = { total: number; segments: Segment[] };

const CX = 140;
const CY = 139;
const RADIUS = 102;

function point(angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: CX + RADIUS * Math.cos(radians), y: CY + RADIUS * Math.sin(radians) };
}

function arc(start: number, end: number) {
  const from = point(start);
  const to = point(end);
  return `M ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${end - start > 180 ? 1 : 0} 1 ${to.x} ${to.y}`;
}

export default function ClientIndustryCard({ summary }: { summary: Summary }) {
  let angle = 180;
  return <div className="dashboard-metric overview__kpi overview__kpi--clients-industry">
    <span>Total Clients</span>
    <div className="client-industry-chart">
      <svg viewBox="0 0 280 158" role="img" aria-label={summary.total ? `${summary.total} clients by industry: ${summary.segments.map(segment => `${segment.name} ${segment.count}`).join(', ')}` : 'No clients yet'}>
        {summary.total === 0 ? <path d={arc(180, 360)} className="client-industry-chart__empty" /> : summary.segments.map(segment => {
          const sweep = segment.count / summary.total * 180;
          // Rounded stroke caps extend about 7° past each path end at this radius.
          const gap = summary.segments.length === 1 ? 0 : Math.min(18, sweep * .48);
          const start = angle + gap / 2;
          const end = angle + sweep - gap / 2;
          angle += sweep;
          return <path key={segment.id} d={arc(start, end)} stroke={segment.color} className="client-industry-chart__segment" />;
        })}
      </svg>
      <div className="client-industry-chart__total" aria-hidden="true"><strong><AnimatedMetricValue value={summary.total}/></strong><span>Clients</span></div>
    </div>
    {summary.total ? <div className="client-industry-list">{summary.segments.map(segment => <div className="client-industry-list__row" key={segment.id}><i style={{ backgroundColor: segment.color }} aria-hidden="true"/><span>{segment.name}</span><strong>{segment.count}</strong><small>{(segment.count / summary.total * 100).toFixed(1)}%</small></div>)}</div> : <p className="client-industry-empty">No active or completed clients yet</p>}
  </div>;
}
