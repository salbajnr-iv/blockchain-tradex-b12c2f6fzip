import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { supabaseMisconfigured } from '@/lib/supabaseClient';
import { PortfolioProvider } from '@/contexts/PortfolioContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import Trade from './pages/Trade';
import Markets from './pages/Markets';
import Alerts from './pages/Alerts';
import Card from './pages/Card';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';

function AuthRedirect() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/" replace /> : null;
}

function App() {
  return (
    <AuthProvider>
      <PortfolioProvider>
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

              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/trade" element={<Trade />} />
                  <Route path="/markets" element={<Markets />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/card" element={<Card />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/analytics" element={<Analytics />} />
                </Route>
              </Route>

              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </PortfolioProvider>
    </AuthProvider>
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
