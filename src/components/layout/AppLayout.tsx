import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import DashboardContentTransition from "../ui/DashboardContentTransition";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./AppLayout.css";

const MOBILE_QUERY = "(max-width: 768px)";

// Keeping the route outlet behind a memo boundary avoids rendering dashboard
// widgets just because the navigation overlay changed state.
const RouteContent = memo(function RouteContent() {
  const location = useLocation();
  const outlet = useOutlet();
  return <DashboardContentTransition transitionKey={location.pathname}>{outlet}</DashboardContentTransition>;
});

export default function AppLayout() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopHovered, setIsDesktopHovered] = useState(false);
  const [isDesktopFocused, setIsDesktopFocused] = useState(false);
  const wasMobileOpen = useRef(false);
  const isCollapsed = !isMobile && !isDesktopHovered && !isDesktopFocused;
  const isOverlayOpen = isMobile && isSidebarOpen;

  const closeSidebar = useCallback(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY);
    const sync = () => { setIsMobile(mobile.matches); if (!mobile.matches) setIsSidebarOpen(false); };
    mobile.addEventListener("change", sync);
    return () => mobile.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsSidebarOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    const resetSidebar = () => {
      if (document.hidden || !document.hasFocus()) {
        setIsDesktopHovered(false);
        setIsDesktopFocused(false);
        setIsSidebarOpen(false);
        const sidebar = document.getElementById("app-sidebar");
        if (sidebar?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      }
    };
    window.addEventListener("blur", resetSidebar);
    document.addEventListener("visibilitychange", resetSidebar);
    return () => {
      window.removeEventListener("blur", resetSidebar);
      document.removeEventListener("visibilitychange", resetSidebar);
    };
  }, []);

  useEffect(() => {
    if (isOverlayOpen) {
      wasMobileOpen.current = true;
      const previousOverflow = document.body.style.overflow;
      const previousPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.body.style.overflow = "hidden";
      const focusFrame = requestAnimationFrame(() => {
        const sidebar = document.getElementById("app-sidebar");
        if (sidebar && (!sidebar.contains(document.activeElement) || document.activeElement?.hasAttribute("inert"))) {
          sidebar.querySelector<HTMLElement>(".sidebar__toggle")?.focus();
        }
      });
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          closeSidebar();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...(document.querySelector<HTMLElement>("#app-sidebar")?.querySelectorAll<HTMLElement>('a[href]:not([inert]):not([tabindex="-1"]), button:not([disabled]):not([inert]):not([tabindex="-1"])') ?? [])];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => {
        cancelAnimationFrame(focusFrame);
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPaddingRight;
        document.removeEventListener("keydown", onKeyDown);
      };
    }
    if (wasMobileOpen.current) {
      wasMobileOpen.current = false;
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".topbar__burger")?.focus());
    }
  }, [closeSidebar, isMobile, isOverlayOpen]);

  return (
    <div className={`app-layout${isCollapsed ? " app-layout--collapsed" : ""}${isOverlayOpen ? " app-layout--overlay-open" : ""}`}>
      <Sidebar isOpen={isOverlayOpen} isMobile={isMobile} isCollapsed={isCollapsed} closeSidebar={closeSidebar} onDesktopHoverChange={setIsDesktopHovered} onDesktopFocusChange={setIsDesktopFocused} />
      <div className="app-layout__overlay" aria-hidden="true" onClick={closeSidebar} />
      <div className="app-layout__main" inert={isOverlayOpen}>
        <TopBar toggleSidebar={() => setIsSidebarOpen((value) => !value)} isSidebarOpen={isSidebarOpen} />
        <main className="app-layout__content"><RouteContent /></main>
      </div>
    </div>
  );
}
