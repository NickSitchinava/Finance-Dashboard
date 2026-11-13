import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import SwipeToast from "../components/ui/SwipeToast";
import AnimatedList from "../components/ui/AnimatedList";
import RubberSegment from "../components/ui/RubberSegment";
import { Seek } from "../components/ui/Seek";
import "../components/ui/Seek.css";
import GooeyNav from "../components/ui/GooeyNav";
import PillNav from "../components/ui/PillNav";
import DashboardMetricCard from "../components/ui/DashboardMetricCard";
import DashboardContentTransition from "../components/ui/DashboardContentTransition";
import AnimatedMetricValue from "../components/ui/AnimatedMetricValue";
import { dashboardSnapshot, saveDashboardSnapshot } from "../lib/dashboardCache";
import { ProjectsContentSkeleton } from "../components/layout/DashboardSkeleton";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";
import { useGitHub } from "../hooks/useGitHub";
import {
  dateAfterDays,
  estimateWorkWeek,
  ledgerByCurrency,
  localDay,
  mondayOf,
  normalizeExternalUrl,
  taskProgress,
  type GitHubEvent,
  type GitHubRepository,
  type LedgerTransaction,
  type Project,
  type ProjectKind,
  type ProjectLink,
  type ProjectNote,
  type ProjectTask,
  type WorkReview,
} from "../lib/projects";
import "./ProjectsPage.css";

type Client = { id: string; name: string };
type Connection = { id: string; github_login: string; installation_id: number; state: string };
type DeviceAuthorization = {
  state: string;
  user_code: string;
  verification_uri: string;
  expires_at: string;
  interval: number;
};
type DailyActivity = {
  activity_day: string;
  commit_count: number;
  pull_request_count: number;
  merge_count: number;
};
type Data = {
  projects: Project[];
  clients: Client[];
  tasks: ProjectTask[];
  notes: ProjectNote[];
  links: ProjectLink[];
  reviews: WorkReview[];
  repositories: GitHubRepository[];
  events: GitHubEvent[];
  dailyActivity: DailyActivity[];
  transactions: LedgerTransaction[];
  connections: Connection[];
};
const blank: Data = {
  projects: [],
  clients: [],
  tasks: [],
  notes: [],
  links: [],
  reviews: [],
  repositories: [],
  events: [],
  dailyActivity: [],
  transactions: [],
  connections: [],
};
const statuses = ["In Progress", "Coming Soon", "Review", "Paused", "Completed", "Overdue"];
const today = () => localDay(new Date());
const historyStart = (range: string) => {
  if (range === "30") return dateAfterDays(today(), -30);
  if (range === "90") return dateAfterDays(today(), -90);
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - (range === "6m" ? 6 : 12));
  return date.toISOString().slice(0, 10);
};
async function githubFailureMessage(failure: unknown, response?: { error?: string } | null) {
  if (response?.error) return response.error;
  if (failure instanceof FunctionsHttpError) {
    try {
      const body = await failure.context.json();
      if (typeof body?.error === "string") return body.error;
    } catch { /* The gateway may return an empty or non-JSON body. */ }
    if (failure.context.status === 401) return "Your session has expired. Sign in again.";
    if (failure.context.status === 503) return "GitHub connection is not configured. Add the GitHub App secrets in Supabase.";
  }
  return failure instanceof Error ? failure.message : "GitHub request failed. Please retry.";
}
const dateLabel = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";
const timeLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
const active = (p: Project) => !["Completed", "Paused"].includes(p.status);
const deadlineState = (p: Project) =>
  !p.deadline || !active(p)
    ? ""
    : p.deadline < today()
      ? "Overdue"
      : p.deadline <= dateAfterDays(today(), 14)
        ? "Due soon"
        : "";

