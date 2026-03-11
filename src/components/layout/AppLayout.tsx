import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./AppLayout.css";

interface AppLayoutProps {
  toggleChat?: () => void;
}

export default function AppLayout({ toggleChat }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      
      <Sidebar
        isOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
        onToggleChat={toggleChat}
      />
      {isSidebarOpen && (
        <div
          className="app-layout__overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="app-layout__main">
        <TopBar
          toggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onToggleChat={toggleChat}
        />
        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}