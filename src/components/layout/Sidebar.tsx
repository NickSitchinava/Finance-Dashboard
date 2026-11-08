import { useState, type CSSProperties, type ReactNode, type PointerEvent, type FocusEvent } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProfile } from "../auth/ProfileContext";
import "./Sidebar.css";

const navItems = [
  { path: "/",          label: "Overview",  icon: "grid"      },
  { path: "/finances",  label: "Finances",  icon: "dollar"    },
  { path: "/projects",  label: "Projects",  icon: "code"      },
  { path: "/clients",   label: "Clients",   icon: "users"     },
  { path: "/invoices",  label: "Invoices",  icon: "file-text" },
  { path: "/analytics", label: "Analytics", icon: "bar-chart" },
  { path: "/goals",     label: "Goals",     icon: "target"    },
];

const icons: Record<string, ReactNode> = {
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  dollar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  code: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "bar-chart": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  target: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  "file-text": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  isCollapsed: boolean;
  closeSidebar: () => void;
  onDesktopHoverChange: (hovered: boolean) => void;
  onDesktopFocusChange: (focused: boolean) => void;
}

type Highlight = { y: number; height: number; visible: boolean };
const emptyHighlight: Highlight = { y: 0, height: 0, visible: false };

export default function Sidebar({ isOpen, isMobile, isCollapsed, closeSidebar, onDesktopHoverChange, onDesktopFocusChange }: SidebarProps) {
  const { session, signOut } = useAuth();
  const { avatarUrl, fullName, loading: profileLoading } = useProfile();
  const [loadedAvatarUrl, setLoadedAvatarUrl] = useState("");
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const visibleAvatarUrl = profileLoading ? "" : avatarUrl;
  const avatarLoading = profileLoading || Boolean(visibleAvatarUrl && loadedAvatarUrl !== visibleAvatarUrl && failedAvatarUrl !== visibleAvatarUrl);
  const [mainHighlight, setMainHighlight] = useState<Highlight>(emptyHighlight);
  const [utilityHighlight, setUtilityHighlight] = useState<Highlight>(emptyHighlight);
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null);
  const showTooltip = (label: string, element: HTMLElement) => {
    if (!isMobile && isCollapsed) {
      const rect = element.getBoundingClientRect();
      setTooltip({ label, y: rect.top + rect.height / 2 });
    }
  };
  const moveHighlight = (event: PointerEvent<HTMLElement>, group: "main" | "utility") => {
    if (event.pointerType === "touch") return;
    const item = event.currentTarget;
    const parent = item.closest("[data-nav-group]");
    if (!parent) return;
    const itemRect = item.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const next = { y: itemRect.top - parentRect.top, height: itemRect.height, visible: true };
    if (group === "main") setMainHighlight(next);
    else setUtilityHighlight(next);
  };
  const tooltipProps = (label: string) => ({
    onFocus: (event: FocusEvent<HTMLElement>) => showTooltip(label, event.currentTarget),
    onBlur: () => setTooltip(null),
    onMouseEnter: (event: { currentTarget: HTMLElement }) => showTooltip(label, event.currentTarget),
    onMouseLeave: () => setTooltip(null),
  });
  const initials = fullName
    ? fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "FD";
  const highlightStyle = (highlight: Highlight): CSSProperties => ({
    height: highlight.height,
    transform: `translateY(${highlight.y}px)`,
    opacity: highlight.visible ? 1 : 0,
  });

  return (
    <aside id="app-sidebar" className={`sidebar${isOpen ? " sidebar--open" : ""}${isCollapsed && !isMobile ? " sidebar--collapsed" : ""}`} aria-label="Application navigation" aria-modal={isOpen ? true : undefined} role={isOpen ? "dialog" : undefined} inert={isMobile && !isOpen}
      onPointerEnter={(event) => { if (!isMobile && event.pointerType !== "touch") { setTooltip(null); onDesktopHoverChange(true); } }}
      onPointerLeave={(event) => { if (!isMobile && event.pointerType !== "touch") { onDesktopHoverChange(false); onDesktopFocusChange(false); } }}
      onFocusCapture={() => { if (!isMobile) onDesktopFocusChange(true); }}
      onBlurCapture={(event) => { if (!isMobile && !event.currentTarget.contains(event.relatedTarget)) onDesktopFocusChange(false); }}>
      <div className="sidebar__top">
        <NavLink to="/settings?tab=general" className="sidebar__profile" aria-label={fullName ? `${fullName} — Profile settings` : "Profile settings"} onClick={closeSidebar} {...tooltipProps(fullName || "Profile settings")}>
          <div className={`sidebar__avatar${avatarLoading ? " sidebar__avatar--loading" : ""}${visibleAvatarUrl && loadedAvatarUrl === visibleAvatarUrl ? " sidebar__avatar--image" : ""}`}>
            {!avatarLoading && (!visibleAvatarUrl || failedAvatarUrl === visibleAvatarUrl) ? initials : null}
            {visibleAvatarUrl && failedAvatarUrl !== visibleAvatarUrl && <img src={visibleAvatarUrl} alt="" style={loadedAvatarUrl === visibleAvatarUrl ? undefined : { visibility: "hidden" }} onLoad={() => setLoadedAvatarUrl(visibleAvatarUrl)} onError={() => setFailedAvatarUrl(visibleAvatarUrl)} />}
          </div>
          <div className="sidebar__profile-info">
            <span className="sidebar__name">{fullName || "Finance Dashboard"}</span>
            <span className="sidebar__status"><span className="sidebar__online-dot" />Online</span>
          </div>
        </NavLink>
        {isMobile && <button type="button" className="sidebar__toggle" onClick={closeSidebar} aria-label="Close navigation" aria-expanded={isOpen} title="Close navigation">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>}
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        <span className="sidebar__section-label">Menu</span>
        <ul className="sidebar__list" data-nav-group onPointerLeave={() => setMainHighlight((previous) => ({ ...previous, visible: false }))}>
          <span className="sidebar__hover" style={highlightStyle(mainHighlight)} aria-hidden="true" />
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink to={item.path} className={({ isActive }) => `sidebar__link${isActive ? " sidebar__link--active" : ""}`} end={item.path === "/"} aria-label={item.label} onClick={closeSidebar} onPointerEnter={(event) => moveHighlight(event, "main")} {...tooltipProps(item.label)}>
                <span className="sidebar__icon">{icons[item.icon]}</span><span className="sidebar__link-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__bottom" data-nav-group onPointerLeave={() => setUtilityHighlight((previous) => ({ ...previous, visible: false }))}>
        <span className="sidebar__hover" style={highlightStyle(utilityHighlight)} aria-hidden="true" />
        <NavLink to="/settings" className={({ isActive }) => `sidebar__link${isActive ? " sidebar__link--active" : ""}`} aria-label="Settings" onClick={closeSidebar} onPointerEnter={(event) => moveHighlight(event, "utility")} {...tooltipProps("Settings")}>
          <span className="sidebar__icon">{icons.settings}</span><span className="sidebar__link-label">Settings</span>
        </NavLink>
        {session && <button className="sidebar__link sidebar__link--btn" aria-label="Logout" onClick={() => { closeSidebar(); void signOut(); }} onPointerEnter={(event) => moveHighlight(event, "utility")} {...tooltipProps("Logout")}>
          <span className="sidebar__icon">{icons.logout}</span><span className="sidebar__link-label">Logout</span>
        </button>}
      </div>
      {tooltip && isCollapsed && <span className="sidebar__tooltip" style={{ top: tooltip.y }} role="tooltip">{tooltip.label}</span>}
    </aside>
  );
}
