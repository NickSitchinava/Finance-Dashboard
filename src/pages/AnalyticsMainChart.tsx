import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartBar } from '../components/ui/chart-bar';
import RubberSegment from '../components/ui/RubberSegment';
import { compactMoney, money } from '../lib/finance';
import type { Currency } from '../lib/finance';

export type AnalyticsChartPoint = { label: string; from: string; to: string; value: number; comparison?: number };
type Props = {
  title: string;
  subtitle: string;
  data: AnalyticsChartPoint[];
  compare: boolean;
  currency: Currency;
  format: 'money' | 'count';
  kind: 'area' | 'bar';
  setKind: (kind: 'area' | 'bar') => void;
  options?: { value: string; label: string }[];
  option?: string;
  setOption?: (value: string) => void;
  unavailable?: boolean;
  empty?: boolean;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  selected: AnalyticsChartPoint | null;
  setSelected: (value: AnalyticsChartPoint | null) => void;
};
const AreaIcon = () => <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 16h16M2 13l5-5 4 3 6-7" /><path d="M2 13v3h15V4l-6 7-4-3-5 5Z" fill="currentColor" fillOpacity=".16" stroke="none" /></svg>;
const BarsIcon = () => <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M2 17h16M4 17V9h3v8M9 17V4h3v13M14 17v-6h3v6" /></svg>;

export function AnalyticsMainChart({ title, subtitle, data, compare, currency, format, kind, setKind, options, option, setOption, unavailable, empty, expanded, setExpanded, selected, setSelected }: Props) {
  const color = format === 'count' ? '#4935A5' : option === 'expenses' ? '#B64E5D' : '#16845E';
  const formatter = (value: number) => format === 'money' ? money(Math.round(value * 100), currency) : new Intl.NumberFormat().format(value);
  const axis = (value: number) => format === 'money' ? compactMoney(value, currency) : new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const series = [{ key: 'value', label: title, color }, ...(compare ? [{ key: 'comparison', label: 'Comparison', color: '#A698D9' }] : [])];
  const onClick = (event: unknown) => setSelected((event as { activePayload?: { payload: AnalyticsChartPoint }[] } | null)?.activePayload?.[0]?.payload || null);
  return <section className={'analytics-panel finance-panel finance-chart analytics-performance' + (expanded ? ' finance-chart--expanded' : '') + (kind === 'bar' ? ' finance-chart--bar' : '')}>
    <div className="finance-panel__head"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="finance-chart__controls">
      {options && option && setOption && <select aria-label="Chart metric" value={option} onChange={event => setOption(event.target.value)}>{options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}
      <RubberSegment className="analytics-rubber-chart-types" trackColor="#eeeafa" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Chart type" items={[{ value: 'area', label: 'Area', icon: <AreaIcon /> }, { value: 'bar', label: 'Bar', icon: <BarsIcon /> }]} value={kind} onChange={value => setKind(value as 'area' | 'bar')} size="md" />
      <button type="button" className="finance-chart__expand" onClick={() => setExpanded(!expanded)}>{expanded ? 'Close' : 'Expand'}</button>
    </div></div>
    {unavailable ? <div className="finance-empty">Some records lack a currency or exchange rate. Resolve them to view an accurate chart.</div> : empty ? <div className="finance-empty">No activity in this period.</div> : <div className="finance-chart__body"><div className="finance-chart__viewport"><div className="finance-chart__plot">
      {kind === 'bar' ? <ChartBar data={data.map(item => ({ label: item.label, value: item.value, ...(item.comparison === undefined ? {} : { comparison: item.comparison }) }))} index="label" series={series} showLegend={compare} currency={currency} title={title} description={subtitle} height={expanded ? 300 : 210} surface="light" bare total="none" valueFormat={formatter} animate duration={.85} /> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }} onClick={onClick}>
        <defs><linearGradient id="analytics-main-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.24} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#e7e3f0" strokeDasharray="3 5" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fill: '#7e7891', fontSize: 11 }} dy={8} />
        <YAxis axisLine={false} tickLine={false} allowDecimals={format !== 'count'} tick={{ fill: '#7e7891', fontSize: 11 }} tickFormatter={value => axis(Number(value))} />
        <Tooltip formatter={(value, name) => [formatter(Number(value)), name === 'comparison' ? 'Comparison' : title]} contentStyle={{ border: '1px solid #ded8ee', borderRadius: 10, boxShadow: '0 12px 32px #21145218', fontSize: 12 }} />
        {compare && <Legend formatter={key => key === 'comparison' ? 'Comparison' : title} />}
        <Area type="monotone" dataKey="value" name="value" stroke={color} strokeWidth={2.5} fill="url(#analytics-main-fill)" activeDot={{ r: 5, fill: color }} isAnimationActive animationDuration={850} animationEasing="ease-in-out" />
        {compare && <Line type="monotone" dataKey="comparison" name="comparison" stroke="#A698D9" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive animationDuration={850} />}
      </AreaChart></ResponsiveContainer>}
    </div></div></div>}
    {selected && <p className="finance-chart__caption">{selected.from} to {selected.to} · {formatter(selected.value)}</p>}
    {!selected && <p className="finance-chart__caption">Chart values use dated records.</p>}
  </section>;
}
