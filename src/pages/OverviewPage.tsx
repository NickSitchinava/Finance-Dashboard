import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";
import { useCurrency } from "../hooks/useCurrency";
import SwipeToast from "../components/ui/SwipeToast";
import AnimatedList from "../components/ui/AnimatedList";
import RubberSegment from "../components/ui/RubberSegment";
import DashboardMetricCard from "../components/ui/DashboardMetricCard";
import AnimatedMetricValue from "../components/ui/AnimatedMetricValue";
import { dashboardSnapshot, saveDashboardSnapshot } from "../lib/dashboardCache";
import { chartBuckets, compactMoney, convertedCents, loadRates, money, periodBounds, previousBounds } from "../lib/finance";
import type { Currency, FinanceTransaction, RateMap } from "../lib/finance";
import { buildAttentionItems, dateKey, daysFrom, groupReadiness, isPendingInvoice, parseDay } from "./overviewAttention";
import "./OverviewPage.css";

type Project = { id: string; name: string; status: string; deadline: string | null; hours_logged: number | null; clients: { name: string } | null };
type Transaction = { id: string; type: string; amount: number; income_amount: number | null; expense_amount: number | null; description: string | null; created_at: string; date: string; currency: Currency | null };
type Invoice = { id: string; invoice_number: string; client_name: string; amount: number; due_date: string | null; status: string };
type Goal = { id: string; title: string; target_date: string; percent_complete: number | null };
type FinancialDay = { date: string; revenue: number; expenses: number; revenueCents: number; expensesCents: number; unresolved: number };
type FinancialSummary = { revenue: number; expenses: number; days: FinancialDay[]; unresolved: number; rates: RateMap; fetchedFrom: string };
type WidgetId = "finance" | "attention" | "projects" | "briefing" | "recent";
type Widget = { id: WidgetId; visible: boolean };
type Data = { projects: Project[]; transactions: Transaction[]; invoices: Invoice[]; goals: Goal[] };
type Metric = "revenue" | "expenses" | "net";
type Period = "30d" | "3m" | "6m" | "12m";
type KpiPeriod = Period | "custom";
type Resource<T> = { data: T | null; status: "loading" | "refreshing" | "ready" | "error"; error: string | null };
type ResourceHandle<T> = Resource<T> & { retry: () => void };
type Source = "projects" | "invoices" | "goals" | "finance" | "clients" | "projectCount" | "recent" | "preferences";

const WIDGET_NAMES: Record<WidgetId, string> = {
  finance: "Financial performance", attention: "Needs attention", projects: "Active projects",
  briefing: "Daily briefing", recent: "Recent transactions",
};
const DEFAULT_WIDGETS: Widget[] = (Object.keys(WIDGET_NAMES) as WidgetId[]).map(id => ({ id, visible: true }));
const EMPTY_DATA: Data = { projects: [], transactions: [], invoices: [], goals: [] };
const EMPTY_FINANCIAL: FinancialSummary = { revenue: 0, expenses: 0, days: [], unresolved: 0, rates: {}, fetchedFrom: "" };
const shortDate = (value: string) => parseDay(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const income = (row: Transaction) => Number(row.income_amount ?? (row.type === "Income" ? row.amount : 0)) || 0;
const expense = (row: Transaction) => Number(row.expense_amount ?? (row.type === "Expense" ? row.amount : 0)) || 0;

function normalizeWidgets(value: unknown): Widget[] {
  if (!Array.isArray(value)) return DEFAULT_WIDGETS;
  const valid = value.filter((item): item is Widget =>
    !!item && typeof item === "object" && typeof item.id === "string" &&
    Object.hasOwn(WIDGET_NAMES, item.id) && typeof item.visible === "boolean");
  const unique = valid.filter((item, index) => valid.findIndex(other => other.id === item.id) === index);
  return [...unique, ...DEFAULT_WIDGETS.filter(item => !unique.some(other => other.id === item.id))];
}

async function allRows<T>(table: string, columns: string, userId: string): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; ; start += 500) {
    const base = supabase.from(table).select(columns).eq("user_id", userId);
    const query = table === "projects" ? base.in("status", ["In Progress", "Review", "Overdue"]) : table === "invoices" ? base.in("status", ["Pending", "Overdue"]) : base;
    const { data, error } = await query.order("id", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    result.push(...(data as T[] || []));
    if (!data || data.length < 500) return result;
  }
}

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;
}
function Pencil() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
}
function Kpi({ label, value, detail, tone = "" }: { label: string; value: React.ReactNode; detail: string; tone?: string }) {
  return <DashboardMetricCard className={`overview__kpi ${tone}`} label={label} value={value} detail={detail}/>;
}

