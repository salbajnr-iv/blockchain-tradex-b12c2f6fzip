import { useEffect, useState } from 'react';
import { getAdminDashboardStats } from '@/lib/api/admin';
import { ArrowDownToLine, ShieldCheck, Users, DollarSign, RefreshCw } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Platform overview</p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={ArrowDownToLine}
            label="Pending Withdrawals"
            value={stats.pendingWithdrawals}
            color="bg-orange-500/15 text-orange-500 dark:text-orange-400"
          />
          <StatCard
            icon={ShieldCheck}
            label="Pending KYC"
            value={stats.pendingKyc}
            color="bg-yellow-500/15 text-yellow-500 dark:text-yellow-400"
          />
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats.totalUsers.toLocaleString()}
            color="bg-blue-500/15 text-blue-500 dark:text-blue-400"
          />
          <StatCard
            icon={DollarSign}
            label="Platform Value"
            value={formatCurrency(stats.totalPlatformValue)}
            color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          />
        </div>
      ) : null}

      {stats && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Review Withdrawals', href: '/admin/withdrawals', badge: stats.pendingWithdrawals, color: 'text-orange-500 dark:text-orange-400 border-orange-200 dark:border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-500/10' },
              { label: 'Review KYC', href: '/admin/kyc', badge: stats.pendingKyc, color: 'text-yellow-500 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30 hover:bg-yellow-50 dark:hover:bg-yellow-500/10' },
              { label: 'Manage Users', href: '/admin/users', badge: null, color: 'text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10' },
            ].map(({ label, href, badge, color }) => (
              <a
                key={href}
                href={href}
                className={`flex items-center justify-between px-5 py-4 rounded-xl border bg-white dark:bg-gray-900 transition-colors ${color}`}
              >
                <span className="text-sm font-medium">{label}</span>
                {badge > 0 && (
                  <span className="bg-current/20 text-current text-xs font-bold px-2 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
