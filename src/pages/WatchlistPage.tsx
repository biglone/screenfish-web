import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { StockDetail } from '../components/StockDetail';

export function WatchlistPage() {
  const { groups, createGroup, renameGroup, deleteGroup, upsertItem, removeItems } =
    useWatchlist();

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTsCode, setActiveTsCode] = useState<string | null>(null);
  const [autoSelectDetail, setAutoSelectDetail] = useState(true);
  const [filter, setFilter] = useState('');
  const [addCode, setAddCode] = useState('');

  const activeGroup = useMemo(() => {
    if (groups.length === 0) return null;
    const found = activeGroupId ? groups.find((g) => g.id === activeGroupId) : null;
    return found ?? groups[0];
  }, [activeGroupId, groups]);

  const resolvedActiveTsCode = useMemo(() => {
    if (!activeGroup) return null;
    if (activeTsCode && activeGroup.items.some((i) => i.ts_code === activeTsCode)) return activeTsCode;
    if (!autoSelectDetail) return null;
    return activeGroup.items[0]?.ts_code ?? null;
  }, [activeGroup, activeTsCode, autoSelectDetail]);

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!activeGroup) return [];
    if (!q) return activeGroup.items;
    return activeGroup.items.filter((i) => {
      const code = i.ts_code.toLowerCase();
      const name = (i.name ?? '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [activeGroup, filter]);

  const handleCreateGroup = () => {
    const name = window.prompt('新建分组名称', '新分组');
    if (!name) return;
    void (async () => {
      const id = await createGroup(name);
      if (id) setActiveGroupId(id);
    })();
  };

  const handleRenameGroup = (groupId: string, currentName: string) => {
    const name = window.prompt('重命名分组', currentName);
    if (!name) return;
    renameGroup(groupId, name);
  };

  const handleDeleteGroup = (groupId: string, name: string) => {
    if (!window.confirm(`确定删除分组「${name}」？`)) return;
    deleteGroup(groupId);
    if (activeGroupId === groupId) setActiveGroupId(null);
  };

  const handleAddCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = addCode.trim();
    if (!code || !activeGroup) return;
    upsertItem(activeGroup.id, { ts_code: code });
    setAddCode('');
    setActiveTsCode(code);
    setAutoSelectDetail(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">自选分组</h1>
        <Link to="/screen" className="text-sm text-gray-500 hover:text-gray-700">
          去筛选并加入分组
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: groups + list */}
        <div className="lg:col-span-4">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">分组</div>
              <button
                type="button"
                onClick={handleCreateGroup}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新建
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {groups.map((g) => {
                const active = activeGroup?.id === g.id;
                return (
                  <div key={g.id} className={`px-4 py-2 ${active ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveGroupId(g.id)}
                        className={`min-w-0 flex-1 truncate text-left text-sm ${
                          active ? 'font-semibold text-blue-700' : 'text-gray-900 hover:text-blue-700'
                        }`}
                        title={g.name}
                      >
                        {g.name}
                        <span className="ml-2 text-xs text-gray-400">({g.items.length})</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRenameGroup(g.id, g.name)}
                          className="text-gray-400 hover:text-gray-600"
                          title="重命名"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(g.id, g.name)}
                          className="text-gray-400 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-200 px-4 py-3">
              <div className="mb-2 text-sm font-semibold text-gray-900">股票</div>

              <div className="mb-3 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="搜索代码/名称..."
                    className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <form onSubmit={handleAddCode} className="mb-3 flex gap-2">
                <input
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                  placeholder="输入 ts_code 添加..."
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!activeGroup || addCode.trim().length === 0}
                  className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  添加
                </button>
              </form>

              <div className="max-h-[520px] overflow-auto">
                {activeGroup && filteredItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">暂无股票</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {filteredItems.map((item) => {
                      const active = item.ts_code === resolvedActiveTsCode;
                      return (
                        <li key={item.ts_code} className={active ? 'bg-gray-50' : ''}>
                          <div className="flex items-center justify-between gap-2 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTsCode(item.ts_code);
                                setAutoSelectDetail(true);
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="truncate text-sm font-medium text-gray-900">
                                {item.name ? `${item.name} (${item.ts_code})` : item.ts_code}
                              </div>
                              {item.name && (
                                <div className="truncate text-xs text-gray-500">{item.ts_code}</div>
                              )}
                            </button>
                            {activeGroup && (
                              <button
                                type="button"
                                onClick={() => removeItems(activeGroup.id, [item.ts_code])}
                                className="text-gray-400 hover:text-red-600"
                                title="移除"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: detail */}
        <div className="lg:col-span-8">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            {resolvedActiveTsCode ? (
              <StockDetail
                tsCode={resolvedActiveTsCode}
                variant="panel"
                onClose={() => {
                  setActiveTsCode(null);
                  setAutoSelectDetail(false);
                }}
              />
            ) : (
              <div className="flex h-[560px] items-center justify-center text-sm text-gray-500">
                从左侧选择一只股票查看K线
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
