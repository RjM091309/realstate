import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building, Mail, Lock, ArrowRight, Eye, EyeOff, Shield, Globe, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

export function LoginView() {
  const { login, register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleId, setRoleId] = useState<number>(1);
  const [roles, setRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          password,
          roleId,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  async function ensureRolesLoaded() {
    if (rolesLoaded) return;
    setRolesLoaded(true);
    try {
      const data = await apiFetch<{ roles: Array<{ id: number; name: string }> }>('/api/auth/roles');
      if (Array.isArray(data.roles)) {
        setRoles(data.roles);
        if (data.roles.length) setRoleId(data.roles[0]!.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load roles.');
    }
  }

  return (
    <div className="min-h-screen font-sans text-slate-900 selection:bg-indigo-500/30 selection:text-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
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
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="w-full max-w-4xl grid lg:grid-cols-10 bg-white/95 dark:bg-slate-950/45 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/40 overflow-hidden relative z-10 border border-white/10">
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
                      <item.icon size={14} className="text-indigo-400" />
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

        <div className="col-span-full lg:col-span-6 p-8 md:p-14 bg-white dark:bg-slate-950/30 flex flex-col justify-center">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-[#10b981] rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Building size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight italic">Realstate</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {mode === 'login' ? 'System Admin Login' : 'Create Account'}
            </h2>
            <p className="text-slate-500 dark:text-slate-300/80 text-sm">
              {mode === 'login'
                ? 'Please sign in to access your administrative dashboard.'
                : 'Create an account to start using the system.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'register' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider ml-1">
                    First name
                  </label>
                  <input
                    id="firstName"
                    autoComplete="given-name"
                    required
                    className="w-full bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/80 rounded-xl py-4 px-4 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/15 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-sm"
                    placeholder="Juan"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider ml-1">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    autoComplete="family-name"
                    required
                    className="w-full bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/80 rounded-xl py-4 px-4 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/15 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-sm"
                    placeholder="Dela Cruz"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="username" className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider ml-1">
                Username
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors"
                  size={18}
                />
                <input
                  id="username"
                  autoComplete="username"
                  required
                  className="w-full bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/80 rounded-xl py-4 pl-12 pr-4 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/15 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-sm"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label htmlFor="password" className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/80 rounded-xl py-4 pl-12 pr-12 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/15 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {mode === 'register' ? (
              <div className="space-y-2">
                <label htmlFor="roleId" className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider ml-1">
                  Role
                </label>
                <select
                  id="roleId"
                  className="w-full bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/80 rounded-xl py-4 px-4 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/15 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-sm"
                  value={roleId}
                  onChange={(e) => setRoleId(Number(e.target.value))}
                  onFocus={() => void ensureRolesLoaded()}
                >
                  {(roles.length ? roles : [{ id: 1, name: 'Administrator' }]).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-400/80">
                  Tip: Create an Administrator account first so you can access the Control Panel.
                </p>
              </div>
            ) : null}

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
                    <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                    <span>{mode === 'login' ? 'Login to Dashboard' : 'Create account'}</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="absolute inset-0 bg-indigo-600 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out -z-10" />
            </button>

            <div
              className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-300/80"
              role="tablist"
              aria-label="Authentication mode"
            >
              <span className="text-slate-400 dark:text-slate-400/80">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`font-extrabold tracking-wide transition-colors ${
                  mode === 'login'
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200'
                }`}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                Login
              </button>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`font-extrabold tracking-wide transition-colors ${
                  mode === 'register'
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200'
                }`}
                onClick={() => {
                  setMode('register');
                  setError(null);
                  void ensureRolesLoaded();
                }}
              >
                Create account
              </button>
            </div>
          </form>

          <div className="mt-12 flex flex-col items-center gap-6">
            <div className="flex items-center gap-3 w-full">
              <span className="h-px grow bg-slate-100" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] whitespace-nowrap">Regional Support</span>
              <span className="h-px grow bg-slate-100" />
            </div>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
              {['Manila', 'Cebu', 'Davao'].map((city) => (
                <div key={city} className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{city}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
