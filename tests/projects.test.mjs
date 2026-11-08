import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/projects.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { taskProgress, normalizeExternalUrl, mondayOf, estimateWorkWeek, ledgerByCurrency } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

test('progress is untracked before tasks exist and uses completed tasks only', () => {
  assert.deepEqual(taskProgress([]), { total: 0, done: 0, percent: null });
  assert.deepEqual(taskProgress([{ status: 'done' }, { status: 'doing' }, { status: 'todo' }]), { total: 3, done: 1, percent: 33 });
});
test('project links reject unsafe schemes and credentials', () => {
  assert.equal(normalizeExternalUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeExternalUrl('javascript:alert(1)'), null);
  assert.equal(normalizeExternalUrl('http://example.com'), null);
  assert.equal(normalizeExternalUrl('https://user:secret@example.com'), null);
});
test('work estimate requires multiple distinct activity days', () => {
  const week = mondayOf(new Date('2026-10-30T12:00:00Z'));
  const event = date => ({ occurred_at: `${date}T12:00:00Z` });
  assert.equal(estimateWorkWeek([event('2026-10-29'), event('2026-10-29')], week).weeks, null);
  assert.equal(estimateWorkWeek([event('2026-10-27'), event('2026-10-29')], week).weeks, 0.1);
});
test('project ledger keeps currencies separate and ignores unrelated projects', () => {
  const rows = [{ project_id: 'a', type: 'Income', amount: 10, income_amount: 10, currency: 'USD' }, { project_id: 'a', type: 'Expense', amount: 5, expense_amount: 5, currency: 'EUR' }, { project_id: 'b', type: 'Income', amount: 100, income_amount: 100, currency: 'USD' }];
  assert.deepEqual(ledgerByCurrency(rows, 'a'), { USD: { income: 10, expense: 0 }, EUR: { income: 0, expense: 5 } });
});
