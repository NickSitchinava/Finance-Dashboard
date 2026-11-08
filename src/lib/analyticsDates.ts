export type AnalyticsPreset = '30d' | '3m' | '6m' | '12m' | 'Custom';
export type AnalyticsCompare = 'previous' | 'year' | 'custom' | 'none';
export type AnalyticsRange = { from: string; to: string };
const DAY = 86_400_000;
const utc = (day: string) => new Date(day + 'T00:00:00Z');
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const shiftAnalyticsDay = (day: string, count: number) => iso(new Date(utc(day).getTime() + count * DAY));

// All ranges include both local calendar dates; querying date columns with >= from and <= to matches this.
export function analyticsBounds(preset: AnalyticsPreset, custom: AnalyticsRange, today: string): AnalyticsRange {
  if (preset === 'Custom') return custom;
  const start = utc(today);
  if (preset === '30d') start.setUTCDate(start.getUTCDate() - 29);
  else {
    const months = Number.parseInt(preset, 10);
    const year = start.getUTCFullYear(), month = start.getUTCMonth() - months;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    start.setUTCFullYear(year, month, Math.min(start.getUTCDate(), last));
  }
  return { from: iso(start), to: today };
}
export function analyticsComparisonBounds(mode: AnalyticsCompare, range: AnalyticsRange, custom: AnalyticsRange): AnalyticsRange | null {
  if (mode === 'none') return null;
  if (mode === 'custom') return custom;
  if (mode === 'previous') {
    const end = shiftAnalyticsDay(range.from, -1);
    const count = Math.round((utc(range.to).getTime() - utc(range.from).getTime()) / DAY) + 1;
    return { from: shiftAnalyticsDay(end, 1 - count), to: end };
  }
  const priorYear = (day: string) => {
    const date = utc(day), year = date.getUTCFullYear() - 1, month = date.getUTCMonth();
    return iso(new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()))));
  };
  return { from: priorYear(range.from), to: priorYear(range.to) };
}
export function validAnalyticsRange(range: AnalyticsRange, today: string) {
  const shape = /^\d{4}-\d{2}-\d{2}$/;
  if (!shape.test(range.from) || !shape.test(range.to)) return false;
  const from = utc(range.from), to = utc(range.to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && iso(from) === range.from && iso(to) === range.to && range.from <= range.to && range.to <= today;
}
