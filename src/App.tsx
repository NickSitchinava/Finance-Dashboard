import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import { ProfileProvider } from "./components/auth/ProfileContext";
import AuthGuard from "./components/auth/AuthGuard";
import AppLayout from "./components/layout/AppLayout";
import ChatbotButton from "./components/ui/ChatbotButton";
import OverviewPage from "./pages/OverviewPage";
import FinancesPage from "./pages/FinancesPage";
import ProjectsPage from "./pages/ProjectsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GoalsPage from "./pages/GoalsPage";
import InvoicesPage from "./pages/InvoicesPage";
import ClientsPage from "./pages/ClientsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const toggleChat = () => setIsChatOpen((prev) => !prev);

  return (
    <AuthProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<AuthGuard />}>
              <Route element={<AppLayout toggleChat={toggleChat} />}>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/finances" element={<FinancesPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ChatbotButton
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  );
}