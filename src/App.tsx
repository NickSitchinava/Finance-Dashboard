import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import { ProfileProvider } from "./components/auth/ProfileContext";
import AuthGuard from "./components/auth/AuthGuard";
import AppLayout from "./components/layout/AppLayout";
import { DashboardRouteSkeleton } from "./components/layout/DashboardSkeleton";
import OverviewPage from "./pages/OverviewPage";
import ProjectsPage from "./pages/ProjectsPage";
import GoalsPage from "./pages/GoalsPage";
import InvoicesPage from "./pages/InvoicesPage";
import ClientsPage from "./pages/ClientsWorkspace";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const FinancesPage = lazy(() => import("./pages/FinancesPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<AppLayout />}>
              <Route element={<AuthGuard />}>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/finances" element={<Suspense fallback={<DashboardRouteSkeleton route="/finances" />}><FinancesPage /></Suspense>} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/analytics" element={<Suspense fallback={<DashboardRouteSkeleton route="/analytics" />}><AnalyticsPage /></Suspense>} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  );
}
