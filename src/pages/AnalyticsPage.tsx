import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { useCurrency } from '../hooks/useCurrency';
import PillNav from '../components/ui/PillNav';
import AnimatedList from '../components/ui/AnimatedList';
import RubberSegment from '../components/ui/RubberSegment';
import { ChartBar } from '../components/ui/chart-bar';
import { supabase } from '../lib/supabase';
import DashboardContentTransition from '../components/ui/DashboardContentTransition';
import AnimatedMetricValue from '../components/ui/AnimatedMetricValue';
import { convertedCents, loadRates, money } from '../lib/finance';
import type { Currency, RateMap } from '../lib/finance';
import { cents, localDay } from '../lib/invoices';
import { analyticsBounds, analyticsComparisonBounds, shiftAnalyticsDay, validAnalyticsRange } from '../lib/analyticsDates';
import type { AnalyticsCompare, AnalyticsPreset, AnalyticsRange } from '../lib/analyticsDates';
import { AnalyticsBalance } from './AnalyticsBalance';
import { AnalyticsCompareSelect } from './AnalyticsCompare';
import { AnalyticsMainChart } from './AnalyticsMainChart';
import type { AnalyticsChartPoint } from './AnalyticsMainChart';
import './FinancesPage.css';
import './AnalyticsPage.css';

