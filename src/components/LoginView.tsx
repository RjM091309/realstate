import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, KeyRound, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type AuthMode = 'signin' | 'register';

interface RoleOption {
  id: number;
  name: string;
}

export function LoginView() {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [roleId, setRoleId] = useState('');

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesErr, setRolesErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setRolesErr(null);
    setRolesLoading(true);
    try {
      const data = await apiFetch<{ roles: RoleOption[] }>('/api/auth/roles');
      setRoles(data.roles ?? []);
    } catch {
      setRolesErr(t('login.register.rolesError'));
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (mode !== 'register') return;
    void loadRoles();
  }, [mode, loadRoles]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setErr(null);
    setRolesErr(null);
    if (next === 'signin') {
      setFirstName('');
      setLastName('');
      setPasswordConfirm('');
      setRoleId('');
      setPassword('');
    }
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('login.error'));
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const rid = Number(roleId);
    if (!Number.isFinite(rid) || rid < 1) {
      setErr(t('login.register.roleRequired'));
      return;
    }
    if (password !== passwordConfirm) {
      setErr(t('login.register.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        password,
        roleId: rid,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('login.error'));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'h-11 border-stone-200 bg-stone-50/50 focus-visible:border-emerald-700/50 focus-visible:ring-emerald-700/20';
  const selectClass = cn(
    'flex h-11 w-full rounded-md border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 shadow-xs transition-colors',
    'focus-visible:border-emerald-700/50 focus-visible:ring-[3px] focus-visible:ring-emerald-700/20 focus-visible:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-50',
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-stone-100">
      <aside
        className={cn(
          'relative hidden lg:flex lg:w-[44%] xl:w-[42%] min-h-screen flex-col justify-center overflow-hidden',
          'bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-950 text-white px-10 xl:px-14 2xl:px-20',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
          }}
        />
        <div className="pointer-events-none absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-amber-200/10 blur-3xl" />

        <div className="relative z-10 max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Building2 className="h-6 w-6 text-emerald-200" strokeWidth={1.75} />
            </div>
            <span className="font-semibold tracking-wide text-lg text-white/95">{t('login.brand')}</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl xl:text-4xl font-semibold leading-tight tracking-tight text-white">
              {t('login.heroTitle')}
            </h1>
            <p className="text-base leading-relaxed text-stone-300">{t('login.heroSubtitle')}</p>
          </div>
          <ul className="flex flex-col gap-4 pt-2 text-sm text-stone-400">
            <li className="flex items-start gap-3">
              <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/90" strokeWidth={1.75} />
              <span>{t('login.heroBullet1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/90" strokeWidth={1.75} />
              <span>{t('login.heroBullet2')}</span>
            </li>
          </ul>
        </div>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="mb-8 flex w-full max-w-md items-center justify-center gap-2.5 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-emerald-300 shadow-lg shadow-stone-900/15">
            <Building2 className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-stone-900">{t('login.brand')}</span>
        </div>

        <div
          className={cn(
            'w-full max-w-md rounded-2xl border border-stone-200/90 bg-white p-8 shadow-xl shadow-stone-900/5',
            'ring-1 ring-stone-900/[0.04]',
          )}
        >
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
              {mode === 'signin' ? t('login.title') : t('login.register.title')}
            </h2>
            <p className="text-sm leading-relaxed text-stone-500">
              {mode === 'signin' ? t('login.subtitle') : t('login.register.subtitle')}
            </p>
          </div>

          {mode === 'signin' ? (
            <form onSubmit={onSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-stone-700">
                  {t('login.username')}
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={busy}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-stone-700">
                  {t('login.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  required
                  className={inputClass}
                />
              </div>
              {err ? (
                <p className="text-sm font-medium text-rose-600" role="alert">
                  {err}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={busy}
                className={cn(
                  'h-11 w-full rounded-xl font-medium shadow-md shadow-stone-900/10',
                  'bg-stone-900 text-white hover:bg-stone-800',
                  'focus-visible:ring-emerald-700/30',
                )}
              >
                {busy ? t('login.loading') : t('login.submit')}
              </Button>
              <p className="text-center text-xs leading-relaxed text-stone-400">{t('login.hint')}</p>
              <p className="text-center text-sm text-stone-600">
                <button
                  type="button"
                  className="font-medium text-emerald-800 underline-offset-4 hover:underline"
                  onClick={() => switchMode('register')}
                >
                  {t('login.switchToRegister')}
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={onRegister} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="firstName" className="text-stone-700">
                    {t('login.register.firstName')}
                  </Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={busy}
                    required
                    maxLength={128}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="lastName" className="text-stone-700">
                    {t('login.register.lastName')}
                  </Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={busy}
                    required
                    maxLength={128}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-username" className="text-stone-700">
                  {t('login.username')}
                </Label>
                <Input
                  id="reg-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={busy}
                  required
                  minLength={3}
                  maxLength={64}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password" className="text-stone-700">
                  {t('login.password')}
                </Label>
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm" className="text-stone-700">
                  {t('login.register.confirmPassword')}
                </Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  disabled={busy}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-stone-700">
                  {t('login.register.role')}
                </Label>
                <select
                  id="role"
                  className={selectClass}
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={busy || rolesLoading}
                  required
                >
                  <option value="">{t('login.register.rolePlaceholder')}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {rolesLoading ? (
                  <p className="text-xs text-stone-500">{t('login.register.loadingRoles')}</p>
                ) : null}
                {rolesErr ? (
                  <p className="text-xs font-medium text-rose-600" role="alert">
                    {rolesErr}
                  </p>
                ) : null}
              </div>
              {err ? (
                <p className="text-sm font-medium text-rose-600" role="alert">
                  {err}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={busy || rolesLoading || !!rolesErr || roles.length === 0}
                className={cn(
                  'h-11 w-full rounded-xl font-medium shadow-md shadow-stone-900/10',
                  'bg-stone-900 text-white hover:bg-stone-800',
                  'focus-visible:ring-emerald-700/30',
                )}
              >
                {busy ? t('login.register.loading') : t('login.register.submit')}
              </Button>
              <p className="text-center text-sm text-stone-600">
                <button
                  type="button"
                  className="font-medium text-emerald-800 underline-offset-4 hover:underline"
                  onClick={() => switchMode('signin')}
                >
                  {t('login.switchToSignIn')}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
