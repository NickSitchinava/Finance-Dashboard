import { useLocation } from "react-router-dom";
import "./TopBar.css";

interface TopBarProps {
  toggleSidebar?: () => void;
  onToggleChat?: () => void;
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function TopBar({ toggleSidebar, onToggleChat }: TopBarProps) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Dashboard";
  const today = formatDate(new Date());

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          className="topbar__burger"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
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
        <button
          className="topbar__icon-btn topbar__icon-btn--notif"
          aria-label="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="topbar__notif-dot" />
        </button>
      </div>
    </header>
  );
}