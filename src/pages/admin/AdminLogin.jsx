import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getAdminStatus } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function AdminLogin() {
  const { signIn, signOut, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) return;

    setCheckingExisting(true);
    getAdminStatus()
      .then((isAdmin) => {
        if (isAdmin) {
          navigate('/admin', { replace: true });
        } else {
          signOut().catch(() => {});
          setCheckingExisting(false);
        }
      })
      .catch(() => {
        signOut().catch(() => {});
        setCheckingExisting(false);
      });
  }, [isAuthenticated, isLoadingAuth, navigate, signOut]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await signIn(email, password);

      const isAdmin = await getAdminStatus();
      if (!isAdmin) {
        await signOut();
        toast.error('Access denied. This account does not have admin privileges.');
        setLoading(false);
        return;
      }

      toast.success('Welcome back, Admin');
      navigate('/admin', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAuth || checkingExisting) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-[420px] flex-shrink-0 flex-col justify-between bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 px-10 py-12">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-black text-base select-none">
              BT
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-semibold text-sm leading-tight">BlockTrade</p>
              <p className="text-emerald-600 dark:text-emerald-400 text-xs font-medium tracking-widest uppercase">Admin Console</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
            Platform<br />Administration
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            Restricted access. This portal is for authorised administrators only. Unauthorised access attempts are logged.
          </p>

          <div className="mt-10 space-y-4">
            {[
              'Manage user accounts & balances',
              'Review withdrawal requests',
              'KYC identity verification',
              'Platform-wide analytics',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600 text-xs">
            <Lock size={12} />
            <span>256-bit TLS encrypted · Admin access only</span>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        {/* Theme toggle top-right */}
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
              BT
            </div>
            <span className="text-gray-900 dark:text-white font-semibold text-sm">BlockTrade Admin</span>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-4">
              <Shield size={12} className="text-emerald-500 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">Admin Access Required</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in to Admin</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Use your administrator credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourdomain.com"
                  required
                  autoComplete="email"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl pl-10 pr-11 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                'Sign in to Admin Panel'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
            Not an admin?{' '}
            <a href="/login" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Go to user login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
