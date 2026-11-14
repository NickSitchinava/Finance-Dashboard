import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';
import { useCurrency } from '../hooks/useCurrency';
import { chartBuckets, compactMoney, comparison, convertedCents, currencySymbol, loadRates, money, periodBounds, previousBounds, sumType, txCents } from '../lib/finance';
import type { Currency, FinanceTransaction, RateMap, TxType } from '../lib/finance';
import FinanceTransactionModal from './FinanceTransactionModal';
import FinanceScheduleModal from './FinanceScheduleModal';
import { FinanceBreakdownSkeleton, FinanceCategoriesSkeleton, FinanceChartSkeleton, FinanceKpiSkeleton, FinanceLoadError, FinanceProjectSkeleton, FinanceRecurringSkeleton, FinanceReportsSkeleton, FinanceSkeletonLine, FinanceTransactionSkeleton } from './FinanceSkeletons';
import { ChartBar } from '../components/ui/chart-bar';
import { FinanceDonut } from '../components/ui/finance-donut';
import { FinanceCategoryIcon } from '../components/ui/finance-category-icon';
import { FinanceCategoryPicker } from '../components/ui/finance-category-picker';
import SwipeToast from '../components/ui/SwipeToast';
import DashboardMetricCard from '../components/ui/DashboardMetricCard';
import DashboardContentTransition from '../components/ui/DashboardContentTransition';
import AnimatedMetricValue from '../components/ui/AnimatedMetricValue';
import { dashboardSnapshot, saveDashboardSnapshot } from '../lib/dashboardCache';
import PillNav from '../components/ui/PillNav';
import RubberSegment from '../components/ui/RubberSegment';
import { Seek } from '../components/ui/Seek';
import '../components/ui/Seek.css';
import type { Category, LinkedInvoice, Named } from './FinanceTransactionModal';
import './FinancesPage.css';

type Period = '30d' | '3m' | '6m' | '12m' | 'custom';
type Panel = 'Main' | 'Transactions' | 'Recurring' | 'Categories' | 'Reports';
type Schedule = { id: string; type: TxType; amount: number; currency: Currency; description: string; category: string | null; category_id: string | null; client_id: string | null; project_id: string | null; notes: string | null; frequency: string; start_on: string; end_on: string | null; next_on: string; occurrence_index: number; status: 'active' | 'paused' | 'cancelled' };
type Occurrence = { id: string; schedule_id: string; due_on: string; status: 'expected' | 'recorded' | 'dismissed'; transaction_id: string | null };
type Metric = 'revenue' | 'profit' | 'compare';
type ChartKind = 'area' | 'bar';
type Filters = { search: string; type: string; category: string; currency: string; client: string; project: string; recurring: string; sort: string };
type FilterKey = Exclude<keyof Filters, 'sort'>;
type Resource<T> = { key: string; version: string; data: T | null; error: string | null };
type FinanceData = { rows: FinanceTransaction[]; rates: RateMap };
type MetaData = { clients: Named[]; projects: (Named & { client_id?: string })[]; categories: Category[]; invoices: LinkedInvoice[]; paymentTransactionIds: string[] };
type RecurringData = { schedules: Schedule[]; occurrences: Occurrence[] };
type LedgerData = { rows: FinanceTransaction[]; count: number };
const emptyFilters: Filters = { search: '', type: '', category: '', currency: '', client: '', project: '', recurring: '', sort: 'newest' };
const PAGE_SIZE = 12;
const INCOME_COLORS = ['#16845E','#5BBE93','#9ADBBC','#319E78','#B6E5CC','#D4F0E0'];
const EXPENSE_COLORS = ['#B64E5D','#E18D9A','#F0B8C0','#CF6978','#F3D1D3','#F8E4E6'];
const cashNote = 'Cash basis: only recorded transactions count. Invoices and expected recurring items are excluded.';
const EMPTY_TRANSACTIONS: FinanceTransaction[] = [];
const EMPTY_META: MetaData = { clients: [], projects: [], categories: [], invoices: [], paymentTransactionIds: [] };
const EMPTY_RECURRING: RecurringData = { schedules: [], occurrences: [] };
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined,{ month:'short',day:'numeric',year:'numeric' });
const csvCell = (value: unknown) => { const text = String(value ?? ''); return `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"','""')}"`; };

async function fetchAll(userId: string, from: string, to: string): Promise<FinanceTransaction[]> {
  const all: FinanceTransaction[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('transactions').select('*, clients(name), projects(name)').eq('user_id',userId).gte('date',from).lte('date',to).order('date',{ascending:false}).order('id',{ascending:false}).range(offset,offset+499);
    if (error) throw error;
    all.push(...((data ?? []) as FinanceTransaction[]));
    if (!data || data.length < 500) break;
  }
  return all;
}

async function fetchFinanceData(userId: string, from: string, to: string, currency: Currency): Promise<FinanceData> {
  const rows = await fetchAll(userId, from, to);
  const rateDates = [...new Set(rows.filter(row => row.currency && row.currency !== currency).map(row => row.date))];
  const rates = rateDates.length ? await loadRates(rateDates) : {};
  return { rows, rates };
}

async function fetchMetaData(userId: string): Promise<MetaData> {
  const [clientResult,projectResult,categoryResult,invoiceResult,paymentResult] = await Promise.all([
    supabase.from('clients').select('id,name').eq('user_id',userId).order('name'),
    supabase.from('projects').select('id,name,client_id').eq('user_id',userId).order('name'),
    supabase.from('financial_categories').select('*').eq('user_id',userId).order('name'),
    supabase.from('invoices').select('id,invoice_number,status,amount,client_id,lifecycle_state,archived_at').eq('user_id',userId).order('invoice_number'),
    supabase.from('invoice_payments').select('transaction_id').eq('user_id',userId).is('reversed_at',null),
  ]);
  for (const result of [clientResult,projectResult,categoryResult,invoiceResult,paymentResult]) if (result.error) throw result.error;
  let categories = (categoryResult.data ?? []) as Category[];
  if (!categories.length) {
    const legacy = await supabase.from('transactions').select('type,category,income_category,expense_category').eq('user_id',userId).limit(1000);
    if (legacy.error) throw legacy.error;
    const names = new Map<string,{name:string;type:TxType}>();
    for (const row of legacy.data ?? []) {
      const type = row.type as TxType;
      const name = type === 'Income' ? row.income_category || row.category : row.expense_category || row.category;
      if (name?.trim()) names.set(`${type}:${name.toLowerCase()}`,{name,type});
    }
    for (const item of [{name:'Client work',type:'Income' as TxType},{name:'Software & SaaS',type:'Expense' as TxType}]) {
      if (![...names.values()].some(value=>value.type===item.type)) names.set(`${item.type}:${item.name.toLowerCase()}`,item);
    }
    const inserted = await supabase.from('financial_categories').insert([...names.values()].map(item=>({user_id:userId,...item,icon:'tag',color:item.type==='Income'?'#4935A5':'#8F639D'}))).select('*');
    if (!inserted.error) categories = (inserted.data ?? []) as Category[];
  }
  return {
    clients: (clientResult.data ?? []) as Named[],
    projects: (projectResult.data ?? []) as (Named & { client_id?: string })[],
    categories,
    invoices: (invoiceResult.data ?? []) as LinkedInvoice[],
    paymentTransactionIds: (paymentResult.data ?? []).map(row=>row.transaction_id).filter((id):id is string=>!!id),
  };
}

