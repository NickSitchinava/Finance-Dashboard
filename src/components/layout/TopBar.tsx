import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { todayLocal } from "../../lib/goals";
import "./TopBar.css";

interface TopBarProps {
  toggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

interface Notification {
  id: string;
  type: "overdue_project" | "overdue_invoice" | "transaction" | "deadline" | "client_follow_up" | "goal_occurrence" | "goal_overdue";
  title: string;
  desc: string;
  time: string;
  read: boolean;
  invoiceId?: string;
  eventId?: string;
  occurrenceId?: string;
}

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/finances": "Finances",
  "/projects": "Projects",
  "/clients": "Clients",
  "/invoices": "Invoices",
  "/analytics": "Analytics",
  "/goals": "Goals",
  "/settings": "Settings",
};


function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

const notifIcons: Record<string, string> = {
  overdue_project: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01",
  overdue_invoice: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-4m0 0v-2m0 2h2m-2 0H10",
  transaction:     "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  deadline:        "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  client_follow_up: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  goal_occurrence: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
  goal_overdue: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 7v5m0 4h.01",
};

const notifColors: Record<string, string> = {
  overdue_project: "#e05252",
  overdue_invoice: "#e87b3a",
  transaction:     "#34c759",
  deadline:        "#3296FA",
  client_follow_up: "#4935A5",
  goal_occurrence: "#4935A5",
  goal_overdue: "#aa5e59",
};

const DISMISSED_KEY = "dismissed_notifications";

