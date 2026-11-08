import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Compile the real calculation module in isolation so Node does not initialize
// the browser-only Supabase client used by its rate loader.
const source = (await readFile(new URL('../src/lib/finance.ts', import.meta.url), 'utf8'))
  .replace("import { supabase } from './supabase';", 'const supabase = {};');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { convertedCents, originalCents, sumType, previousBounds, comparison, chartBuckets, money, compactMoney } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

const date = '2026-10-29';
const rates = { [date]: { date, sourceDate: date, USD: 2.7, EUR: 3.0, GEL: 1, source: 'NBG' } };
const row = (type, amount, currency) => ({ type, amount, currency, date, income_amount: type === 'Income' ? amount : 0, expense_amount: type === 'Expense' ? amount : 0 });

test('converts original minor units through dated GEL rates without mutating originals', () => {
  const income = row('Income', 10.01, 'USD');
  assert.equal(originalCents(income.amount), 1001);
  assert.equal(convertedCents(income, 'GEL', rates), 2703);
  assert.equal(convertedCents(income, 'EUR', rates), 901);
  assert.equal(convertedCents(income, 'USD', rates), 1001);
  assert.equal(income.amount, 10.01);
});

test('does not invent currencies or rates for historical records', () => {
  assert.equal(convertedCents(row('Expense', 12, null), 'USD', rates), null);
  assert.equal(convertedCents(row('Expense', 12, 'EUR'), 'USD', {}), null);
  assert.deepEqual(sumType([row('Income', 5, 'USD'), row('Income', 3, null)], 'Income', 'USD', rates), { cents: 500, unresolved: 1 });
});

test('previous comparison period has the same inclusive number of days', () => {
  assert.deepEqual(previousBounds('2026-10-01', '2026-10-31'), { from: '2026-08-31', to: '2026-09-30' });
  assert.equal(comparison(12000, 10000), '+20% vs prior period');
  assert.equal(comparison(100, 0), 'No prior value');
});

test('chart bins include quiet months and respect custom boundaries', () => {
  const months = chartBuckets('6m', '2026-05-01', '2026-10-29');
  assert.equal(months.length, 6);
  assert.deepEqual(months.map(item => item.key), ['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
  assert.deepEqual(months.map(item => item.label), ['May','Jun','Jul','Aug','Sep','Oct']);
  assert.equal(months[2].revenue, 0);
  const custom = chartBuckets('custom', '2026-03-17', '2026-05-12');
  assert.deepEqual(custom.map(item => [item.from, item.to]), [['2026-03-17','2026-03-31'],['2026-04-01','2026-04-30'],['2026-05-01','2026-05-12']]);
  const days = chartBuckets('30d', '2026-09-30', '2026-10-29');
  assert.equal(days.length, 6);
  assert.equal(days[0].from, '2026-09-30');
  assert.equal(days[5].to, '2026-10-29');
});

test('year-crossing month labels omit dates and GEL uses its symbol', () => {
  const months = chartBuckets('12m', '2025-11-01', '2026-10-29');
  assert.deepEqual(months.map(item => item.label), ['Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct']);
  assert.match(money(1284, 'GEL'), /₾/);
  assert.doesNotMatch(money(1284, 'GEL'), /GEL/);
  assert.match(compactMoney(1200, 'GEL'), /^₾/);
});