async function fetchRecurringData(userId: string, from: string, to: string): Promise<RecurringData> {
  const [scheduleResult,occurrenceResult] = await Promise.all([
    supabase.from('recurring_schedules').select('*').eq('user_id',userId).order('next_on'),
    supabase.from('recurring_occurrences').select('*').eq('user_id',userId).gte('due_on',from).lte('due_on',to).order('due_on',{ascending:false}).limit(100),
  ]);
  if (scheduleResult.error) throw scheduleResult.error;
  if (occurrenceResult.error) throw occurrenceResult.error;
  return { schedules: (scheduleResult.data ?? []) as Schedule[], occurrences: (occurrenceResult.data ?? []) as Occurrence[] };
}

function useFinanceResource<T>(key: string, revision: number, fetcher: () => Promise<T>) {
  const owner = (value: string) => value.startsWith('[') ? String(JSON.parse(value)[0] ?? '') : value.split('|')[0];
  const [retryCount, setRetryCount] = useState(0);
  const version = `${revision}:${retryCount}`;
  const [state, setState] = useState<Resource<T>>(() => ({ key, version: '', data: dashboardSnapshot<T>(`finance|${key}`), error: null }));
  useEffect(() => {
    if (!key) return;
    let live = true;
    void fetcher().then(data => {
      if (live) { saveDashboardSnapshot(`finance|${key}`, data); setState({ key, version, data, error: null }); }
    }).catch(cause => {
      if (!live) return;
      const error = cause instanceof Error ? cause.message : 'Could not load this section.';
      setState(previous => previous.data !== null && owner(previous.key) === owner(key)
        ? { ...previous, version, error }
        : { key, version, data: null, error });
    });
    return () => { live = false; };
  }, [key, version, fetcher]);
  const cached = dashboardSnapshot<T>(`finance|${key}`);
  const previousData = owner(state.key) === owner(key) ? state.data : null;
  const data = state.key === key ? state.data : cached ?? previousData;
  const sourceKey = state.key === key || cached !== null ? key : previousData !== null ? state.key : key;
  const error = state.error;
  const status = data === null ? error && state.version === version ? 'error' : 'loading' : sourceKey === key && state.version === version ? 'ready' : 'refreshing';
  const retry = useCallback(() => setRetryCount(value => value + 1), []);
  return { data, sourceKey, error, status, retry } as const;
}

function Breakdown({ title, rows, categories, currency, rates, available, onSelect }: { title: string; rows: FinanceTransaction[]; categories: Category[]; currency: Currency; rates: RateMap; available: boolean; onSelect: (category: string) => void }) {
  const [activeIndex,setActiveIndex] = useState<number|null>(null);
  const totals = new Map<string, number>();
  const categoryIds = new Map<string, string>();
  for (const row of rows) {
    const value = convertedCents(row,currency,rates);
    if (value === null) continue;
    const category = row.type === 'Income' ? row.income_category || row.category || 'Uncategorized' : row.expense_category || row.category || 'Uncategorized';
    totals.set(category,(totals.get(category) || 0)+value);
    if (row.category_id && !categoryIds.has(category)) categoryIds.set(category,row.category_id);
  }
  const ranked = [...totals].sort((a,b)=>b[1]-a[1]);
  const total = ranked.reduce((sum,[,value])=>sum+value,0);
  const isIncome=title.startsWith('Income');
  const palette=isIncome?INCOME_COLORS:EXPENSE_COLORS;
  const categoryType: TxType = isIncome ? 'Income' : 'Expense';
  const categoryColor = (name: string, index: number) => categories.find(item=>item.id===categoryIds.get(name) && item.type===categoryType)?.color
    ?? categories.find(item=>item.name===name && item.type===categoryType)?.color
    ?? palette[index % palette.length];
  return <section className={`finance-panel finance-breakdown ${isIncome?'finance-breakdown--income':'finance-breakdown--expense'}`}>
    <div className="finance-panel__head"><div><h2>{title}</h2><p>{isIncome?'Income':'Expenses'} by category</p></div></div>
    {!available?<div className="finance-empty">Resolve missing currencies or rates to view this breakdown.</div>:ranked.length ? <div className="finance-breakdown__content"><FinanceDonut title={title} label={isIncome?'Income':'Expenses'} currency={currency} segments={ranked.map(([name,value],index)=>({label:name,value,color:categoryColor(name,index)}))} activeIndex={activeIndex !== null && activeIndex < ranked.length ? activeIndex : null} onActiveChange={setActiveIndex}/><div className="finance-breakdown__list">{ranked.map(([name,value],index)=><button type="button" key={name} className={`finance-breakdown__item ${activeIndex===index?'is-active':''}`} onMouseEnter={()=>setActiveIndex(index)} onMouseLeave={()=>setActiveIndex(null)} onFocus={()=>setActiveIndex(index)} onBlur={()=>setActiveIndex(null)} onClick={()=>onSelect(name)} title={`Filter transactions by ${name}`}><span className={`finance-breakdown__mark ${index % 2 === 1?'finance-breakdown__mark--striped':''}`} style={{backgroundColor:categoryColor(name,index)}} aria-hidden="true"/><span className="finance-breakdown__name">{name}</span><strong><AnimatedMetricValue value={money(value,currency)}/></strong><small><AnimatedMetricValue value={total ? Math.round(value/total*100) : 0}/>%</small></button>)}</div></div> : <div className="finance-empty">No {isIncome?'income':'expenses'} in this period.</div>}
  </section>;
}

function MetricCard({ label, value, detail, primary=false, tone='' }: { label: string; value: string; detail: React.ReactNode; primary?: boolean; tone?: string }) {
  return <DashboardMetricCard className={`finance-metric ${primary?'finance-metric--primary':''} ${tone}`} label={label} value={value} detail={detail}/>;
}

const ChartAreaIcon = () => <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 16h16M2 13l5-5 4 3 6-7"/><path d="M2 13v3h15V4l-6 7-4-3-5 5Z" fill="currentColor" fillOpacity=".16" stroke="none"/></svg>;
const ChartBarsIcon = () => <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M2 17h16M4 17V9h3v8M9 17V4h3v13M14 17v-6h3v6"/></svg>;