function useDashboardResource<T>(key: string, fetcher: () => Promise<T>): ResourceHandle<T> {
  const [state, setState] = useState<Resource<T>>(() => {
    const data = dashboardSnapshot<T>(key);
    return { data, status: data === null ? "loading" : "ready", error: null };
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void fetcher().then(data => {
      if (active) { saveDashboardSnapshot(key, data); setState({ data, status: "ready", error: null }); }
    }).catch(error => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "Could not load this section.";
      setState(previous => previous.data === null
        ? { data: null, status: "error", error: message }
        : { ...previous, status: "ready", error: message });
    });
    return () => { active = false; };
  }, [key, fetcher, revision]);
  const retry = useCallback(() => {
    setState(previous => ({ ...previous, status: previous.data === null ? "loading" : "refreshing", error: null }));
    setRevision(value => value + 1);
  }, []);
  return { ...state, retry };
}

function SkeletonLine({ width = "100%", height = 10 }: { width?: string; height?: number }) {
  return <span className="overview__skel-line" style={{ width, height }} aria-hidden="true"/>;
}

function WidgetSkeleton({ kind }: { kind: WidgetId }) {
  if (kind === "finance") return <div className="overview__skeleton overview__skeleton--finance" role="status" aria-label="Loading Financial Performance"><div className="overview__skel-head"><div><SkeletonLine width="160px" height={15}/><SkeletonLine width="132px" height={9}/></div><SkeletonLine width="154px" height={30}/></div><SkeletonLine width="245px" height={34}/><div className="overview__skel-value"><SkeletonLine width="120px" height={25}/><SkeletonLine width="105px" height={9}/></div><div className="overview__skel-chart"><div className="overview__skel-gridlines"/><div className="overview__skel-chart-line"/></div><SkeletonLine width="190px" height={9}/></div>;
  if (kind === "attention") return <div className="overview__skeleton" role="status" aria-label="Loading Needs Attention"><div className="overview__skel-head"><div><SkeletonLine width="130px" height={15}/><SkeletonLine width="145px" height={9}/></div><SkeletonLine width="26px" height={26}/></div><div className="overview__skel-rows">{[0, 1, 2, 3].map(index => <div className="overview__skel-row" key={index}><SkeletonLine width="8px" height={8}/><div><SkeletonLine width="75%" height={10}/><SkeletonLine width="45%" height={8}/></div><SkeletonLine width="48px" height={9}/></div>)}</div></div>;
  if (kind === "projects") return <div className="overview__skeleton" role="status" aria-label="Loading Active Projects"><div className="overview__skel-head"><div><SkeletonLine width="126px" height={15}/><SkeletonLine width="110px" height={9}/></div><SkeletonLine width="73px" height={9}/></div><div className="overview__skel-rows">{[0, 1, 2, 3].map(index => <div className="overview__skel-row overview__skel-row--project" key={index}><SkeletonLine width="33px" height={33}/><div><SkeletonLine width="70%" height={10}/><SkeletonLine width="48%" height={8}/></div><SkeletonLine width="58px" height={9}/></div>)}</div></div>;
  if (kind === "briefing") return <div className="overview__skeleton" role="status" aria-label="Loading Daily Briefing"><div className="overview__skel-head"><SkeletonLine width="110px" height={15}/><SkeletonLine width="22px" height={22}/></div><div className="overview__skel-briefing"><SkeletonLine width="95%" height={10}/><SkeletonLine width="68%" height={10}/></div></div>;
  return <div className="overview__skeleton" role="status" aria-label="Loading Recent Transactions"><div className="overview__skel-head"><div><SkeletonLine width="155px" height={15}/><SkeletonLine width="110px" height={9}/></div><SkeletonLine width="70px" height={9}/></div><div className="overview__skel-rows">{[0, 1, 2].map(index => <div className="overview__skel-row overview__skel-row--transaction" key={index}><SkeletonLine width="29px" height={29}/><div><SkeletonLine width="70%" height={10}/><SkeletonLine width="40%" height={8}/></div><SkeletonLine width="58px" height={10}/></div>)}</div></div>;
}

function WidgetError({ title, retry }: { title: string; retry: () => void }) {
  return <div className="overview__widget-error" role="alert"><strong>{title} unavailable</strong><p>We could not load this section.</p><button type="button" onClick={retry}>Retry</button></div>;
}

