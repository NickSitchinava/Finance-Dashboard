import type { ReactNode } from "react";
import AnimatedMetricValue from "./AnimatedMetricValue";

/** Shared label, value, and context structure for dashboard summary cards. */
export default function DashboardMetricCard({
  label,
  value,
  detail,
  className = "",
  loading = false,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  className?: string;
  loading?: boolean;
}) {
  return (
    <div className={`dashboard-metric ${className}`.trim()}>
      <span>{label}</span>
      {loading ? value : <strong>{typeof value === 'number' || typeof value === 'string' ? <AnimatedMetricValue value={value} fit /> : value}</strong>}
      <small>{detail}</small>
    </div>
  );
}
