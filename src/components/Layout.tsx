import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  RefreshCw,
  Fish,
  List,
  FileCode,
  Star,
  Terminal,
  Users,
  User,
  Menu,
  X,
  Palette,
} from 'lucide-react';
import { useHealth } from '../hooks/useApi';
import { logout, useMe } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../hooks/useTheme';

const navItems: Array<{
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  adminOnly?: boolean;
  authOnly?: boolean;
}> = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/stocks', icon: List, label: '股票列表' },
  { to: '/watchlist', icon: Star, label: '自选分组' },
  { to: '/account', icon: User, label: '账号设置', authOnly: true },
  { to: '/formulas', icon: FileCode, label: '公式管理' },
  { to: '/screen', icon: Search, label: '股票筛选' },
  { to: '/users', icon: Users, label: '用户管理', adminOnly: true },
  { to: '/logs', icon: Terminal, label: '运行日志', adminOnly: true },
  { to: '/update', icon: RefreshCw, label: '数据更新', adminOnly: true },
];

export function Layout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme, themes } = useTheme();
  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);
  const isAdmin = !authEnabled || me.data?.role === 'admin';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleItems = navItems.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.authOnly || authEnabled)
  );

  const handleLogout = () => {
    logout(queryClient);
    navigate('/auth', { replace: true });
  };

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-gray-900 px-4 xl:hidden">
        <div className="flex items-center gap-2">
          <Fish className="h-7 w-7 text-[color:var(--sf-primary-400)]" />
          <span className="text-lg font-bold text-white">ScreenFish</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="打开菜单"
          className="inline-flex items-center justify-center rounded-md border border-gray-800 bg-gray-900 p-2 text-gray-200 hover:bg-gray-800"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 xl:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar / Drawer */}
        <aside
          className={`fixed left-0 top-0 z-50 h-screen w-64 max-w-[80vw] bg-gray-900 transition-transform xl:z-40 xl:translate-x-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center justify-between gap-3 border-b border-gray-800 px-4 lg:h-16 lg:px-6">
            <div className="flex items-center gap-3">
              <Fish className="h-8 w-8 text-[color:var(--sf-primary-400)]" />
              <span className="text-xl font-bold text-white">ScreenFish</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="关闭菜单"
              className="inline-flex items-center justify-center rounded-md border border-gray-800 bg-gray-900 p-2 text-gray-200 hover:bg-gray-800 xl:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[color:var(--sf-primary-600)] text-white'
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
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                    <Palette className="h-4 w-4" />
                    主题颜色
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--sf-primary-500)]" />
                </div>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as typeof theme)}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-2 text-xs text-gray-200 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                >
                  {themes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

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
        </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-16 xl:ml-64 xl:p-8 xl:pt-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--sf-primary-600)] border-t-transparent" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
        </main>
      </div>
    </div>
  );
}
