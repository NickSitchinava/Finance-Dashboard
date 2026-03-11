import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "../../hooks/useCurrency";

interface DataPoint {
  month: string;
  revenue: number;
}

interface RevenueAreaChartProps {
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
const activeDotStyle = { r: 5, fill: "var(--accent)", strokeWidth: 0 };

export default function RevenueAreaChart({ data }: RevenueAreaChartProps) {
  const { symbol } = useCurrency();

  return (
    <div className="card chart-card">
      <h3 className="chart-card__title">Revenue Growth (12 Months)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            animationDuration={150}
            contentStyle={tooltipStyle}
            formatter={(value: any) => [`${symbol}${Number(value).toLocaleString()}`, "Revenue"]}
            labelStyle={tooltipLabelStyle}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--accent)"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorRevenue)"
            activeDot={activeDotStyle}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}