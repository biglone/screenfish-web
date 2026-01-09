import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';
import api from '../api/client';
import { useHealth } from '../hooks/useApi';
import { useMe } from '../hooks/useAuth';
import type { AdminUserItem } from '../types/api';

function formatUnixTs(ts: number | null | undefined): string {
  if (!ts) return '-';
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '操作失败';
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);
  const isAdmin = !authEnabled || me.data?.role === 'admin';

  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', search, limit, offset],
    queryFn: () => api.listAdminUsers({ search: search.trim() || undefined, limit, offset }),
    enabled: isAdmin,
    retry: false,
  });

  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const createUser = useMutation({
    mutationFn: (req: { username: string; email: string; password: string; role: 'admin' | 'user'; disabled: boolean }) =>
      api.createAdminUser({
        username: req.username,
        password: req.password,
        email: req.email.trim() ? req.email.trim() : null,
        role: req.role,
        disabled: req.disabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: (req: { userId: string; patch: { role?: 'admin' | 'user'; disabled?: boolean } }) =>
      api.updateAdminUser(req.userId, req.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const setPassword = useMutation({
    mutationFn: (req: { userId: string; password: string }) =>
      api.setAdminUserPassword(req.userId, { password: req.password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const revokeTokens = useMutation({
    mutationFn: (userId: string) => api.revokeAdminUserTokens(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'admin' | 'user'>('user');
  const [createDisabled, setCreateDisabled] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<AdminUserItem | null>(null);
  const [passwordValue, setPasswordValue] = useState('');

  const submitting =
    createUser.isPending || updateUser.isPending || setPassword.isPending || revokeTokens.isPending;

  const activeError =
    createUser.error ?? updateUser.error ?? setPassword.error ?? revokeTokens.error ?? usersQuery.error;

  const currentPageLabel = useMemo(() => {
    if (!total) return '0';
    const page = Math.floor(offset / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));
    return `${page}/${pages}`;
  }, [limit, offset, total]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setOffset(0);
    void usersQuery.refetch();
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const username = createUsername.trim();
    const password = createPassword;
    if (!username || !password) return;
    createUser.mutate(
      { username, email: createEmail, password, role: createRole, disabled: createDisabled },
      {
        onSuccess: () => {
          setCreateUsername('');
          setCreateEmail('');
          setCreatePassword('');
          setCreateRole('user');
          setCreateDisabled(false);
        },
      }
    );
  };

  const handleToggleDisabled = (u: AdminUserItem) => {
    const next = !u.disabled;
    const ok = window.confirm(next ? `确定禁用用户「${u.username}」？` : `确定启用用户「${u.username}」？`);
    if (!ok) return;
    updateUser.mutate({ userId: u.id, patch: { disabled: next } });
  };

  const handleRoleChange = (u: AdminUserItem, role: 'admin' | 'user') => {
    if (u.role === role) return;
    const ok = window.confirm(
      role === 'admin'
        ? `确定将用户「${u.username}」提升为管理员？`
        : `确定将用户「${u.username}」降级为普通用户？`
    );
    if (!ok) return;
    updateUser.mutate({ userId: u.id, patch: { role } });
  };

  const openPasswordModal = (u: AdminUserItem) => {
    setPasswordTarget(u);
    setPasswordValue('');
  };

  const closePasswordModal = () => {
    setPasswordTarget(null);
    setPasswordValue('');
  };

  const handleSetPassword = () => {
    if (!passwordTarget) return;
    const pw = passwordValue;
    if (!pw || pw.length < 8) return;
    const ok = window.confirm(`确定重置用户「${passwordTarget.username}」的密码？（会让该用户所有登录失效）`);
    if (!ok) return;
    setPassword.mutate(
      { userId: passwordTarget.id, password: pw },
      {
        onSuccess: () => closePasswordModal(),
      }
    );
  };

  const handleRevokeTokens = (u: AdminUserItem) => {
    const ok = window.confirm(`确定踢下线用户「${u.username}」？（会让该用户所有登录失效）`);
    if (!ok) return;
    revokeTokens.mutate(u.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <button
          type="button"
          onClick={() => usersQuery.refetch()}
          disabled={!isAdmin || usersQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          {usersQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          刷新
        </button>
      </div>

      {!isAdmin && (
        <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
          需要管理员权限（admin）才能管理用户。
        </div>
      )}

      {activeError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {getErrorMessage(activeError)}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <UserPlus className="h-4 w-4" />
            创建用户
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700">用户名</label>
              <input
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="至少 3 位"
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700">邮箱（可选）</label>
              <input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700">密码</label>
              <input
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                type="password"
                placeholder="至少 8 位"
                autoComplete="new-password"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700">角色</label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as typeof createRole)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700">禁用</label>
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createDisabled}
                  onChange={(e) => setCreateDisabled(e.target.checked)}
                  className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                />
                是
              </label>
            </div>

            <div className="lg:col-span-12">
              <button
                type="submit"
                disabled={submitting || !createUsername.trim() || createPassword.length < 8}
                className="inline-flex items-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--sf-primary-700)] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                创建
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow">
        <div className="border-b border-gray-200 px-4 py-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Shield className="h-4 w-4" />
              用户列表
              <span className="text-xs font-normal text-gray-500">
                共 {total.toLocaleString()} 个
              </span>
            </div>
            <div className="flex flex-1 items-center gap-2 sm:max-w-xl">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索用户名/邮箱"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
              />
              <button
                type="submit"
                disabled={!isAdmin}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                搜索
              </button>
            </div>
          </form>
        </div>

        <div className="p-4">
          {!isAdmin ? (
            <div className="text-sm text-gray-500">无权限。</div>
          ) : usersQuery.isFetching && !usersQuery.data ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">用户名</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">邮箱</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">角色</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">状态</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">最近登录</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Token v</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{u.username}</div>
                          <div className="text-xs text-gray-500">{u.id}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{u.email ?? '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                              {u.role}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRoleChange(u, u.role === 'admin' ? 'user' : 'admin')}
                              disabled={submitting}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                            >
                              切换
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {u.disabled ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">disabled</span>
                          ) : (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">active</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          <div>{formatUnixTs(u.last_login_at)}</div>
                          <div className="text-xs text-gray-500">{u.last_login_ip ?? ''}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{u.token_version}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleDisabled(u)}
                              disabled={submitting}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                            >
                              {u.disabled ? '启用' : '禁用'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openPasswordModal(u)}
                              disabled={submitting}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                            >
                              重置密码
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeTokens(u)}
                              disabled={submitting}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                            >
                              踢下线
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                          （无数据）
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-500">
                  每页
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(parseInt(e.target.value, 10));
                      setOffset(0);
                    }}
                    className="mx-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  条，页码 {currentPageLabel}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canPrev || usersQuery.isFetching}
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={!canNext || usersQuery.isFetching}
                    onClick={() => setOffset((o) => o + limit)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
            <div className="mb-4 text-lg font-semibold text-gray-900">重置密码</div>
            <div className="text-sm text-gray-600">
              用户：<span className="font-medium text-gray-900">{passwordTarget.username}</span>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">新密码</label>
              <input
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                type="password"
                placeholder="至少 8 位"
                autoComplete="new-password"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
              />
              <div className="mt-2 text-xs text-gray-500">提交后会让该用户所有登录失效。</div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={submitting}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSetPassword}
                disabled={submitting || passwordValue.length < 8}
                className="inline-flex items-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--sf-primary-700)] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {setPassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

