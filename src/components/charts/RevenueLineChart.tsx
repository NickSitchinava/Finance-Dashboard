import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "../../hooks/useCurrency";

interface DataPoint {
  month: string;
  revenue: number;
}

interface RevenueLineChartProps {
  data: DataPoint[];
}

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 13,
};

const tooltipLabelStyle = { color: "var(--text-secondary)" };
const dotStyle = { fill: "var(--accent)", r: 3, strokeWidth: 0 };
const activeDotStyle = { r: 5, fill: "var(--accent)", strokeWidth: 0 };

export default function RevenueLineChart({ data }: RevenueLineChartProps) {
  const { symbol } = useCurrency();

  return (
    <div className="card chart-card">
      <h3 className="chart-card__title">Revenue Growth</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${symbol}${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            animationDuration={100}
            contentStyle={tooltipStyle}
            formatter={(value: any) => [`${symbol}${Number(value).toLocaleString()}`, "Revenue"]}
            labelStyle={tooltipLabelStyle}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={dotStyle}
            activeDot={activeDotStyle}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}