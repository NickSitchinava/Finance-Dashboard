import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/analyticsDates.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { analyticsBounds, analyticsComparisonBounds, validAnalyticsRange } = await import('data:text/javascript,' + encodeURIComponent(compiled));

test('rolling periods include today and clamp month ends', () => {
  assert.deepEqual(analyticsBounds('30d', { from: '', to: '' }, '2026-03-31'), { from: '2026-03-02', to: '2026-03-31' });
  assert.deepEqual(analyticsBounds('3m', { from: '', to: '' }, '2026-05-31'), { from: '2026-02-28', to: '2026-05-31' });
  assert.deepEqual(analyticsBounds('12m', { from: '', to: '' }, '2024-02-29'), { from: '2023-02-28', to: '2024-02-29' });
});
test('comparison periods use adjacent inclusive days and calendar year matching', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  assert.deepEqual(analyticsComparisonBounds('previous', range, range), { from: '2026-08-31', to: '2026-09-30' });
  assert.deepEqual(analyticsComparisonBounds('year', { from: '2024-02-29', to: '2024-03-15' }, range), { from: '2023-02-28', to: '2023-03-15' });
});
test('invalid and future custom dates are rejected', () => {
  assert.equal(validAnalyticsRange({ from: '2026-01-01', to: '2026-02-31' }, '2026-11-06'), false);
  assert.equal(validAnalyticsRange({ from: '2026-11-05', to: '2026-11-07' }, '2026-11-06'), false);
  assert.equal(validAnalyticsRange({ from: '2026-05-01', to: '2026-04-30' }, '2026-11-06'), false);
  assert.equal(validAnalyticsRange({ from: '2026-05-01', to: '2026-05-31' }, '2026-11-06'), true);
});
