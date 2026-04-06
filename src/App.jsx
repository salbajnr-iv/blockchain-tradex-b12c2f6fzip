import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { supabaseMisconfigured } from '@/lib/supabaseClient';
import { PortfolioProvider } from '@/contexts/PortfolioContext';
import { LivePricesProvider } from '@/contexts/LivePricesContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import Trade from './pages/Trade';
import Markets from './pages/Markets';
import Asset from './pages/Asset';
import Orders from './pages/Orders';
import Alerts from './pages/Alerts';
import Card from './pages/Card';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Withdrawal from './pages/Withdrawal';
import SettingsLayout from './pages/settings/Layout';
import ProfileSettings from './pages/settings/Profile';
import SecuritySettings from './pages/settings/Security';
import AppearanceSettings from './pages/settings/Appearance';
import NotificationPrefs from './pages/settings/NotificationPrefs';
import PaymentsSettings from './pages/settings/Payments';
import KycSettings from './pages/settings/Kyc';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AdminRoute from './components/AdminRoute';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminKyc from './pages/admin/AdminKyc';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAuditLog from './pages/admin/AdminAuditLog';
import Recurring from './pages/Recurring';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PortfolioProvider>
          <LivePricesProvider>
          <QueryClientProvider client={queryClientInstance}>
            {supabaseMisconfigured && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                background: '#dc2626', color: '#fff', padding: '12px 20px',
                fontSize: '14px', fontWeight: 600, textAlign: 'center', lineHeight: 1.5,
              }}>
                ⚠️ BlockTrade is missing its database configuration. Add{' '}
                <code style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '1px 6px' }}>VITE_SUPABASE_URL</code>{' '}
                and{' '}
                <code style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '1px 6px' }}>VITE_SUPABASE_ANON_KEY</code>{' '}
                to your Vercel Environment Variables, then redeploy.
              </div>
            )}
            <Router>
              <Routes>
                <Route path="/login" element={
                  <AuthRedirectWrapper>
                    <Login />
                  </AuthRedirectWrapper>
                } />
                <Route path="/register" element={
                  <AuthRedirectWrapper>
                    <Register />
                  </AuthRedirectWrapper>
                } />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/trade" element={<Trade />} />
                    <Route path="/markets" element={<Markets />} />
                    <Route path="/asset/:coinId" element={<Asset />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/card" element={<Card />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/withdrawal" element={<Withdrawal />} />
                    <Route path="/recurring" element={<Recurring />} />

                    <Route path="/settings" element={<SettingsLayout />}>
                      <Route index element={<ProfileSettings />} />
                      <Route path="security" element={<SecuritySettings />} />
                      <Route path="appearance" element={<AppearanceSettings />} />
                      <Route path="notifications" element={<NotificationPrefs />} />
                      <Route path="payments" element={<PaymentsSettings />} />
                      <Route path="kyc" element={<KycSettings />} />
                    </Route>
                  </Route>
                </Route>

                {/* Admin login — public, no auth required */}
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Admin routes — gated behind AdminRoute */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="withdrawals" element={<AdminWithdrawals />} />
                    <Route path="kyc" element={<AdminKyc />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="audit-log" element={<AdminAuditLog />} />
                  </Route>
                </Route>

                <Route path="*" element={<PageNotFound />} />
              </Routes>
            </Router>
            <Toaster />
          </QueryClientProvider>
          </LivePricesProvider>
        </PortfolioProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthRedirectWrapper({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default App
