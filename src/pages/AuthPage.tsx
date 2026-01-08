import { useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useHealth } from '../hooks/useApi';
import { useLogin, useRegister, useRegisterEmail, useRequestEmailCode } from '../hooks/useAuth';

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
  }
  if (error instanceof Error) return error.message;
  return '操作失败';
}

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const health = useHealth();
  const login = useLogin();
  const register = useRegister();
  const requestEmailCode = useRequestEmailCode();
  const registerEmail = useRegisterEmail();

  const authEnabled = health.data?.auth_enabled === true;
  const signupMode = health.data?.auth_signup_mode ?? 'open';
  const bootstrap = health.data?.auth_bootstrap === true;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const fromPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname ?? '/';
  }, [location.state]);

  const emailRegisterEnabled = signupMode === 'email' && !bootstrap;
  const registerTabEnabled = signupMode !== 'closed' || bootstrap;

  const submitting =
    login.isPending || register.isPending || requestEmailCode.isPending || registerEmail.isPending;

  const activeError =
    mode === 'login'
      ? login.error
      : emailRegisterEnabled
        ? registerEmail.error ?? requestEmailCode.error
        : register.error;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const p = password;
    if (!u || !p) return;

    try {
      if (mode === 'login') {
        await login.mutateAsync({ username: u, password: p });
      } else {
        if (emailRegisterEnabled) {
          const e1 = email.trim();
          const c1 = code.trim();
          if (!e1 || !c1) return;
          await registerEmail.mutateAsync({ email: e1, code: c1, username: u, password: p });
        } else {
          await register.mutateAsync({ username: u, password: p });
        }
      }
      navigate(fromPath, { replace: true });
    } catch {
      // handled by mutation state
    }
  };

  const handleSendCode = async () => {
    const e1 = email.trim();
    if (!e1) return;
    try {
      await requestEmailCode.mutateAsync({ email: e1 });
    } catch {
      // handled by mutation state
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        <div className="mb-6">
          <div className="text-2xl font-bold text-gray-900">ScreenFish</div>
          <div className="mt-1 text-sm text-gray-600">登录后使用全部功能</div>
        </div>

        {health.isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : !authEnabled ? (
          <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            后端未开启登录鉴权（`STOCK_SCREENER_AUTH_ENABLED`）。
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => registerTabEnabled && setMode('register')}
                disabled={!registerTabEnabled}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white'
                    : registerTabEnabled
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                注册
              </button>
            </div>

            {mode === 'register' && signupMode === 'closed' && !bootstrap && (
              <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                注册已关闭，请联系管理员开通邮箱注册或创建账号。
              </div>
            )}

            {mode === 'register' && emailRegisterEnabled && (
              <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                需要邮箱验证码注册（更安全）。
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && emailRegisterEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">邮箱</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">验证码</label>
                    <div className="mt-1 flex gap-2">
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="6 位数字"
                        inputMode="numeric"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={requestEmailCode.isPending || !email.trim()}
                        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        发送验证码
                      </button>
                    </div>
                    {requestEmailCode.data?.ok && (
                      <div className="mt-2 text-xs text-gray-500">
                        已发送验证码（有效期至 {new Date(requestEmailCode.data.expires_at * 1000).toLocaleString()}）
                        {requestEmailCode.data.debug_code
                          ? `，debug_code=${requestEmailCode.data.debug_code}`
                          : ''}
                      </div>
                    )}
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">用户名</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'login' ? '用户名或邮箱' : '请输入用户名'}
                  autoComplete="username"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">密码</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {activeError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {getErrorMessage(activeError)}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  submitting ||
                  !username.trim() ||
                  !password ||
                  (mode === 'register' && !registerTabEnabled) ||
                  (mode === 'register' && emailRegisterEnabled && (!email.trim() || !code.trim()))
                }
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {mode === 'login' ? '登录' : '注册'}
              </button>
            </form>

            <div className="mt-4 text-xs text-gray-500">
              {!bootstrap
                ? signupMode === 'closed'
                  ? '注册已关闭，可通过管理员创建账号。'
                  : '第一个注册用户自动成为管理员（admin）。'
                : '当前未检测到用户，可注册一个管理员账号用于初始化。'}
            </div>
          </>
        )}

        {!health.isLoading && !authEnabled && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            返回应用
          </button>
        )}
      </div>
    </div>
  );
}
