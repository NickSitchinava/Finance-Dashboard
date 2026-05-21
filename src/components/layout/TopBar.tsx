import { useState, useEffect, useRef } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import "./TopBar.css";

interface TopBarProps {
  toggleSidebar?: () => void;
  onToggleChat?: () => void;
}

interface Notification {
  id: string;
  type: "overdue_project" | "overdue_invoice" | "transaction" | "deadline";
  title: string;
  desc: string;
  time: string;
  read: boolean;
}

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/finances": "Finances",
  "/projects": "Projects",
  "/invoices": "Invoices",
  "/analytics": "Analytics",
  "/goals": "Goals",
  "/settings": "Settings",
};

const navItems = [
  { path: "/",          label: "Overview",  icon: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3h2v2h-2zm0-3h7v1h-7zm0 5h7v1h-7z" },
  { path: "/finances",  label: "Finances",  icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { path: "/projects",  label: "Projects",  icon: "M16 18l6-6-6-6M8 6L2 12l6 6" },
  { path: "/invoices",  label: "Invoices",  icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8m8 4H8" },
  { path: "/analytics", label: "Analytics", icon: "M18 20V10M12 20V4M6 20v-6" },
  { path: "/goals",     label: "Goals",     icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  { path: "/settings",  label: "Settings",  icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
];

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
};

const notifColors: Record<string, string> = {
  overdue_project: "#e05252",
  overdue_invoice: "#e87b3a",
  transaction:     "#34c759",
  deadline:        "#3296FA",
};

const DISMISSED_KEY = "dismissed_notifications";

export default function TopBar({ onToggleChat }: TopBarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Dashboard";
  const today = formatDate(new Date());

  const [menuOpen, setMenuOpen] = useState(false);
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
    const dismissed = getDismissed();
    dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function dismissAll() {
    const ids = notifications.map((n) => n.id);
    const dismissed = [...getDismissed(), ...ids];
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    setNotifications([]);
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

    // 2. Overdue invoices
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id, client_name, amount, due_date")
      .neq("status", "Paid")
      .lt("due_date", today);

    overdueInvoices?.forEach((inv) => {
      const id = `overdue_invoice_${inv.id}`;
      if (!dismissed.includes(id)) {
        notifs.push({
          id,
          type: "overdue_invoice",
          title: "Unpaid Invoice Overdue",
          desc: `Invoice for ${inv.client_name} ($${inv.amount}) is overdue.`,
          time: inv.due_date,
          read: false,
        });
      }
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

    // Sort by most recent
    notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setNotifications(notifs);
  }

  useEffect(() => {
    fetchNotifications();
  }, [user]);

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
      <header className="topbar">
        <div className="topbar__left">
          <button
            className={`topbar__burger${menuOpen ? " topbar__burger--active" : ""}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
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
          <button
            className="topbar__icon-btn"
            onClick={onToggleChat}
            aria-label="AI Assistant"
            title="AI Assistant"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

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
                      <div key={n.id} className="notif-item">
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
                        </div>
                        <button
                          className="notif-item__dismiss"
                          onClick={() => dismiss(n.id)}
                          title="Dismiss"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile dropdown */}
      <div className={`topbar__mobile-menu${menuOpen ? " topbar__mobile-menu--open" : ""}`}>
        <div className="topbar__mobile-menu-inner">
          {navItems.map((item, i) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `topbar__mobile-link${isActive ? " topbar__mobile-link--active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="topbar__mobile-link-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
              </span>
              <span className="topbar__mobile-link-label">{item.label}</span>
              <span className="topbar__mobile-link-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </NavLink>
          ))}
        </div>
      </div>

      {menuOpen && (
        <div className="topbar__backdrop" onClick={() => setMenuOpen(false)} />
      )}
    </>
  );
}