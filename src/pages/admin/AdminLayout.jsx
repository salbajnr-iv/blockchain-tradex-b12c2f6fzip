import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ShieldCheck,
  Users,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { to: '/admin/kyc', label: 'KYC Review', icon: ShieldCheck },
  { to: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/admin/login');
    } catch {
      toast.error('Sign out failed');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-white font-bold text-sm select-none">
                A
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">BlockTrade</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium tracking-wide">Admin Panel</p>
              </div>
            </div>
            <ThemeToggle size="sm" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-emerald-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
