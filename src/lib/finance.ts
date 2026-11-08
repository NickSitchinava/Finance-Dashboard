import { supabase } from './supabase';

export type Currency = 'USD' | 'EUR' | 'GEL';
export type TxType = 'Income' | 'Expense';
export type FinanceTransaction = {
  id: string; user_id: string; type: TxType; amount: number; description: string; date: string;
  category: string | null; category_id: string | null; currency: Currency | null;
  client_id: string | null; project_id: string | null; invoice_id: string | null; recurring_occurrence_id: string | null;
  income_amount: number | null; expense_amount: number | null;
  income_category: string | null; expense_category: string | null;
  income_notes: string | null; expense_notes: string | null;
  clients?: { name: string } | null; projects?: { name: string } | null;
};
export type RateDay = { date: string; sourceDate: string; USD: number; EUR: number; GEL: 1; source: string };
export type RateMap = Record<string, RateDay>;
export type AmountRow = Pick<FinanceTransaction, 'type' | 'amount' | 'currency' | 'date'> & Partial<Pick<FinanceTransaction, 'income_amount' | 'expense_amount'>>;

export const currencySymbol = (currency: Currency) => currency === 'GEL' ? '₾' : currency === 'EUR' ? '€' : '$';
export const money = (cents: number, currency: Currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100).replace(/GEL/g, '₾');
export const originalCents = (value: number | string) => Math.round(Number(value) * 100);
export const txCents = (row: AmountRow) => originalCents(row.type === 'Income' ? row.income_amount ?? row.amount : row.expense_amount ?? row.amount);

// All ledger totals are integer minor units. Rates are scaled before division,
// so one rounding boundary exists at each converted transaction.
export function convertedCents(row: AmountRow, target: Currency, rates: RateMap): number | null {
  if (!row.currency) return null;
  const cents = txCents(row);
  if (row.currency === target) return cents;
  const day = rates[row.date];
  if (!day || !day[row.currency] || !day[target]) return null;
  const source = BigInt(Math.round(day[row.currency] * 1_000_000));
  const destination = BigInt(Math.round(day[target] * 1_000_000));
  const numerator = BigInt(cents) * source;
  return Number((numerator + destination / 2n) / destination);
}

const memoryRates: RateMap = {};
export async function loadRates(dates: string[]): Promise<RateMap> {
  const unique = [...new Set(dates)].filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
  const missing = unique.filter(date => !memoryRates[date]);
  for (let index = 0; index < missing.length; index += 60) {
    const { data, error } = await supabase.functions.invoke('finance-rates', { body: { dates: missing.slice(index, index + 60) } });
    if (error) throw error;
    for (const result of data?.results ?? []) if (result.rate) memoryRates[result.date] = result.rate;
  }
  return Object.fromEntries(unique.filter(date => memoryRates[date]).map(date => [date, memoryRates[date]]));
}

export function periodBounds(period: '30d' | '3m' | '6m' | '12m' | 'custom', customFrom: string, customTo: string) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const start = new Date(end);
  if (period === '30d') start.setUTCDate(start.getUTCDate() - 29);
  if (period === '3m') start.setUTCFullYear(end.getUTCFullYear(), end.getUTCMonth() - 2, 1);
  if (period === '6m') start.setUTCFullYear(end.getUTCFullYear(), end.getUTCMonth() - 5, 1);
  if (period === '12m') start.setUTCFullYear(end.getUTCFullYear(), end.getUTCMonth() - 11, 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: period === 'custom' ? customFrom : iso(start), to: period === 'custom' ? customTo : iso(end) };
}

export type ChartBucket = { key: string; label: string; from: string; to: string; revenue: number; expenses: number; profit: number; cash: number };

// Include every calendar month or five-day segment, even when no transaction exists.
// This keeps the chart's x-axis stable when users change periods.
export function chartBuckets(period: '30d' | '3m' | '6m' | '12m' | 'custom', from: string, to: string): ChartBucket[] {
  if (!from || !to || from > to) return [];
  const dayMs = 86_400_000;
  const dayCount = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs) + 1;
  const make = (key: string, label: string, start: string, end: string): ChartBucket => ({ key, label, from: start, to: end, revenue: 0, expenses: 0, profit: 0, cash: 0 });
  if (period === '30d' || (period === 'custom' && dayCount <= 31)) {
    const count = Math.min(6, dayCount);
    return Array.from({ length: count }, (_, index) => {
      const start = new Date(Date.parse(`${from}T00:00:00Z`) + Math.floor(index * dayCount / count) * dayMs);
      const end = new Date(Date.parse(`${from}T00:00:00Z`) + (Math.floor((index + 1) * dayCount / count) - 1) * dayMs);
      const startKey = start.toISOString().slice(0, 10);
      const endKey = end.toISOString().slice(0, 10);
      return make(`${startKey}|${endKey}`, start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }), startKey, endKey);
    });
  }
  const first = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const last = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
  const buckets: ChartBucket[] = [];
  for (let date = new Date(first); date <= last; date.setUTCMonth(date.getUTCMonth() + 1)) {
    const key = date.toISOString().slice(0, 7);
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    buckets.push(make(key, date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }), key === from.slice(0, 7) ? from : `${key}-01`, key === to.slice(0, 7) ? to : monthEnd));
  }
  return buckets;
}

export function previousBounds(from: string, to: string) {
  const length = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  const before = new Date(`${from}T00:00:00Z`);
  before.setUTCDate(before.getUTCDate() - 1);
  const start = new Date(before);
  start.setUTCDate(start.getUTCDate() - length + 1);
  return { from: start.toISOString().slice(0, 10), to: before.toISOString().slice(0, 10) };
}

export function sumType(rows: FinanceTransaction[], type: TxType, currency: Currency, rates: RateMap) {
  let cents = 0;
  let unresolved = 0;
  for (const row of rows) if (row.type === type) {
    const value = convertedCents(row, currency, rates);
    if (value === null) unresolved++;
    else cents += value;
  }
  return { cents, unresolved };
}

export function comparison(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 'No change' : 'No prior value';
  const delta = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return `${delta > 0 ? '+' : ''}${delta}% vs prior period`;
}

export function compactMoney(value: number, currency: Currency) {
  const absolute = Math.abs(value);
  if (absolute < 1000) return money(Math.round(value * 100), currency).replace(/\.00(?=\D*$)/, '');
  const divisor = absolute >= 1_000_000 ? 1_000_000 : 1_000;
  const suffix = divisor === 1_000_000 ? 'm' : 'k';
  const digits = Math.abs(value / divisor) < 10 ? 1 : 0;
  const symbol = currencySymbol(currency);
  return `${value < 0 ? '-' : ''}${symbol}${(absolute / divisor).toFixed(digits)}${suffix}`;
}
