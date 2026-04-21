import React, { useState, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import AppErrors from "@/components/AppErrors"
import SplashScreen from '@/components/SplashScreen';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { supabaseMisconfigured } from '@/lib/supabaseClient';
import { PortfolioProvider } from '@/contexts/PortfolioContext';
import { LivePricesProvider } from '@/contexts/LivePricesContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AdminProvider } from '@/contexts/AdminContext';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AccountStateGate from './components/AccountStateGate';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import Trade from './pages/Trade';
import Markets from './pages/Markets';
import Asset from './pages/Asset';
import Orders from './pages/Orders';
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
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import AdminDeposits from './pages/admin/AdminDeposits';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminSupport from './pages/admin/AdminSupport';
import Notifications from './pages/Notifications';
import NotificationDetail from './pages/NotificationDetail';
import Support from './pages/Support';
import Leaderboard from './pages/Leaderboard';
import AdminLeaderboard from './pages/admin/AdminLeaderboard';
import Investments from './pages/Investments';
import AdminInvestments from './pages/admin/AdminInvestments';
import AdminDepositAddresses from './pages/admin/AdminDepositAddresses';
import AdminDeviceFingerprints from './pages/admin/AdminDeviceFingerprints';
import AdminMultiAccount from './pages/admin/AdminMultiAccount';
import AdminPlatformControls from './pages/admin/AdminPlatformControls';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminMessages from './pages/AdminMessages';
import Alerts from './pages/Alerts';
import AnnouncementBanner from './components/AnnouncementBanner';

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}
    <ThemeProvider>
      <AuthProvider>
        <AdminProvider>
        <ConfirmProvider>
        <FeatureFlagsProvider>
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
                to your Replit Secrets, then restart the app.
              </div>
            )}
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ImpersonationBanner />
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
                  <Route element={<AccountStateGate />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/trade" element={<Trade />} />
                    <Route path="/markets" element={<Markets />} />
                    <Route path="/asset/:coinId" element={<Asset />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/messages" element={<AdminMessages />} />
                    <Route path="/card" element={<Card />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/withdrawal" element={<Withdrawal />} />
                    <Route path="/recurring" element={<Recurring />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/assets/:type/:id" element={<AssetDetail />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/notifications/:id" element={<NotificationDetail />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/invest" element={<Investments />} />

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
                    <Route path="deposits" element={<AdminDeposits />} />
                    <Route path="audit-log" element={<AdminAuditLog />} />
                    <Route path="notifications" element={<AdminNotifications />} />
                    <Route path="support" element={<AdminSupport />} />
                    <Route path="leaderboard" element={<AdminLeaderboard />} />
                    <Route path="investments" element={<AdminInvestments />} />
                    <Route path="deposit-addresses" element={<AdminDepositAddresses />} />
                    <Route path="device-fingerprints" element={<AdminDeviceFingerprints />} />
                    <Route path="multi-account" element={<AdminMultiAccount />} />
                    <Route path="platform-controls" element={<AdminPlatformControls />} />
                    <Route path="users/:userId" element={<AdminUserDetail />} />
                    <Route path="announcements" element={<AdminAnnouncements />} />
                  </Route>
                </Route>

                <Route path="*" element={<PageNotFound />} />
              </Routes>
            </Router>
            <Toaster />
            <SonnerToaster richColors position="top-right" />
            <AppErrors />
          </QueryClientProvider>
          </LivePricesProvider>
        </PortfolioProvider>
        </FeatureFlagsProvider>
        </ConfirmProvider>
        </AdminProvider>
      </AuthProvider>
    </ThemeProvider>
    </>
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
