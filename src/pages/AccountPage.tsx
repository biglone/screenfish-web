import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Mail, Save, User } from 'lucide-react';
import api from '../api/client';
import { useHealth } from '../hooks/useApi';
import { useMe } from '../hooks/useAuth';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '操作失败';
}

export function AccountPage() {
  const queryClient = useQueryClient();
  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);

  const accountQuery = useQuery({
    queryKey: ['account'],
    queryFn: () => api.account(),
    enabled: authEnabled,
    retry: false,
  });

  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSavedAt, setEmailSavedAt] = useState<number | null>(null);

  const email = draftEmail ?? (accountQuery.data?.email ?? '');

  const updateAccount = useMutation({
    mutationFn: (req: { email: string | null; current_password: string }) => api.updateAccount(req),
    onSuccess: (data) => {
      queryClient.setQueryData(['account'], data);
      setDraftEmail(null);
      setEmailPassword('');
      setEmailSavedAt(Date.now());
    },
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [passwordSavedAt, setPasswordSavedAt] = useState<number | null>(null);

  const changePassword = useMutation({
    mutationFn: (req: { current_password: string; new_password: string }) => api.changePassword(req),
    onSuccess: (data) => {
      api.setAuthToken(data.token);
      queryClient.invalidateQueries();
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      setPasswordSavedAt(Date.now());
    },
  });

  const submitting = updateAccount.isPending || changePassword.isPending;
  const activeError = updateAccount.error ?? changePassword.error ?? accountQuery.error;

  const normalizedEmail = email.trim();
  const emailPayload = normalizedEmail ? normalizedEmail : null;
  const serverEmailPayload = (accountQuery.data?.email ?? null) || null;
  const emailChanged = serverEmailPayload !== emailPayload;

  const passwordMismatch = newPassword.length > 0 && newPassword2.length > 0 && newPassword !== newPassword2;
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;

  const meLine = useMemo(() => {
    const u = me.data?.username;
    const role = me.data?.role;
    if (!u || !role) return '';
    return `${u} (${role})`;
  }, [me.data?.role, me.data?.username]);

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!authEnabled) return;
    if (!emailPassword.trim()) return;
    updateAccount.mutate({ email: emailPayload, current_password: emailPassword });
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!authEnabled) return;
    if (!currentPassword.trim() || !newPassword.trim()) return;
    if (newPassword !== newPassword2) return;
    changePassword.mutate({ current_password: currentPassword, new_password: newPassword });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">账号设置</h1>
        {meLine && <div className="text-sm text-gray-600">{meLine}</div>}
      </div>

      {!authEnabled && (
        <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
          后端未开启登录鉴权（`STOCK_SCREENER_AUTH_ENABLED`），无需账号设置。
        </div>
      )}

      {activeError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {getErrorMessage(activeError)}
        </div>
      )}

      {authEnabled && (
        <>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Mail className="h-4 w-4" />
              邮箱
            </div>

            <form onSubmit={handleEmailSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <label className="block text-sm font-medium text-gray-700">邮箱</label>
                <input
                  value={email}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
                <div className="mt-2 text-xs text-gray-500">留空表示清空邮箱（将无法用邮箱登录）。</div>
              </div>

              <div className="lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700">当前密码</label>
                <input
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
              </div>

              <div className="lg:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={submitting || !emailPassword.trim() || !emailChanged}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--sf-primary-700)] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {updateAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存
                </button>
              </div>
            </form>

            {emailSavedAt && (
              <div className="mt-3 text-xs text-green-700">
                已保存（{new Date(emailSavedAt).toLocaleString()}）
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <KeyRound className="h-4 w-4" />
              修改密码
            </div>

            <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700">当前密码</label>
                <input
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
              </div>
              <div className="lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700">新密码</label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
                {passwordTooShort && <div className="mt-1 text-xs text-red-600">至少 8 位</div>}
              </div>
              <div className="lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700">确认新密码</label>
                <input
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
                {passwordMismatch && <div className="mt-1 text-xs text-red-600">两次输入不一致</div>}
              </div>

              <div className="lg:col-span-12 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <User className="h-4 w-4" />
                  修改密码会让其它设备的登录全部失效。
                </div>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !currentPassword.trim() ||
                    newPassword.length < 8 ||
                    newPassword !== newPassword2
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--sf-primary-700)] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存新密码
                </button>
              </div>
            </form>

            {passwordSavedAt && (
              <div className="mt-3 text-xs text-green-700">
                已保存（{new Date(passwordSavedAt).toLocaleString()}）
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
