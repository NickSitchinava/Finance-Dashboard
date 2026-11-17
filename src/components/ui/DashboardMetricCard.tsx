import type { ReactNode } from "react";
import AnimatedMetricValue from "./AnimatedMetricValue";

/** Shared label, value, and context structure for dashboard summary cards. */
export default function DashboardMetricCard({
  label,
  value,
  detail,
  icon,
  className = "",
  loading = false,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon?: ReactNode;
  className?: string;
  loading?: boolean;
}) {
  return (
    <div className={`dashboard-metric ${className}`.trim()}>
      <span>{label}</span>
      {icon && <div className="dashboard-metric__icon" aria-hidden="true">{icon}</div>}
      {loading ? value : <strong>{typeof value === 'number' || typeof value === 'string' ? <AnimatedMetricValue value={value} fit /> : value}</strong>}
      <small>{detail}</small>
    </div>
  );
}
