import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { currencySymbol } from '../lib/finance';
import type { Currency } from '../lib/finance';
import AnimatedMetricValue from '../components/ui/AnimatedMetricValue';
import './AnalyticsBalance.css';

type Reading = { label: string; value: number };
export type AnalyticsBalanceProps = {
  label: string;
  value: number | null;
  prior: number | null;
  kind: 'money' | 'count';
  currency: Currency;
  note: string;
  history?: Reading[];
  corner?: number;
};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
function pathFor(values: number[]) {
  const low = Math.min(...values), high = Math.max(...values), span = high - low || 1;
  const points = values.map((value, index) => ({ x: index * 100 / (values.length - 1), y: 36 - (value - low) / span * 31 }));
  const path = points.map((point, index) => {
    if (!index) return 'M ' + point.x.toFixed(2) + ' ' + point.y.toFixed(2);
    const previous = points[index - 1], before = points[index - 2] || previous, next = points[index + 1] || point;
    const c1x = previous.x + (point.x - before.x) / 6, c1y = previous.y + (point.y - before.y) / 6;
    const c2x = point.x - (next.x - previous.x) / 6, c2y = point.y - (next.y - previous.y) / 6;
    return 'C ' + c1x.toFixed(2) + ' ' + c1y.toFixed(2) + ' ' + c2x.toFixed(2) + ' ' + c2y.toFixed(2) + ' ' + point.x.toFixed(2) + ' ' + point.y.toFixed(2);
  }).join(' ');
  return { path, points };
}
function display(value: number | null, kind: 'money' | 'count', currency: Currency) {
  if (value === null) return { sign: '', whole: '—', decimal: '' };
  if (kind === 'count') return { sign: '', whole: new Intl.NumberFormat().format(value), decimal: '' };
  const amount = Math.abs(value / 100);
  const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.floor(amount));
  const decimal = '.' + String(Math.round(Math.abs(value) % 100)).padStart(2, '0');
  return { sign: (value < 0 ? '−' : '') + currencySymbol(currency), whole, decimal };
}
function change(value: number | null, prior: number | null) {
  if (value === null || prior === null) return 'No comparison';
  if (prior === 0) return value === 0 ? 'No change' : 'New activity';
  const pct = Math.round((value - prior) / Math.abs(prior) * 100);
  return (pct > 0 ? '+' : '') + pct + '% vs comparison';
}

export function AnalyticsBalance({ label, value, prior, kind, currency, note, history, corner = 20 }: AnalyticsBalanceProps) {
  const series = useMemo(() => history && history.length >= 2 ? history : [], [history]);
  const curve = useMemo(() => series.length ? pathFor(series.map(item => item.value)) : null, [series]);
  const amount = display(value, kind, currency);
  const direction = value !== null && prior !== null ? value >= prior : null;
  return <article className="analytics-balance" style={{ '--balance-corner': clamp(corner, 0, 40) + 'px' } as CSSProperties}>
    <div className="analytics-balance-sheet">
      <div className="analytics-balance-label"><span>{label}</span></div>
      <div className="analytics-balance-main">
        <p className="analytics-balance-value"><span>{amount.sign}</span><AnimatedMetricValue value={amount.whole} /><small>{amount.decimal}</small></p>
        <div className="analytics-balance-plot" role="img" aria-label={series.length ? label + ' history' : 'Historical trend unavailable'}>
          {curve ? <><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d={curve.path} /></svg><i className="analytics-balance-dot" style={{ left: curve.points[curve.points.length - 1].x + '%', top: curve.points[curve.points.length - 1].y / 40 * 100 + '%' }} /></> : <span className="analytics-balance-no-trend">Trend unavailable</span>}
        </div>
      </div>
      <div className="analytics-balance-change" data-direction={direction === null ? 'neutral' : direction ? 'up' : 'down'}><strong>{change(value, prior)}</strong><span>{note}</span></div>
    </div>
  </article>;
}
