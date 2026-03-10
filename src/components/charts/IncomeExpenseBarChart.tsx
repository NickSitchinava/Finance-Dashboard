import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DataPoint {
  month: string;
  income: number;
  expenses: number;
}

interface IncomeExpenseBarChartProps {
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

const legendStyle = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  paddingTop: 8,
};

export default function IncomeExpenseBarChart({ data }: IncomeExpenseBarChartProps) {
  return (
    <div className="card chart-card">
      <h3 className="chart-card__title">Income vs Expenses</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          barGap={4}
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
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            animationDuration={100}
            contentStyle={tooltipStyle}
            formatter={(value: any) => [`$${Number(value).toLocaleString()}`, undefined]}
            labelStyle={tooltipLabelStyle}
          />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={legendStyle}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--accent)"
            radius={[3, 3, 0, 0]}
            barSize={18}
          />
          <Bar
            dataKey="expenses"
            name="Expenses"
            fill="var(--text-secondary)"
            radius={[3, 3, 0, 0]}
            barSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}