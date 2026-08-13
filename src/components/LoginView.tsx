import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Shield,
  Globe,
  MapPin,
  KeyRound,
  CheckCircle2,
  UserPlus,
  Clock,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

/** Must match server `MIN_PASSWORD_LENGTH` in authController.js */
const PASSWORD_MIN_LENGTH = 4;

function ForgotPasswordModal({
  onClose,
  initialUsername,
}: {
  onClose: (nextUsername?: string) => void;
  initialUsername: string;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [masterKey, setMasterKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !masterKey || !newPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), masterKey, newPassword }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : () => onClose()}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/90 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        <div className="mb-1 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue">
              <KeyRound size={18} />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Reset Password</h3>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            disabled={loading}
            className="text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="mt-5 space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={20} />
              <p className="text-sm text-emerald-200">
                Password updated. You can now sign in with your new password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onClose(username.trim())}
              className="w-full rounded-xl bg-brand-blue py-3 font-bold text-white transition-colors hover:bg-[#3d7ab8]"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-slate-400">
              Enter your username and the recovery key configured on this server to set a new password.
            </p>

            <div className="space-y-1.5">
              <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                Username
              </label>
              <input
                required
                autoComplete="username"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                Recovery Key
              </label>
              <input
                required
                type="password"
                autoComplete="off"
                placeholder="Server RESET_MASTER_KEY"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all placeholder:text-slate-500 focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                  New Password
                </label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                  Confirm
                </label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-rose-400">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue py-3 font-bold text-white transition-colors hover:bg-[#3d7ab8] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Resetting…</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

type SignUpRoleOption = { id: number; name: string };

/** Public sign-up never offers the Administrator role — matches server-side `PUBLIC_SIGNUP_BLOCKED_ROLE_ID`. */
const SIGNUP_BLOCKED_ROLE_ID = 1;

function SignUpModal({
  onClose,
  initialUsername,
}: {
  onClose: (nextUsername?: string) => void;
  initialUsername: string;
}) {
  const { register } = useAuth();
  const [roles, setRoles] = useState<SignUpRoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState(initialUsername);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ roles: SignUpRoleOption[] }>('/api/auth/roles');
        if (cancelled) return;
        const available = (res.roles ?? []).filter((r) => r.id !== SIGNUP_BLOCKED_ROLE_ID);
        setRoles(available);
        setRoleId(available[0]?.id ?? null);
      } catch {
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !roleId) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        password,
        roleId,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : () => onClose()}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/90 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        <div className="mb-1 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <UserPlus size={18} />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Create Account</h3>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            disabled={loading}
            className="text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="mt-5 space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <Clock className="mt-0.5 shrink-0 text-amber-400" size={20} />
              <p className="text-sm text-amber-200">
                Account created. An administrator needs to approve it from User Management before
                you can sign in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onClose(username.trim())}
              className="w-full rounded-xl bg-brand-blue py-3 font-bold text-white transition-colors hover:bg-[#3d7ab8]"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-slate-400">
              Request access to the dashboard. Your account stays inactive until an administrator
              approves it.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                  First name
                </label>
                <input
                  required
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                  Last name
                </label>
                <input
                  required
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                Username
              </label>
              <input
                required
                autoComplete="username"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                Requested role
              </label>
              <select
                required
                disabled={rolesLoading || roles.length === 0}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15 disabled:opacity-60"
                value={roleId ?? ''}
                onChange={(e) => setRoleId(Number(e.target.value))}
              >
                {rolesLoading ? <option value="">Loading roles…</option> : null}
                {!rolesLoading && roles.length === 0 ? (
                  <option value="">No roles available</option>
                ) : null}
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                  Confirm
                </label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/15"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-rose-400">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue py-3 font-bold text-white transition-colors hover:bg-[#3d7ab8] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Creating…</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans text-slate-100 selection:bg-brand-blue/30 selection:text-blue-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2070"
          alt="Modern Architecture"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-[#0d121f]/80 backdrop-blur-[4px]" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-blue/10 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="w-full max-w-4xl grid lg:grid-cols-10 bg-slate-950/55 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/50 overflow-hidden relative z-10 border border-white/10">
        <div className="hidden lg:flex lg:col-span-4 flex-col justify-between p-10 bg-[#0d121f]">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-[#10b981] rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Building size={22} />
              </div>
              <span className="text-xl font-bold tracking-tight text-white italic">Realstate</span>
            </div>
            <div className="space-y-8">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
                <h1 className="text-3xl font-bold text-white leading-tight mb-4">
                  Manage your portfolio with <span className="text-emerald-400">precision.</span>
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  The complete 3CORE platform for property operations, CRM, and lease management.
                </p>
              </motion.div>
              <div className="space-y-4 pt-4">
                {[
                  { icon: Shield, text: 'Enterprise Security' },
                  { icon: MapPin, text: 'Local Insights' },
                  { icon: Globe, text: 'Cloud Infrastructure' },
                ].map((item, i) => (
                  <motion.div
                    key={item.text}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + i * 0.1 }}
                    className="flex items-center gap-3 text-slate-400 text-sm"
                  >
                    <div className="p-1.5 bg-slate-800/50 rounded-md">
                      <item.icon size={14} className="text-brand-blue" />
                    </div>
                    <span>{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-slate-600">
            <span>Powered by 3CORE Systems</span>
          </div>
        </div>

        <div className="col-span-full lg:col-span-6 p-8 md:p-14 bg-slate-950/35 flex flex-col justify-center">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-[#10b981] rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Building size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight italic">Realstate</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">System Admin Login</h2>
            <p className="text-slate-300/80 text-sm">
              Please sign in to access your administrative dashboard. New staff accounts are created
              from <span className="font-semibold text-slate-200">User Management → User Info</span>{' '}
              after you sign in, or request access below — an administrator reviews and approves
              every sign-up.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                Username
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-blue transition-colors"
                  size={18}
                />
                <input
                  id="username"
                  autoComplete="username"
                  required
                  className="w-full bg-slate-900/40 border border-slate-700/80 rounded-xl py-4 pl-12 pr-4 text-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-blue/15 focus:border-brand-blue transition-all placeholder:text-slate-500 text-sm"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label htmlFor="password" className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs font-semibold text-brand-blue hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-blue transition-colors"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full bg-slate-900/40 border border-slate-700/80 rounded-xl py-4 pl-12 pr-12 text-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-blue/15 focus:border-brand-blue transition-all placeholder:text-slate-500 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-blue transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1c2434] hover:bg-[#2c3444] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-70 group overflow-hidden relative"
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                    <span>Login to Dashboard</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="absolute inset-0 bg-brand-blue -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out -z-10" />
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => setSignUpOpen(true)}
              className="font-semibold text-brand-blue transition-colors hover:text-blue-300"
            >
              Sign Up
            </button>
          </p>

          <div className="mt-8 flex flex-col items-center gap-6">
            <div className="flex items-center gap-3 w-full">
              <span className="h-px grow bg-slate-800/80" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Regional Support</span>
              <span className="h-px grow bg-slate-800/80" />
            </div>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
              {['Manila', 'Cebu', 'Davao'].map((city) => (
                <div key={city} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{city}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {forgotOpen ? (
          <ForgotPasswordModal
            initialUsername={username}
            onClose={(nextUsername?: string) => {
              if (nextUsername != null) setUsername(nextUsername);
              setForgotOpen(false);
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {signUpOpen ? (
          <SignUpModal
            initialUsername={username}
            onClose={(nextUsername?: string) => {
              if (nextUsername != null) setUsername(nextUsername);
              setSignUpOpen(false);
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
