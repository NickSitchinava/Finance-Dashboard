import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  month: string;
  clients: number;
}

interface NewClientsBarChartProps {
  data: DataPoint[];
}

const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 13,
};

const tooltipLabelStyle = { color: 'var(--text-secondary)' };
const cursorStyle = { fill: 'rgba(255, 255, 255, 0.05)' };

export default function NewClientsBarChart({ data }: NewClientsBarChartProps) {
  return (
    <div className="card chart-card">
      <h3 className="chart-card__title">New Clients Acquired</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            animationDuration={150}
            cursor={cursorStyle}
            contentStyle={tooltipStyle}
            formatter={(value: any) => [`${value}`, 'New Clients']}
            labelStyle={tooltipLabelStyle}
          />
          <Bar
            dataKey="clients"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}