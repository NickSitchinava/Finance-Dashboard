import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useCurrency } from '../../hooks/useCurrency';

interface Slice {
  name: string;
  value: number;
  color: string;
}

interface PortfolioDonutChartProps {
  data: Slice[];
  title?: string;
}

const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 13,
};

export default function PortfolioDonutChart({ data, title }: PortfolioDonutChartProps) {
  const { symbol } = useCurrency();

  const isEmpty = data.length === 0 || data.every(d => d.value === 0);

  return (
    <div className="card chart-card">
      <h3 className="chart-card__title">{title}</h3>

      {isEmpty ? (
        <div style={{
          height: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
        }}>
          No data yet
        </div>
      ) : (
        <div className="donut-chart__wrapper">
          <ResponsiveContainer width="55%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>

              <Tooltip
                animationDuration={100}
                contentStyle={tooltipStyle}
                formatter={(value: any) => [`${symbol}${Number(value).toLocaleString()}`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="donut-chart__legend">
            {data.map((item, i) => (
              <div key={i} className="donut-chart__legend-item">
                <span
                  className="donut-chart__legend-dot"
                  style={{ background: item.color }}
                />
                <span className="donut-chart__legend-name">{item.name}</span>
                <span className="donut-chart__legend-value">
                  {symbol}{Number(item.value).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}