function Icon({
  name,
}: {
  name: "github" | "globe" | "link" | "grid" | "table" | "plus" | "close";
}) {
  if (name === "github")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.76-.24.76-.54v-2.1c-3.1.68-3.75-1.32-3.75-1.32-.5-1.27-1.23-1.6-1.23-1.6-1-.7.08-.69.08-.69 1.1.08 1.69 1.13 1.69 1.13.98 1.67 2.57 1.19 3.2.9.1-.7.38-1.19.69-1.46-2.47-.28-5.08-1.24-5.08-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.14a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.14 3.08-1.14.61 1.55.23 2.7.11 2.98.72.78 1.15 1.78 1.15 3 0 4.29-2.61 5.23-5.09 5.5.39.34.73.99.73 2v2.98c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />
      </svg>
    );
  const paths = {
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    table: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 10v10" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M5 5 19 19M19 5 5 19" />,
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function External({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: "github" | "globe" | "link";
}) {
  const url = href ? normalizeExternalUrl(href) : null;
  return (
    url && (
      <a
        className="projects-icon-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        onClick={(event) => event.stopPropagation()}
      >
        <Icon name={icon} />
      </a>
    )
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() =>
      dialogRef.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus(),
    );
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]",
        ),
      ];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="projects-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="projects-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="projects-icon-link" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function ProjectForm({
  project,
  clients,
  kind,
  userId,
  onClose,
  onSaved,
}: {
  project: Project | null;
  clients: Client[];
  kind: ProjectKind;
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(() => ({
    name: project?.name ?? "",
    kind: project?.kind ?? kind,
    client_id: project?.client_id ?? "",
    description: project?.description ?? "",
    tech_stack: project?.tech_stack?.join(", ") ?? "",
    status: project?.status ?? "In Progress",
    start_date: project?.start_date ?? "",
    deadline: project?.deadline ?? "",
    estimated_weeks: project?.estimated_weeks?.toString() ?? "",
    estimated_cost: project?.estimated_cost?.toString() ?? "",
    agreed_payment: project?.agreed_payment?.toString() ?? "",
    budget_currency: project?.budget_currency ?? "USD",
    payment_due_on: project?.payment_due_on ?? "",
    github_link: project?.github_link ?? "",
    website_link: project?.website_link ?? "",
    other_link: project?.other_link ?? "",
  }));
  const [initialForm] = useState(form);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dismiss = () => {
    if (
      JSON.stringify(form) !== JSON.stringify(initialForm) &&
      !window.confirm("Discard unsaved project changes?")
    )
      return;
    onClose();
  };
  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) return setError("Enter a project name.");
    for (const key of ["github_link", "website_link", "other_link"] as const)
      if (form[key] && !normalizeExternalUrl(form[key]))
        return setError("Use an HTTPS URL for project links.");
    setSaving(true);
    setError("");
    const payload = {
      user_id: userId,
      name: form.name.trim(),
      kind: form.kind,
      client_id: form.kind === "client" ? form.client_id || null : null,
      description: form.description.trim() || null,
      tech_stack: form.tech_stack
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      status: form.status,
      start_date: form.start_date || null,
      deadline: form.deadline || null,
      estimated_weeks: form.estimated_weeks ? Number(form.estimated_weeks) : null,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      agreed_payment:
        form.kind === "client" && form.agreed_payment ? Number(form.agreed_payment) : null,
      budget_currency: form.budget_currency,
      payment_due_on: form.kind === "client" ? form.payment_due_on || null : null,
      github_link: normalizeExternalUrl(form.github_link),
      website_link: normalizeExternalUrl(form.website_link),
      other_link: normalizeExternalUrl(form.other_link),
      updated_at: new Date().toISOString(),
    };
    const result = project
      ? await supabase.from("projects").update(payload).eq("id", project.id).eq("user_id", userId)
      : await supabase.from("projects").insert(payload);
    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    await onSaved();
    onClose();
  };
  return (
    <Dialog title={project ? "Edit project" : "New project"} onClose={dismiss}>
      <form className="projects-form" onSubmit={submit}>
        {error && (
          <p className="projects-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Project name
          <input
            autoFocus
            required
            maxLength={200}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <div className="projects-form-row">
          <label>
            Project type
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="client">Client project</option>
              <option value="personal">Personal project</option>
            </select>
          </label>
          {form.kind === "client" && (
            <label>
              Client <span>(optional)</span>
              <select value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
                <option value="">No client linked</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label>
          Description
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <div className="projects-form-row">
          <label>
            Status
            <select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Tech stack <span>(comma separated)</span>
            <input value={form.tech_stack} onChange={(e) => set("tech_stack", e.target.value)} />
          </label>
        </div>
        <div className="projects-form-row projects-form-row--3">
          <label>
            Start date
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </label>
          <label>
            Deadline
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </label>
          <label>
            Planned weeks
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.estimated_weeks}
              onChange={(e) => set("estimated_weeks", e.target.value)}
            />
          </label>
        </div>
        <div className="projects-form-row projects-form-row--3">
          <label>
            Estimated cost
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_cost}
              onChange={(e) => set("estimated_cost", e.target.value)}
            />
          </label>
          {form.kind === "client" && (
            <label>
              Agreed payment
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.agreed_payment}
                onChange={(e) => set("agreed_payment", e.target.value)}
              />
            </label>
          )}
          <label>
            Currency
            <select
              value={form.budget_currency}
              onChange={(e) => set("budget_currency", e.target.value)}
            >
              <option>USD</option>
              <option>EUR</option>
              <option>GEL</option>
            </select>
          </label>
        </div>
        {form.kind === "client" && (
          <label>
            Payment due date
            <input
              type="date"
              value={form.payment_due_on}
              onChange={(e) => set("payment_due_on", e.target.value)}
            />
          </label>
        )}
        <div className="projects-form-row">
          <label>
            GitHub URL
            <input
              type="text"
              inputMode="url"
              value={form.github_link}
              onChange={(e) => set("github_link", e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </label>
          <label>
            Website URL
            <input
              type="text"
              inputMode="url"
              value={form.website_link}
              onChange={(e) => set("website_link", e.target.value)}
              placeholder="https://example.com"
            />
          </label>
        </div>
        <label>
          Other link
          <input
            type="text"
            inputMode="url"
            value={form.other_link}
            onChange={(e) => set("other_link", e.target.value)}
          />
        </label>
        <footer>
          <button
            type="button"
            className="projects-button projects-button--secondary"
            onClick={dismiss}
          >
            Cancel
          </button>
          <button className="projects-button projects-button--primary" disabled={saving}>
            {saving ? "Saving…" : project ? "Save changes" : "Create project"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function TaskForm({
  task,
  project,
  userId,
  onClose,
  onSaved,
}: {
  task: ProjectTask | null;
  project: Project;
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "todo");
  const [priority, setPriority] = useState(task?.priority ?? "normal");
  const [due, setDue] = useState(task?.due_on ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dismiss = () => {
    const dirty =
      title !== (task?.title ?? "") ||
      description !== (task?.description ?? "") ||
      status !== (task?.status ?? "todo") ||
      priority !== (task?.priority ?? "normal") ||
      due !== (task?.due_on ?? "");
    if (dirty && !window.confirm("Discard unsaved task changes?")) return;
    onClose();
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    const payload = {
      project_id: project.id,
      user_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_on: due || null,
      completed_at: status === "done" ? (task?.completed_at ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };
    const result = task
      ? await supabase.from("project_tasks").update(payload).eq("id", task.id)
      : await supabase.from("project_tasks").insert(payload);
    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    await onSaved();
    onClose();
  };
  return (
    <Dialog title={task ? "Edit task" : "New task"} onClose={dismiss}>
      <form className="projects-form" onSubmit={submit}>
        {error && (
          <p className="projects-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Task title
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="projects-form-row projects-form-row--3">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="todo">To do</option>
              <option value="doing">In progress</option>
              <option value="done">Completed</option>
            </select>
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <footer>
          <button
            type="button"
            className="projects-button projects-button--secondary"
            onClick={dismiss}
          >
            Cancel
          </button>
          <button className="projects-button projects-button--primary" disabled={saving}>
            {saving ? "Saving…" : "Save task"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
function ActivityHeatmap({ days }: { days: DailyActivity[] }) {
  const calendarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (calendarRef.current) calendarRef.current.scrollLeft = calendarRef.current.scrollWidth;
  }, [days]);
  const end = today();
  const start = dateAfterDays(end, -364);
  const gridStart = mondayOf(new Date(`${start}T12:00:00`));
  const weekCount = Math.ceil(
    (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${gridStart}T12:00:00Z`) + 86400000) /
      (7 * 86400000),
  );
  const weeks = Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => dateAfterDays(gridStart, week * 7 + day)),
  );
  const counts = new Map<string, number>();
  for (const day of days) {
    if (day.activity_day >= start && day.activity_day <= end)
      counts.set(
        day.activity_day,
        Number(day.commit_count) + Number(day.pull_request_count) + Number(day.merge_count),
      );
  }
  const activeDays = counts.size;
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const peak = Math.max(0, ...counts.values());
  const intensity = (count: number) =>
    count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
  return (
    <div className="projects-heatmap">
      <div
        ref={calendarRef}
        className="projects-heatmap__calendar"
        role="group"
        aria-label="Development activity calendar, last 365 days"
      >
        <div className="projects-heatmap__day-labels" aria-hidden="true">
          <span />
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
          <span />
        </div>
        <div className="projects-heatmap__weeks">
          {weeks.map((week, index) => (
            <div className="projects-heatmap__week" key={week[0]}>
              <span className="projects-heatmap__month">
                {index === 0 || week.some((day) => day.endsWith("-01"))
                  ? new Date(
                      `${week.find((day) => day.endsWith("-01")) ?? week[0]}T12:00:00`,
                    ).toLocaleDateString(undefined, { month: "short" })
                  : ""}
              </span>
              {week.map((day) => {
                const inRange = day >= start && day <= end;
                const count = inRange ? (counts.get(day) ?? 0) : 0;
                return (
                  <span
                    key={day}
                    className={`projects-heatmap__cell ${inRange ? `level-${intensity(count)}` : "is-outside"}`}
                    title={
                      inRange
                        ? `${dateLabel(day)}: ${count} synchronized event${count === 1 ? "" : "s"}`
                        : undefined
                    }
                    role={inRange ? "img" : undefined}
                    tabIndex={inRange && count > 0 ? 0 : undefined}
                    aria-label={
                      inRange
                        ? `${dateLabel(day)}: ${count} synchronized event${count === 1 ? "" : "s"}`
                        : undefined
                    }
                    aria-hidden={!inRange}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="projects-heatmap__legend" aria-label="Activity intensity from less to more">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={`projects-heatmap__cell level-${level}`} aria-hidden="true" />
          ))}
          <span>More</span>
        </div>
      </div>
      <span className="projects-heatmap__mobile-hint">Swipe to view earlier weeks</span>
      <div className="projects-heatmap__summary">
        <strong>{total}</strong>
        <span>synchronized events</span>
        <div>
          <b>{activeDays}</b>
          <span>active days</span>
        </div>
        <div>
          <b>{peak}</b>
          <span>most events in a day</span>
        </div>
        <p>
          {total
            ? "Commits, pull requests, and merges from connected repositories only."
            : "No verified events in this period. Connected repositories will fill this calendar as activity syncs."}
        </p>
      </div>
    </div>
  );
}
// Project details render once in a portal: centered on desktop and full screen on phones.
function Workspace({
  project,
  data,
  userId,
  onClose,
  onEdit,
  onReload,
  onError,
  onDelete,
  onDirtyChange,
  githubAction,
}: {
  project: Project;
  data: Data;
  userId: string;
  onClose: () => void;
  onEdit: () => void;
  onReload: () => Promise<void>;
  onError: (error: string) => void;
  onDelete: () => void;
  onDirtyChange: (dirty: boolean) => void;
  githubAction: (action: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [section, setSection] = useState("Overview");
  const [taskForm, setTaskForm] = useState<ProjectTask | null | "new">(null);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskSort, setTaskSort] = useState("due");
  const [noteInput, setNoteInput] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [syncFrom, setSyncFrom] = useState(dateAfterDays(today(), -30));
  const [syncTo, setSyncTo] = useState(today());
  const [syncPreset, setSyncPreset] = useState("30");
  const [workWeek, setWorkWeek] = useState(mondayOf(new Date()));
  const [weekEvents, setWeekEvents] = useState<GitHubEvent[] | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [manual, setManual] = useState(false);
  const [manualWeeks, setManualWeeks] = useState("");
  useEffect(() => {
    const dirty = !!(
      noteInput.trim() ||
      linkTitle.trim() ||
      linkUrl.trim() ||
      (renewOpen && manual && manualWeeks)
    );
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [noteInput, linkTitle, linkUrl, renewOpen, manual, manualWeeks, onDirtyChange]);
  const [standardHours, setStandardHours] = useState(
    () => Number(localStorage.getItem("fdash.work-week-hours")) || 40,
  );
  const [saving, setSaving] = useState(false);
  const tasks = data.tasks.filter((t) => t.project_id === project.id);
  const notes = data.notes
    .filter((n) => n.project_id === project.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const links = data.links.filter((l) => l.project_id === project.id);
  const reviews = data.reviews
    .filter((r) => r.project_id === project.id)
    .sort((a, b) => b.week_start.localeCompare(a.week_start));
  const repositories = data.repositories.filter((r) => r.project_id === project.id);
  const events = data.events
    .filter((e) => e.project_id === project.id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  useEffect(() => {
    if (!renewOpen) return;
    let activeRequest = true;
    queueMicrotask(() => {
      if (activeRequest) {
        setWeekEvents(null);
        setEstimateError("");
      }
    });
    void supabase
      .from("github_events")
      .select("*")
      .eq("user_id", userId)
      .eq("project_id", project.id)
      .gte("occurred_at", `${dateAfterDays(workWeek, -1)}T00:00:00Z`)
      .lt("occurred_at", `${dateAfterDays(workWeek, 8)}T00:00:00Z`)
      .limit(1000)
      .then(({ data: rows, error }) => {
        if (!activeRequest) return;
        if (error) {
          setEstimateError("Could not load GitHub activity for this week.");
          setWeekEvents([]);
        } else if ((rows?.length ?? 0) >= 1000) {
          setEstimateError(
            "This week has too much activity for a complete estimate. Enter actual time manually.",
          );
          setWeekEvents([]);
        } else setWeekEvents((rows ?? []) as GitHubEvent[]);
      });
    return () => {
      activeRequest = false;
    };
  }, [renewOpen, workWeek, userId, project.id]);
  const progress = taskProgress(tasks);
  const ledger = ledgerByCurrency(data.transactions, project.id);
  const budgetCurrency = project.budget_currency ?? "USD";
  const received = ledger[budgetCurrency]?.income ?? 0;
  const outstanding =
    project.agreed_payment == null ? null : Math.max(0, Number(project.agreed_payment) - received);
  const estimate = estimateWorkWeek(weekEvents ?? [], workWeek, standardHours);
  const existingReview = reviews.find((r) => r.week_start === workWeek);
  const confirmedWeeks = reviews.reduce((sum, r) => sum + Number(r.confirmed_weeks), 0);
  const run = async (work: () => PromiseLike<{ error: { message: string } | null }>) => {
    setSaving(true);
    const result = await work();
    setSaving(false);
    if (result.error) {
      onError(result.error.message);
      return false;
    }
    await onReload();
    return true;
  };
  const visibleTasks = tasks
    .filter(
      (t) =>
        (taskFilter === "all" || t.status === taskFilter) &&
        `${t.title} ${t.description ?? ""}`.toLowerCase().includes(taskSearch.toLowerCase()),
    )
    .sort((a, b) =>
      taskSort === "priority"
        ? { high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority]
        : taskSort === "name"
          ? a.title.localeCompare(b.title)
          : (a.due_on || "9999").localeCompare(b.due_on || "9999"),
    );
  const saveNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const saved = await run(() =>
      editingNote
        ? supabase
            .from("project_notes")
            .update({ content: noteInput.trim(), updated_at: new Date().toISOString() })
            .eq("id", editingNote)
        : supabase
            .from("project_notes")
            .insert({ project_id: project.id, user_id: userId, content: noteInput.trim() }),
    );
    if (saved) {
      setNoteInput("");
      setEditingNote(null);
    }
  };
  const saveLink = async (e: FormEvent) => {
    e.preventDefault();
    const url = normalizeExternalUrl(linkUrl);
    if (!url) return onError("Enter a valid HTTPS link.");
    const saved = await run(() =>
      editingLink
        ? supabase
            .from("project_links")
            .update({ title: linkTitle.trim(), url })
            .eq("id", editingLink)
        : supabase
            .from("project_links")
            .insert({ project_id: project.id, user_id: userId, title: linkTitle.trim(), url }),
    );
    if (saved) {
      setLinkTitle("");
      setLinkUrl("");
      setEditingLink(null);
    }
  };
  const saveReview = async (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 7)
      return onError("Enter between 0 and 7 weeks.");
    setSaving(true);
    const payload = {
      project_id: project.id,
      user_id: userId,
      week_start: workWeek,
      estimated_weeks: estimate.weeks,
      confirmed_weeks: value,
      standard_week_hours: standardHours,
      confirmation_method: manual ? "manual" : "accepted",
      estimation_version: estimate.method,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const result = existingReview
      ? await supabase.from("project_work_reviews").update(payload).eq("id", existingReview.id)
      : await supabase.from("project_work_reviews").insert(payload);
    if (result.error) onError(result.error.message);
    else {
      await onReload();
      setRenewOpen(false);
    }
    setSaving(false);
  };
  const closeRenew = () => {
    if (manual && manualWeeks && !window.confirm("Discard the work time you entered?")) return;
    setRenewOpen(false);
  };
  const tabs = ["Overview", "Tasks", "Notes", "Links", "Finances", "Work time", "GitHub"];
  return (
    <section className="projects-workspace" aria-label={`${project.name} workspace`}>
      <div className="projects-workspace__sticky">
        <div className="projects-workspace__head">
          <div>
            <button className="projects-back" onClick={onClose}>
              <Icon name="close" /> Back to projects
            </button>
            <h2>{project.name}</h2>
            <div className="projects-workspace__meta">
              <span>
                {project.clients?.name ??
                  (project.kind === "personal" ? "Personal project" : "Client project")}
              </span>
              <span className="projects-status">{project.status}</span>
            </div>
            <div className="projects-workspace__links">
              <External
                href={project.github_link || repositories[0]?.html_url || null}
                label="Open GitHub repository"
                icon="github"
              />
              <External href={project.website_link} label="Open project website" icon="globe" />
            </div>
          </div>
          <div className="projects-workspace__actions">
            <button className="projects-button projects-button--secondary" onClick={onEdit}>
              Edit project
            </button>
            <button className="projects-button projects-button--danger" onClick={onDelete}>
              Delete
            </button>
            <button
              className="projects-icon-link projects-desktop-close"
              onClick={onClose}
              aria-label="Close project"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="projects-workspace__tabs">
          <GooeyNav
            items={tabs.map(label => ({ label }))}
            activeIndex={tabs.indexOf(section)}
            onChange={(_, item) => setSection(item.label ?? "Overview")}
            theme="light"
            size="md"
            frame
            particleCount={8}
            spread={32}
            gooeyness={0.25}
            wobble={0.2}
            tabMode
            ariaLabel="Project sections"
          />
        </div>
      </div>
      {section === "Overview" && (
        <div className="projects-workspace__content">
          <p className="projects-description">
            {project.description || "No description yet. Add one when you edit this project."}
          </p>
          <div className="projects-detail-grid">
            <div>
              <span>Task progress</span>
              <strong>{progress.percent == null ? "Untracked" : `${progress.percent}%`}</strong>
              <small>
                {progress.done} of {progress.total} completed
              </small>
            </div>
            <div>
              <span>Confirmed work</span>
              <strong>{confirmedWeeks.toFixed(2)} wk</strong>
              <small>{reviews.length} reviewed weeks</small>
            </div>
            <div>
              <span>Deadline</span>
              <strong>{dateLabel(project.deadline)}</strong>
              <small>{deadlineState(project) || "No alert"}</small>
            </div>
          </div>
          <dl className="projects-facts">
            <div>
              <dt>Start date</dt>
              <dd>{dateLabel(project.start_date)}</dd>
            </div>
            <div>
              <dt>Planned duration</dt>
              <dd>
                {project.estimated_weeks == null ? "Not set" : `${project.estimated_weeks} weeks`}
              </dd>
            </div>
            <div>
              <dt>Tech stack</dt>
              <dd>{project.tech_stack?.join(", ") || "Not set"}</dd>
            </div>
            <div>
              <dt>Repository</dt>
              <dd>
                {repositories.length
                  ? repositories.map((r) => r.full_name).join(", ")
                  : "Not connected"}
              </dd>
            </div>
          </dl>
          <div className="projects-link-row">
            <External href={project.github_link} label="Open GitHub repository" icon="github" />
            <External href={project.website_link} label="Open website" icon="globe" />
            <External href={project.other_link} label="Open other project link" icon="link" />
          </div>
        </div>
      )}
      {section === "Tasks" && (
        <div className="projects-workspace__content">
          <div className="projects-section-head">
            <div>
              <h3>Tasks</h3>
              <p>
                {progress.total
                  ? `${progress.done} of ${progress.total} complete`
                  : "Add tasks to start tracking progress."}
              </p>
            </div>
            <button
              className="projects-button projects-button--primary"
              onClick={() => setTaskForm("new")}
            >
              <Icon name="plus" /> New task
            </button>
          </div>
          <div className="projects-task-controls">
            <input
              aria-label="Search tasks"
              placeholder="Search tasks"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
            />
            <select
              aria-label="Filter tasks"
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
            >
              <option value="all">All tasks</option>
              <option value="todo">To do</option>
              <option value="doing">In progress</option>
              <option value="done">Completed</option>
            </select>
            <select
              aria-label="Sort tasks"
              value={taskSort}
              onChange={(e) => setTaskSort(e.target.value)}
            >
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
              <option value="name">Name</option>
            </select>
          </div>
          {visibleTasks.length ? (
            <div className="projects-task-list">
              {visibleTasks.map((task) => (
                <div className="projects-task" key={task.id}>
                  <button
                    className={`projects-task__check ${task.status === "done" ? "is-done" : ""}`}
                    aria-label={
                      task.status === "done" ? `Reopen ${task.title}` : `Complete ${task.title}`
                    }
                    disabled={saving}
                    onClick={() =>
                      run(() =>
                        supabase
                          .from("project_tasks")
                          .update({
                            status: task.status === "done" ? "todo" : "done",
                            completed_at: task.status === "done" ? null : new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", task.id),
                      )
                    }
                  >
                    <Check aria-hidden="true" size={13} strokeWidth={2.5} />
                  </button>
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {task.description || `${task.priority} priority`}
                      {task.due_on ? ` · Due ${dateLabel(task.due_on)}` : ""}
                    </small>
                  </div>
                  <span className="projects-task__status">
                    {task.status === "todo"
                      ? "To do"
                      : task.status === "doing"
                        ? "In progress"
                        : "Done"}
                  </span>
                  <button className="projects-text-button" onClick={() => setTaskForm(task)}>
                    Edit
                  </button>
                  <button
                    className="projects-text-button projects-text-button--danger"
                    onClick={() => {
                      if (window.confirm(`Delete “${task.title}”?`))
                        run(() => supabase.from("project_tasks").delete().eq("id", task.id));
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="projects-empty-inline">
              {tasks.length
                ? "No tasks match these filters."
                : "No tasks yet. Create the first one to track progress."}
            </p>
          )}
        </div>
      )}
      {section === "Notes" && (
        <div className="projects-workspace__content">
          <div className="projects-section-head">
            <div>
              <h3>Project notes</h3>
              <p>Updates and context for this project.</p>
            </div>
          </div>
          <form className="projects-note-form" onSubmit={saveNote}>
            <textarea
              aria-label="Note content"
              rows={3}
              placeholder="Write a project note…"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <button
              className="projects-button projects-button--primary"
              disabled={saving || !noteInput.trim()}
            >
              {editingNote ? "Save note" : "Add note"}
            </button>
            {editingNote && (
              <button
                type="button"
                className="projects-text-button"
                onClick={() => {
                  setEditingNote(null);
                  setNoteInput("");
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
          {notes.length ? (
            <div className="projects-note-list">
              {notes.map((note) => (
                <article key={note.id}>
                  <p>{note.content}</p>
                  <footer>
                    <time>{timeLabel(note.created_at)}</time>
                    <button
                      className="projects-text-button"
                      onClick={() => {
                        setEditingNote(note.id);
                        setNoteInput(note.content);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="projects-text-button projects-text-button--danger"
                      onClick={() => {
                        if (window.confirm("Delete this note?"))
                          run(() => supabase.from("project_notes").delete().eq("id", note.id));
                      }}
                    >
                      Delete
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <p className="projects-empty-inline">No notes yet.</p>
          )}
        </div>
      )}
      {section === "Links" && (
        <div className="projects-workspace__content">
          <div className="projects-section-head">
            <div>
              <h3>Links and references</h3>
              <p>Save external documents, designs, and resources.</p>
            </div>
          </div>
          <form className="projects-link-form" onSubmit={saveLink}>
            <input
              required
              maxLength={120}
              aria-label="Link title"
              placeholder="Title"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
            <input
              required
              inputMode="url"
              aria-label="Link URL"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <button className="projects-button projects-button--primary" disabled={saving}>
              {editingLink ? "Save link" : "Add link"}
            </button>
            {editingLink && (
              <button
                type="button"
                className="projects-text-button"
                onClick={() => {
                  setEditingLink(null);
                  setLinkTitle("");
                  setLinkUrl("");
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
          {links.length ? (
            <ul className="projects-reference-list">
              {links.map((link) => (
                <li key={link.id}>
                  <External href={link.url} label={`Open ${link.title}`} icon="link" />
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.title}
                  </a>
                  <button
                    className="projects-text-button"
                    onClick={() => {
                      setEditingLink(link.id);
                      setLinkTitle(link.title);
                      setLinkUrl(link.url);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="projects-text-button projects-text-button--danger"
                    onClick={() => {
                      if (window.confirm(`Delete “${link.title}”?`))
                        run(() => supabase.from("project_links").delete().eq("id", link.id));
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="projects-empty-inline">No references yet.</p>
          )}
        </div>
      )}
      {section === "Finances" && (
        <div className="projects-workspace__content">
          <div className="projects-section-head">
            <div>
              <h3>Project finances</h3>
              <p>
                Recorded income and expenses come from Finances transactions linked to this project.
              </p>
            </div>
          </div>
          <div className="projects-detail-grid">
            <div>
              <span>Estimated cost</span>
              <strong>
                {project.estimated_cost == null
                  ? "Not set"
                  : money(Number(project.estimated_cost), budgetCurrency)}
              </strong>
            </div>
            {project.kind === "client" && (
              <>
                <div>
                  <span>Agreed payment</span>
                  <strong>
                    {project.agreed_payment == null
                      ? "Not set"
                      : money(Number(project.agreed_payment), budgetCurrency)}
                  </strong>
                </div>
                <div>
                  <span>Outstanding</span>
                  <strong>
                    {outstanding == null ? "Not set" : money(outstanding, budgetCurrency)}
                  </strong>
                  <small>
                    {outstanding == null
                      ? "Add an agreed amount to track this"
                      : outstanding === 0
                        ? "Paid"
                        : project.payment_due_on && project.payment_due_on < today()
                          ? "Overdue"
                          : received > 0
                            ? "Partially paid"
                            : "Unpaid"}
                  </small>
                </div>
              </>
            )}
          </div>
          <div className="projects-finance-list">
            {Object.entries(ledger).length ? (
              Object.entries(ledger).map(([currency, amounts]) => (
                <div key={currency}>
                  <span>{currency}</span>
                  <span>
                    Received{" "}
                    {currency === "Unspecified"
                      ? amounts.income.toFixed(2)
                      : money(amounts.income, currency)}
                  </span>
                  <span>
                    Costs{" "}
                    {currency === "Unspecified"
                      ? amounts.expense.toFixed(2)
                      : money(amounts.expense, currency)}
                  </span>
                </div>
              ))
            ) : (
              <p className="projects-empty-inline">
                No recorded transactions are linked to this project.
              </p>
            )}
          </div>
          <p className="projects-help">
            Amounts in different currencies are shown separately. Link transactions to this project
            from Finances.
          </p>
        </div>
      )}
      {section === "Work time" && (
        <div className="projects-workspace__content">
          <div className="projects-section-head">
            <div>
              <h3>Confirmed work</h3>
              <p>Time changes only after you confirm a reviewed week.</p>
            </div>
            <button
              className="projects-button projects-button--primary"
              onClick={() => {
                setWorkWeek(mondayOf(new Date()));
                setRenewOpen(true);
                setManual(false);
              }}
            >
              Renew Time
            </button>
          </div>
          <div className="projects-work-total">
            {confirmedWeeks.toFixed(2)} <span>weeks confirmed</span>
          </div>
          {reviews.length ? (
            <div className="projects-review-list">
              {reviews.map((review) => (
                <div key={review.id}>
                  <div>
                    <strong>
                      {dateLabel(review.week_start)} – {dateLabel(review.week_end)}
                    </strong>
                    <small>
                      {review.confirmation_method === "accepted"
                        ? "GitHub estimate accepted"
                        : "Entered manually"}{" "}
                      · Confirmed {timeLabel(review.confirmed_at)}
                      {review.estimated_weeks != null
                        ? ` · Estimate ${review.estimated_weeks} wk`
                        : ""}
                    </small>
                  </div>
                  <strong>{Number(review.confirmed_weeks).toFixed(2)} wk</strong>
                  <button
                    className="projects-text-button"
                    onClick={() => {
                      setWorkWeek(review.week_start);
                      setManual(true);
                      setManualWeeks(String(review.confirmed_weeks));
                      setRenewOpen(true);
                    }}
                  >
                    Correct
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="projects-empty-inline">
              No confirmed work weeks yet. Renew Time to review a week.
            </p>
          )}
        </div>
      )}
      {section === "GitHub" && (
        <div className="projects-workspace__content">
          <div className="projects-section-head">
            <div>
              <h3>GitHub activity</h3>
              <p>Only verified events from connected repositories appear here.</p>
            </div>
            <button
              className="projects-button projects-button--secondary"
              onClick={() => githubAction("repositories", { project_id: project.id })}
            >
              Manage repositories
            </button>
          </div>
          <div className="projects-sync-range">
            <label>
              Date range
              <select value={syncPreset} onChange={(event) => {
                const range = event.target.value;
                setSyncPreset(range);
                if (range !== "custom") { setSyncFrom(historyStart(range)); setSyncTo(today()); }
              }}>
                <option value="30">Last 30 days</option><option value="90">Last 90 days</option>
                <option value="6m">Last 6 months</option><option value="12m">Last 12 months</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            <label>
              Import from
              <input
                type="date"
                value={syncFrom}
                max={syncTo}
                onChange={(e) => { setSyncPreset("custom"); setSyncFrom(e.target.value); }}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                value={syncTo}
                min={syncFrom}
                max={today()}
                onChange={(e) => { setSyncPreset("custom"); setSyncTo(e.target.value); }}
              />
            </label>
          </div>
          {repositories.length ? (
            <div className="projects-repo-list">
              {repositories.map((repo) => (
                <div key={repo.id}>
                  <External href={repo.html_url} label={`Open ${repo.full_name}`} icon="github" />
                  <strong>{repo.full_name}</strong>
                  <span>{repo.state}</span>
                  <small>
                    {repo.last_synced_at
                      ? `Last synced ${timeLabel(repo.last_synced_at)}`
                      : "Awaiting first sync"}
                  </small>
                  <button
                    className="projects-text-button"
                    onClick={() =>
                      githubAction("sync", { repository_id: repo.id, from: syncFrom, to: syncTo })
                    }
                  >
                    Resync
                  </button>
                  <button
                    className="projects-text-button projects-text-button--danger"
                    onClick={() => {
                      if (window.confirm(`Disconnect ${repo.full_name}?`))
                        githubAction("disconnect", { repository_id: repo.id });
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="projects-empty-inline">
              No repository connected to this project. Connect GitHub to choose one.
            </p>
          )}
          {events.length ? (
            <div className="projects-event-list">
              {events.slice(0, 20).map((event) => (
                <a href={event.html_url} target="_blank" rel="noopener noreferrer" key={event.id}>
                  <span className="projects-event-kind">
                    {event.kind === "commit"
                      ? "Commit"
                      : event.kind === "merge"
                        ? "Merged PR"
                        : "Pull request"}
                  </span>
                  <strong>{event.title}</strong>
                  <small>
                    {event.author_login ? `${event.author_login} · ` : ""}
                    {timeLabel(event.occurred_at)}
                  </small>
                </a>
              ))}
            </div>
          ) : (
            <p className="projects-empty-inline">No activity in the last 90 days. Earlier activity remains in the calendar.</p>
          )}
        </div>
      )}
      {taskForm && (
        <TaskForm
          task={taskForm === "new" ? null : taskForm}
          project={project}
          userId={userId}
          onClose={() => setTaskForm(null)}
          onSaved={onReload}
        />
      )}
      {renewOpen && (
        <Dialog title={existingReview ? "Correct work time" : "Renew Time"} onClose={closeRenew}>
          <div className="projects-renew">
            <label>
              Week starting Monday
              <input
                type="date"
                value={workWeek}
                max={today()}
                onChange={(e) => {
                  if (e.target.value) {
                    setWeekEvents(null);
                    setEstimateError("");
                    setWorkWeek(mondayOf(new Date(`${e.target.value}T12:00:00Z`)));
                  }
                }}
              />
            </label>
            <p>
              Reviewing {dateLabel(workWeek)} – {dateLabel(dateAfterDays(workWeek, 6))}.
            </p>
            {existingReview && (
              <p className="projects-notice">
                This week is already confirmed. Saving will correct the existing record.
              </p>
            )}
            <label>
              Hours in a standard working week
              <input
                type="number"
                min="10"
                max="80"
                step="0.5"
                value={standardHours}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value >= 10 && value <= 80) {
                    setStandardHours(value);
                    localStorage.setItem("fdash.work-week-hours", String(value));
                  }
                }}
              />
            </label>
            <div className="projects-estimate">
              <span>GitHub activity estimate</span>
              <strong>
                {weekEvents === null
                  ? "Loading activity…"
                  : estimateError
                    ? "Estimate unavailable"
                    : estimate.weeks == null
                      ? "Insufficient activity"
                      : `${estimate.weeks.toFixed(2)} weeks`}
              </strong>
              {estimateError && <small role="alert">{estimateError}</small>}
              <small>
                {estimate.activeDays} active days in connected repositories. Conservative estimate:
                2 hours per active day, capped at 16 hours; {standardHours} hours = 1 week. Commits
                do not measure actual work.
              </small>
            </div>
            {manual ? (
              <label>
                Actual time spent, in weeks
                <input
                  autoFocus
                  type="number"
                  min="0"
                  max="7"
                  step="0.001"
                  value={manualWeeks}
                  onChange={(e) => setManualWeeks(e.target.value)}
                />
              </label>
            ) : (
              <p>Is this close to the actual time you spent?</p>
            )}
            <footer>
              <button className="projects-button projects-button--secondary" onClick={closeRenew}>
                Cancel
              </button>
              {manual ? (
                <button
                  className="projects-button projects-button--primary"
                  disabled={saving || manualWeeks === ""}
                  onClick={() => saveReview(Number(manualWeeks))}
                >
                  {saving ? "Saving…" : existingReview ? "Save correction" : "Confirm actual time"}
                </button>
              ) : (
                <>
                  <button
                    className="projects-button projects-button--secondary"
                    onClick={() => {
                      setManual(true);
                      setManualWeeks(existingReview ? String(existingReview.confirmed_weeks) : "");
                    }}
                  >
                    No, enter manually
                  </button>
                  <button
                    className="projects-button projects-button--primary"
                    disabled={
                      saving || weekEvents === null || !!estimateError || estimate.weeks == null
                    }
                    onClick={() => saveReview(estimate.weeks!)}
                  >
                    {saving ? "Saving…" : "Yes, confirm"}
                  </button>
                </>
              )}
            </footer>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function ProjectModal({
  project,
  originElement,
  originRect,
  closing,
  onRequestClose,
  onClosed,
  children,
}: {
  project: Project;
  originElement: HTMLElement | null;
  originRect: DOMRect | null;
  closing: boolean;
  onRequestClose: () => void;
  onClosed: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onRequestClose);
  const closedRef = useRef(onClosed);
  const originalFocus = useRef<HTMLElement | null>(null);
  const openAnimationRef = useRef<Animation | null>(null);
  useEffect(() => {
    closeRef.current = onRequestClose;
    closedRef.current = onClosed;
  }, [onRequestClose, onClosed]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    originalFocus.current = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    const oldPadding = document.body.style.paddingRight;
    const appRoot = document.getElementById("root");
    const wasInert = appRoot?.inert ?? false;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    document.body.style.overflow = "hidden";
    if (appRoot) appRoot.inert = true;
    panel.focus({ preventScroll: true });
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = panel.getBoundingClientRect();
    const visibleOrigin = originRect && originRect.bottom > 0 && originRect.top < innerHeight;
    const start =
      !mobile && visibleOrigin
        ? `translate(${originRect!.left + originRect!.width / 2 - rect.left - rect.width / 2}px, ${originRect!.top + originRect!.height / 2 - rect.top - rect.height / 2}px) scale(${originRect!.width / rect.width}, ${originRect!.height / rect.height})`
        : mobile
          ? "translateY(24px)"
          : "scale(.94)";
    const animation = reduced
      ? null
      : panel.animate(
          [
            {
              transform: start,
              opacity: mobile ? 0.8 : 0.82,
              borderRadius: visibleOrigin && !mobile ? "12px" : undefined,
            },
            { transform: "none", opacity: 1, borderRadius: mobile ? "0px" : "18px" },
          ],
          { duration: mobile ? 350 : 420, easing: "cubic-bezier(.16, 1, .3, 1)" },
        );
    openAnimationRef.current = animation;
    const handleKey = (event: KeyboardEvent) => {
      if (document.querySelector(".projects-dialog-backdrop")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ].filter((element) => element.getClientRects().length > 0);
      if (!controls.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1)!;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === panel)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      animation?.cancel();
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = oldOverflow;
      document.body.style.paddingRight = oldPadding;
      if (appRoot) appRoot.inert = wasInert;
      const focusTarget = originElement?.matches(".projects-card")
        ? originElement.querySelector<HTMLElement>(".projects-card__main")
        : originElement;
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
      else originalFocus.current?.focus({ preventScroll: true });
    };
  }, [originElement, originRect]);

  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => closedRef.current());
      return;
    }
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const target = originElement?.isConnected ? originElement.getBoundingClientRect() : null;
    const rect = panel.getBoundingClientRect();
    const canReturn =
      !mobile && target && target.width > 0 && target.bottom > 0 && target.top < innerHeight;
    const end = canReturn
      ? `translate(${target!.left + target!.width / 2 - rect.left - rect.width / 2}px, ${target!.top + target!.height / 2 - rect.top - rect.height / 2}px) scale(${target!.width / rect.width}, ${target!.height / rect.height})`
      : mobile
        ? "translateY(18px)"
        : "scale(.96)";
    const currentStyle = window.getComputedStyle(panel);
    const currentTransform = currentStyle.transform;
    const currentOpacity = Number(currentStyle.opacity);
    openAnimationRef.current?.cancel();
    const animation = panel.animate(
      [
        { transform: currentTransform, opacity: currentOpacity },
        { transform: end, opacity: canReturn ? 0.78 : 0 },
      ],
      { duration: mobile ? 240 : 320, easing: "cubic-bezier(.4, 0, .8, .2)", fill: "forwards" },
    );
    void animation.finished.then(() => closedRef.current()).catch(() => {});
    return () => animation.cancel();
  }, [closing, originElement]);

  return createPortal(
    <div className={`projects-project-modal${closing ? " is-closing" : ""}`}>
      <div className="projects-project-modal__backdrop" onMouseDown={onRequestClose} />
      <section
        ref={panelRef}
        className="projects-project-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} project workspace`}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const showGitHub = useGitHub();
  const [data, setData] = useState<Data>(() => dashboardSnapshot<Data>(`${user?.id}|projects`) ?? blank);
  const [loading, setLoading] = useState(() => !dashboardSnapshot<Data>(`${user?.id}|projects`));
  const [error, setErrorState] = useState("");
  const [notice, setNoticeState] = useState("");
  const [errorSequence, setErrorSequence] = useState(0);
  const [noticeSequence, setNoticeSequence] = useState(0);
  const setError = useCallback((message: string) => {
    setErrorState(message);
    if (message) setErrorSequence((sequence) => sequence + 1);
  }, []);
  const setNotice = useCallback((message: string) => {
    setNoticeState(message);
    if (message) setNoticeSequence((sequence) => sequence + 1);
  }, []);
  const [kind, setKind] = useState<ProjectKind>("client");
  const [view, setView] = useState<"grid" | "table">(() =>
    localStorage.getItem("fdash.projects.view") === "table" ? "table" : "grid",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deadline, setDeadline] = useState("all");
  const [githubFilter, setGithubFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [pulseMode, setPulseMode] = useState<"tasks" | "status" | "work">("tasks");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("project"),
  );
  const [projectModalClosing, setProjectModalClosing] = useState(false);
  const [projectOrigin, setProjectOrigin] = useState<{
    element: HTMLElement | null;
    rect: DOMRect | null;
  }>({ element: null, rect: null });
  const projectDraftRef = useRef(false);
  const projectHistoryRef = useRef(false);
  const onProjectDirtyChange = useCallback((dirty: boolean) => {
    projectDraftRef.current = dirty;
  }, []);
  const [formProject, setFormProject] = useState<Project | null | "new">(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [repoPicker, setRepoPicker] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<
    { id: number; full_name: string; html_url: string; installation_id: number }[]
  >([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [selectedRepoProjectId, setSelectedRepoProjectId] = useState("");
  const [initialPreset, setInitialPreset] = useState("30");
  const [initialFrom, setInitialFrom] = useState(historyStart("30"));
  const [initialTo, setInitialTo] = useState(today());
  const [connecting, setConnecting] = useState(false);
  const [deviceAuthorization, setDeviceAuthorization] = useState<DeviceAuthorization | null>(null);
  const githubBusyRef = useRef(false);
  const githubRetryRef = useRef<{ action: string; extra: Record<string, unknown> } | null>(null);
  const load = useCallback(
    async (initial = false) => {
      if (!user) return;
      if (initial && !dashboardSnapshot<Data>(`${user.id}|projects`)) setLoading(true);
      setError("");
      const results = await Promise.all([
        supabase
          .from("projects")
          .select("*,clients(name)")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase.from("clients").select("id,name").eq("user_id", user.id),
        supabase.from("project_tasks").select("*").eq("user_id", user.id),
        supabase.from("project_notes").select("*").eq("user_id", user.id),
        supabase.from("project_links").select("*").eq("user_id", user.id),
        supabase.from("project_work_reviews").select("*").eq("user_id", user.id),
        supabase.from("github_repositories").select("*").eq("user_id", user.id),
        supabase
          .from("github_events")
          .select("*")
          .eq("user_id", user.id)
          .gte("occurred_at", `${dateAfterDays(today(), -91)}T00:00:00Z`)
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .range(0, 999),
        supabase
          .from("transactions")
          .select("id,project_id,type,amount,income_amount,expense_amount,currency,date")
          .eq("user_id", user.id),
        supabase
          .from("github_connections")
          .select("id,github_login,installation_id,state")
          .eq("user_id", user.id),
        supabase.rpc("project_github_activity_calendar", {
          p_since: dateAfterDays(today(), -364),
          p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      ]);
      let failure = results.find((result) => result.error)?.error;
      let activityEvents = (results[7].data ?? []) as GitHubEvent[];
      for (
        let offset = 1000;
        !failure && activityEvents.length === offset && offset < 10000;
        offset += 1000
      ) {
        const page = await supabase
          .from("github_events")
          .select("*")
          .eq("user_id", user.id)
          .gte("occurred_at", `${dateAfterDays(today(), -91)}T00:00:00Z`)
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 999);
        if (page.error) failure = page.error;
        else activityEvents = [...activityEvents, ...((page.data ?? []) as GitHubEvent[])];
      }
      if (failure) setError(failure.message);
      else {
        if (activityEvents.length >= 10000)
          setError(
            "Development activity is unusually large; only the newest 10,000 events are shown.",
          );
        const nextData: Data = {
          projects: (results[0].data ?? []) as Project[],
          clients: (results[1].data ?? []) as Client[],
          tasks: (results[2].data ?? []) as ProjectTask[],
          notes: (results[3].data ?? []) as ProjectNote[],
          links: (results[4].data ?? []) as ProjectLink[],
          reviews: (results[5].data ?? []) as WorkReview[],
          repositories: (results[6].data ?? []) as GitHubRepository[],
          events: activityEvents,
          transactions: (results[8].data ?? []) as LedgerTransaction[],
          connections: (results[9].data ?? []) as Connection[],
          dailyActivity: (results[10].data ?? []) as DailyActivity[],
        };
        saveDashboardSnapshot(`${user.id}|projects`, nextData);
        setData(nextData);
      }
      setLoading(false);
    },
    [user, setError],
  );
  useEffect(() => {
    queueMicrotask(() => void load(true));
  }, [load]);
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`projects-github-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "github_events", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "github_repositories",
          filter: `user_id=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe();
    const interval = window.setInterval(() => void load(), 5 * 60_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user, load, setError, setNotice]);
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const authorizationError = params.get("error");
    if (authorizationError) {
      setError(authorizationError === "access_denied" ? "GitHub authorization was cancelled." : "GitHub authorization failed. Connect again.");
      const url = new URL(window.location.href);
      for (const key of ["error", "error_description", "state", "installation_id", "setup_action"]) url.searchParams.delete(key);
      window.history.replaceState({}, "", url);
      return;
    }
    const code = params.get("code"),
      state = params.get("state"),
      installation_id = params.get("installation_id");
    if (!state || (!code && !installation_id)) return;
    let activeRequest = true;
    supabase.functions
      .invoke("github-sync", {
        body: code
          ? { action: "complete", code, state }
          : { action: "authorize", state, installation_id },
      })
      .then(async ({ data: response, error: failure }) => {
        if (!activeRequest) return;
        if (failure || response?.error)
          setError(await githubFailureMessage(failure, response));
        else if (response?.url) {
          window.location.assign(response.url);
          return;
        } else {
          setNotice(response?.message || "GitHub connected.");
          void load();
        }
        const url = new URL(window.location.href);
        for (const key of ["code", "state", "installation_id", "setup_action"])
          url.searchParams.delete(key);
        window.history.replaceState({}, "", url);
      });
    return () => {
      activeRequest = false;
    };
  }, [user, load, setError, setNotice]);
  useEffect(() => {
    if (!user || !deviceAuthorization) return;
    let cancelled = false;
    let timer: number;
    const poll = async () => {
      const { data: response, error: failure } = await supabase.functions.invoke("github-sync", {
        body: { action: "device_poll", state: deviceAuthorization.state },
      });
      if (cancelled) return;
      if (failure || response?.error) {
        setError(await githubFailureMessage(failure, response));
        setDeviceAuthorization(null);
        return;
      }
      if (response?.status === "pending") {
        timer = window.setTimeout(poll, Math.min(60_000, Math.max(1_000, Number(response.retry_after_ms) || 5_000)));
        return;
      }
      setDeviceAuthorization(null);
      setNotice(response?.message || "GitHub connected.");
      void load();
    };
    timer = window.setTimeout(poll, Math.max(1, deviceAuthorization.interval) * 1_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deviceAuthorization, user, load, setError, setNotice]);
  useEffect(() => {
    const onPop = () => {
      const next = new URLSearchParams(window.location.search).get("project");
      if (
        selectedId &&
        (projectDraftRef.current || document.querySelector(".projects-dialog-backdrop")) &&
        !window.confirm("Discard unsaved project changes?")
      ) {
        const url = new URL(window.location.href);
        if (selectedId) url.searchParams.set("project", selectedId);
        window.history.pushState({ project: selectedId }, "", url);
        return;
      }
      setProjectModalClosing(false);
      setSelectedId(next);
      projectHistoryRef.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [selectedId]);
  useEffect(() => {
    try {
      localStorage.setItem("fdash.projects.view", view);
    } catch {
      /* storage disabled */
    }
  }, [view]);
  const selected = data.projects.find((p) => p.id === selectedId) ?? null;
  useEffect(() => {
    if (selected && selected.kind !== kind) queueMicrotask(() => setKind(selected.kind));
  }, [selected, kind]);
  const openProject = (id: string, source?: HTMLElement) => {
    setProjectOrigin({ element: source ?? null, rect: source?.getBoundingClientRect() ?? null });
    projectDraftRef.current = false;
    setProjectModalClosing(false);
    setSelectedId(id);
    if (window.matchMedia("(max-width: 768px)").matches) {
      const url = new URL(window.location.href);
      url.searchParams.set("project", id);
      window.history.pushState({ project: id }, "", url);
      projectHistoryRef.current = true;
    }
  };
  const closeProject = () => {
    if (document.querySelector(".projects-dialog-backdrop")) return;
    if (projectDraftRef.current && !window.confirm("Discard unsaved project changes?")) return;
    setProjectModalClosing(true);
  };
  const finishCloseProject = () => {
    setSelectedId(null);
    setProjectModalClosing(false);
    projectDraftRef.current = false;
    if (projectHistoryRef.current) {
      projectHistoryRef.current = false;
      window.history.back();
    } else if (new URLSearchParams(window.location.search).has("project")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("project");
      window.history.replaceState({}, "", url);
    }
  };
  const projects = useMemo(
    () =>
      data.projects
        .filter((p) => p.kind === kind)
        .filter((p) => status === "all" || p.status === status)
        .filter((p) => {
          const state = deadlineState(p);
          return (
            deadline === "all" ||
            (deadline === "none"
              ? !p.deadline
              : deadline === "overdue"
                ? state === "Overdue"
                : state === "Due soon")
          );
        })
        .filter(
          (p) =>
            githubFilter === "all" ||
            (githubFilter === "connected"
              ? data.repositories.some((r) => r.project_id === p.id)
              : !data.repositories.some((r) => r.project_id === p.id)),
        )
        .filter((p) =>
          `${p.name} ${p.clients?.name ?? ""} ${(p.tech_stack ?? []).join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "deadline"
              ? (a.deadline || "9999").localeCompare(b.deadline || "9999")
              : sort === "progress"
                ? (taskProgress(data.tasks.filter((t) => t.project_id === b.id)).percent ?? -1) -
                  (taskProgress(data.tasks.filter((t) => t.project_id === a.id)).percent ?? -1)
                : sort === "created"
                  ? b.created_at.localeCompare(a.created_at)
                  : b.updated_at.localeCompare(a.updated_at),
        ),
    [data, kind, status, deadline, githubFilter, search, sort],
  );
  const activeCount = data.projects.filter((p) => active(p) && p.status !== "Coming Soon").length;
  const completed = data.projects.filter((p) => p.status === "Completed").length;
  const dueSoon = data.projects.filter(
    (p) => deadlineState(p) === "Due soon" || deadlineState(p) === "Overdue",
  ).length;
  const workWeeks = data.reviews.reduce((sum, r) => sum + Number(r.confirmed_weeks), 0);
  const deleteProject = async () => {
    if (!deleting || !user) return;
    const related = await Promise.all([
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("project_id", deleting.id),
      supabase
        .from("time_sessions")
        .select("id", { count: "exact", head: true })
        .eq("project_id", deleting.id),
      supabase
        .from("recurring_schedules")
        .select("id", { count: "exact", head: true })
        .eq("project_id", deleting.id),
    ]);
    if (related.some((r) => r.error)) {
      setError("Could not verify project relationships. Try again.");
      setDeleting(null);
      return;
    }
    if (related.some((r) => (r.count ?? 0) > 0)) {
      setError(
        "This project has linked financial or time records. Keep it to preserve those relationships.",
      );
      setDeleting(null);
      return;
    }
    const result = await supabase
      .from("projects")
      .delete()
      .eq("id", deleting.id)
      .eq("user_id", user.id);
    if (result.error) setError(result.error.message);
    else {
      if (selectedId === deleting.id) {
        setSelectedId(null);
        projectDraftRef.current = false;
        projectHistoryRef.current = false;
        const url = new URL(window.location.href);
        url.searchParams.delete("project");
        window.history.replaceState({}, "", url);
      }
      await load();
    }
    setDeleting(null);
  };
  const githubAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (githubBusyRef.current) return null;
    githubBusyRef.current = true;
    setConnecting(true);
    setError("");
    try {
      const { data: response, error: failure } = await supabase.functions.invoke("github-sync", {
        body: { action, ...extra },
      });
      if (failure || response?.error) {
        githubRetryRef.current = { action, extra };
        setError(await githubFailureMessage(failure, response));
        return null;
      }
      githubRetryRef.current = null;
      if (action === "repositories") {
        const repositories = (response.repositories ?? []) as typeof availableRepos;
        setAvailableRepos(repositories);
        setSelectedRepoId(repositories.length === 1 ? String(repositories[0].id) : "");
        const mappedProjectId = repositories.length === 1
          ? data.repositories.find((repo) => repo.github_repository_id === repositories[0].id)?.project_id
          : undefined;
        setSelectedRepoProjectId(
          typeof extra.project_id === "string" ? extra.project_id : mappedProjectId ?? "",
        );
        setRepoPicker(true);
      } else if (action === "install") window.location.assign(response.url);
      else if (action === "device_start") setDeviceAuthorization(response as DeviceAuthorization);
      else {
        setNotice(response.message ?? "GitHub updated.");
        await load();
      }
      return response;
    } catch (failure) {
      githubRetryRef.current = { action, extra };
      setError(await githubFailureMessage(failure));
      return null;
    } finally {
      githubBusyRef.current = false;
      setConnecting(false);
    }
  };
  const connectedGitHub = data.connections.some((connection) => connection.state === "connected");
  const needsGitHubReauthorization = data.connections.some((connection) => connection.state === "reauthorization_required");
  const selectedRepo = availableRepos.find((repo) => String(repo.id) === selectedRepoId);
  const selectedRepoMapping = data.repositories.find(
    (repo) => repo.github_repository_id === selectedRepo?.id,
  );
  const counts = {
    client: data.projects.filter((p) => p.kind === "client").length,
    personal: data.projects.filter((p) => p.kind === "personal").length,
  };
  const headerActions = document.getElementById("projects-header-actions");
  return (
    <div className="projects-page">
      {headerActions && createPortal(
        loading ? <div className="projects-header-skeleton-actions" aria-hidden="true"><span/><span/></div> : <>
          <button
            className="projects-button projects-button--secondary"
            onClick={() => githubAction(connectedGitHub ? "repositories" : "install")}
            disabled={connecting}
          >
            {connecting
              ? "Connecting…"
              : connectedGitHub
                ? "GitHub connected"
                : needsGitHubReauthorization
                  ? "Reconnect GitHub"
                  : "Connect GitHub"}
          </button>
          {!connectedGitHub && (
            <button
              className="projects-button projects-button--secondary"
              onClick={() => void githubAction("device_start")}
              disabled={connecting || !!deviceAuthorization}
            >
              {deviceAuthorization ? "Awaiting GitHub…" : "Use device code"}
            </button>
          )}
          <button
            className="projects-button projects-button--primary"
            onClick={() => setFormProject("new")}
          >
            <Icon name="plus" /> New project
          </button>
        </>,
        headerActions,
      )}
      <div className="projects-page__inner">
        {deviceAuthorization && (
          <div className="projects-device-auth" role="status">
            <div>
              <strong>Finish connecting GitHub</strong>
              <p>Enter this code on GitHub. F-Dash will connect after you authorize the App.</p>
            </div>
            <code aria-label="GitHub device code">{deviceAuthorization.user_code}</code>
            <a href={deviceAuthorization.verification_uri} target="_blank" rel="noopener noreferrer">
              Open GitHub authorization
            </a>
            <span>Expires {new Date(deviceAuthorization.expires_at).toLocaleTimeString()}</span>
          </div>
        )}
        {loading ? (
          <div role="status" aria-label="Loading projects">
            <ProjectsContentSkeleton />
          </div>
        ) : (
          <>
            <div className="projects-metrics">
              <DashboardMetricCard className="projects-metric projects-metric--primary" label="Active projects" value={activeCount} detail="Currently underway" />
              <DashboardMetricCard className="projects-metric" label="Completed" value={completed} detail="Across all projects" />
              <DashboardMetricCard className="projects-metric" label="Needs attention" value={dueSoon} detail="Due soon or overdue" />
              <DashboardMetricCard className="projects-metric projects-metric--tint" label="Confirmed work" value={<><AnimatedMetricValue value={workWeeks.toFixed(2)}/> <em>wk</em></>} detail="Reviewed time only" />
            </div>
            <div className="projects-collection">
              <div className="projects-collection__head">
                <div className="projects-kind-tabs">
                  <PillNav
                    className="projects-pill-tabs"
                    items={[{ label: `Client projects ${counts.client}` }, { label: `Personal projects ${counts.personal}` }]}
                    selectedIndex={kind === "client" ? 0 : 1}
                    onItemClick={(_, index) => { setKind(index === 0 ? "client" : "personal"); setSelectedId(null); }}
                    theme="light"
                    size="md"
                    layout="joined"
                    surface="glass"
                    itemStyle="plain"
                    hoverEffect="glide"
                    indicator="pill"
                    collapse="never"
                    intro
                    ariaLabel="Project type"
                  />
                </div>
                <div className="projects-view-switch">
                  <button
                    className={view === "grid" ? "is-active" : ""}
                    onClick={() => setView("grid")}
                    aria-label="Grid view"
                  >
                    <Icon name="grid" />
                  </button>
                  <button
                    className={view === "table" ? "is-active" : ""}
                    onClick={() => setView("table")}
                    aria-label="Table view"
                  >
                    <Icon name="table" />
                  </button>
                </div>
              </div>
              <div className="projects-filters">
                <Seek width={280} height={38} value={search} onChange={setSearch}
                  placeholder="Search projects, clients, tech…" ariaLabel="Search projects" />
                <select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter by deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                >
                  <option value="all">All deadlines</option>
                  <option value="soon">Due soon</option>
                  <option value="overdue">Overdue</option>
                  <option value="none">No deadline</option>
                </select>
                <select
                  aria-label="Filter by GitHub connection"
                  value={githubFilter}
                  onChange={(e) => setGithubFilter(e.target.value)}
                >
                  <option value="all">All repositories</option>
                  <option value="connected">Connected</option>
                  <option value="unconnected">Not connected</option>
                </select>
                <select
                  aria-label="Sort projects"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="updated">Recently updated</option>
                  <option value="created">Newest created</option>
                  <option value="name">Name</option>
                  <option value="deadline">Deadline</option>
                  <option value="progress">Progress</option>
                </select>
              </div>
              <DashboardContentTransition transitionKey={kind}>
              {projects.length === 0 ? (
                <div className="projects-empty">
                  <h2>
                    {data.projects.length === 0
                      ? "Your projects start here"
                      : "No matching projects"}
                  </h2>
                  <p>
                    {data.projects.length === 0
                      ? "Create a client or personal project, then add tasks to track real progress."
                      : "Try another search or filter."}
                  </p>
                  {data.projects.length === 0 && (
                    <button
                      className="projects-button projects-button--primary"
                      onClick={() => setFormProject("new")}
                    >
                      Create a project
                    </button>
                  )}
                </div>
              ) : view === "grid" ? (
                <div className="projects-card-grid">
                  {projects.map((project) => {
                    const progress = taskProgress(
                      data.tasks.filter((t) => t.project_id === project.id),
                    );
                    const repo = data.repositories.find((r) => r.project_id === project.id);
                    const weeks = data.reviews
                      .filter((r) => r.project_id === project.id)
                      .reduce((sum, r) => sum + Number(r.confirmed_weeks), 0);
                    return (
                      <div className="projects-card-slot" key={project.id}>
                        <article
                          className={`projects-card${selectedId === project.id ? " is-selected" : ""}`}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest("button, a")) return;
                            openProject(project.id, event.currentTarget);
                          }}
                        >
                          <button
                            className="projects-card__main"
                            onClick={(event) =>
                              openProject(
                                project.id,
                                event.currentTarget.closest(".projects-card") as HTMLElement,
                              )
                            }
                            aria-haspopup="dialog"
                            aria-label={`Open ${project.name}`}
                          >
                            <div className="projects-card__top">
                              <span className="projects-card__type">
                                {project.clients?.name ??
                                  (project.kind === "personal" ? "Personal" : "Client")}
                              </span>
                              <span
                                className={`projects-status ${deadlineState(project) === "Overdue" ? "is-overdue" : ""}`}
                              >
                                {project.status}
                              </span>
                            </div>
                            <h3>{project.name}</h3>
                            <p>{project.description || "No description yet"}</p>
                            <div className="projects-card__tech">
                              {(project.tech_stack ?? []).slice(0, 3).map((t) => (
                                <span key={t}>{t}</span>
                              ))}
                            </div>
                            <div className="projects-card__progress">
                              <div>
                                <span>Progress</span>
                                <strong>
                                  {progress.percent == null ? "Untracked" : `${progress.percent}%`}
                                </strong>
                              </div>
                              <div className="projects-progress-track">
                                <span
                                  style={{ transform: `scaleX(${(progress.percent ?? 0) / 100})` }}
                                />
                              </div>
                              <small>
                                {progress.total
                                  ? `${progress.done}/${progress.total} tasks complete`
                                  : "Add tasks to start tracking"}
                              </small>
                            </div>
                            <div className="projects-card__facts">
                              <span>
                                {deadlineState(project) ? `${deadlineState(project)} · ` : ""}
                                {project.deadline ? dateLabel(project.deadline) : "No deadline"}
                              </span>
                              <span>{weeks.toFixed(2)} wk confirmed</span>
                            </div>
                          </button>
                          <footer>
                            <div>
                              <External
                                href={project.github_link || repo?.html_url || null}
                                label={`Open ${project.name} on GitHub`}
                                icon="github"
                              />
                              <External
                                href={project.website_link}
                                label={`Open ${project.name} website`}
                                icon="globe"
                              />
                              <External
                                href={project.other_link}
                                label={`Open ${project.name} link`}
                                icon="link"
                              />
                            </div>
                            <span
                              className={
                                repo ? "projects-repo-state is-connected" : "projects-repo-state"
                              }
                            >
                              {repo ? "GitHub connected" : "No repository"}
                            </span>
                          </footer>
                        </article>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="projects-table-wrap">
                  <table className="projects-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Client / type</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Deadline</th>
                        <th>Confirmed</th>
                        <th>GitHub</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project) => {
                        const progress = taskProgress(
                          data.tasks.filter((t) => t.project_id === project.id),
                        );
                        return (
                          <tr
                            key={project.id}
                            tabIndex={0}
                            aria-label={`Open ${project.name}`}
                            onClick={(event) => openProject(project.id, event.currentTarget)}
                            onKeyDown={(event) => {
                              if (
                                event.target === event.currentTarget &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                openProject(project.id, event.currentTarget);
                              }
                            }}
                          >
                            <td>
                              <strong>{project.name}</strong>
                            </td>
                            <td>
                              {project.clients?.name ??
                                (project.kind === "personal" ? "Personal" : "Client")}
                            </td>
                            <td><span className={`projects-status ${deadlineState(project) === "Overdue" ? "is-overdue" : /complete|done/i.test(project.status) ? "is-complete" : /progress|active/i.test(project.status) ? "is-progress" : "is-pending"}`}>{project.status}</span></td>
                            <td>
                              {progress.percent == null
                                ? "Untracked"
                                : `${progress.percent}% · ${progress.done}/${progress.total}`}
                            </td>
                            <td>{project.deadline ? dateLabel(project.deadline) : "—"}</td>
                            <td>
                              {data.reviews
                                .filter((r) => r.project_id === project.id)
                                .reduce((s, r) => s + Number(r.confirmed_weeks), 0)
                                .toFixed(2)}{" "}
                              wk
                            </td>
                            <td>
                              {data.repositories.some((r) => r.project_id === project.id)
                                ? <span className="projects-repo-connected">Connected</span>
                                : "—"}
                            </td>
                            <td>
                              <button
                                className="projects-text-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openProject(
                                    project.id,
                                    event.currentTarget.closest("tr") as HTMLElement,
                                  );
                                }}
                                aria-haspopup="dialog"
                                aria-label={`Open ${project.name}`}
                                data-tooltip="Open project"
                              >
                                <ArrowUpRight size={16} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </DashboardContentTransition>
            </div>
            <div className="projects-lower">
              <section className="projects-panel">
                <div className="projects-panel__head">
                  <h2>Project pulse</h2>
                  <RubberSegment className="projects-rubber-pulse" trackColor="#f4f2f9" thumbColor="#fff" textColor="#35265e" activeTextColor="#27187e" aria-label="Project analytics metric" items={["Tasks", "Status", "Work"]} value={pulseMode[0].toUpperCase() + pulseMode.slice(1)} onChange={value => setPulseMode(value.toLowerCase() as typeof pulseMode)} size="md" />
                </div>
                <DashboardContentTransition transitionKey={pulseMode}>
                <div className="projects-pulse">
                  {pulseMode === "tasks" ? (
                    <>
                      <div>
                        <strong><AnimatedMetricValue value={data.tasks.filter((t) => t.status === "done").length}/></strong>
                        <span>Tasks completed</span>
                      </div>
                      <div>
                        <strong><AnimatedMetricValue value={data.tasks.filter((t) => t.status !== "done").length}/></strong>
                        <span>Tasks remaining</span>
                      </div>
                      <div>
                        <strong>
                          <AnimatedMetricValue value={data.tasks.length
                            ? Math.round(
                                (data.tasks.filter((t) => t.status === "done").length /
                                  data.tasks.length) *
                                  100,
                              )
                            : "—"}/>
                        </strong>
                        <span>Completion %</span>
                      </div>
                    </>
                  ) : pulseMode === "status" ? (
                    <>
                      <div>
                        <strong><AnimatedMetricValue value={activeCount}/></strong>
                        <span>Active</span>
                      </div>
                      <div>
                        <strong><AnimatedMetricValue value={completed}/></strong>
                        <span>Completed</span>
                      </div>
                      <div>
                        <strong><AnimatedMetricValue value={dueSoon}/></strong>
                        <span>Due soon or overdue</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong><AnimatedMetricValue value={workWeeks.toFixed(2)}/></strong>
                        <span>Confirmed weeks</span>
                      </div>
                      <div>
                        <strong><AnimatedMetricValue value={data.reviews.length}/></strong>
                        <span>Reviewed periods</span>
                      </div>
                      <div>
                        <strong>
                          <AnimatedMetricValue value={data.projects.filter((p) =>
                            data.reviews.some((r) => r.project_id === p.id),
                          ).length}/>
                        </strong>
                        <span>Projects with work</span>
                      </div>
                    </>
                  )}
                </div>
                </DashboardContentTransition>
              </section>
              {showGitHub && (
                <section className="projects-panel">
                  <div className="projects-panel__head">
                    <h2>Connected GitHub activity</h2>
                    <span>{data.repositories.length} repositories</span>
                  </div>
                  {data.events.length ? (
                    <AnimatedList className="projects-event-list projects-event-list--connected" items={data.events.slice(0, 20).map(event => ({ id: event.id, title: event.title, description: event.kind === "commit" ? "Commit" : event.kind === "merge" ? "Merged PR" : "Pull request", meta: timeLabel(event.occurred_at) }))} onItemSelect={(_, index) => window.open(data.events[index].html_url, "_blank", "noopener,noreferrer")} theme="light" width="100%" maxHeight={185} radius={9} gap={3} frame={false} fadeSize={28} />
                  ) : (
                    <p className="projects-empty-inline">
                      {data.connections.length
                        ? data.repositories.length
                          ? "No activity in the last 90 days. Earlier activity remains in the calendar."
                          : "Connect a repository to a project to import its activity."
                        : "Connect GitHub to sync commits and pull requests from selected repositories."}
                    </p>
                  )}
                </section>
              )}
            </div>
            {showGitHub && (
              <section className="projects-panel projects-panel--activity">
                <div className="projects-panel__head">
                  <h2>Development activity</h2>
                  <span>Past year · connected repositories</span>
                </div>
                <ActivityHeatmap days={data.dailyActivity} />
                <div className="projects-activity-stats">
                  <span>
                    {data.dailyActivity.reduce((sum, day) => sum + Number(day.commit_count), 0)}{" "}
                    commits
                  </span>
                  <span>
                    {data.dailyActivity.reduce(
                      (sum, day) => sum + Number(day.pull_request_count),
                      0,
                    )}{" "}
                    pull requests
                  </span>
                  <span>
                    {data.dailyActivity.reduce((sum, day) => sum + Number(day.merge_count), 0)}{" "}
                    merges
                  </span>
                </div>
              </section>
            )}
          </>
        )}
        {selected && user && (
          <ProjectModal
            key={selected.id}
            project={selected}
            originElement={projectOrigin.element}
            originRect={projectOrigin.rect}
            closing={projectModalClosing}
            onRequestClose={closeProject}
            onClosed={finishCloseProject}
          >
            <Workspace
              project={selected}
              data={data}
              userId={user.id}
              onClose={closeProject}
              onEdit={() => setFormProject(selected)}
              onReload={() => load()}
              onError={setError}
              onDelete={() => setDeleting(selected)}
              onDirtyChange={onProjectDirtyChange}
              githubAction={githubAction}
            />
          </ProjectModal>
        )}
        {formProject && user && (
          <ProjectForm
            project={formProject === "new" ? null : formProject}
            clients={data.clients}
            kind={kind}
            userId={user.id}
            onClose={() => setFormProject(null)}
            onSaved={() => load()}
          />
        )}
        {deleting && (
          <Dialog title="Delete project" onClose={() => setDeleting(null)}>
            <div className="projects-confirm">
              <p>
                Delete “{deleting.name}” and its tasks, notes, links, work reviews, and repository
                mappings? Projects with financial or time records cannot be deleted, to preserve
                their links.
              </p>
              <footer>
                <button
                  className="projects-button projects-button--secondary"
                  onClick={() => setDeleting(null)}
                >
                  Cancel
                </button>
                <button className="projects-button projects-button--danger" onClick={deleteProject}>
                  Delete project
                </button>
              </footer>
            </div>
          </Dialog>
        )}
        {repoPicker && (
          <Dialog title="Connect a repository" onClose={() => setRepoPicker(false)}>
            <div className="projects-repo-picker">
              <p>
                Choose which GitHub repository belongs to which F-Dash project.
              </p>
              {availableRepos.length ? (
                <>
                  <div className="projects-repo-picker__fields">
                    <label>
                      GitHub repository
                      <select
                        value={selectedRepoId}
                        onChange={(event) => setSelectedRepoId(event.target.value)}
                      >
                        {availableRepos.length > 1 && <option value="">Select repository</option>}
                        {availableRepos.map((repo) => (
                          <option key={repo.id} value={repo.id}>{repo.full_name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      F-Dash project
                      <select
                        value={selectedRepoProjectId}
                        onChange={(event) => setSelectedRepoProjectId(event.target.value)}
                      >
                        <option value="">Select project</option>
                        {data.projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {selectedRepoMapping && (
                    <p className="projects-repo-picker__hint">
                      {selectedRepoMapping.project_id
                        ? `Currently linked to ${data.projects.find((project) => project.id === selectedRepoMapping.project_id)?.name ?? "a project"}.`
                        : "Previously linked project was removed. Choose a new project to relink this repository."}
                    </p>
                  )}
                  {availableRepos.length === 1 && (
                    <p className="projects-repo-picker__hint">
                      This is the only repository your GitHub App can access. To add another, update its <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer">repository access on GitHub</a>.
                    </p>
                  )}
                </>
              ) : (
                <p>No repositories are available to this GitHub App. Check its repository access on GitHub.</p>
              )}
              <div className="projects-sync-range">
                <label>Import history
                  <select value={initialPreset} onChange={(event) => {
                    const range = event.target.value;
                    setInitialPreset(range);
                    if (range !== "custom") { setInitialFrom(historyStart(range)); setInitialTo(today()); }
                  }}>
                    <option value="30">Last 30 days</option><option value="90">Last 90 days</option>
                    <option value="6m">Last 6 months</option><option value="12m">Last 12 months</option>
                    <option value="custom">Custom range</option>
                  </select>
                </label>
                <label>From<input type="date" value={initialFrom} max={initialTo} onChange={(event) => { setInitialPreset("custom"); setInitialFrom(event.target.value); }} /></label>
                <label>Through<input type="date" value={initialTo} min={initialFrom} max={today()} onChange={(event) => { setInitialPreset("custom"); setInitialTo(event.target.value); }} /></label>
              </div>
              <div className="projects-repo-picker__actions">
                <button
                  className="projects-button projects-button--primary"
                  disabled={connecting || !selectedRepo || !selectedRepoProjectId}
                  onClick={async () => {
                    if (!selectedRepo || !selectedRepoProjectId) return;
                    const connected = await githubAction("connect", {
                      github_repository_id: selectedRepo.id,
                      installation_id: selectedRepo.installation_id,
                      project_id: selectedRepoProjectId,
                      from: initialFrom,
                      to: initialTo,
                    });
                    if (connected) setRepoPicker(false);
                  }}
                >
                  {connecting ? "Connecting…" : selectedRepoMapping ? "Update connection" : "Connect repository"}
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
      {createPortal(
        <div className="app-toast-viewport" aria-label="Notifications">
          <AnimatePresence initial={false}>
            {error && (
              <SwipeToast
                key={`error-${errorSequence}`}
                kind="error"
                message={error}
                onClose={() => setError("")}
                onRetry={() => githubRetryRef.current
                  ? void githubAction(githubRetryRef.current.action, githubRetryRef.current.extra)
                  : void load()}
                retryDisabled={connecting}
              />
            )}
            {notice && (
              <SwipeToast
                key={`notice-${noticeSequence}`}
                kind="success"
                message={notice}
                onClose={() => setNotice("")}
              />
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </div>
  );
}
