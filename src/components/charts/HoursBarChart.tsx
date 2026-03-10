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
  project: string;
  hours: number;
}

interface HoursBarChartProps {
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

export default function HoursBarChart({ data }: HoursBarChartProps) {
  return (
    <div className="card chart-card">
      <h3 className="chart-card__title">Hours Logged per Project</h3>
      <ResponsiveContainer width="100%" height={data.length * 48 + 40}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            tickFormatter={(v: number) => `${v}h`}
          />
          <YAxis
            type="category"
            dataKey="project"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={150}
          />
          <Tooltip
            animationDuration={100}
            contentStyle={tooltipStyle}
           formatter={(value: any) => [`${value} hours`, '']}
            labelStyle={tooltipLabelStyle}
          />
          <Bar
            dataKey="hours"
            fill="var(--accent)"
            radius={[0, 4, 4, 0]}
            barSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}