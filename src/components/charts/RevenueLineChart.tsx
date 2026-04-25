import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCurrency } from "../../hooks/useCurrency";

interface DataPoint {
  month: string;
  revenue: number;
}

interface RevenueLineChartProps {
  data: DataPoint[];
}

const CustomTooltip = ({ active, payload, label, symbol }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
        {symbol}{Number(payload[0].value).toLocaleString()}
      </div>
    </div>
  );
};

export default function RevenueLineChart({ data }: RevenueLineChartProps) {
  const { symbol } = useCurrency();

  // Calculate growth vs previous month
  const latest = data[data.length - 1]?.revenue || 0;
  const previous = data[data.length - 2]?.revenue || 0;
  const growth = previous > 0 ? (((latest - previous) / previous) * 100).toFixed(1) : null;
  const isPositive = latest >= previous;

  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="card chart-card revenue-line-card">
      {/* Header */}
      <div className="revenue-line-header">
        <div className="revenue-line-header__left">
          <span className="revenue-line-header__label">Revenue Growth</span>
          <span className="revenue-line-header__total">{symbol}{total.toLocaleString()}</span>
          <span className="revenue-line-header__sub">Last 6 months</span>
        </div>
        {growth !== null && (
          <div className={`revenue-line-badge ${isPositive ? "revenue-line-badge--up" : "revenue-line-badge--down"}`}>
            <span>{isPositive ? "↑" : "↓"}</span>
            <span>{Math.abs(Number(growth))}%</span>
            <span className="revenue-line-badge__label">vs last month</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
            opacity={0.6}
          />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v === 0 ? "0" : `${symbol}${(v / 1000).toFixed(0)}k`
            }
            width={45}
          />
          <Tooltip
            content={<CustomTooltip symbol={symbol} />}
            cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.5 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--accent)"
            strokeWidth={2.5}
            fill="url(#revenueGradient)"
            dot={{ fill: "var(--accent)", r: 3.5, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "var(--accent)", strokeWidth: 2, stroke: "var(--bg-surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}