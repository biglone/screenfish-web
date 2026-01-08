import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Search, RefreshCw, Fish, List, FileCode, Star, Terminal } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/stocks', icon: List, label: '股票列表' },
  { to: '/watchlist', icon: Star, label: '自选分组' },
  { to: '/formulas', icon: FileCode, label: '公式管理' },
  { to: '/screen', icon: Search, label: '股票筛选' },
  { to: '/logs', icon: Terminal, label: '运行日志' },
  { to: '/update', icon: RefreshCw, label: '数据更新' },
];

export function Layout() {
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
            {navItems.map((item) => (
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
            <p className="text-xs text-gray-500">
              A-Share Stock Screener
            </p>
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