export default function TopBar({ toggleSidebar, isSidebarOpen }: TopBarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] || "Dashboard";
  const today = formatDate(new Date());
  const lightHeader = ["/", "/finances", "/projects", "/clients", "/invoices", "/analytics", "/goals", "/settings"].includes(location.pathname);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  function getDismissed(): string[] {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function dismiss(id: string) {
    const event = notifications.find(item => item.id === id);
    if (event?.occurrenceId) return;
    if (event?.eventId) void supabase.from("invoice_notification_events").update({ read_at: new Date().toISOString() }).eq("id", event.eventId);
    const dismissed = getDismissed();
    dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function dismissAll() {
    for (const event of notifications) if (event.eventId) void supabase.from("invoice_notification_events").update({ read_at: new Date().toISOString() }).eq("id", event.eventId);
    const ids = notifications.filter(n => !n.occurrenceId).map((n) => n.id);
    const dismissed = [...getDismissed(), ...ids];
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    setNotifications(items => items.filter(n => n.occurrenceId));
  }

  async function fetchNotifications() {
    if (!user) return;
    const dismissed = getDismissed();
    const today = new Date().toISOString().split("T")[0];
    const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const notifs: Notification[] = [];

    // 1. Overdue projects
    const { data: overdueProjects } = await supabase
      .from("projects")
      .select("id, name, deadline")
      .eq("status", "Overdue");

    overdueProjects?.forEach((p) => {
      const id = `overdue_project_${p.id}`;
      if (!dismissed.includes(id)) {
        notifs.push({
          id,
          type: "overdue_project",
          title: "Overdue Project",
          desc: `"${p.name}" is past its deadline.`,
          time: p.deadline,
          read: false,
        });
      }
    });

    // Invoice reminders are persisted by the scheduled database processor.
    const { data: invoiceEvents } = await supabase
      .from("invoice_notification_events")
      .select("id,invoice_id,title,body,created_at,read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    invoiceEvents?.forEach((event) => {
      if (!event.read_at && !dismissed.includes(event.id)) notifs.push({
        id: event.id,
        eventId: event.id,
        invoiceId: event.invoice_id,
        type: "overdue_invoice",
        title: event.title,
        desc: event.body,
        time: event.created_at,
        read: false,
      });
    });

    // 3. Recent transactions (last 5)
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, type, amount, category, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    transactions?.forEach((t) => {
      const id = `transaction_${t.id}`;
      if (!dismissed.includes(id)) {
        notifs.push({
          id,
          type: "transaction",
          title: `New ${t.type === "income" ? "Income" : "Expense"}`,
          desc: `${t.category} — $${t.amount}`,
          time: t.created_at,
          read: false,
        });
      }
    });

    // 4. Upcoming deadlines (within 7 days)
    const { data: upcomingProjects } = await supabase
      .from("projects")
      .select("id, name, deadline")
      .neq("status", "Completed")
      .neq("status", "Overdue")
      .gte("deadline", today)
      .lte("deadline", sevenDays);

    upcomingProjects?.forEach((p) => {
      const id = `deadline_${p.id}`;
      if (!dismissed.includes(id)) {
        const days = daysUntil(p.deadline);
        notifs.push({
          id,
          type: "deadline",
          title: "Upcoming Deadline",
          desc: `"${p.name}" is due in ${days} day${days !== 1 ? "s" : ""}.`,
          time: p.deadline,
          read: false,
        });
      }
    });

    // Follow-ups use the same notification surface as project deadlines.
    const { data: followUps } = await supabase
      .from("clients")
      .select("id,name,follow_up_at,follow_up_note")
      .eq("user_id", user.id)
      .eq("follow_up_completed", false)
      .not("follow_up_at", "is", null)
      .lte("follow_up_at", new Date(Date.now() + 7 * 86400000).toISOString());
    followUps?.forEach((client) => {
      const id = `client_follow_up_${client.id}_${client.follow_up_at}`;
      if (!dismissed.includes(id)) notifs.push({
        id,
        type: "client_follow_up",
        title: new Date(client.follow_up_at).getTime() <= Date.now() ? "Client follow-up due" : "Upcoming client follow-up",
        desc: `${client.name}${client.follow_up_note ? ` — ${client.follow_up_note}` : ""}`,
        time: client.follow_up_at,
        read: false,
      });
    });

    const [{ data: dueOccurrences }, { data: overdueGoals }] = await Promise.all([
      supabase.from("goal_occurrences").select("id,due_at,scheduled_date,goals!inner(title)").eq("user_id", user.id).eq("status", "pending").lte("due_at", new Date().toISOString()).order("due_at", { ascending: false }).limit(30),
      supabase.from("goals").select("id,title,target_date").eq("user_id", user.id).neq("status", "completed").is("recurrence", null).lt("target_date", todayLocal()).limit(30),
    ]);
    dueOccurrences?.forEach(row => {
      const related = row.goals as unknown as { title: string };
      notifs.push({ id: `goal_occurrence_${row.id}`, occurrenceId: row.id, type: "goal_occurrence", title: related?.title || "Recurring goal", desc: `Did you complete this goal for ${row.scheduled_date}?`, time: row.due_at, read: false });
    });
    overdueGoals?.forEach(goal => {
      const id = `goal_overdue_${goal.id}_${goal.target_date}`;
      if (!dismissed.includes(id)) notifs.push({ id, type: "goal_overdue", title: "Goal overdue", desc: goal.title, time: goal.target_date, read: false });
    });

    // Sort by most recent
    notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setNotifications(notifs);
  }

  const fetchNotificationsRef = useRef(fetchNotifications);
  useEffect(() => { fetchNotificationsRef.current = fetchNotifications; });

  useEffect(() => {
    const refresh = () => { void fetchNotificationsRef.current(); };
    queueMicrotask(refresh);
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("client-follow-up-updated", refresh);
    window.addEventListener("invoice-updated", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("client-follow-up-updated", refresh); window.removeEventListener("invoice-updated", refresh); };
  }, [user]);

  async function openNotification(notification: Notification) {
    if (notification.occurrenceId) return;
    if (!notification.invoiceId) return;
    if (notification.eventId) {
      await supabase.from("invoice_notification_events").update({ read_at: new Date().toISOString() }).eq("id", notification.eventId);
      setNotifications(prev => prev.filter(item => item.id !== notification.id));
    }
    setNotifOpen(false);
    navigate(`/invoices?invoice=${encodeURIComponent(notification.invoiceId)}`);
  }

  async function answerGoal(occurrenceId: string, status: "completed" | "missed") {
    if (!user) return;
    const { data, error } = await supabase.from("goal_occurrences").update({ status, resolved_at: new Date().toISOString() }).eq("id", occurrenceId).eq("user_id", user.id).eq("status", "pending").select("id").maybeSingle();
    if (error || !data) { void fetchNotificationsRef.current(); return; }
    setNotifications(items => items.filter(item => item.occurrenceId !== occurrenceId));
    window.dispatchEvent(new Event("goal-updated"));
  }

  // Close notif dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.length;

  return (
    <>
      <header className={lightHeader ? `topbar topbar--overview${location.pathname === "/finances" ? " topbar--finances" : ""}${location.pathname === "/projects" ? " topbar--projects" : ""}${location.pathname === "/goals" ? " topbar--goals" : ""}` : "topbar"}>
        <div className="topbar__left">
          <button
            className={`topbar__burger${isSidebarOpen ? " topbar__burger--active" : ""}`}
            onClick={toggleSidebar}
            aria-label={isSidebarOpen ? "Close navigation" : "Open navigation"}
            aria-controls="app-sidebar"
            aria-expanded={Boolean(isSidebarOpen)}
          >
            <span className="topbar__burger-bar" />
            <span className="topbar__burger-bar" />
            <span className="topbar__burger-bar" />
          </button>
          <div className="topbar__titles">
            <h1 className="topbar__title">{title}</h1>
            <span className="topbar__date">{today}</span>
          </div>
        </div>

        <div className="topbar__right">
          {location.pathname === "/" && <div id="overview-header-actions" className="topbar__overview-actions" />}
          {location.pathname === "/finances" && <div id="finances-header-actions" className="topbar__finance-actions" />}
          {location.pathname === "/projects" && <div id="projects-header-actions" className="topbar__projects-actions" />}
          {location.pathname === "/clients" && <div id="clients-header-actions" className="topbar__clients-actions" />}
          {location.pathname === "/invoices" && <div id="invoices-header-actions" className="topbar__invoice-actions" />}
          {location.pathname === "/goals" && <div id="goals-header-actions" className="topbar__goals-actions" />}
          {/* Notifications */}
          <div className="notif-wrapper" ref={notifRef}>
            <button
              className="topbar__icon-btn topbar__icon-btn--notif"
              aria-label="Notifications"
              onClick={() => setNotifOpen((prev) => !prev)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="topbar__notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-dropdown__header">
                  <span className="notif-dropdown__title">Notifications</span>
                  {unreadCount > 0 && (
                    <button className="notif-dropdown__clear" onClick={dismissAll}>
                      Clear all
                    </button>
                  )}
                </div>

                <div className="notif-dropdown__list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <span>You're all caught up!</span>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="notif-item" onClick={() => void openNotification(n)} onKeyDown={e => { if (e.key === "Enter") void openNotification(n); }} tabIndex={n.invoiceId ? 0 : undefined} role={n.invoiceId ? "button" : undefined}>
                        <div
                          className="notif-item__icon"
                          style={{ background: `${notifColors[n.type]}18`, color: notifColors[n.type] }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={notifIcons[n.type]} />
                          </svg>
                        </div>
                        <div className="notif-item__body">
                          <span className="notif-item__title">{n.title}</span>
                          <span className="notif-item__desc">{n.desc}</span>
                          <span className="notif-item__time">{timeAgo(n.time)}</span>
                          {n.occurrenceId && <div className="notif-item__goal-actions"><button onClick={event => { event.stopPropagation(); void answerGoal(n.occurrenceId!, "completed"); }}>Yes</button><button onClick={event => { event.stopPropagation(); void answerGoal(n.occurrenceId!, "missed"); }}>No</button></div>}
                        </div>
                        {!n.occurrenceId && <button
                          className="notif-item__dismiss"
                          onClick={(event) => { event.stopPropagation(); dismiss(n.id); }}
                          onKeyDown={(event) => event.stopPropagation()}
                          title="Dismiss"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

    </>
  );
}