export default function FinancesPage() {
  const { user } = useAuth();
  const { currency: preference } = useCurrency();
  const currency = (['USD','EUR','GEL'].includes(preference) ? preference : 'USD') as Currency;
  const [period,setPeriod] = useState<Period>('6m');
  const [customFrom,setCustomFrom] = useState(today());
  const [customTo,setCustomTo] = useState(today());
  const [panel,setPanel] = useState<Panel>('Main');
  const [metric,setMetric] = useState<Metric>('compare');
  const [chartKind,setChartKind] = useState<ChartKind>('area');
  const chartViewportRef=useRef<HTMLDivElement>(null);
  const [expandedChart,setExpandedChart] = useState(false);
  const [mobileFilters,setMobileFilters] = useState(false);
  const [filters,setFilters] = useState<Filters>(emptyFilters);
  const [debouncedSearch,setDebouncedSearch] = useState('');
  const [page,setPage] = useState(0);
  const [error,setErrorState] = useState('');
  const [notice,setNoticeState] = useState('');
  const [errorSequence,setErrorSequence] = useState(0);
  const [noticeSequence,setNoticeSequence] = useState(0);
  const setError = (message: string) => { setErrorState(message); if(message) setErrorSequence(value=>value+1); };
  const setNotice = (message: string) => { setNoticeState(message); if(message) setNoticeSequence(value=>value+1); };
  const [revision,setRevision] = useState(0);
  const [modalOpen,setModalOpen] = useState(false);
  const [edit,setEdit] = useState<FinanceTransaction|null>(null);
  const [occurrenceId,setOccurrenceId] = useState<string|null>(null);
  const [scheduleToEdit,setScheduleToEdit] = useState<Schedule|null>(null);
  const [categoryForm,setCategoryForm] = useState({ id:'', name:'',type:'Expense' as TxType, icon:'tag',color:'#7664CC' });
  const [legacyCurrency,setLegacyCurrency] = useState<Currency | ''>('');
  const [busy,setBusy] = useState(false);
  const bounds = useMemo(()=>periodBounds(period,customFrom,customTo),[period,customFrom,customTo]);
  const priorBounds = useMemo(()=>previousBounds(bounds.from,bounds.to),[bounds]);
  const updateFilters = (patch: Partial<Filters>) => { setFilters(value=>({...value,...patch})); setPage(0); };
  const removeFilter = (key: FilterKey) => { setFilters(value=>({...value,[key]:''})); setPage(0); };
  const refresh = () => setRevision(value=>value+1);
  const notify = (message: string) => { setNotice(message); refresh(); };

  useEffect(()=>{ const timer=window.setTimeout(()=>setDebouncedSearch(filters.search.trim()),250); return ()=>window.clearTimeout(timer); },[filters.search]);
  useEffect(()=>{if(!expandedChart)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpandedChart(false);};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[expandedChart]);

  const userId = user?.id ?? '';
  const currentKey = userId ? `${userId}|${bounds.from}|${bounds.to}|${currency}` : '';
  const priorKey = userId ? `${userId}|${priorBounds.from}|${priorBounds.to}|${currency}` : '';
  const recurringKey = userId ? `${userId}|${bounds.from}|${bounds.to}` : '';
  const currentQuery = useCallback(() => fetchFinanceData(userId,bounds.from,bounds.to,currency),[userId,bounds.from,bounds.to,currency]);
  const priorQuery = useCallback(() => fetchFinanceData(userId,priorBounds.from,priorBounds.to,currency),[userId,priorBounds.from,priorBounds.to,currency]);
  const metaQuery = useCallback(() => fetchMetaData(userId),[userId]);
  const recurringQuery = useCallback(() => fetchRecurringData(userId,bounds.from,bounds.to),[userId,bounds.from,bounds.to]);
  const currentResource = useFinanceResource(currentKey,revision,currentQuery);
  const priorResource = useFinanceResource(priorKey,revision,priorQuery);
  const metaResource = useFinanceResource(userId,revision,metaQuery);
  const recurringResource = useFinanceResource(recurringKey,revision,recurringQuery);
  const [lastReadyPeriod, setLastReadyPeriod] = useState<Period>(period);
  useEffect(() => { if (currentResource.status === 'ready') setLastReadyPeriod(period); }, [currentResource.status, period]);
  const displayPeriod = currentResource.sourceKey === currentKey ? period : lastReadyPeriod;
  const sourceParts = currentResource.sourceKey.split('|');
  const displayBounds = sourceParts.length >= 4 && sourceParts[0] === userId
    ? { from: sourceParts[1], to: sourceParts[2] } : bounds;
  const displayedPrior = previousBounds(displayBounds.from, displayBounds.to);
  const priorSourceParts = priorResource.sourceKey.split('|');
  const analytics = currentResource.data?.rows ?? EMPTY_TRANSACTIONS;
  const prior = priorResource.data?.rows ?? EMPTY_TRANSACTIONS;
  const rates = useMemo(() => ({ ...currentResource.data?.rates, ...priorResource.data?.rates }),[currentResource.data?.rates,priorResource.data?.rates]);
  const {clients,projects,categories,invoices,paymentTransactionIds} = metaResource.data ?? EMPTY_META;
  const {schedules,occurrences} = recurringResource.data ?? EMPTY_RECURRING;
  const currentReady = currentResource.data !== null;
  const priorReady = priorResource.data !== null && priorSourceParts[1] === displayedPrior.from && priorSourceParts[2] === displayedPrior.to;
  const metaReady = metaResource.data !== null;
  const recurringReady = recurringResource.data !== null;

  const safeSearch = debouncedSearch.replace(/[%,().]/g,'').slice(0,80);
  const relatedIds = safeSearch ? [...clients.filter(item=>item.name.toLowerCase().includes(safeSearch.toLowerCase())).map(item=>item.id),...projects.filter(item=>item.name.toLowerCase().includes(safeSearch.toLowerCase())).map(item=>item.id)].join(',') : '';
  const searchSettling = filters.search.trim() !== debouncedSearch;
  const ledgerKey = userId ? JSON.stringify([userId,bounds.from,bounds.to,filters.type,filters.category,filters.currency,filters.client,filters.project,filters.recurring,filters.sort,safeSearch,relatedIds,page]) : '';
  const ledgerQuery = useCallback(async (): Promise<LedgerData> => {
    let query=supabase.from('transactions').select('*, clients(name), projects(name)',{count:'exact'}).eq('user_id',userId).gte('date',bounds.from).lte('date',bounds.to);
    if(filters.type) query=query.eq('type',filters.type);
    if(filters.category) query=query.or(`category.eq.${filters.category},income_category.eq.${filters.category},expense_category.eq.${filters.category}`);
    if(filters.currency) query=query.eq('currency',filters.currency);
    if(filters.client) query=query.eq('client_id',filters.client);
    if(filters.project) query=query.eq('project_id',filters.project);
    if(filters.recurring==='yes') query=query.not('recurring_occurrence_id','is',null);
    if(filters.recurring==='no') query=query.is('recurring_occurrence_id',null);
    if(safeSearch) query=query.or(`description.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%${relatedIds?`,client_id.in.(${relatedIds}),project_id.in.(${relatedIds})`:''}`);
    const asc=filters.sort==='oldest'||filters.sort==='lowest';
    query=query.order(filters.sort==='highest'||filters.sort==='lowest'?'amount':'date',{ascending:asc}).order('id',{ascending:false}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
    const {data,count,error:queryError}=await query;
    if(queryError) throw queryError;
    return { rows: (data??[]) as FinanceTransaction[], count: count??0 };
  },[userId,bounds.from,bounds.to,filters.type,filters.category,filters.currency,filters.client,filters.project,filters.recurring,filters.sort,safeSearch,relatedIds,page]);
  const ledgerResource = useFinanceResource(ledgerKey,revision,ledgerQuery);
  const ledger = ledgerResource.data?.rows ?? EMPTY_TRANSACTIONS;
  const totalRows = ledgerResource.data?.count ?? 0;
  const ledgerLoading = searchSettling || ledgerResource.status === 'loading';
  const transactionLoading = ledgerLoading || (!currentReady && currentResource.status !== 'error');
  const transactionError = ledgerResource.status === 'error' || (!currentReady && currentResource.status === 'error');
  const categoryOptions = [...new Set(categories.map(item=>item.name))];
  if (filters.category && !categoryOptions.includes(filters.category)) categoryOptions.push(filters.category);
  const activeFilterChips: { key: FilterKey; label: string }[] = [
    ...(filters.search.trim() ? [{ key: 'search' as const, label: `Search: ${filters.search.trim()}` }] : []),
    ...(filters.type ? [{ key: 'type' as const, label: `Type: ${filters.type}` }] : []),
    ...(filters.category ? [{ key: 'category' as const, label: `Category: ${filters.category}` }] : []),
    ...(filters.currency ? [{ key: 'currency' as const, label: `Currency: ${filters.currency}` }] : []),
    ...(filters.client ? [{ key: 'client' as const, label: `Client: ${clients.find(item=>item.id===filters.client)?.name??filters.client}` }] : []),
    ...(filters.project ? [{ key: 'project' as const, label: `Project: ${projects.find(item=>item.id===filters.project)?.name??filters.project}` }] : []),
    ...(filters.recurring ? [{ key: 'recurring' as const, label: filters.recurring==='yes'?'From schedule':'One-time' }] : []),
  ];
  const filterCount = activeFilterChips.length;
  const revenue=sumType(analytics,'Income',currency,rates), expenses=sumType(analytics,'Expense',currency,rates);
  const prevRevenue=sumType(prior,'Income',currency,rates), prevExpenses=sumType(prior,'Expense',currency,rates);
  const unresolved=revenue.unresolved+expenses.unresolved, priorUnresolved=prevRevenue.unresolved+prevExpenses.unresolved;
  const known=unresolved===0, priorKnown=priorUnresolved===0;
  const net=revenue.cents-expenses.cents, prevNet=prevRevenue.cents-prevExpenses.cents;
  const showMoney=(value:number,valid=known)=>valid?money(value,currency):'—';
  const comparisonText=(value:number,previous:number)=>known&&priorKnown?comparison(value,previous):'Resolve currency to compare';
  const chartData=useMemo(()=>{
    if(!known)return [];
    const bins=chartBuckets(displayPeriod,displayBounds.from,displayBounds.to);
    for(const row of analytics){
      const entry=bins.find(bin=>row.date>=bin.from&&row.date<=bin.to);
      if(!entry)continue;
      const value=(convertedCents(row,currency,rates)??0)/100;
      if(row.type==='Income')entry.revenue+=value;else entry.expenses+=value;
      entry.profit=entry.revenue-entry.expenses;entry.cash=entry.profit;
    }
    return bins;
  },[analytics,displayPeriod,displayBounds.from,displayBounds.to,currency,rates,known]);
  const chartKeys=metric==='compare'?['revenue','expenses']:[metric];
  const chartTotal=metric==='revenue'?revenue.cents:net;
  const chartPrevious=metric==='revenue'?prevRevenue.cents:prevNet;
  const chartSeries=chartKeys.map(key=>({key,label:key==='profit'?'Net profit':key==='revenue'?'Income':'Expenses',color:key==='revenue'?INCOME_COLORS[0]:key==='expenses'?EXPENSE_COLORS[0]:net<0?EXPENSE_COLORS[0]:INCOME_COLORS[0]}));
  useEffect(()=>{const viewport=chartViewportRef.current;if(!viewport)return;if(expandedChart){viewport.scrollLeft=0;return;}if(chartData.length<=6||!window.matchMedia('(max-width: 768px)').matches)return;const firstActive=chartData.findIndex(item=>item.revenue||item.expenses);if(firstActive>=0)viewport.scrollLeft=Math.max(0,(firstActive-1)*68);},[chartData,chartKind,period,expandedChart]);
  const projectSummary=useMemo(()=>projects.map(project=>{const rows=analytics.filter(row=>row.project_id===project.id);const inc=sumType(rows,'Income',currency,rates),exp=sumType(rows,'Expense',currency,rates);return {...project,revenue:inc.cents,expenses:exp.cents,profit:inc.cents-exp.cents,unresolved:inc.unresolved+exp.unresolved};}).filter(item=>item.revenue||item.expenses||item.unresolved).sort((a,b)=>b.revenue-a.revenue),[projects,analytics,currency,rates]);
  const legacyCount=analytics.filter(row=>!row.currency).length;
  const scheduledDraft = useMemo(()=>{
    const occurrence=occurrences.find(item=>item.id===occurrenceId);
    const schedule=schedules.find(item=>item.id===occurrence?.schedule_id);
    if(!occurrence||!schedule)return null;
    return {type:schedule.type,amount:schedule.amount,currency:schedule.currency,description:schedule.description,category_id:schedule.category_id,client_id:schedule.client_id,project_id:schedule.project_id,notes:schedule.notes,due_on:occurrence.due_on};
  },[occurrenceId,occurrences,schedules]);

  async function deleteTransaction(row: FinanceTransaction){if(!user||!window.confirm(`Delete “${row.description}”? This cannot be undone.`))return;setBusy(true);const result=await supabase.from('transactions').delete().eq('id',row.id).eq('user_id',user.id);setBusy(false);if(result.error)setError(result.error.message);else notify('Transaction deleted.');}
  async function saveCategory(event:React.FormEvent){event.preventDefault();if(!user||busy)return;setBusy(true);const payload={user_id:user.id,name:categoryForm.name.trim(),type:categoryForm.type,icon:categoryForm.icon,color:categoryForm.color};const result=categoryForm.id?await supabase.from('financial_categories').update(payload).eq('id',categoryForm.id).eq('user_id',user.id):await supabase.from('financial_categories').insert(payload);setBusy(false);if(result.error)setError(result.error.message);else{setCategoryForm({id:'',name:'',type:'Expense',icon:'tag',color:'#7664CC'});notify(categoryForm.id?'Category updated.':'Category created.');}}
  async function archiveCategory(item:Category){if(!user||!window.confirm(`Archive “${item.name}”? Historical transactions keep their category.`))return;const result=await supabase.from('financial_categories').update({archived_at:new Date().toISOString()}).eq('id',item.id).eq('user_id',user.id);if(result.error)setError(result.error.message);else notify('Category archived.');}
  async function resolveLegacy(){if(!user||!legacyCurrency||!window.confirm(`Assign ${legacyCurrency} to all your transactions without currency metadata? Only do this if every original amount was entered in ${legacyCurrency}.`))return;setBusy(true);const result=await supabase.from('transactions').update({currency:legacyCurrency}).eq('user_id',user.id).is('currency',null);setBusy(false);if(result.error)setError(result.error.message);else notify(`Legacy transactions assigned ${legacyCurrency}.`);}
  async function setScheduleStatus(item:Schedule,status:Schedule['status']){if(!user)return;if(status==='cancelled'&&!window.confirm(`Cancel “${item.description}”? Existing recorded transactions stay intact.`))return;const result=await supabase.from('recurring_schedules').update({status}).eq('id',item.id).eq('user_id',user.id);if(result.error)setError(result.error.message);else notify(`Schedule ${status}.`);}
  async function dismissOccurrence(item:Occurrence){if(!user)return;const result=await supabase.from('recurring_occurrences').update({status:'dismissed'}).eq('id',item.id).eq('user_id',user.id);if(result.error)setError(result.error.message);else notify('Expected occurrence dismissed.');}
  function recordOccurrence(item:Occurrence){const schedule=schedules.find(value=>value.id===item.schedule_id);if(!schedule)return;setEdit(null);setOccurrenceId(item.id);setModalOpen(true);}
  function exportCsv(){const rows=analytics.map(row=>{const converted=convertedCents(row,currency,rates);return [row.date,row.type,row.description,row.category??'',row.clients?.name??'',row.projects?.name??'',invoices.find(item=>item.id===row.invoice_id)?.invoice_number??'',(txCents(row)/100).toFixed(2),row.currency??'UNRESOLVED',converted===null?'':(converted/100).toFixed(2),converted===null?'':currency,row.currency&&row.currency!==currency?rates[row.date]?.sourceDate??'':''].map(csvCell).join(',')});const header=['Date','Type','Description','Category','Client','Project','Invoice','Original amount','Original currency','Converted amount','Display currency','Rate date'].map(csvCell).join(',');const blob=new Blob(['\ufeff',header,'\r\n',...rows.map(row=>`${row}\r\n`)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`f-dash-finances-${displayBounds.from}-${displayBounds.to}.csv`;a.click();URL.revokeObjectURL(url);setNotice('CSV exported.');}
  const pdfMoney = (cents: number, code: Currency) => `${currencySymbol(code)} ${(cents / 100).toFixed(2)}`;
  async function exportPdf() {
    if (!known) { setError('Resolve currencies and exchange rates before exporting a consolidated PDF report.'); return; }
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      let y = 27;
      const startPage = () => { pdf.addPage(); y = 22; };
      const ensureSpace = (height: number) => { if (y + height > 277) startPage(); };
      const line = (label: string, value: string) => {
        ensureSpace(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(label.slice(0, 68), 16, y);
        pdf.text(value, 194, y, { align: 'right' });
        y += 7;
      };
      const section = (title: string) => {
        ensureSpace(17);
        y += 5;
        pdf.setDrawColor(220, 216, 233);
        pdf.line(16, y, 194, y);
        y += 8;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(title, 16, y);
        y += 7;
      };
      pdf.setFillColor(39, 24, 126);
      pdf.rect(0, 0, 210, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('F-DASH  /  FINANCIAL REPORT', 16, 13);
      pdf.setTextColor(33, 27, 59);
      pdf.setFontSize(10);
      pdf.text(`${formatDate(displayBounds.from)} - ${formatDate(displayBounds.to)}  |  ${currency}`, 16, y);
      y += 7;
      pdf.setFontSize(8);
      pdf.text(`Generated ${new Date().toLocaleString()}  |  Cash basis`, 16, y);
      y += 10;
      line('Revenue', pdfMoney(revenue.cents, currency));
      line('Expenses', pdfMoney(expenses.cents, currency));
      line('Net profit / recorded cash flow', pdfMoney(net, currency));
      for (const type of ['Income', 'Expense'] as TxType[]) {
        const grouped = new Map<string, number>();
        for (const row of analytics.filter(item => item.type === type)) {
          const name = type === 'Income' ? row.income_category || row.category || 'Uncategorized' : row.expense_category || row.category || 'Uncategorized';
          grouped.set(name, (grouped.get(name) ?? 0) + (convertedCents(row, currency, rates) ?? 0));
        }
        section(`${type} by category`);
        if (!grouped.size) line('No recorded activity', '');
        for (const [name, cents] of [...grouped].sort((a, b) => b[1] - a[1])) line(name, pdfMoney(cents, currency));
      }
      section('Clients');
      for (const client of clients.filter(item => analytics.some(row => row.client_id === item.id))) {
        const rows = analytics.filter(row => row.client_id === client.id);
        line(client.name, pdfMoney(sumType(rows, 'Income', currency, rates).cents - sumType(rows, 'Expense', currency, rates).cents, currency));
      }
      section('Projects');
      for (const project of projectSummary) line(project.name, pdfMoney(project.profit, currency));
      section('Recorded transactions');
      for (const row of analytics) {
        const converted = convertedCents(row, currency, rates) ?? 0;
        const original = row.currency ? pdfMoney(txCents(row), row.currency) : 'UNRESOLVED';
        line(`${row.date}  ${row.type}  ${row.description}  [${original}]`, pdfMoney(converted, currency));
      }
      ensureSpace(18);
      y += 4;
      pdf.setFontSize(8);
      pdf.setTextColor(110, 105, 125);
      pdf.text('Cash basis: only recorded transactions count. Invoices and expected items are excluded.', 16, y);
      y += 5;
      pdf.text('Historical conversions use National Bank of Georgia rates on transaction dates.', 16, y);
      pdf.save(`f-dash-report-${displayBounds.from}-${displayBounds.to}.pdf`);
      setNotice('PDF exported.');
    } catch { setError('Could not generate the PDF report. Try again.'); }
  }


  const headerActions = document.getElementById('finances-header-actions');
  if(!user)return null;
  return <main className="finances">
    {headerActions && createPortal(<><button type="button" className="finance-secondary" onClick={()=>setPanel('Reports')}>Export report</button><button type="button" className="finance-primary" onClick={()=>{setEdit(null);setOccurrenceId(null);setModalOpen(true);}}>＋ Add transaction</button></>,headerActions)}
    <div className="finances__controls"><div className="finance-pill-tabs-wrap"><PillNav className="finance-pill-tabs" items={(['Main','Transactions','Recurring','Categories','Reports'] as Panel[]).map(label=>({label}))} selectedIndex={(['Main','Transactions','Recurring','Categories','Reports'] as Panel[]).indexOf(panel)} onItemClick={(item)=>setPanel(item.label as Panel)} theme="light" size="md" layout="joined" surface="glass" itemStyle="plain" hoverEffect="glide" indicator="pill" collapse="never" intro ariaLabel="Finance sections" /></div><div className="finance-range-controls">{period==='custom'&&<div className="finance-custom-range"><label>From <input type="date" value={customFrom} max={customTo} onChange={event=>{setCustomFrom(event.target.value);setPage(0);}}/></label><label>To <input type="date" value={customTo} min={customFrom} onChange={event=>{setCustomTo(event.target.value);setPage(0);}}/></label></div>}<RubberSegment className="finance-rubber-periods" trackColor="#eeeafa" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Date range" items={['30d','3m','6m','12m',{value:'custom',label:'Custom'}]} value={period} onChange={value=>{setPeriod(value as Period);setPage(0)}} size="md" /></div></div>
    {currentReady && currentResource.sourceKey !== currentKey && <div className="finance-updating" role="status">Showing the previous period while the selected range updates…</div>}
    {panel === 'Transactions' && ledgerResource.data && ledgerResource.sourceKey !== ledgerKey && <div className="finance-updating" role="status">Showing previous transactions while the selected filters update…</div>}
    {currentResource.error&&currentReady&&<div className="finance-refresh-error" role="alert">Financial data could not update. <button onClick={currentResource.retry}>Retry</button></div>}
    {priorResource.error&&priorReady&&panel==='Main'&&<div className="finance-refresh-error" role="alert">Previous-period comparison could not update. <button onClick={priorResource.retry}>Retry</button></div>}
    {metaResource.error&&metaReady&&(panel==='Main'||panel==='Categories'||panel==='Reports')&&<div className="finance-refresh-error" role="alert">Categories and related details could not update. <button onClick={metaResource.retry}>Retry</button></div>}
    {recurringResource.error&&recurringReady&&panel==='Recurring'&&<div className="finance-refresh-error" role="alert">Recurring activity could not update. <button onClick={recurringResource.retry}>Retry</button></div>}
    {legacyCount>0&&<div className="finance-legacy"><div><strong>{legacyCount} transaction{legacyCount===1?'':'s'} in this period need a currency</strong><p>Older amounts were entered without currency metadata. Edit individual records to assign their original currency. If every unresolved amount used the same currency, you can assign it to all unresolved records in your account.</p></div><select aria-label="Original currency for all unresolved transactions" value={legacyCurrency} onChange={event=>setLegacyCurrency(event.target.value as Currency | '')}><option value="">Select currency</option><option>USD</option><option>EUR</option><option>GEL</option></select><button type="button" className="finance-secondary" disabled={busy||!legacyCurrency} onClick={resolveLegacy}>Assign to all</button></div>}
    <DashboardContentTransition transitionKey={panel}>
    {panel==='Main'&&<>
      {!currentReady ? currentResource.status === 'error' ? <section className="finance-metrics"><FinanceLoadError title="Financial summary" retry={currentResource.retry}/></section> : <FinanceKpiSkeleton/> : <section className="finance-metrics finance-revealed" aria-label="Financial summary"><MetricCard label="Revenue" value={showMoney(revenue.cents)} detail={priorReady?comparisonText(revenue.cents,prevRevenue.cents):priorResource.status==='error'?<button className="finance-inline-retry" onClick={priorResource.retry}>Comparison unavailable · Retry</button>:priorResource.data?'Updating comparison…':<FinanceSkeletonLine width="104px" height={9}/>} tone="finance-metric--income"/><MetricCard label="Expenses" value={showMoney(expenses.cents)} detail={priorReady?comparisonText(expenses.cents,prevExpenses.cents):priorResource.status==='error'?<button className="finance-inline-retry" onClick={priorResource.retry}>Comparison unavailable · Retry</button>:priorResource.data?'Updating comparison…':<FinanceSkeletonLine width="104px" height={9}/>} tone="finance-metric--expense"/><MetricCard label="Net profit" value={showMoney(net)} detail={priorReady?comparisonText(net,prevNet):priorResource.status==='error'?<button className="finance-inline-retry" onClick={priorResource.retry}>Comparison unavailable · Retry</button>:priorResource.data?'Updating comparison…':<FinanceSkeletonLine width="104px" height={9}/>} tone={net<0?'finance-metric--expense':'finance-metric--income'}/></section>}
      <section className={`finance-panel finance-chart${expandedChart?' finance-chart--expanded':''}${chartKind==='bar'?' finance-chart--bar':''}`}>
        <div className="finance-panel__head">
          <div><h2>Financial performance</h2><p>{formatDate(displayBounds.from)} – {formatDate(displayBounds.to)} · historical NBG rates{currentResource.status === 'refreshing' ? ' · Updating…' : ''}</p></div>
          <div className="finance-chart__controls">
            <select aria-label="Chart metric" value={metric} onChange={event=>setMetric(event.target.value as Metric)}>
              <option value="compare">Income vs expenses</option><option value="revenue">Revenue</option><option value="profit">Net profit</option>
            </select>
            <RubberSegment className="finance-rubber-chart-types" trackColor="#eeeafa" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Chart type" items={[{value:'area',label:'Area',icon:<ChartAreaIcon/>},{value:'bar',label:'Bar',icon:<ChartBarsIcon/>}]} value={chartKind} onChange={value=>setChartKind(value as ChartKind)} size="md" />
            <button type="button" className="finance-chart__expand" onClick={()=>setExpandedChart(value=>!value)}>{expandedChart?'Close':'Expand'}</button>
          </div>
        </div>
        {expandedChart&&<div className="finance-chart__expanded-periods"><RubberSegment trackColor="#eeeafa" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Expanded chart date range" items={['30d','3m','6m','12m',{value:'custom',label:'Custom'}]} value={period} onChange={value=>setPeriod(value as Period)} size="md" /></div>}
        {!currentReady ? currentResource.status === 'error' ? <FinanceLoadError title="Financial performance" retry={currentResource.retry}/> : <FinanceChartSkeleton bar={chartKind==='bar'}/> : <div className="finance-revealed"><div className="finance-chart__summary"><strong className={chartTotal<0?'is-negative':'is-positive'}><AnimatedMetricValue value={showMoney(chartTotal)}/></strong><span>{!priorReady ? priorResource.status==='error' ? <button className="finance-inline-retry" onClick={priorResource.retry}>Comparison unavailable · Retry</button> : priorResource.data ? 'Updating comparison…' : <FinanceSkeletonLine width="105px" height={9}/> : known&&priorKnown?comparison(chartTotal,chartPrevious):'Resolve currencies or rates to compare'}</span></div>
        <div className="finance-chart__body">{!known?<div className="finance-empty">Resolve missing currencies or rates to view a reliable chart.</div>:chartData.length===0?<div className="finance-empty">Choose a valid date range to view the chart.</div>:<div className="finance-chart__viewport" ref={chartViewportRef}><div key={expandedChart?'expanded-plot':'inline-plot'} className="finance-chart__plot" style={{minWidth:expandedChart?'100%':Math.max(480,chartData.length*68)}}>
          {chartKind==='bar'?<ChartBar data={chartData} index="label" series={chartSeries} showLegend currency={currency} title="Financial performance" description={`${formatDate(displayBounds.from)} to ${formatDate(displayBounds.to)}`} height={expandedChart?300:210} surface="light" bare total="none" animate duration={.85} valueFormat={value=>money(Math.round(value*100),currency)}/>:<ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:8,right:12,left:-18,bottom:0}}>
            <defs>{chartSeries.map(item=><linearGradient key={item.key} id={`financeArea-${item.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity={0.24}/><stop offset="100%" stopColor={item.color} stopOpacity={0}/></linearGradient>)}</defs>
            <CartesianGrid vertical={false} stroke="#e7e3f0" strokeDasharray="3 5"/>
            <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{fill:'#7e7891',fontSize:11}} dy={8}/>
            <YAxis axisLine={false} tickLine={false} tick={{fill:'#7e7891',fontSize:11}} tickFormatter={value=>compactMoney(Number(value),currency)}/>
            <Tooltip formatter={(value,name)=>[money(Math.round(Number(value)*100),currency),chartSeries.find(item=>item.key===name)?.label??String(name)]} contentStyle={{border:'1px solid #ded8ee',borderRadius:10,boxShadow:'0 12px 32px #21145218',fontSize:12}}/>
            {chartSeries.length>1&&<Legend formatter={key=>chartSeries.find(item=>item.key===key)?.label??key}/>}
            {chartSeries.map(item=><Area key={item.key} type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={2.5} fill={`url(#financeArea-${item.key})`} activeDot={{r:5,fill:item.color}} isAnimationActive animationBegin={0} animationDuration={850} animationEasing="ease-in-out"/>)}</AreaChart></ResponsiveContainer>}
        </div></div>}</div>
        <p className="finance-chart__caption">{cashNote} Chart values use each transaction date’s official rate.{chartData.length>6&&<span className="finance-chart__scroll-hint"> Swipe to see every month.</span>}</p></div>}
      </section>
      <div className="finance-breakdowns">{!currentReady ? currentResource.status==='error' ? <><section className="finance-panel"><FinanceLoadError title="Income breakdown" retry={currentResource.retry}/></section><section className="finance-panel"><FinanceLoadError title="Expense breakdown" retry={currentResource.retry}/></section></> : <><FinanceBreakdownSkeleton title="Income breakdown" income/><FinanceBreakdownSkeleton title="Expense breakdown" income={false}/></> : <><Breakdown title="Income breakdown" rows={analytics.filter(row=>row.type==='Income')} categories={categories} currency={currency} rates={rates} available={known} onSelect={category=>{updateFilters({category});setPanel('Transactions');}}/><Breakdown title="Expense breakdown" rows={analytics.filter(row=>row.type==='Expense')} categories={categories} currency={currency} rates={rates} available={known} onSelect={category=>{updateFilters({category});setPanel('Transactions');}}/></>}</div>
      {!currentReady||!metaReady ? currentResource.status==='error'||metaResource.status==='error' ? <section className="finance-panel"><FinanceLoadError title="Project profitability" retry={currentResource.status==='error'?currentResource.retry:metaResource.retry}/></section> : <FinanceProjectSkeleton/> : <section className="finance-panel finance-revealed"><div className="finance-panel__head"><div><h2>Project profitability</h2><p>Recorded project income and costs</p></div><Link to="/projects">View projects →</Link></div>{projectSummary.length?<div className="finance-project-list">{projectSummary.slice(0,5).map(item=><div key={item.id}><strong>{item.name}</strong><span>{item.unresolved?'—':money(item.revenue,currency)} revenue</span><span>{item.unresolved?'—':money(item.expenses,currency)} costs</span><b>{item.unresolved?'Currency needed':money(item.profit,currency)}</b><small>{item.unresolved?'':item.revenue?`${Math.round(item.profit/item.revenue*100)}% margin`:'Margin unavailable'}</small></div>)}</div>:<div className="finance-empty">Link transactions to a project to see profitability.</div>}</section>}
    </>}
    {panel==='Transactions'&&<section className="finance-panel finance-transactions">
      <div className="finance-panel__head">
        <div><h2>Transactions</h2><p>{transactionLoading?<FinanceSkeletonLine width="128px" height={10}/>:transactionError?'Transactions unavailable':<>{totalRows} matching recorded entries</>}{filterCount>0&&<span className="finance-filter-count">{filterCount} active filter{filterCount===1?'':'s'}</span>}</p></div>
        <button type="button" className="finance-secondary" disabled={filterCount===0&&filters.sort==='newest'} onClick={()=>updateFilters(emptyFilters)}>Clear filters</button>
      </div>
      <button type="button" className={`finance-filter-toggle finance-secondary${filterCount>0?' is-active':''}`} onClick={()=>setMobileFilters(value=>!value)} aria-expanded={mobileFilters}>Filters{filterCount>0&&<strong>{filterCount}</strong>}</button>
      <div className={`finance-filters${mobileFilters?' is-open':''}`}>
        <Seek width={360} height={38} ariaLabel="Search transactions" placeholder="Search transactions, clients, projects…" value={filters.search} onChange={value=>updateFilters({search:value})}/>
        <select className={filters.type?'is-active':''} aria-label="Type" value={filters.type} onChange={event=>updateFilters({type:event.target.value})}><option value="">All types</option><option>Income</option><option>Expense</option></select>
        <select className={filters.category?'is-active':''} aria-label="Category" value={filters.category} onChange={event=>updateFilters({category:event.target.value})}><option value="">All categories</option>{categoryOptions.map(name=><option key={name}>{name}</option>)}</select>
        <select className={filters.currency?'is-active':''} aria-label="Currency" value={filters.currency} onChange={event=>updateFilters({currency:event.target.value})}><option value="">All currencies</option><option>USD</option><option>EUR</option><option>GEL</option></select>
        <select className={filters.client?'is-active':''} aria-label="Client" value={filters.client} onChange={event=>updateFilters({client:event.target.value})}><option value="">All clients</option>{clients.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
        <select className={filters.project?'is-active':''} aria-label="Project" value={filters.project} onChange={event=>updateFilters({project:event.target.value})}><option value="">All projects</option>{projects.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
        <select className={filters.recurring?'is-active':''} aria-label="Recurring" value={filters.recurring} onChange={event=>updateFilters({recurring:event.target.value})}><option value="">All entries</option><option value="yes">From schedule</option><option value="no">One-time</option></select>
        <select className={filters.sort!=='newest'?'is-active':''} aria-label="Sort" value={filters.sort} onChange={event=>updateFilters({sort:event.target.value})}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select>
      </div>
      {filterCount>0&&<div className="finance-active-filters" aria-label="Active transaction filters"><span>Active filters</span>{activeFilterChips.map(item=><button type="button" key={item.key} onClick={()=>removeFilter(item.key)} aria-label={`Remove ${item.label} filter`} title={`Remove ${item.label} filter`}><span>{item.label}</span><svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button>)}</div>}
      {transactionLoading ? <FinanceTransactionSkeleton/> : transactionError ? <FinanceLoadError title="Transactions" retry={ledgerResource.status==='error'?ledgerResource.retry:currentResource.retry}/> : <div className="finance-revealed"><div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Transaction</th><th>Category / link</th><th>Date</th><th>Original</th><th>Display</th><th>Actions</th></tr></thead><tbody>{ledger.map(row=>{const value=convertedCents(row,currency,rates);const invoice=invoices.find(item=>item.id===row.invoice_id);return <tr key={row.id}><td data-label="Transaction"><strong>{row.description}</strong><small className={`finance-badge finance-badge--${row.type.toLowerCase()}`}>{row.type}{row.recurring_occurrence_id?' · recurring':''}</small></td><td data-label="Category"><span>{row.type==='Income'?row.income_category||row.category||'Uncategorized':row.expense_category||row.category||'Uncategorized'}</span><small>{row.clients?.name??''}{row.clients?.name&&row.projects?.name?' · ':''}{row.projects?.name??''}{invoice&&<><br/><Link to={`/invoices?invoice=${row.invoice_id}`}>Invoice {invoice.invoice_number} · {invoice.status}</Link></>}</small></td><td data-label="Date">{formatDate(row.date)}</td><td data-label="Original">{row.currency?money(txCents(row),row.currency):`${(txCents(row)/100).toFixed(2)} · currency unknown`}</td><td data-label="Display" className={row.type==='Expense'?'is-expense':'is-income'}>{value===null?'—':`${row.type==='Expense'?'−':'+'}${money(value,currency)}`}</td><td data-label="Actions"><div className="finance-row-actions">{paymentTransactionIds.includes(row.id)?<Link to={`/invoices?invoice=${row.invoice_id}`} aria-label="Manage invoice payment" data-tooltip="Manage payment"><ExternalLink size={16} aria-hidden="true"/></Link>:<><button type="button" onClick={()=>{setEdit(row);setOccurrenceId(null);setModalOpen(true);}} aria-label={`Edit ${row.description}`} data-tooltip="Edit transaction"><Pencil size={16} aria-hidden="true"/></button><button type="button" onClick={()=>deleteTransaction(row)} className="is-danger" aria-label={`Delete ${row.description}`} data-tooltip="Delete transaction"><Trash2 size={16} aria-hidden="true"/></button></>}</div></td></tr>})}</tbody></table>{!ledger.length&&<div className="finance-empty">No transactions match these filters.</div>}</div><div className="finance-pagination"><span>Page {page+1} of {Math.max(1,Math.ceil(totalRows/PAGE_SIZE))}</span><div><button type="button" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous</button><button type="button" disabled={(page+1)*PAGE_SIZE>=totalRows} onClick={()=>setPage(value=>value+1)}>Next</button></div></div></div>}
      {ledgerResource.error&&ledgerResource.data&&<div className="finance-refresh-error" role="alert">Transactions could not update. <button onClick={ledgerResource.retry}>Retry</button></div>}
    </section>}
    {panel==='Recurring'&&!recurringReady&&(recurringResource.status==='error'?<div className="finance-recurring-grid"><section className="finance-panel"><FinanceLoadError title="Recurring activity" retry={recurringResource.retry}/></section></div>:<FinanceRecurringSkeleton/>)}
    {panel==='Recurring'&&recurringReady&&<div className="finance-recurring-grid finance-revealed"><section className="finance-panel"><div className="finance-panel__head"><div><h2>Recurring schedules</h2><p>Automation creates expected items, never recorded payments.</p></div></div>{schedules.length?<div className="finance-schedule-list">{schedules.map(item=><div key={item.id}><div><strong>{item.description}</strong><small>{item.frequency} · {money(Math.round(item.amount*100),item.currency)} · next {formatDate(item.next_on)}</small></div><span className={`finance-status finance-status--${item.status}`}>{item.status}</span><div className="finance-row-actions">{item.status!=='cancelled'&&<button onClick={()=>setScheduleToEdit(item)}>Edit</button>}{item.status==='active'?<button onClick={()=>setScheduleStatus(item,'paused')}>Pause</button>:item.status==='paused'?<button onClick={()=>setScheduleStatus(item,'active')}>Resume</button>:null}{item.status!=='cancelled'&&<button onClick={()=>setScheduleStatus(item,'cancelled')}>Cancel</button>}</div></div>)}</div>:<div className="finance-empty">No schedules yet. Choose “Repeat this transaction” when recording income or an expense.</div>}</section><section className="finance-panel"><div className="finance-panel__head"><div><h2>Expected activity</h2><p>Review and record when money actually moves.</p></div></div>{occurrences.filter(item=>item.status==='expected').length?<div className="finance-schedule-list">{occurrences.filter(item=>item.status==='expected').map(item=>{const schedule=schedules.find(value=>value.id===item.schedule_id);return <div key={item.id}><div><strong>{schedule?.description??'Scheduled item'}</strong><small>Due {formatDate(item.due_on)} · {schedule?money(Math.round(schedule.amount*100),schedule.currency):''}</small></div><div className="finance-row-actions"><button onClick={()=>recordOccurrence(item)}>Record</button><button onClick={()=>dismissOccurrence(item)}>Dismiss</button></div></div>})}</div>:<div className="finance-empty">No expected items in this period.</div>}</section></div>}
    {panel==='Categories'&&!metaReady&&(metaResource.status==='error'?<section className="finance-panel"><FinanceLoadError title="Categories" retry={metaResource.retry}/></section>:<FinanceCategoriesSkeleton/>)}
    {panel==='Categories'&&metaReady&&<div className="finance-category-grid finance-revealed"><section className="finance-panel"><div className="finance-panel__head"><div><h2>Manage categories</h2><p>Archive categories without changing past records.</p></div></div>{(['Income','Expense'] as TxType[]).map(type=><div className="finance-category-list" key={type}><h3>{type}</h3>{categories.filter(item=>item.type===type&&!item.archived_at).map(item=><div key={item.id}><span className="finance-category-dot" style={{background:item.color}}/><strong>{item.name}</strong><span className="finance-category-list__icon"><FinanceCategoryIcon name={item.icon}/></span><button onClick={()=>setCategoryForm({id:item.id,name:item.name,type:item.type,icon:item.icon,color:item.color})}>Edit</button><button onClick={()=>archiveCategory(item)}>Archive</button></div>)}</div>)}</section><section className="finance-panel"><h2>{categoryForm.id?'Edit category':'New category'}</h2><form className="finance-form" onSubmit={saveCategory}><label>Name<input required maxLength={60} value={categoryForm.name} onChange={event=>setCategoryForm(value=>({...value,name:event.target.value}))}/></label><label>Type<select value={categoryForm.type} onChange={event=>setCategoryForm(value=>({...value,type:event.target.value as TxType}))}><option>Income</option><option>Expense</option></select></label><FinanceCategoryPicker value={categoryForm.icon} onChange={icon=>setCategoryForm(value=>({...value,icon}))}/><label>Color<input type="color" value={categoryForm.color} onChange={event=>setCategoryForm(value=>({...value,color:event.target.value}))}/></label><div className="finance-dialog__actions">{categoryForm.id&&<button type="button" className="finance-secondary" onClick={()=>setCategoryForm({id:'',name:'',type:'Expense',icon:'tag',color:'#7664CC'})}>Cancel</button>}<button type="submit" className="finance-primary" disabled={busy}>{busy?'Saving…':categoryForm.id?'Save category':'Create category'}</button></div></form></section></div>}
    {panel==='Reports'&&(!currentReady||!metaReady)&&(currentResource.status==='error'||metaResource.status==='error'?<section className="finance-panel"><FinanceLoadError title="Financial reports" retry={currentResource.status==='error'?currentResource.retry:metaResource.retry}/></section>:<FinanceReportsSkeleton/>)}
    {panel==='Reports'&&currentReady&&metaReady&&<div className="finance-report-grid finance-revealed"><section className="finance-panel"><div className="finance-panel__head"><div><h2>Financial report</h2><p>{formatDate(displayBounds.from)} – {formatDate(displayBounds.to)} · {currency}</p></div></div><div className="finance-report-totals"><div><span>Revenue</span><strong><AnimatedMetricValue value={showMoney(revenue.cents)}/></strong></div><div><span>Expenses</span><strong><AnimatedMetricValue value={showMoney(expenses.cents)}/></strong></div><div><span>Net profit</span><strong><AnimatedMetricValue value={showMoney(net)}/></strong></div></div><p className="finance-report-note">{cashNote} Historical conversions use official NBG rates on the transaction date.</p><div className="finance-report-actions"><button className="finance-primary" onClick={exportCsv}>Download CSV</button><button className="finance-secondary" onClick={exportPdf}>Download PDF</button></div></section><section className="finance-panel"><h2>Client summary</h2>{clients.filter(client=>analytics.some(row=>row.client_id===client.id)).map(client=>{const rows=analytics.filter(row=>row.client_id===client.id);const inc=sumType(rows,'Income',currency,rates),exp=sumType(rows,'Expense',currency,rates);return <div className="finance-summary-row" key={client.id}><span>{client.name}</span><strong>{inc.unresolved||exp.unresolved?'—':money(inc.cents-exp.cents,currency)}</strong></div>})}<h2 className="finance-subhead">Project summary</h2>{projectSummary.map(item=><div className="finance-summary-row" key={item.id}><span>{item.name}</span><strong>{item.unresolved?'—':money(item.profit,currency)}</strong></div>)}</section></div>}
    {panel==='Reports'&&currentReady&&metaReady&&<section className="finance-panel finance-invoice-summary finance-revealed"><div className="finance-panel__head"><div><h2>Invoice activity</h2><p>Issued invoices and linked payments in the selected period. Expected invoice value is separate from received income.</p></div><Link to="/invoices">Manage invoices →</Link></div><div className="finance-report-totals"><div><span>Paid invoices</span><strong>{invoices.filter(item=>item.lifecycle_state!=='draft'&&!item.archived_at&&item.status==='Paid').length}</strong></div><div><span>Outstanding invoices</span><strong>{invoices.filter(item=>item.lifecycle_state!=='draft'&&!item.archived_at&&item.status!=='Paid').length}</strong></div><div><span>Linked payments</span><strong>{analytics.filter(item=>item.invoice_id).length}</strong></div></div></section>}
    </DashboardContentTransition>
    <FinanceTransactionModal open={modalOpen} onClose={()=>setModalOpen(false)} onSaved={notify} userId={user.id} categories={categories} clients={clients} projects={projects} invoices={invoices} edit={edit} defaultCurrency={currency} occurrenceId={occurrenceId} scheduled={scheduledDraft}/>
    {scheduleToEdit&&<FinanceScheduleModal key={scheduleToEdit.id} schedule={scheduleToEdit} userId={user.id} categories={categories} clients={clients} projects={projects} onClose={()=>setScheduleToEdit(null)} onSaved={()=>notify('Schedule updated for future occurrences.')}/>}
    {createPortal(<div className="app-toast-viewport" aria-label="Notifications"><AnimatePresence initial={false}>
      {error&&<SwipeToast key={`error-${errorSequence}`} kind="error" message={error} onClose={()=>setError('')}/>}
      {notice&&<SwipeToast key={`notice-${noticeSequence}`} kind="success" message={notice} onClose={()=>setNotice('')}/>}
    </AnimatePresence></div>,document.body)}
  </main>;
}
