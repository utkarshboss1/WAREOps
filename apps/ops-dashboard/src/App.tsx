import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layout & Auth Pages
import { Layout } from './components/layout/Layout';
import OnboardingPage from './pages/OnboardingPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import MFAPage from './pages/auth/MFAPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import AcceptInvitePage from './pages/auth/AcceptInvitePage';

// Operator Pages
import OperatorDashboard from './pages/operator/OperatorDashboard';
import ProductFinder from './pages/operator/ProductFinder';
import VerificationQueue from './pages/operator/VerificationQueue';
import ReportIssuePage from './pages/operator/ReportIssuePage';

// Supervisor Pages
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import AlertCenter from './pages/supervisor/AlertCenter';
import MissionControl from './pages/supervisor/MissionControl';
import TeamMonitor from './pages/supervisor/TeamMonitor';
import InventoryManagement from './pages/supervisor/InventoryManagement';
import SupervisorReports from './pages/supervisor/SupervisorReports';

// Manager Pages
import ExecutiveDashboard from './pages/manager/ExecutiveDashboard';
import AnalyticsPage from './pages/manager/AnalyticsPage';
import HeatmapPage from './pages/manager/HeatmapPage';
import ReportsPage from './pages/manager/ReportsPage';
import WarehouseSettings from './pages/manager/WarehouseSettings';

// Admin Pages
import AdminOverview from './pages/admin/AdminOverview';
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs';
import OrgSettings from './pages/admin/OrgSettings';

// Shared Pages
import DigitalTwin from './pages/DigitalTwin';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';

// Simple Route Guards
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to default page for their role
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RoleDefaultRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/onboarding" replace />;
  }

  switch (user.role) {
    case 'ENTERPRISE_ADMIN':
      return <Navigate to="/admin/overview" replace />;
    case 'WAREHOUSE_MANAGER':
      return <Navigate to="/manager/dashboard" replace />;
    case 'WAREHOUSE_SUPERVISOR':
      return <Navigate to="/supervisor/dashboard" replace />;
    case 'WAREHOUSE_OPERATOR':
      return <Navigate to="/operator/dashboard" replace />;
    default:
      return <Navigate to="/onboarding" replace />;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Standalone Landing & Onboarding Routes */}
        <Route path="/" element={<RoleDefaultRedirect />} />
        <Route path="/landing" element={<OnboardingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard-preview" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/mfa" element={<MFAPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/accept-invite" element={<AcceptInvitePage />} />

        {/* Protected Dashboard Layout Routes */}
        <Route element={<Layout />}>
          {/* Operator Routes */}
          <Route
            path="operator/dashboard"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_OPERATOR']}>
                <OperatorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="operator/products"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_OPERATOR']}>
                <ProductFinder />
              </ProtectedRoute>
            }
          />
          <Route
            path="operator/verifications"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_OPERATOR']}>
                <VerificationQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="operator/report-issue"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_OPERATOR']}>
                <ReportIssuePage />
              </ProtectedRoute>
            }
          />

          {/* Supervisor Routes */}
          <Route
            path="supervisor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_SUPERVISOR']}>
                <SupervisorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="supervisor/alerts"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_SUPERVISOR']}>
                <AlertCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="supervisor/inventory"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_SUPERVISOR']}>
                <InventoryManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="supervisor/missions"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_SUPERVISOR']}>
                <MissionControl />
              </ProtectedRoute>
            }
          />
          <Route
            path="supervisor/team"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_SUPERVISOR']}>
                <TeamMonitor />
              </ProtectedRoute>
            }
          />
          <Route
            path="supervisor/reports"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_SUPERVISOR']}>
                <SupervisorReports />
              </ProtectedRoute>
            }
          />

          {/* Manager Routes */}
          <Route
            path="manager/dashboard"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER']}>
                <ExecutiveDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="manager/twin"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER']}>
                <DigitalTwin />
              </ProtectedRoute>
            }
          />
          <Route
            path="manager/analytics"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER']}>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="manager/reports"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="manager/settings"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER']}>
                <WarehouseSettings />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="admin/overview"
            element={
              <ProtectedRoute allowedRoles={['ENTERPRISE_ADMIN']}>
                <AdminOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute allowedRoles={['ENTERPRISE_ADMIN']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['ENTERPRISE_ADMIN']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/security"
            element={
              <ProtectedRoute allowedRoles={['ENTERPRISE_ADMIN']}>
                <div className="p-12 text-center text-slate-400 font-mono">Security logs and events console under construction.</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/settings"
            element={
              <ProtectedRoute allowedRoles={['ENTERPRISE_ADMIN']}>
                <OrgSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/warehouses"
            element={
              <ProtectedRoute allowedRoles={['ENTERPRISE_ADMIN']}>
                <div className="p-12 text-center text-slate-400">Warehouse configuration editor module coming soon.</div>
              </ProtectedRoute>
            }
          />

          {/* Shared Pages */}
          <Route
            path="twin"
            element={
              <ProtectedRoute>
                <DigitalTwin />
              </ProtectedRoute>
            }
          />
          <Route
            path="digital-twin"
            element={
              <ProtectedRoute>
                <DigitalTwin />
              </ProtectedRoute>
            }
          />
          <Route
            path="manager/heatmap"
            element={
              <ProtectedRoute>
                <HeatmapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="heatmap"
            element={
              <ProtectedRoute>
                <HeatmapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
