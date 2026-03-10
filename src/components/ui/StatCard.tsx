import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  trend?: 'up' | 'down';
}

export default function StatCard({ label, value, change, trend }: StatCardProps) {
  const isPositive = trend === 'up' && change !== undefined && change >= 0;

  return (
    <div className="stat-card card">
      <span className="stat-card__label">{label}</span>
      <div className="stat-card__value">{value}</div>
      {change !== undefined && trend && (
        <span className={`stat-card__change ${isPositive ? 'stat-card__change--up' : 'stat-card__change--down'}`}>
          <span className="stat-card__arrow">{isPositive ? '↑' : '↓'}</span>
          {Math.abs(change)}% vs last month
        </span>
      )}
    </div>
  );
}
