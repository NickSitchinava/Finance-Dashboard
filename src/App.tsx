import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import AuthGuard from "./components/auth/AuthGuard";
import AppLayout from "./components/layout/AppLayout";
import ChatbotButton from "./components/ui/ChatbotButton";
import OverviewPage from "./pages/OverviewPage";
import FinancesPage from "./pages/FinancesPage";
import ProjectsPage from "./pages/ProjectsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GoalsPage from "./pages/GoalsPage";
import InvoicesPage from "./pages/InvoicesPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => setIsChatOpen(!isChatOpen);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<AuthGuard />}>
            <Route element={<AppLayout toggleChat={toggleChat} />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/finances" element={<FinancesPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChatbotButton
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
