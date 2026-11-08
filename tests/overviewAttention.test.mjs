import test from "node:test";
import assert from "node:assert/strict";
import { buildAttentionItems, daysFrom, groupReadiness } from "../src/pages/overviewAttention.ts";

const today = "2026-10-29";
const money = value => `$${value.toLocaleString()}`;
const invoice = (id, status, due_date, amount = 350) => ({ id, invoice_number: `INV-${id}`, client_name: "Client", amount, due_date, status });

test("alerts include overdue and approaching unpaid invoices, not paid, distant, or undated invoices", () => {
  const items = buildAttentionItems([], [
    invoice("overdue", "Pending", "2026-10-24"),
    invoice("today", "Overdue", today),
    invoice("soon", "Pending", "2026-11-05"),
    invoice("later", "Pending", "2026-11-06"),
    invoice("paid", "Paid", "2026-10-20"),
    invoice("canceled", "Canceled", "2026-10-20"),
    invoice("undated", "Pending", null),
  ], [], today, money);
  assert.deepEqual(items.map(item => item.id), ["i-overdue", "i-today", "i-soon"]);
  assert.match(items[0].title, /Invoice #INV-overdue — Client/);
  assert.equal(items[0].detail, "$350 outstanding · Invoice");
  assert.equal(items[0].path, "/invoices");
});

test("recent overdue items lead; historical unpaid invoices remain accessible with lower priority", () => {
  const items = buildAttentionItems(
    [{ id: "project", name: "Project", deadline: "2026-10-25" }],
    [invoice("old", "Pending", "2026-08-10"), invoice("new", "Pending", "2026-10-28")],
    [{ id: "goal", title: "Goal", target_date: "2026-10-30", percent_complete: 20 }],
    today, money,
  );
  assert.deepEqual(items.map(item => item.id), ["i-new", "p-project", "g-goal", "i-old"]);
  assert.equal(items.length, 4);
});

test("completed goals and distant project deadlines are excluded", () => {
  const items = buildAttentionItems(
    [{ id: "later", name: "Later", deadline: "2026-11-13" }], [],
    [{ id: "done", title: "Done", target_date: today, percent_complete: 100 }],
    today, money,
  );
  assert.deepEqual(items, []);
});

test("date-only overdue calculation uses local calendar days", () => {
  assert.equal(daysFrom("2026-10-28", today), -1);
  assert.equal(daysFrom(today, today), 0);
  assert.equal(daysFrom("2026-10-30", today), 1);
});

test("loading groups resolve from only their own source statuses", () => {
  assert.equal(groupReadiness(["ready", "ready", "ready"]), "ready");
  assert.equal(groupReadiness(["ready", "loading"]), "loading");
  assert.equal(groupReadiness(["ready", "error"]), "error");
  assert.equal(groupReadiness(["ready", "refreshing"]), "ready");
});
