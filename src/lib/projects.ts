export type ProjectKind = "client" | "personal";
export type Project = {
  id: string;
  user_id: string;
  name: string;
  kind: ProjectKind;
  client_id: string | null;
  description: string | null;
  tech_stack: string[] | null;
  status: string;
  start_date: string | null;
  deadline: string | null;
  estimated_weeks: number | null;
  estimated_cost: number | null;
  agreed_payment: number | null;
  budget_currency: string | null;
  payment_due_on: string | null;
  github_link: string | null;
  website_link: string | null;
  other_link: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
};
export type ProjectTask = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  priority: "low" | "normal" | "high";
  due_on: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ProjectNote = {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};
export type ProjectLink = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
};
export type WorkReview = {
  id: string;
  project_id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  estimated_weeks: number | null;
  confirmed_weeks: number;
  standard_week_hours: number;
  confirmation_method: "accepted" | "manual";
  estimation_version: string | null;
  confirmed_at: string;
};
export type GitHubRepository = {
  id: string;
  project_id: string | null;
  user_id: string;
  connection_id: string;
  github_repository_id: number;
  full_name: string;
  html_url: string;
  state: string;
  last_synced_at: string | null;
  last_error: string | null;
};
export type GitHubEvent = {
  id: string;
  project_id: string | null;
  repository_id: string;
  kind: "commit" | "pull_request" | "merge";
  title: string;
  html_url: string;
  author_login: string | null;
  occurred_at: string;
};
export type LedgerTransaction = {
  id: string;
  project_id: string | null;
  type: "Income" | "Expense";
  amount: number;
  income_amount: number | null;
  expense_amount: number | null;
  currency: string | null;
  date: string;
};

export function taskProgress(tasks: ProjectTask[]) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : null };
}

export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      trimmed.startsWith("https://") || trimmed.startsWith("http://")
        ? trimmed
        : `https://${trimmed}`,
    );
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password)
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function mondayOf(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return localDay(day);
}

export function localDay(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateAfterDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Conservative signal only: a day with activity supports a range, not a clocked duration.
// 0.25 standard working days per active day, capped at 2 days per reviewed week.
export function estimateWorkWeek(events: GitHubEvent[], weekStart: string, hoursPerWeek = 40) {
  const end = dateAfterDays(weekStart, 6);
  const activeDays = new Set(
    events
      .filter((event) => {
        const day = localDay(event.occurred_at);
        return day >= weekStart && day <= end;
      })
      .map((event) => localDay(event.occurred_at)),
  );
  if (activeDays.size < 2)
    return { weeks: null, activeDays: activeDays.size, method: "active-days-v1" };
  const estimatedHours = Math.min(16, activeDays.size * 2);
  return {
    weeks: Number((estimatedHours / hoursPerWeek).toFixed(3)),
    activeDays: activeDays.size,
    method: "active-days-v1",
  };
}

export function ledgerByCurrency(rows: LedgerTransaction[], projectId: string) {
  const amounts: Record<string, { income: number; expense: number }> = {};
  for (const row of rows) {
    if (row.project_id !== projectId) continue;
    const currency = row.currency || "Unspecified";
    const bucket = (amounts[currency] ??= { income: 0, expense: 0 });
    const amount = Number(
      row.type === "Income"
        ? (row.income_amount ?? row.amount)
        : (row.expense_amount ?? row.amount),
    );
    if (row.type === "Income") bucket.income += amount;
    else bucket.expense += amount;
  }
  return amounts;
}
