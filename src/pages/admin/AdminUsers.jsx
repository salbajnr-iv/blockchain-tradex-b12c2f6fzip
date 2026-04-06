import { useEffect, useState } from 'react';
import { getAllUsers, setUserAdminFlag, setUserStatus } from '@/lib/api/admin';
import { toast } from 'sonner';
import { RefreshCw, Search, Shield, ShieldOff } from 'lucide-react';

const STATUS_COLORS = {
  active: 'bg-emerald-500/15 text-emerald-400',
  inactive: 'bg-gray-500/15 text-gray-400',
  suspended: 'bg-red-500/15 text-red-400',
};

const KYC_TIER_COLORS = {
  basic: 'bg-gray-500/15 text-gray-400',
  intermediate: 'bg-blue-500/15 text-blue-400',
  pro: 'bg-purple-500/15 text-purple-400',
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAdminToggle = async (userId, currentIsAdmin) => {
    setActionLoading(userId + '-admin');
    try {
      await setUserAdminFlag(userId, !currentIsAdmin);
      toast.success(currentIsAdmin ? 'Admin access revoked' : 'Admin access granted');
      setUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u)
      );
    } catch (err) {
      toast.error(err.message || 'Failed to update admin flag');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setActionLoading(userId + '-status');
    try {
      await setUserStatus(userId, newStatus);
      toast.success(`User ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}`);
      setUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u)
      );
    } catch (err) {
      toast.error(err.message || 'Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-1">Manage registered platform users</p>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="relative flex-1 max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search by email, name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['User', 'KYC Tier', 'Status', 'Joined', 'Last Login', 'Admin', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-800 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">No users found.</td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">{u.full_name || u.username || '—'}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${KYC_TIER_COLORS[u.kyc_tier] || 'bg-gray-800 text-gray-400'}`}>
                        {u.kyc_tier || 'basic'}
                        {u.kyc_verified && <span className="ml-1">✓</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[u.status] || 'bg-gray-800 text-gray-400'}`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 whitespace-nowrap text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-400 whitespace-nowrap text-xs">
                      {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-5 py-4">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <Shield size={12} />
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdminToggle(u.id, u.is_admin)}
                          disabled={actionLoading === u.id + '-admin'}
                          title={u.is_admin ? 'Revoke admin' : 'Grant admin'}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                            u.is_admin
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
                              : 'bg-gray-800 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                          }`}
                        >
                          {u.is_admin ? <ShieldOff size={12} /> : <Shield size={12} />}
                          {u.is_admin ? 'Revoke' : 'Grant'}
                        </button>
                        <button
                          onClick={() => handleStatusToggle(u.id, u.status)}
                          disabled={actionLoading === u.id + '-status'}
                          className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                            u.status === 'suspended'
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-gray-800 text-gray-400 hover:bg-red-500/10 hover:text-red-400'
                          }`}
                        >
                          {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
            {filtered.length} of {users.length} users
          </div>
        )}
      </div>
    </div>
  );
}