export default function OverviewPage() {
  const { user, loading } = useAuth();
  if (!user) return loading ? <div className="overview__loading" role="status">Loading your overview…</div> : null;
  return <OverviewDashboard key={user.id} userId={user.id}/>;
}

function OverviewDashboard({ userId }: { userId: string }) {
  const { currency, symbol, format } = useCurrency();
  const displayCurrency = currency as Currency;
  const displayMoney = (value: number) => value < 0 ? `−${symbol}${Math.abs(value).toLocaleString()}` : format(value);
  const [kpiPeriod, setKpiPeriod] = useState<KpiPeriod>("6m");
  const [kpiFrom, setKpiFrom] = useState(() => periodBounds("6m", "", "").from);
  const [kpiTo, setKpiTo] = useState(() => periodBounds("6m", "", "").to);
  const kpiBounds = useMemo(() => periodBounds(kpiPeriod, kpiFrom, kpiTo), [kpiPeriod, kpiFrom, kpiTo]);
  const kpiRangeValid = Boolean(kpiBounds.from && kpiBounds.to && kpiBounds.from <= kpiBounds.to);
  const financeHistoryFrom = dateKey(new Date(new Date().getFullYear(), new Date().getMonth() - 24, 1));
  const financeFetchFrom = kpiPeriod === "custom" && kpiRangeValid && kpiBounds.from < financeHistoryFrom ? kpiBounds.from : financeHistoryFrom;
  const projectsQuery = useCallback(() => allRows<Project>("projects", "id,name,status,deadline,hours_logged,clients(name)", userId), [userId]);
  const invoicesQuery = useCallback(() => allRows<Invoice>("invoices", "id,invoice_number,client_name,amount,due_date,status", userId), [userId]);
  const goalsQuery = useCallback(() => allRows<Goal>("goals", "id,title,target_date,percent_complete", userId), [userId]);
  const financeQuery = useCallback(async () => {
    const rows: FinanceTransaction[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("transactions").select("id,user_id,type,amount,description,date,category,category_id,currency,client_id,project_id,recurring_occurrence_id,income_amount,expense_amount,income_category,expense_category,income_notes,expense_notes").eq("user_id", userId).gte("date", financeFetchFrom).order("date").range(offset, offset + 499);
      if (error) throw error;
      rows.push(...((data ?? []) as FinanceTransaction[]));
      if (!data || data.length < 500) break;
    }
    const rateDates = rows.filter(row => row.currency && row.currency !== displayCurrency).map(row => row.date);
    const rates = rateDates.length ? await loadRates(rateDates) : {};
    const daily = new Map<string, FinancialDay>();
    let revenue = 0, expenses = 0, unresolved = 0;
    for (const row of rows) {
      const amount = convertedCents(row, displayCurrency, rates);
      const day = daily.get(row.date) ?? { date: row.date, revenue: 0, expenses: 0, revenueCents: 0, expensesCents: 0, unresolved: 0 };
      if (amount === null) { if (row.date >= financeHistoryFrom) unresolved++; day.unresolved++; daily.set(row.date, day); continue; }
      if (row.type === "Income") { day.revenue += amount / 100; day.revenueCents += amount; revenue += amount; }
      else { day.expenses += amount / 100; day.expensesCents += amount; expenses += amount; }
      daily.set(row.date, day);
    }
    return { revenue: revenue / 100, expenses: expenses / 100, days: [...daily.values()], unresolved, rates, fetchedFrom: financeFetchFrom };
  }, [userId, displayCurrency, financeFetchFrom, financeHistoryFrom]);
  const clientsQuery = useCallback(async () => {
    const { count, error } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true);
    if (error) throw error;
    return count ?? 0;
  }, [userId]);
  const projectCountQuery = useCallback(async () => {
    const { count, error } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (error) throw error;
    return count ?? 0;
  }, [userId]);
  const recentQuery = useCallback(async () => {
    const { data, error } = await supabase.from("transactions").select("id,type,amount,income_amount,expense_amount,description,created_at,date,currency").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    return data as Transaction[] || [];
  }, [userId]);
  const preferencesQuery = useCallback(async () => {
    const { data, error } = await supabase.from("overview_preferences").select("widgets").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return normalizeWidgets(data?.widgets);
  }, [userId]);
  const projectsResource = useDashboardResource(`${userId}|overview|projects`, projectsQuery);
  const invoicesResource = useDashboardResource(`${userId}|overview|invoices`, invoicesQuery);
  const goalsResource = useDashboardResource(`${userId}|overview|goals`, goalsQuery);
  const financeResource = useDashboardResource(`${userId}|overview|finance|${displayCurrency}|${financeFetchFrom}`, financeQuery);
  const clientsResource = useDashboardResource(`${userId}|overview|clients`, clientsQuery);
  const projectCountResource = useDashboardResource(`${userId}|overview|project-count`, projectCountQuery);
  const recentResource = useDashboardResource(`${userId}|overview|recent`, recentQuery);
  const preferencesResource = useDashboardResource(`${userId}|overview|preferences`, preferencesQuery);
  const data: Data = {
    projects: projectsResource.data ?? EMPTY_DATA.projects,
    invoices: invoicesResource.data ?? EMPTY_DATA.invoices,
    goals: goalsResource.data ?? EMPTY_DATA.goals,
    transactions: recentResource.data ?? EMPTY_DATA.transactions,
  };
  const financial = financeResource.data ?? EMPTY_FINANCIAL;
  const recentMoney = (row: Transaction, amount: number) => {
    if (!row.currency) return '—';
    const converted = convertedCents({ type: row.type as 'Income' | 'Expense', amount, currency: row.currency, date: row.date }, displayCurrency, financial.rates);
    return converted === null ? '—' : money(converted, displayCurrency);
  };
  const resources: Record<Source, ResourceHandle<unknown>> = {
    projects: projectsResource, invoices: invoicesResource, goals: goalsResource,
    finance: financeResource, clients: clientsResource, projectCount: projectCountResource,
    recent: recentResource, preferences: preferencesResource,
  };
  const groups: Record<"kpis" | WidgetId, Source[]> = {
    kpis: ["finance", "clients", "projectCount", "projects"],
    finance: ["finance"], attention: ["projects", "invoices", "goals"],
    projects: ["projects"], briefing: ["projects", "invoices"], recent: ["recent"],
  };
  const groupState = (group: keyof typeof groups) => {
    return groupReadiness(groups[group].map(source => resources[source].status));
  };
  const retryGroup = (group: keyof typeof groups) => groups[group].forEach(source => {
    if (resources[source].status === "error" || resources[source].error) resources[source].retry();
  });
  const [savedOverride, setSavedOverride] = useState<Widget[] | null>(null);
  const saved = savedOverride ?? preferencesResource.data ?? DEFAULT_WIDGETS;
  const [draft, setDraft] = useState(DEFAULT_WIDGETS);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditErrorState] = useState("");
  const [notice, setNoticeState] = useState("");
  const [errorSequence, setErrorSequence] = useState(0);
  const [noticeSequence, setNoticeSequence] = useState(0);
  const setEditError = (message: string) => { setEditErrorState(message); if (message) setErrorSequence(value => value + 1); };
  const setNotice = (message: string) => { setNoticeState(message); if (message) setNoticeSequence(value => value + 1); };
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<Metric>("revenue");
  const [shownMetric, setShownMetric] = useState<Metric>("revenue");
  const [chartFading, setChartFading] = useState(false);
  const transitionRef = useRef<number | null>(null);
  const headerSlot = document.getElementById("overview-header-actions");
  const today = dateKey();
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => () => { if (transitionRef.current !== null) clearTimeout(transitionRef.current); }, []);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]");
      if (link && !window.confirm("Discard unsaved dashboard changes?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeLink, true); };
  }, [dirty]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (!dirty || window.confirm("Discard unsaved dashboard changes?"))) {
        setDraft(saved); setEditing(false); setEditError("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, dirty, saved]);

  const activeProjects = useMemo(() => data.projects.filter(project => ["In Progress", "Review", "Overdue"].includes(project.status)), [data.projects]);
  const prioritized = useMemo(() => [...activeProjects].sort((a, b) => {
    const rank = (p: Project) => p.deadline ? daysFrom(p.deadline, today) < 0 ? 0 : daysFrom(p.deadline, today) <= 7 ? 1 : 2 : 3;
    return rank(a) - rank(b) || (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.name.localeCompare(b.name);
  }).slice(0, 4), [activeProjects, today]);
  const outstanding = data.invoices.filter(isPendingInvoice);
  const attention = buildAttentionItems(activeProjects, outstanding, data.goals, today, displayMoney);
  const overdueCount = attention.filter(item => daysFrom(item.date, today) < 0).length;
  const soonCount = attention.filter(item => daysFrom(item.date, today) >= 0 && daysFrom(item.date, today) <= 7).length;
  const kpiCovered = Boolean(financial.fetchedFrom && financial.fetchedFrom <= kpiBounds.from);
  const kpiTotals = useMemo(() => financial.days.reduce((totals, day) => {
    if (day.date >= kpiBounds.from && day.date <= kpiBounds.to) {
      totals.revenue += day.revenueCents;
      totals.expenses += day.expensesCents;
      totals.unresolved += day.unresolved;
    }
    return totals;
  }, { revenue: 0, expenses: 0, unresolved: 0 }), [financial.days, kpiBounds.from, kpiBounds.to]);
  const kpiReady = kpiRangeValid && kpiCovered && kpiTotals.unresolved === 0;
  const kpiPeriodLabel = kpiPeriod === "30d" ? "Last 30 days" : kpiPeriod === "3m" ? "Last 3 months" : kpiPeriod === "6m" ? "Last 6 months" : kpiPeriod === "12m" ? "Last 12 months" : "Custom range";
  const widgetList = editing ? draft : saved.filter(widget => widget.visible);
  const standardLayout = !editing && saved.every((widget, index) => widget.visible && widget.id === DEFAULT_WIDGETS[index].id);

  const chart = useMemo(() => {
    if (!kpiRangeValid || !kpiCovered) return [];
    const bins = chartBuckets(kpiPeriod, kpiBounds.from, kpiBounds.to).map(bin => ({ ...bin, net: 0 }));
    financial.days.forEach(day => {
      const bin = bins.find(item => day.date >= item.from && day.date <= item.to);
      if (bin) { bin.revenue += day.revenueCents / 100; bin.expenses += day.expensesCents / 100; bin.net = bin.revenue - bin.expenses; }
    });
    return bins;
  }, [financial.days, kpiPeriod, kpiBounds.from, kpiBounds.to, kpiRangeValid, kpiCovered]);
  const chartTotalCents = shownMetric === "revenue" ? kpiTotals.revenue : shownMetric === "expenses" ? kpiTotals.expenses : kpiTotals.revenue - kpiTotals.expenses;
  const hasChart = kpiReady && chart.some(item => item.revenue || item.expenses);
  const previousPeriod = useMemo(() => {
    if (!kpiRangeValid) return { covered: false, hasRecords: false, unresolved: 0, totalCents: 0 };
    const bounds = previousBounds(kpiBounds.from, kpiBounds.to);
    const rows = financial.days.filter(day => day.date >= bounds.from && day.date <= bounds.to);
    const totalCents = rows.reduce((sum, day) => sum + (shownMetric === "revenue" ? day.revenueCents : shownMetric === "expenses" ? day.expensesCents : day.revenueCents - day.expensesCents), 0);
    return { covered: Boolean(financial.fetchedFrom && financial.fetchedFrom <= bounds.from), hasRecords: rows.length > 0, unresolved: rows.reduce((sum, day) => sum + day.unresolved, 0), totalCents };
  }, [financial.days, financial.fetchedFrom, kpiBounds.from, kpiBounds.to, kpiRangeValid, shownMetric]);

  function selectChart(next: Metric) {
    setSelectedMetric(next);
    if (transitionRef.current !== null) clearTimeout(transitionRef.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShownMetric(next); setChartFading(false); return; }
    setChartFading(true);
    transitionRef.current = window.setTimeout(() => {
      setShownMetric(next);
      window.requestAnimationFrame(() => setChartFading(false));
    }, 140);
  }
  function move(index: number, delta: number) {
    const next = [...draft]; const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  }
  function cancel() {
    if (dirty && !window.confirm("Discard unsaved dashboard changes?")) return;
    setDraft(saved); setEditError(""); setEditing(false);
  }
  async function save() {
    if (!draft.some(widget => widget.visible)) { setEditError("Keep at least one widget visible."); return; }
    setSaving(true); setEditError("");
    const { error } = await supabase.from("overview_preferences").upsert({ user_id: userId, layout_version: 1, widgets: draft, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) setEditError(`Could not save layout: ${error.message}`);
    else { saveDashboardSnapshot(`${userId}|overview|preferences`, draft); setSavedOverride(draft); setEditing(false); setNotice("Dashboard layout saved"); }
  }

  return <>
    {headerSlot && createPortal(
      editing ? <div className="overview__header-edit"><button className="overview__header-cancel" onClick={cancel}>Cancel</button><button className="overview__header-save" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save layout"}</button></div>
        : <button className="overview__edit" aria-label="Customize dashboard" title="Customize dashboard" disabled={preferencesResource.status !== "ready"} onClick={() => { setDraft(saved); setEditing(true); }}><Pencil/></button>,
      headerSlot,
    )}
    <div className="overview"><div className="overview__inner">
      {editing && <div className="overview__edit-banner"><div><strong>Customize dashboard</strong><span>Move widgets or choose which ones to show.</span></div><div className="overview__mobile-edit"><button onClick={cancel}>Cancel</button><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save layout"}</button></div></div>}
      {preferencesResource.status === "error" && <div className="overview__partial" role="alert"><span>Dashboard layout preferences could not be loaded.</span><button type="button" onClick={preferencesResource.retry}>Retry</button></div>}
        <div className="overview__kpi-controls"><span>Financial period</span><div className="overview__period-controls">{kpiPeriod === "custom" && <div className="overview__kpi-custom"><label>From <input type="date" value={kpiFrom} max={kpiTo} onChange={event => setKpiFrom(event.target.value)}/></label><label>To <input type="date" value={kpiTo} min={kpiFrom} onChange={event => setKpiTo(event.target.value)}/></label></div>}<RubberSegment className="overview__rubber-periods" trackColor="#f6f4fa" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Overview financial date range" items={["30d", "3m", "6m", "12m", { value: "custom", label: "Custom" }]} value={kpiPeriod} onChange={value => setKpiPeriod(value as KpiPeriod)} size="md" /></div></div>
        {kpiPeriod === "custom" && !kpiRangeValid && <p className="overview__kpi-range-error" role="alert">Choose a valid date range.</p>}
        {kpiRangeValid && !kpiCovered && financeResource.error && <p className="overview__kpi-range-error" role="alert">Could not load this date range. <button type="button" onClick={financeResource.retry}>Retry</button></p>}
        <section className="overview__kpis" aria-label="Business summary">
          {groupState("kpis") === "loading" ? [0, 1, 2, 3, 4].map(index => <div key={index} className={`dashboard-metric overview__kpi overview__kpi-skeleton ${index === 0 ? "overview__kpi--primary" : index === 1 ? "overview__kpi--tint" : ""}`} role="status" aria-label="Loading business summary"><SkeletonLine width="72%" height={10}/><SkeletonLine width="58%" height={27}/><SkeletonLine width="82%" height={9}/></div>) : groupState("kpis") === "error" ? <div className="overview__kpi-error" role="alert"><strong>Business summary unavailable</strong><span>One or more metrics could not be loaded.</span><button type="button" onClick={() => retryGroup("kpis")}>Retry</button></div> : <>
            <Kpi label="Recorded Revenue" value={kpiReady ? money(kpiTotals.revenue, displayCurrency) : kpiRangeValid && !kpiCovered && !financeResource.error ? <SkeletonLine width="58%" height={27}/> : '—'} detail={kpiReady ? `${kpiPeriodLabel} · income transactions` : !kpiRangeValid ? "Choose a valid date range" : !kpiCovered ? financeResource.error ? "Date range unavailable" : "Loading date range" : "Currencies need review"} tone="overview__kpi--primary"/>
            <Kpi label="Net profit" value={kpiReady ? money(kpiTotals.revenue - kpiTotals.expenses, displayCurrency) : kpiRangeValid && !kpiCovered && !financeResource.error ? <SkeletonLine width="58%" height={27}/> : '—'} detail={kpiReady ? `${kpiPeriodLabel} · income less expenses` : !kpiRangeValid ? "Choose a valid date range" : !kpiCovered ? financeResource.error ? "Date range unavailable" : "Loading date range" : "Currencies need review"} tone="overview__kpi--tint"/>
            <Kpi label="Total Clients" value={clientsResource.data ?? 0} detail="Active client records"/>
            <Kpi label="Total Projects" value={projectCountResource.data ?? 0} detail="All project statuses"/>
            <Kpi label="Active Projects" value={activeProjects.length} detail="Currently in motion"/>
          </>}
        </section>
          <div className={`overview__grid${standardLayout ? " overview__grid--standard" : ""}`}>
            {widgetList.map((widget, index) => { const state = groupState(widget.id); return <section key={widget.id} className={`overview__panel overview__panel--${widget.id}${widget.visible ? "" : " overview__panel--hidden"}`} aria-label={WIDGET_NAMES[widget.id]}>
              {editing && <div className="overview__widget-tools"><strong>{WIDGET_NAMES[widget.id]}</strong><div><button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${WIDGET_NAMES[widget.id]} up`}>↑</button><button onClick={() => move(index, 1)} disabled={index === draft.length - 1} aria-label={`Move ${WIDGET_NAMES[widget.id]} down`}>↓</button><button onClick={() => setDraft(draft.map(item => item.id === widget.id ? { ...item, visible: !item.visible } : item))} aria-label={`${widget.visible ? "Hide" : "Show"} ${WIDGET_NAMES[widget.id]}`}>{widget.visible ? "Hide" : "Show"}</button></div></div>}
              {widget.visible && state === "loading" && <WidgetSkeleton kind={widget.id}/>}
              {widget.visible && state === "error" && <WidgetError title={WIDGET_NAMES[widget.id]} retry={() => retryGroup(widget.id)}/>}
              {widget.visible && state === "ready" && <div className="overview__revealed">{groups[widget.id].some(source => resources[source].status === "refreshing") && <span className="overview__refreshing">Refreshing…</span>}{groups[widget.id].some(source => resources[source].error) && <div className="overview__refresh-error">Latest refresh failed. <button type="button" onClick={() => retryGroup(widget.id)}>Retry</button></div>}
              {widget.id === "finance" && <>
                <div className="overview__panel-head overview__finance-head"><div><h2>Financial Performance</h2></div></div>
                <RubberSegment className="overview__rubber-metrics" trackColor="#f5f3fa" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Financial metric" items={[{ value: "revenue", label: "Revenue" }, { value: "expenses", label: "Expenses" }, { value: "net", label: "Net profit" }]} value={selectedMetric} onChange={value => selectChart(value as Metric)} size="md" />
                <div className={`overview__chart-content${chartFading ? " is-fading" : ""}`}>
                  <div className="overview__chart-summary"><strong>{kpiReady ? <AnimatedMetricValue value={money(chartTotalCents, displayCurrency)}/> : '—'}</strong><span>{kpiReady ? !previousPeriod.covered ? "Previous period outside loaded history" : previousPeriod.unresolved ? "Resolve prior-period currencies to compare" : previousPeriod.hasRecords ? `${chartTotalCents - previousPeriod.totalCents >= 0 ? "+" : "−"}${money(Math.abs(chartTotalCents - previousPeriod.totalCents), displayCurrency)} vs previous period` : "No prior-period comparison" : !kpiRangeValid ? "Choose a valid date range" : !kpiCovered ? financeResource.error ? "Date range unavailable" : "Loading selected date range" : "Resolve transaction currencies in Finances"}</span></div>
                  {hasChart ?
                    <div className="overview__chart" role="img" aria-label={`${shownMetric === "net" ? "Net profit" : shownMetric} over ${kpiPeriodLabel}: ${money(chartTotalCents, displayCurrency)}`}>
                      <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="overviewArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6248b4" stopOpacity={0.24}/><stop offset="100%" stopColor="#6248b4" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e7e3f0" strokeDasharray="3 5"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7e7891", fontSize: 11 }} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#7e7891", fontSize: 11 }} tickFormatter={value => compactMoney(Number(value), displayCurrency)}/><Tooltip formatter={value => displayMoney(Number(value))} contentStyle={{ border: "1px solid #ded8ee", borderRadius: 10, boxShadow: "0 12px 32px #21145218", fontSize: 12 }}/><Area type="monotone" dataKey={shownMetric} stroke="#4935a5" strokeWidth={2.5} fill="url(#overviewArea)" activeDot={{ r: 5, fill: "#27187e" }} isAnimationActive="auto" animationBegin={0} animationDuration={650} animationEasing="ease-in-out"/></AreaChart></ResponsiveContainer>
                    </div> : <div className="overview__empty-chart"><strong>{kpiReady ? "No transactions in this period" : !kpiRangeValid ? "Choose a valid date range" : !kpiCovered ? financeResource.error ? "Date range unavailable" : "Loading selected date range" : "Currencies need review"}</strong><p>{kpiReady ? "Financial trends will appear as records are added." : !kpiCovered ? "The chart will update when this range is ready." : "Assign original currencies in Finances to see reliable trends."}</p></div>}
                </div>
                <div className="overview__panel-foot"><span>Unpaid invoices are excluded from recorded revenue.</span><Link to="/finances">View finances <Arrow/></Link></div>
              </>}
              {widget.visible && widget.id === "attention" && <>
                <div className="overview__panel-head"><div><h2>Needs Attention</h2><p>{overdueCount ? `${overdueCount} overdue · ` : ""}{soonCount} due within 7 days</p></div><span className="overview__count">{attention.length}</span></div>
                {attention.length ? <><div className={`overview__attention-list${attentionExpanded ? " is-expanded" : ""}`}>{(attentionExpanded ? attention : attention.slice(0, 5)).map(item => { const days = daysFrom(item.date, today); const aged = item.kind === "invoice" && days < -30; return <Link to={item.path} key={item.id} className="overview__attention-item"><span className={`overview__priority-dot${aged ? " is-aged" : days < 0 ? " is-overdue" : days <= 7 ? " is-soon" : ""}${item.kind === "invoice" ? " is-invoice" : ""}`}/><span className="overview__item-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><em className={days < 0 && !aged ? "is-overdue" : ""}>{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : days === 1 ? "Tomorrow" : shortDate(item.date)}</em></Link>; })}</div>{attention.length > 5 && <button className="overview__attention-more" type="button" onClick={() => setAttentionExpanded(value => !value)}>{attentionExpanded ? "Show fewer" : `View all ${attention.length} alerts`}</button>}</> : <div className="overview__empty"><strong>Nothing pressing right now</strong><p>Upcoming deadlines will appear here.</p></div>}
              </>}
              {widget.visible && widget.id === "projects" && <>
                <div className="overview__panel-head"><div><h2>Active Projects</h2><p>Prioritized by deadline</p></div><Link className="overview__text-link" to="/projects">All projects <Arrow/></Link></div>
                {prioritized.length ? <div className="overview__projects-list">{prioritized.map(project => <Link to="/projects" key={project.id} className="overview__project"><span className="overview__project-avatar">{project.name.slice(0, 1).toUpperCase()}</span><span className="overview__project-main"><strong>{project.name}</strong><small>{project.clients?.name || "Independent project"} · {project.status}</small></span><span className="overview__project-meta"><strong className={project.deadline && daysFrom(project.deadline, today) < 0 ? "is-overdue" : ""}>{project.deadline ? shortDate(project.deadline) : "No deadline"}</strong><small>{Number(project.hours_logged || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}h logged</small></span></Link>)}</div> : <div className="overview__empty"><strong>No active projects</strong><p>Projects in progress will appear here.</p></div>}
              </>}
              {widget.visible && widget.id === "briefing" && <>
                <div className="overview__panel-head"><div><h2>Daily Briefing</h2></div><span className="overview__briefing-mark" aria-hidden="true">●</span></div>
                <p className="overview__briefing">{activeProjects.length === 0 && outstanding.length === 0 && (!goalsResource.data || attention.length === 0) ? "Your workspace is clear. New activity and deadlines will appear here." : <>You have <strong>{activeProjects.length} active {activeProjects.length === 1 ? "project" : "projects"}</strong>{outstanding.length ? <>, <strong>{outstanding.length} outstanding {outstanding.length === 1 ? "invoice" : "invoices"}</strong></> : null}{goalsResource.data && soonCount ? <>, <strong>{soonCount} item{soonCount === 1 ? "" : "s"} due this week</strong></> : null}{goalsResource.data && overdueCount ? <>, and <strong>{overdueCount} overdue</strong></> : null}.</>}</p>
              </>}
              {widget.visible && widget.id === "recent" && <>
                <div className="overview__panel-head"><div><h2>Recent Transactions</h2><p>Latest recorded activity</p></div><Link className="overview__text-link" to="/finances">All activity <Arrow/></Link></div>
                {data.transactions.length ? <AnimatedList className="overview__recent-list" items={data.transactions.map(row => ({ id: row.id, icon: <span className={`overview__transaction-icon${expense(row) > 0 && income(row) === 0 ? " is-expense" : ""}`}>{expense(row) > 0 && income(row) === 0 ? "−" : "+"}</span>, title: row.description?.trim() || (income(row) > 0 && expense(row) > 0 ? "Income and expense" : income(row) > 0 ? "Income transaction" : "Expense transaction"), description: new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), meta: <span className="overview__recent-amount">{income(row) > 0 && <strong>+{recentMoney(row, income(row))}</strong>}{expense(row) > 0 && <strong className="is-expense">−{recentMoney(row, expense(row))}</strong>}</span> }))} theme="light" width="100%" maxHeight={148} radius={9} gap={3} frame={false} fadeSize={28} /> : <div className="overview__empty"><strong>No transactions yet</strong><p>Recent activity will appear here.</p></div>}
              </>}
              </div>}
            </section>; })}
          </div>
    </div></div>
    {createPortal(<div className="app-toast-viewport" aria-label="Notifications"><AnimatePresence initial={false}>
      {editError && <SwipeToast key={`error-${errorSequence}`} kind="error" message={editError} onClose={() => setEditError("")}/>}
      {notice && <SwipeToast key={`notice-${noticeSequence}`} kind="success" message={notice} onClose={() => setNotice("")}/>}
    </AnimatePresence></div>, document.body)}
  </>;
}
