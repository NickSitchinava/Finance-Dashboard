const DAY_MS = 86400000;

export type AlertProject = { id: string; name: string; deadline: string | null };
export type AlertInvoice = { id: string; invoice_number: string; client_name: string; amount: number; due_date: string | null; status: string };
export type AlertGoal = { id: string; title: string; target_date: string; percent_complete: number | null };
export type AttentionItem = { id: string; kind: "project" | "invoice" | "goal"; title: string; detail: string; date: string; path: string };

export const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const parseDay = (value: string) => new Date(`${value}T12:00:00`);
export const daysFrom = (value: string, today: string) => Math.round((parseDay(value).getTime() - parseDay(today).getTime()) / DAY_MS);
export const isPendingInvoice = (invoice: AlertInvoice) => invoice.status === "Pending" || invoice.status === "Overdue";

export function buildAttentionItems(
  projects: AlertProject[], invoices: AlertInvoice[], goals: AlertGoal[],
  today: string, formatAmount: (value: number) => string,
): AttentionItem[] {
  const items: AttentionItem[] = [
    ...projects.filter(project => project.deadline && daysFrom(project.deadline, today) <= 14)
      .map(project => ({ id: `p-${project.id}`, kind: "project" as const, title: project.name, detail: "Project deadline", date: project.deadline!, path: "/projects" })),
    ...invoices.filter(invoice => isPendingInvoice(invoice) && invoice.due_date && daysFrom(invoice.due_date, today) <= 7)
      .map(invoice => ({ id: `i-${invoice.id}`, kind: "invoice" as const, title: `Invoice ${invoice.invoice_number.startsWith("#") ? "" : "#"}${invoice.invoice_number} — ${invoice.client_name}`, detail: `${formatAmount(Number(invoice.amount))} outstanding · Invoice`, date: invoice.due_date!, path: "/invoices" })),
    ...goals.filter(goal => Number(goal.percent_complete) < 100 && goal.target_date && daysFrom(goal.target_date, today) <= 14)
      .map(goal => ({ id: `g-${goal.id}`, kind: "goal" as const, title: goal.title, detail: "Goal target", date: goal.target_date, path: "/goals" })),
  ];
  return items.sort((a, b) => {
    const aDays = daysFrom(a.date, today), bDays = daysFrom(b.date, today);
    const rank = (item: AttentionItem, days: number) => item.kind === "invoice" && days < -30 ? 3 : days < 0 ? 0 : days <= 7 ? 1 : 2;
    return rank(a, aDays) - rank(b, bDays)
      || (aDays < 0 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
      || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
  });
}

export type LoadingStatus = "loading" | "refreshing" | "ready" | "error";
export function groupReadiness(statuses: LoadingStatus[]): "loading" | "ready" | "error" {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("loading")) return "loading";
  return "ready";
}
