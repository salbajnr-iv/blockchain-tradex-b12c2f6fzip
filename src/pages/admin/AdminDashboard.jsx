import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminDashboardStats, getAdminAnalytics } from '@/lib/api/admin';
import {
  ArrowDownToLine, ShieldCheck, Users, DollarSign, RefreshCw,
  TrendingUp, BarChart3, Activity, Wallet,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon size={18} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

const fmtCurrency = (v) =>
  v >= 1e6
    ? `$${(v / 1e6).toFixed(2)}M`
    : v >= 1e3
    ? `$${(v / 1e3).toFixed(1)}K`
    : `$${Number(v).toFixed(2)}`;

const fmtTooltipUsd = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

const ChartCard = ({ title, sub, children }) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
    {children}
  </div>
);

const xTickFmt = (v) => {
  if (!v) return '';
  const parts = v.split('-');
  return `${parts[1]}/${parts[2]}`;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
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

  const loadAnalytics = async () => {
    setChartsLoading(true);
    try {
      const data = await getAdminAnalytics();
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setChartsLoading(false);
    }
  };

  const handleRefresh = () => { loadStats(); loadAnalytics(); };

  useEffect(() => { loadStats(); loadAnalytics(); }, []);

  const fmtCurrencyFull = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Platform overview · last 30 days</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading && !stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="w-9 h-9 bg-gray-200 dark:bg-gray-800 rounded-lg mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-2" />
              <div className="h-7 bg-gray-200 dark:bg-gray-800 rounded w-16" />
            </div>
          ))
        ) : stats ? (
          <>
            <StatCard
              icon={ArrowDownToLine}
              label="Pending Withdrawals"
              value={stats.pendingWithdrawals}
              color="bg-orange-500/15 text-orange-500"
              sub="awaiting review"
            />
            <StatCard
              icon={ShieldCheck}
              label="Pending KYC"
              value={stats.pendingKyc}
              color="bg-yellow-500/15 text-yellow-500"
              sub="awaiting review"
            />
            <StatCard
              icon={Users}
              label="Total Users"
              value={stats.totalUsers.toLocaleString()}
              color="bg-blue-500/15 text-blue-500"
              sub={analytics ? `+${analytics.totals.totalSignups} this month` : undefined}
            />
            <StatCard
              icon={Wallet}
              label="Platform Value"
              value={fmtCurrencyFull(stats.totalPlatformValue)}
              color="bg-emerald-500/15 text-emerald-500"
              sub={analytics ? `${fmtCurrency(analytics.totals.totalVolume)} volume/30d` : undefined}
            />
          </>
        ) : null}
      </div>

      {/* Charts grid */}
      {chartsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-40 mb-1" />
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-6" />
              <div className="h-44 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            </div>
          ))}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* New signups per day */}
          <ChartCard
            title="New Signups / Day"
            sub={`${analytics.totals.totalSignups} new users in the last 30 days`}
          >
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={analytics.signups} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg, #1f2937)', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#60a5fa' }}
                  formatter={(v) => [v, 'Signups']}
                  labelFormatter={(l, p) => p[0]?.payload?.date ?? l}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#signupGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Trading volume per day */}
          <ChartCard
            title="Trading Volume / Day"
            sub={`${fmtCurrency(analytics.totals.totalVolume)} total over the last 30 days`}
          >
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.volume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="#9ca3af"
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg, #1f2937)', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#34d399' }}
                  formatter={(v) => [fmtTooltipUsd(v), 'Volume']}
                  labelFormatter={(l, p) => p[0]?.payload?.date ?? l}
                />
                <Bar dataKey="value" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Platform revenue (fees) per day */}
          <ChartCard
            title="Platform Revenue / Day"
            sub={`${fmtCurrency(analytics.totals.totalRevenue)} in trading fees over the last 30 days`}
          >
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={analytics.revenue} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="#9ca3af"
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg, #1f2937)', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#c084fc' }}
                  formatter={(v) => [fmtTooltipUsd(v), 'Revenue']}
                  labelFormatter={(l, p) => p[0]?.payload?.date ?? l}
                />
                <Area type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Withdrawal request trends */}
          <ChartCard
            title="Withdrawal Requests / Day"
            sub={`${analytics.totals.totalWithdrawals} requests over the last 30 days`}
          >
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={analytics.withdrawals} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg, #1f2937)', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(v, name) => [v, name === 'value' ? 'Total' : 'Pending']}
                  labelFormatter={(l, p) => p[0]?.payload?.date ?? l}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="value"   stroke="#f59e0b" strokeWidth={2} dot={false} name="Total" />
                <Line type="monotone" dataKey="pending" stroke="#ef4444" strokeWidth={2} dot={false} name="Pending" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
          <BarChart3 size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Analytics data unavailable.</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Charts will appear once transactions are recorded.</p>
        </div>
      )}

      {/* Quick Actions */}
      {stats && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Review Withdrawals', href: '/admin/withdrawals', badge: stats.pendingWithdrawals, color: 'text-orange-500 dark:text-orange-400 border-orange-200 dark:border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-500/10' },
              { label: 'Review KYC',         href: '/admin/kyc',         badge: stats.pendingKyc,         color: 'text-yellow-500 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30 hover:bg-yellow-50 dark:hover:bg-yellow-500/10' },
              { label: 'Manage Users',       href: '/admin/users',       badge: null,                     color: 'text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10' },
            ].map(({ label, href, badge, color }) => (
              <Link
                key={href}
                to={href}
                className={`flex items-center justify-between px-5 py-4 rounded-xl border bg-white dark:bg-gray-900 transition-colors ${color}`}
              >
                <span className="text-sm font-medium">{label}</span>
                {badge > 0 && (
                  <span className="bg-current/20 text-current text-xs font-bold px-2 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
