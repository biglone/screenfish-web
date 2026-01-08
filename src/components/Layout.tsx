import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, RefreshCw, Fish, List, FileCode, Star, Terminal } from 'lucide-react';
import { useHealth } from '../hooks/useApi';
import { logout, useMe } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

const navItems: Array<{
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  adminOnly?: boolean;
}> = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/stocks', icon: List, label: '股票列表' },
  { to: '/watchlist', icon: Star, label: '自选分组' },
  { to: '/formulas', icon: FileCode, label: '公式管理' },
  { to: '/screen', icon: Search, label: '股票筛选' },
  { to: '/logs', icon: Terminal, label: '运行日志', adminOnly: true },
  { to: '/update', icon: RefreshCw, label: '数据更新', adminOnly: true },
];

export function Layout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);
  const isAdmin = !authEnabled || me.data?.role === 'admin';

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = () => {
    logout(queryClient);
    navigate('/auth', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-900">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-6">
            <Fish className="h-8 w-8 text-blue-400" />
            <span className="text-xl font-bold text-white">ScreenFish</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-800 p-4">
            {authEnabled && me.data ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-400">
                  {me.data.username} ({me.data.role})
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-md bg-gray-800 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-700"
                >
                  退出登录
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">A-Share Stock Screener</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