type Category = 'Overview' | 'Financial' | 'Clients' | 'Projects' | 'Invoices';
type Preset = AnalyticsPreset;
type Compare = AnalyticsCompare;
type Metric = 'revenue' | 'expenses' | 'profit' | 'cash';
type Range = AnalyticsRange;
type Tx = { type: 'Income' | 'Expense'; amount: number; income_amount: number | null; expense_amount: number | null; currency: Currency | null; date: string; client_id: string | null; project_id: string | null };
type Client = { id: string; name: string; created_at: string };
type Project = { id: string; name: string; status: string; created_at: string; deadline: string | null; agreed_payment: number | null; budget_currency: Currency | null; kind: string };
type Invoice = { id: string; invoice_number: string; amount: number; currency: Currency | null; issue_date: string | null; created_at: string; due_date: string; lifecycle_state: string };
type Payment = { id: string; invoice_id: string; amount: number; currency: Currency | null; paid_on: string; reversed_at: string | null };
type Data = { tx: Tx[]; clients: Client[]; projects: Project[]; invoices: Invoice[]; payments: Payment[] };
type KPI = { label: string; value: number | null; prior: number | null; kind: 'money' | 'count'; note: string; trend?: number[] };
type Point = { label: string; from: string; to: string; revenue: number; expenses: number; profit: number; cash: number; comparison?: number };
const categories: Category[] = ['Overview', 'Financial', 'Clients', 'Projects', 'Invoices'];
const presets: Preset[] = ['30d', '3m', '6m', '12m', 'Custom'];
const metrics: { key: Metric; label: string }[] = [{ key: 'revenue', label: 'Revenue' }, { key: 'expenses', label: 'Expenses' }, { key: 'profit', label: 'Net profit' }, { key: 'cash', label: 'Net cash flow' }];
const DAY = 86400000;
const utc = (day: string) => new Date(day + 'T00:00:00Z');
const shift = shiftAnalyticsDay;
const inside = (day: string | null | undefined, range: Range) => Boolean(day && day.slice(0, 10) >= range.from && day.slice(0, 10) <= range.to);
const sum = (values: (number | null)[]) => values.some(value => value === null) ? null : values.reduce<number>((total, value) => total + (value || 0), 0);
async function allRows<T>(table: string, columns: string, userId: string): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from(table).select(columns).eq('user_id', userId).order('id').range(start, start + 499);
    if (error) throw error;
    result.push(...(data as T[] || []));
    if (!data || data.length < 500) return result;
  }
}
async function fetchData(userId: string): Promise<Data> {
  const [tx, clients, projects, invoices, payments] = await Promise.all([
    allRows<Tx>('transactions', 'id,type,amount,income_amount,expense_amount,currency,date,client_id,project_id', userId),
    allRows<Client>('clients', 'id,name,created_at', userId),
    allRows<Project>('projects', 'id,name,status,created_at,deadline,agreed_payment,budget_currency,kind', userId),
    allRows<Invoice>('invoices', 'id,invoice_number,amount,currency,issue_date,created_at,due_date,lifecycle_state', userId),
    allRows<Payment>('invoice_payments', 'id,invoice_id,amount,currency,paid_on,reversed_at', userId),
  ]);
  return { tx, clients, projects, invoices, payments };
}
const cache = new Map<string, { data: Data; at: number }>();
function convert(amount: number, currency: Currency | null, date: string, target: Currency, rates: RateMap) {
  return convertedCents({ type: 'Income', amount, currency, date }, target, rates);
}
function total(data: Data, range: Range, type: Tx['type'], currency: Currency, rates: RateMap, clientId?: string) {
  return sum(data.tx.filter(row => row.type === type && inside(row.date, range) && (!clientId || row.client_id === clientId)).map(row => convertedCents(row, currency, rates)));
}
function finance(data: Data, range: Range, currency: Currency, rates: RateMap) {
  const revenue = total(data, range, 'Income', currency, rates);
  const expenses = total(data, range, 'Expense', currency, rates);
  const net = revenue === null || expenses === null ? null : revenue - expenses;
  return { revenue, expenses, profit: net, cash: net };
}
function points(data: Data, range: Range, currency: Currency, rates: RateMap): Point[] {
  const count = Math.round((utc(range.to).getTime() - utc(range.from).getTime()) / DAY) + 1;
  const step = count <= 31 ? 1 : count <= 100 ? 7 : 30;
  const result: Point[] = [];
  let previousMonth = '';
  for (let start = range.from; start <= range.to; start = shift(start, step)) {
    const end = shift(start, step - 1) > range.to ? range.to : shift(start, step - 1);
    const item = finance(data, { from: start, to: end }, currency, rates);
    const month = start.slice(0, 7);
    const label = month === previousMonth ? '' : utc(start).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
    previousMonth = month;
    result.push({ label, from: start, to: end, revenue: (item.revenue || 0) / 100, expenses: (item.expenses || 0) / 100, profit: (item.profit || 0) / 100, cash: (item.cash || 0) / 100 });
  }
  return result;
}
function valueText(value: number | null, kind: KPI['kind'], currency: Currency) { return value === null ? '—' : kind === 'money' ? money(value, currency) : new Intl.NumberFormat().format(value); }

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { currency: currencyName } = useCurrency();
  const currency = currencyName as Currency;
  const [category, setCategory] = useState<Category>('Overview');
  const [preset, setPreset] = useState<Preset>('6m');
  const [custom, setCustom] = useState<Range>({ from: shift(localDay(), -29), to: localDay() });
  const [compare, setCompare] = useState<Compare>('previous');
  const [other, setOther] = useState<Range>({ from: shift(localDay(), -59), to: shift(localDay(), -30) });
  const [metric, setMetric] = useState<Metric>('revenue');
  const [chartKind, setChartKind] = useState<'area' | 'bar'>('area');
  const [storedData, setStoredData] = useState<Data | null>(() => user ? cache.get(user.id)?.data ?? null : null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(() => user?.id ?? null);
  const data = loadedUserId === user?.id ? storedData : null;
  const [rates, setRates] = useState<RateMap>({});
  const [loading, setLoading] = useState(() => !user || !cache.has(user.id));
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [mobileControls, setMobileControls] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<AnalyticsChartPoint | null>(null);
  const range = useMemo(() => analyticsBounds(preset, custom, localDay()), [preset, custom]);
  const baseline = useMemo(() => analyticsComparisonBounds(compare, range, other), [compare, range, other]);
  const dateError = !validAnalyticsRange(range, localDay()) ? 'Choose a valid range ending today or earlier.' : baseline && !validAnalyticsRange(baseline, localDay()) ? 'Choose a valid comparison range.' : '';
  const refresh = () => { if (user) cache.delete(user.id); setReload(value => value + 1); };
  useEffect(() => {
    if (!user) return;
    let active = true;
    const cached = cache.get(user.id);
    if (cached && Date.now() - cached.at < 60000) { queueMicrotask(() => { if (active) { setStoredData(cached.data); setLoadedUserId(user.id); setLoading(false); } }); return () => { active = false; }; }
    fetchData(user.id).then(result => { if (active) { cache.set(user.id, { data: result, at: Date.now() }); setStoredData(result); setLoadedUserId(user.id); setLoading(false); setError(''); } }).catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Analytics could not be loaded.'); setLoading(false); } });
    return () => { active = false; };
  }, [user, reload]);
  useEffect(() => {
    if (!data) return;
    let active = true;
    const dates = [...data.tx.filter(row => row.currency && row.currency !== currency).map(row => row.date), ...data.invoices.filter(row => row.currency && row.currency !== currency).map(row => row.issue_date || row.created_at.slice(0, 10)), ...data.payments.filter(row => row.currency && row.currency !== currency).map(row => row.paid_on)];
    if (!dates.length) return;
    loadRates(dates).then(result => { if (active) setRates(result); }).catch(() => { if (active) setRates({}); });
    return () => { active = false; };
  }, [data, currency]);
  useEffect(() => {
    const handler = () => { if (user) cache.delete(user.id); setReload(value => value + 1); };
    ['finance-updated', 'invoice-updated', 'project-updated', 'client-updated'].forEach(event => window.addEventListener(event, handler));
    return () => ['finance-updated', 'invoice-updated', 'project-updated', 'client-updated'].forEach(event => window.removeEventListener(event, handler));
  }, [user]);
  const model = useMemo(() => {
    if (!data || dateError) return null;
    const now = finance(data, range, currency, rates), before = baseline ? finance(data, baseline, currency, rates) : null;
    const acquired = data.clients.filter(client => inside(client.created_at, range));
    const acquiredBefore = baseline ? data.clients.filter(client => inside(client.created_at, baseline)) : [];
    const started = data.projects.filter(project => inside(project.created_at, range));
    const startedBefore = baseline ? data.projects.filter(project => inside(project.created_at, baseline)) : [];
    const issued = data.invoices.filter(invoice => invoice.lifecycle_state === 'issued' && inside(invoice.issue_date || invoice.created_at, range));
    const issuedBefore = baseline ? data.invoices.filter(invoice => invoice.lifecycle_state === 'issued' && inside(invoice.issue_date || invoice.created_at, baseline)) : [];
    const paid = data.payments.filter(payment => !payment.reversed_at && inside(payment.paid_on, range));
    const paidBefore = baseline ? data.payments.filter(payment => !payment.reversed_at && inside(payment.paid_on, baseline)) : [];
    const invoiceValue = (invoice: Invoice) => convert(invoice.amount, invoice.currency, invoice.issue_date || invoice.created_at.slice(0, 10), currency, rates);
    const paymentValue = (payment: Payment) => convert(payment.amount, payment.currency, payment.paid_on, currency, rates);
    const paymentMap = new Map<string, number>();
    data.payments.filter(payment => !payment.reversed_at).forEach(payment => paymentMap.set(payment.invoice_id, (paymentMap.get(payment.invoice_id) || 0) + cents(payment.amount)));
    const remaining = (invoice: Invoice) => convert(Math.max(0, cents(invoice.amount) - (paymentMap.get(invoice.id) || 0)) / 100, invoice.currency, invoice.issue_date || invoice.created_at.slice(0, 10), currency, rates);
    const outstanding = sum(issued.map(remaining));
    const overdue = sum(issued.filter(invoice => invoice.due_date < localDay()).map(remaining));
    const clientRevenue = data.clients.map(client => ({ ...client, revenue: total(data, range, 'Income', currency, rates, client.id) })).sort((a, b) => (b.revenue ?? -Infinity) - (a.revenue ?? -Infinity));
    const linked = sum(clientRevenue.map(client => client.revenue));
    const top = sum(clientRevenue.slice(0, 3).map(client => client.revenue));
    const pricedProjects = data.projects.filter(project => project.kind === 'client' && project.agreed_payment !== null);
    const projectValue = sum(pricedProjects.map(project => convert(project.agreed_payment!, project.budget_currency, project.created_at.slice(0, 10), currency, rates)));
    const projectPerformance = data.projects.map(project => {
      const linked = data.tx.filter(row => row.project_id === project.id && inside(row.date, range));
      const revenue = sum(linked.filter(row => row.type === 'Income').map(row => convertedCents(row, currency, rates)));
      const expenses = sum(linked.filter(row => row.type === 'Expense').map(row => convertedCents(row, currency, rates)));
      return { ...project, revenue, expenses, profit: revenue === null || expenses === null ? null : revenue - expenses, activity: linked.length };
    }).filter(project => project.activity).sort((a, b) => (b.revenue ?? -Infinity) - (a.revenue ?? -Infinity));
    const currentPoints = points(data, range, currency, rates), priorPoints = baseline ? points(data, baseline, currency, rates) : [];
    const clientTotals = currentPoints.map(point => data.clients.filter(client => client.created_at.slice(0, 10) <= point.to).length);
    const clientStarts = currentPoints.map(point => data.clients.filter(client => inside(client.created_at, point)).length);
    const projectTotals = currentPoints.map(point => data.projects.filter(project => project.created_at.slice(0, 10) <= point.to).length);
    const projectStarts = currentPoints.map(point => data.projects.filter(project => inside(project.created_at, point)).length);
    const topClientIds = new Set(clientRevenue.slice(0, 3).map(client => client.id));
    const clientLinkedTrend = currentPoints.map(point => sum(data.tx.filter(row => row.type === 'Income' && row.client_id && inside(row.date, point)).map(row => convertedCents(row, currency, rates))));
    const topClientTrend = currentPoints.map(point => sum(data.tx.filter(row => row.type === 'Income' && row.client_id && topClientIds.has(row.client_id) && inside(row.date, point)).map(row => convertedCents(row, currency, rates))));
    const issuedTrend = currentPoints.map(point => sum(data.invoices.filter(invoice => invoice.lifecycle_state === 'issued' && inside(invoice.issue_date || invoice.created_at, point)).map(invoiceValue)));
    const paidTrend = currentPoints.map(point => sum(data.payments.filter(payment => !payment.reversed_at && inside(payment.paid_on, point)).map(paymentValue)));
    const kpi = (label: string, value: number | null, prior: number | null, kind: KPI['kind'], note: string, trend?: number[]): KPI => ({ label, value, prior: baseline ? prior : null, kind, note, trend });
    const kpis: Record<Category, KPI[]> = {
      Overview: [kpi('Revenue', now.revenue, before?.revenue ?? null, 'money', 'Recorded income in period', currentPoints.map(point => point.revenue)), kpi('Net profit', now.profit, before?.profit ?? null, 'money', 'Revenue less expenses', currentPoints.map(point => point.profit)), kpi('Total clients', data.clients.length, null, 'count', 'All-time clients', clientTotals), kpi('Total projects', data.projects.length, null, 'count', 'All-time projects', projectTotals)],
      Financial: [kpi('Revenue', now.revenue, before?.revenue ?? null, 'money', 'Recorded income', currentPoints.map(point => point.revenue)), kpi('Expenses', now.expenses, before?.expenses ?? null, 'money', 'Recorded outflow', currentPoints.map(point => point.expenses)), kpi('Net profit', now.profit, before?.profit ?? null, 'money', 'Cash-basis result', currentPoints.map(point => point.profit)), kpi('Net cash flow', now.cash, before?.cash ?? null, 'money', 'Recorded inflow less outflow', currentPoints.map(point => point.cash))],
      Clients: [kpi('Total clients', data.clients.length, null, 'count', 'All-time clients', clientTotals), kpi('New clients', acquired.length, acquiredBefore.length, 'count', 'Created in period', clientStarts), kpi('Revenue per client', linked === null || !data.clients.length ? null : Math.round(linked / data.clients.length), null, 'money', 'Linked income ÷ all clients', clientLinkedTrend.every(value => value !== null) && data.clients.length ? clientLinkedTrend.map(value => (value || 0) / data.clients.length / 100) : undefined), kpi('Top 3 clients', top, null, 'money', 'Linked income in period', topClientTrend.every(value => value !== null) ? topClientTrend.map(value => (value || 0) / 100) : undefined)],
      Projects: [kpi('Total projects', data.projects.length, null, 'count', 'All-time projects', projectTotals), kpi('New projects', started.length, startedBefore.length, 'count', 'Created in period', projectStarts), kpi('Completed', data.projects.filter(project => project.status === 'Completed').length, null, 'count', 'Current status; no completion date'), kpi('Avg agreed value', pricedProjects.length && projectValue !== null ? Math.round(projectValue / pricedProjects.length) : null, null, 'money', 'Client projects with agreed payment')],
      Invoices: [kpi('Total invoiced', sum(issued.map(invoiceValue)), sum(issuedBefore.map(invoiceValue)), 'money', 'Issued in period', issuedTrend.every(value => value !== null) ? issuedTrend.map(value => (value || 0) / 100) : undefined), kpi('Paid amount', sum(paid.map(paymentValue)), sum(paidBefore.map(paymentValue)), 'money', 'Payments dated in period', paidTrend.every(value => value !== null) ? paidTrend.map(value => (value || 0) / 100) : undefined), kpi('Outstanding', outstanding, null, 'money', 'Open on period-issued invoices'), kpi('Overdue', overdue, null, 'money', 'Open and past due')],
    };
    const chart = currentPoints.map((item, index) => ({ ...item, comparison: priorPoints.length ? priorPoints[Math.min(priorPoints.length - 1, Math.floor(index * priorPoints.length / currentPoints.length))][metric] : undefined }));
    const acquisitionSeries = currentPoints.map((item, index) => ({ label: item.label, from: item.from, to: item.to, count: data.clients.filter(client => inside(client.created_at, item)).length, comparison: priorPoints.length ? data.clients.filter(client => inside(client.created_at, priorPoints[Math.min(priorPoints.length - 1, Math.floor(index * priorPoints.length / currentPoints.length))])).length : undefined }));
    const projectSeries = currentPoints.map((item, index) => ({ label: item.label, from: item.from, to: item.to, count: data.projects.filter(project => inside(project.created_at, item)).length, comparison: priorPoints.length ? data.projects.filter(project => inside(project.created_at, priorPoints[Math.min(priorPoints.length - 1, Math.floor(index * priorPoints.length / currentPoints.length))])).length : undefined }));
    const collectionSeries = currentPoints.map((item, index) => {
      const amount = sum(data.payments.filter(payment => !payment.reversed_at && inside(payment.paid_on, item)).map(paymentValue));
      const previous = priorPoints.length ? sum(data.payments.filter(payment => !payment.reversed_at && inside(payment.paid_on, priorPoints[Math.min(priorPoints.length - 1, Math.floor(index * priorPoints.length / currentPoints.length))])).map(paymentValue)) : null;
      return { label: item.label, from: item.from, to: item.to, amount, comparison: previous };
    });
    const insights: string[] = [];
    if (now.revenue !== null && before?.revenue && before.revenue > 0) { const delta = Math.round((now.revenue - before.revenue) / before.revenue * 100); if (Math.abs(delta) >= 15) insights.push('Revenue ' + (delta > 0 ? 'rose ' : 'fell ') + Math.abs(delta) + '% against the comparison period.'); }
    if (now.revenue !== null && now.expenses !== null && now.expenses > now.revenue) insights.push('Recorded expenses exceeded income in this period.');
    if (linked && top !== null && top / linked > .6) insights.push('Your top three clients contributed ' + Math.round(top / linked * 100) + '% of attributed revenue.');
    if (overdue && overdue > 0) insights.push(money(overdue, currency) + ' remains overdue on invoices issued in this period.');
    return { now, kpis: kpis[category], chart, acquisitionSeries, projectSeries, collectionSeries, insights, clientRevenue, projectPerformance, acquired, issued, paid, invoiceValue, paymentValue, outstanding, overdue };
  }, [data, dateError, range, baseline, currency, rates, category, metric]);
  const chartUnavailable = Boolean(data?.tx.some(row => inside(row.date, range) && convertedCents(row, currency, rates) === null));
  const mainChartData: AnalyticsChartPoint[] = !model ? [] : category === 'Clients' ? model.acquisitionSeries.map(item => ({ ...item, value: item.count })) : category === 'Projects' ? model.projectSeries.map(item => ({ ...item, value: item.count })) : category === 'Invoices' ? model.collectionSeries.map(item => ({ ...item, value: (item.amount || 0) / 100, comparison: item.comparison == null ? undefined : item.comparison / 100 })) : model.chart.map(item => ({ label: item.label, from: item.from, to: item.to, value: item[metric], comparison: item.comparison }));
  const mainTitle = category === 'Clients' ? 'Client acquisition' : category === 'Projects' ? 'Project starts' : category === 'Invoices' ? 'Invoice collection' : 'Financial performance';
  const mainFormat = category === 'Clients' || category === 'Projects' ? 'count' : 'money';
  const mainUnavailable = category === 'Invoices' ? Boolean(model?.collectionSeries.some(item => item.amount === null)) : category === 'Overview' || category === 'Financial' ? chartUnavailable : false;
  const mainEmpty = category === 'Clients' ? !model?.acquired.length : category === 'Projects' ? !data?.projects.some(project => inside(project.created_at, range)) : category === 'Invoices' ? !model?.paid.length : !data?.tx.some(row => inside(row.date, range));
  return <div className="analytics-page">
    <div className="analytics-toolbar">
      <div className="analytics-toolbar-left"><PillNav className="analytics-pill-tabs" items={categories.map(label => ({ label }))} selectedIndex={categories.indexOf(category)} onItemClick={item => { setCategory(item.label as Category); setSelected(null); }} theme="light" size="md" layout="joined" surface="glass" itemStyle="plain" hoverEffect="glide" indicator="pill" collapse="never" intro ariaLabel="Analytics sections" /><p className="analytics-range"><CalendarDays size={14} /> {range.from} to {range.to}{baseline && ' · compared with ' + baseline.from + ' to ' + baseline.to}</p></div>
      <button className="analytics-mobile-controls" type="button" onClick={() => setMobileControls(true)}><CalendarDays size={16} /> Period</button>
      <div className="analytics-controls-wrap">
    {mobileControls && <button className="analytics-backdrop" type="button" aria-label="Close period controls" onClick={() => setMobileControls(false)} />}
    <div className={'analytics-controls ' + (mobileControls ? 'is-open' : '')}><div className="analytics-sheet-head"><strong>Period & comparison</strong><button type="button" onClick={() => setMobileControls(false)}>Done</button></div><AnalyticsCompareSelect value={compare} onChange={setCompare} /><div className="analytics-period-controls"><RubberSegment className="analytics-rubber-periods" trackColor="#eeebfa" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Date range" items={presets} value={preset} onChange={value => setPreset(value as Preset)} size="md" />{preset === 'Custom' && <div className="analytics-date-pair analytics-date-pair--period"><label>From<input type="date" value={custom.from} max={localDay()} onChange={event => setCustom(value => ({ ...value, from: event.target.value }))} /></label><label>To<input type="date" value={custom.to} max={localDay()} onChange={event => setCustom(value => ({ ...value, to: event.target.value }))} /></label></div>}</div>{compare === 'custom' && <div className="analytics-date-pair"><label>Comparison from<input type="date" value={other.from} max={localDay()} onChange={event => setOther(value => ({ ...value, from: event.target.value }))} /></label><label>Comparison to<input type="date" value={other.to} max={localDay()} onChange={event => setOther(value => ({ ...value, to: event.target.value }))} /></label></div>}</div>
      </div>
    </div>
    {dateError && <div className="analytics-error" role="alert">{dateError}</div>}
    {error && <div className="analytics-error" role="alert">{error} <button type="button" onClick={refresh}>Try again</button></div>}
    {loading && !data ? <div className="analytics-loading" aria-label="Loading analytics"><div className="analytics-kpis">{[0, 1, 2, 3].map(item => <div className="analytics-skeleton" key={item} />)}</div><div className="analytics-skeleton analytics-skeleton--wide" /></div> : model && <DashboardContentTransition transitionKey={category}>
      <section className="analytics-kpis" aria-label={category + ' key metrics'}>{model.kpis.map(item => <AnalyticsBalance key={item.label} label={item.label} value={item.value} prior={item.prior} kind={item.kind} currency={currency} note={item.note} history={item.value === null ? undefined : item.trend?.map((value, index) => ({ value: item.kind === 'money' ? Math.round(value * 100) : value, label: model.chart[index]?.label || 'Interval' }))} corner={20} />)}</section>
      <div className="analytics-main-grid"><AnalyticsMainChart title={mainTitle} subtitle={category === 'Overview' || category === 'Financial' ? 'Recorded transactions · ' + currency : category === 'Clients' ? 'New client records' : category === 'Projects' ? 'New project records' : 'Payments by actual payment date'} data={mainChartData} compare={Boolean(baseline)} currency={currency} format={mainFormat} kind={chartKind} setKind={setChartKind} options={category === 'Overview' || category === 'Financial' ? metrics.map(item => ({ value: item.key, label: item.label })) : undefined} option={metric} setOption={value => { setMetric(value as Metric); setSelected(null); }} unavailable={mainUnavailable} empty={mainEmpty} expanded={expanded} setExpanded={setExpanded} selected={selected} setSelected={setSelected} /><section className="analytics-panel analytics-insights"><div className="analytics-panel-head"><div><h2>Business signals</h2><p>Changes visible in your records</p></div></div>{model.insights.length ? <ul>{model.insights.map(item => <li key={item}><span />{item}</li>)}</ul> : <div className="analytics-insight-empty"><Activity size={24} /><strong>Nothing unusual yet</strong><p>Significant changes and collection risks will appear as your records grow.</p></div>}</section></div>
      <div className="analytics-detail-grid">
        {(category === 'Overview' || category === 'Financial') && <><section className="analytics-panel"><div className="analytics-panel-head"><div><h2>Revenue & expenses</h2><p>Recorded movement in this period</p></div></div><div className="analytics-mini-chart"><ChartBar data={model.chart.map(({ label, revenue, expenses }) => ({ label, revenue, expenses }))} index="label" series={[{ key: 'revenue', label: 'Revenue', color: '#16845E' }, { key: 'expenses', label: 'Expenses', color: '#B64E5D' }]} showLegend currency={currency} title="Revenue and expenses" description="Recorded transactions" height={210} surface="light" bare total="none" valueFormat={value => money(Math.round(value * 100), currency)} /></div></section><section className="analytics-panel analytics-summary"><div className="analytics-panel-head"><div><h2>Profitability</h2><p>Cash-basis result</p></div></div><strong className="analytics-summary-value"><AnimatedMetricValue value={valueText(model.now.profit, 'money', currency)}/></strong><div className="analytics-summary-row"><span>Profit margin</span><strong>{model.now.revenue && model.now.profit !== null ? Math.round(model.now.profit / model.now.revenue * 100) + '%' : 'N/A'}</strong></div><div className="analytics-summary-row"><span>Net cash movement</span><strong>{valueText(model.now.cash, 'money', currency)}</strong></div><p className="analytics-footnote">Revenue and cash inflow currently share the same recorded income source.</p></section></>}
        {(category === 'Overview' || category === 'Clients') && <><section className="analytics-panel"><div className="analytics-panel-head"><div><h2>Client contribution</h2><p>Income linked to clients in this period</p></div></div>{model.clientRevenue.length ? <AnimatedList className="analytics-client-list" items={model.clientRevenue.map((client, index) => ({ id: client.id, title: client.name, description: `#${String(index + 1).padStart(2, '0')} contributor`, meta: valueText(client.revenue, 'money', currency) }))} theme="light" width="100%" maxHeight={195} radius={9} gap={3} frame={false} fadeSize={28} /> : <p className="analytics-empty">No clients yet.</p>}</section><section className="analytics-panel analytics-summary"><div className="analytics-panel-head"><div><h2>Client acquisition</h2><p>Created in this period</p></div></div><strong className="analytics-summary-value"><AnimatedMetricValue value={model.acquired.length}/></strong><div className="analytics-summary-row"><span>All-time clients</span><strong>{data?.clients.length}</strong></div><div className="analytics-summary-row"><span>Clients with linked income</span><strong>{model.clientRevenue.filter(item => item.revenue !== null && item.revenue > 0).length}</strong></div><p className="analytics-footnote">Income without a client link stays in overall revenue.</p></section></>}
        {category === 'Projects' && <><section className="analytics-panel"><div className="analytics-panel-head"><div><h2>Project status</h2><p>Current state across all projects</p></div></div>{[...new Set(data?.projects.map(project => project.status) || [])].map(status => <div className="analytics-summary-row" key={status}><span>{status}</span><strong>{data?.projects.filter(project => project.status === status).length}</strong></div>)}{Boolean(data?.projects.length) && <div className="analytics-summary-row"><span>Completion rate</span><strong>{Math.round((data?.projects.filter(project => project.status === 'Completed').length || 0) / (data?.projects.length || 1) * 100)}%</strong></div>}{!data?.projects.length && <p className="analytics-empty">No projects yet.</p>}</section><section className="analytics-panel"><div className="analytics-panel-head"><div><h2>Delivery watch</h2><p>Open projects past their deadline</p></div></div><div className="analytics-ranked">{data?.projects.filter(project => project.deadline && project.deadline < localDay() && project.status !== 'Completed').slice(0, 6).map(project => <div key={project.id}><strong>{project.name}</strong><b>{project.deadline}</b></div>)}{!data?.projects.some(project => project.deadline && project.deadline < localDay() && project.status !== 'Completed') && <p>No overdue deadlines.</p>}</div><p className="analytics-footnote">Completion trends need a completion date, which projects do not currently store.</p></section></>}
        {category === 'Invoices' && <><section className="analytics-panel"><div className="analytics-panel-head"><div><h2>Collection activity</h2><p>Actual payment dates in this period</p></div></div><div className="analytics-ranked">{model.paid.slice().sort((a, b) => b.paid_on.localeCompare(a.paid_on)).slice(0, 7).map(payment => <div key={payment.id}><span>{payment.paid_on}</span><strong>{data?.invoices.find(invoice => invoice.id === payment.invoice_id)?.invoice_number || 'Invoice'}</strong><b>{valueText(model.paymentValue(payment), 'money', currency)}</b></div>)}{!model.paid.length && <p>No payments in this period.</p>}</div></section><section className="analytics-panel analytics-summary"><div className="analytics-panel-head"><div><h2>Collection position</h2><p>Invoices issued in this period</p></div></div><strong className="analytics-summary-value"><AnimatedMetricValue value={valueText(model.outstanding, 'money', currency)}/></strong><div className="analytics-summary-row"><span>Total invoiced</span><strong>{valueText(sum(model.issued.map(model.invoiceValue)), 'money', currency)}</strong></div><div className="analytics-summary-row"><span>Paid in period</span><strong>{valueText(sum(model.paid.map(model.paymentValue)), 'money', currency)}</strong></div><div className="analytics-summary-row"><span>Past due</span><strong>{valueText(model.overdue, 'money', currency)}</strong></div><p className="analytics-footnote">Paid in period can include earlier invoices. Outstanding refers to invoices issued in this period.</p></section></>}
      </div>{category === 'Projects' && <section className="analytics-panel analytics-project-performance"><div className="analytics-panel-head"><div><h2>Project performance</h2><p>Income and expenses linked to projects in this period</p></div></div><div className="analytics-project-rows">{model.projectPerformance.slice(0, 8).map(project => <div key={project.id}><strong>{project.name}</strong><span>Revenue {valueText(project.revenue, 'money', currency)}</span><span>Expenses {valueText(project.expenses, 'money', currency)}</span><b>Net {valueText(project.profit, 'money', currency)}</b></div>)}{!model.projectPerformance.length && <p className="analytics-empty">No transactions are linked to projects in this period.</p>}</div></section>}<p className="analytics-method">Transactions use historical rates at their dates. Invoice payments use payment dates. Missing currency data appears as unavailable.</p>
    </DashboardContentTransition>}
  </div>;
}
