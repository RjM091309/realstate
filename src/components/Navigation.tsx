import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseISO, formatDistanceToNow } from 'date-fns';
import {
  LayoutDashboard,
  Building2,
  MapPinned,
  Wrench,
  Users,
  FilePen,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  Bell,
  UserCircle,
  Briefcase,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useDateRange, toYYYYMMDD } from '@/context/DateRangeContext';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import { applyTheme, type AppThemeMode } from '@/lib/theme';
import { animateThemeRippleFromElement } from '@/lib/themeRipple';
import { apiFetch, getToken } from '@/lib/api';
import { getSocketApiOrigin } from '@/lib/socketOrigin';
import {
  effectiveUnreadCount,
  filterNotificationsByPreferences,
  loadNotificationPreferences,
  subscribeNotificationPreferences,
} from '@/lib/notificationPreferences';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal } from '@/components/modal';
import {
  NotificationPanel,
  createDefaultNotifications,
  type Notification,
} from '@/components/NotificationPanel';

/** Socket surface used by TopNav only — avoids top-level `socket.io-client` import (Vite dev resolution). */
type IoNotifySocket = {
  on(ev: string, fn: (...args: unknown[]) => void): void;
  off(ev: string, fn?: (...args: unknown[]) => void): void;
  disconnect(): void;
};

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  /** From DB `branch_sidebar_permissions`; omit to show all items */
  allowedTabIds?: string[];
  /** Administrator (role id 1) — show Control Panel under User Management */
  isAdmin?: boolean;
  onLogout?: () => void;
}

const USER_MGMT_PATHS = {
  info: '/user-management/user-info',
  role: '/user-management/user-role',
  control: '/user-management/control-panel',
} as const;

export function Sidebar({ activeTab, setActiveTab, allowedTabIds, isAdmin, onLogout }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userMgmtOpen, setUserMgmtOpen] = useState(() => location.pathname.startsWith('/user-management'));

  const operationalItems = useMemo(
    () => [
      { id: 'dashboard', label: t('nav.menu.dashboard'), icon: LayoutDashboard },
      { id: 'units', label: t('nav.menu.units'), icon: Building2 },
      { id: 'addUnitByLocation', label: t('nav.menu.addUnitByLocation'), icon: MapPinned },
      { id: 'contracts', label: t('nav.menu.contracts'), icon: FilePen },
      { id: 'crm', label: t('nav.menu.crm'), icon: Users },
      { id: 'ledger', label: t('nav.menu.ledger'), icon: BookOpen },
      { id: 'calendar', label: t('nav.menu.calendar'), icon: Calendar },
      { id: 'maintenance', label: t('nav.menu.maintenance'), icon: Wrench },
      { id: 'userManagement', label: t('nav.menu.userManagement'), icon: UsersRound },
      { id: 'agentPortal', label: t('nav.menu.agentPortal'), icon: Briefcase },
      { id: 'portal', label: t('nav.menu.portal'), icon: UserCircle },
    ],
    [t],
  );

  const hasAllowedTabs = Array.isArray(allowedTabIds);
  const visibleOperational = hasAllowedTabs
    ? operationalItems.filter((item) => {
      if (item.id === 'userManagement') return Boolean(isAdmin);
      if (item.id === 'addUnitByLocation') return allowedTabIds.includes('units');
      return allowedTabIds.includes(item.id);
    })
    : operationalItems.filter((item) => item.id !== 'userManagement' || Boolean(isAdmin));

  const navItems = visibleOperational;

  useEffect(() => {
    if (location.pathname.startsWith('/user-management')) {
      setUserMgmtOpen(true);
    }
  }, [location.pathname]);

  const { session } = useAuth();
  const userName = session
    ? `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.username
    : '';
  const userRole = session?.role.name ?? '';
  const userInitials = (() => {
    const parts = userName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    return userName.slice(0, 2).toUpperCase() || 'U';
  })();

  return (
    <div
      className={cn(
        'relative flex flex-col h-full bg-slate-900 text-slate-400 border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0',
        isCollapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3.5 top-7 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 shadow-lg transition-all hover:text-white"
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Logo */}
      <div className={cn('transition-all duration-300', isCollapsed ? 'px-4 pt-5 pb-4' : 'px-5 pt-6 pb-4')}>
        <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white shadow-lg shadow-brand-orange/20"
            aria-hidden
          >
            <Building2 className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
          <span
            className={cn(
              'text-lg font-bold tracking-tight text-white overflow-hidden transition-all duration-300',
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
            )}
          >
            {t('nav.appName')}
          </span>
        </div>
      </div>

      <div className="mx-4 h-px bg-slate-800" />

      {/* Nav items */}
      <div className="sidebar-scroll flex-1 overflow-y-auto py-3 transition-all duration-300">
        {!isCollapsed && (
          <h3 className="mb-3 px-6 text-[11px] font-bold uppercase tracking-widest text-brand-orange">
            Menu
          </h3>
        )}
        <nav className="space-y-1" aria-label="Main">
          {navItems.map((item) => {
            if (item.id === 'userManagement') {
              const umActive = activeTab === 'userManagement';
              const Icon = item.icon;
              const subLinks: { path: string; label: string }[] = [
                { path: USER_MGMT_PATHS.info, label: t('nav.userMgmt.userInfo') },
                { path: USER_MGMT_PATHS.role, label: t('nav.userMgmt.userRole') },
                ...(isAdmin ? [{ path: '/user-management/audit-logs', label: t('nav.userMgmt.auditLogs') }] : []),
                ...(isAdmin ? [{ path: USER_MGMT_PATHS.control, label: t('nav.userMgmt.controlPanel') }] : []),
              ];

              if (isCollapsed) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => void navigate(USER_MGMT_PATHS.info)}
                    className={cn(
                      'relative flex w-full items-center justify-center py-3.5 text-sm font-medium transition-all',
                      umActive ? 'text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                    )}
                  >
                    {umActive ? <span className="absolute bottom-0 left-0 top-0 w-1 bg-brand-orange" /> : null}
                    <Icon className={cn('h-5 w-5 shrink-0', umActive ? 'text-white' : 'text-slate-400')} />
                  </button>
                );
              }

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => setUserMgmtOpen((o) => !o)}
                    className={cn(
                      'relative flex w-full items-center justify-between py-3.5 pl-6 pr-6 text-left text-sm font-medium transition-all',
                      umActive
                        ? 'mr-3 rounded-r-full bg-brand-orange text-white shadow-md shadow-brand-orange/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon className={cn('h-5 w-5 shrink-0', umActive ? 'text-white' : 'text-slate-400')} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        userMgmtOpen ? 'rotate-180' : '',
                      )}
                      aria-hidden
                    />
                  </button>
                  {userMgmtOpen ? (
                    <div className="bg-slate-800/50 py-1">
                      {subLinks.map(({ path, label }) => {
                        const subActive = location.pathname === path;
                        return (
                          <button
                            key={path}
                            type="button"
                            onClick={() => void navigate(path)}
                            className={cn(
                              'w-full py-2.5 text-sm transition-all duration-300 hover:text-brand-orange',
                              subActive
                                ? 'bg-brand-orange/5 text-center font-black text-brand-orange'
                                : 'pl-14 text-left text-slate-400 hover:text-slate-200',
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={isCollapsed ? item.label : undefined}
                onClick={() => {
                  if (item.id === 'portal') {
                    let suffix = '';
                    try {
                      const tenantId = localStorage.getItem('realstate_portal_tenant_id')?.trim();
                      if (tenantId) suffix = `?tenantId=${encodeURIComponent(tenantId)}`;
                    } catch {
                      // ignore
                    }
                    window.open(`${window.location.origin}/portal${suffix}`, '_blank');
                    return;
                  }
                  if (item.id === 'agentPortal') {
                    window.open(`${window.location.origin}${window.location.pathname}?view=agent-portal`, '_blank');
                    return;
                  }
                  setActiveTab(item.id);
                }}
                className={cn(
                  'relative flex w-full items-center text-sm font-medium transition-all',
                  isCollapsed ? 'justify-center py-3.5' : 'gap-3 py-3.5 pl-6 pr-6',
                  isActive && !isCollapsed
                    ? 'mr-3 rounded-r-full bg-brand-orange text-white shadow-md shadow-brand-orange/20'
                    : isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )}
              >
                {isActive && isCollapsed ? (
                  <span className="absolute bottom-0 left-0 top-0 w-1 bg-brand-orange" />
                ) : null}
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-slate-400',
                  )}
                />
                <span
                  className={cn(
                    'truncate overflow-hidden transition-all duration-300',
                    isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="border-t border-slate-800">
        <div
          className={cn(
            'flex items-center gap-3 transition-all duration-300',
            isCollapsed ? 'justify-center p-3' : 'px-4 py-3.5',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue/20 text-xs font-bold text-brand-blue">
            {userInitials}
          </div>
          <div
            className={cn(
              'min-w-0 overflow-hidden transition-all duration-300',
              isCollapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100',
            )}
          >
            <p className="truncate text-xs font-semibold text-white">{userName}</p>
            <p className="truncate text-[10px] text-slate-500">{userRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TopNav({
  onOpenSettings,
  onLogout,
}: {
  onOpenSettings?: () => void;
  onLogout?: () => void;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;
  const { session, refreshSession } = useAuth();
  const { dateRange, setDateRange } = useDateRange();
  const socketRef = React.useRef<IoNotifySocket | null>(null);
  const refreshTimeoutRef = React.useRef<number | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [themeLoading, setThemeLoading] = useState<AppThemeMode | null>(null);
  const [currentTheme, setCurrentTheme] = useState<AppThemeMode>('light');
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    createDefaultNotifications(t),
  );
  const [notifyPrefs, setNotifyPrefs] = useState(loadNotificationPreferences);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [notificationDetailOpen, setNotificationDetailOpen] = useState(false);

  async function refreshNotifications() {
    try {
      const res = await apiFetch<{ notifications: Notification[] }>('/api/notifications?limit=40');
      if (Array.isArray(res.notifications)) setNotifications(res.notifications);
    } catch {
      // Keep local demo notifications if API is unavailable.
    }
  }

  useEffect(() => {
    setNotifications((prev) => {
      const next = createDefaultNotifications(t);
      return next.map((n) => {
        const old = prev.find((p) => p.id === n.id);
        return old ? { ...n, unread: old.unread } : n;
      });
    });
  }, [t, i18n.language]);

  useEffect(() => {
    return subscribeNotificationPreferences(() => setNotifyPrefs(loadNotificationPreferences()));
  }, []);

  useEffect(() => {
    if (!session || !notifyPrefs.inAppMaster) return;
    void refreshNotifications();
    const id = window.setInterval(() => void refreshNotifications(), 30_000);
    return () => window.clearInterval(id);
  }, [session, notifyPrefs.inAppMaster]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const token = getToken();
    const devUserId = localStorage.getItem('realstate_dev_user_id');
    let active: IoNotifySocket | null = null;

    void (async () => {
      const { io } = await import('socket.io-client');
      if (cancelled) return;
      const socket = io(getSocketApiOrigin(), {
        transports: ['websocket'],
        auth: { token, devUserId },
      }) as IoNotifySocket;
      if (cancelled) {
        socket.disconnect();
        return;
      }
      active = socket;
      socketRef.current = socket;

      socket.on('notifications:changed', () => {
        void refreshNotifications();
      });

      socket.on('access:changed', (raw) => {
        const payload = raw as { roleId?: number } | undefined;
        const changedRoleId = Number(payload?.roleId);
        const myRoleId = Number(session.role?.id);
        if (!Number.isFinite(changedRoleId) || changedRoleId < 1) return;
        if (changedRoleId !== myRoleId) return;
        if (refreshTimeoutRef.current != null) window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = window.setTimeout(() => {
          void refreshSession();
          refreshTimeoutRef.current = null;
        }, 250);
      });
    })();

    return () => {
      cancelled = true;
      const s = active ?? socketRef.current;
      socketRef.current = null;
      if (s) {
        s.off('notifications:changed');
        s.off('access:changed');
        s.disconnect();
      }
      if (refreshTimeoutRef.current != null) window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    };
  }, [session]);
  const filteredNotifications = React.useMemo(
    () => filterNotificationsByPreferences(notifications, notifyPrefs),
    [notifications, notifyPrefs],
  );
  const unreadCount = effectiveUnreadCount(notifications, notifyPrefs);

  function formatAbsoluteNotificationTime(value: string, locale: string) {
    const v = String(value ?? '').trim();
    if (!v) return '';
    try {
      const dt = new Date(v);
      if (Number.isNaN(dt.getTime())) return '';
      if (dt.getFullYear() < 2000) return '';
      return new Intl.DateTimeFormat(locale || undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dt);
    } catch {
      return '';
    }
  }

  function formatNotificationTime(value: string) {
    const v = String(value ?? '').trim();
    if (!v) return '';
    try {
      const dt = new Date(v);
      if (Number.isNaN(dt.getTime())) return v;
      if (dt.getFullYear() < 2000) return v;
      const ago = formatDistanceToNow(dt, { addSuffix: true });
      const abs = formatAbsoluteNotificationTime(value, currentLanguage);
      return abs ? `${ago} • ${abs}` : ago;
    } catch {
      return v;
    }
  }

  async function openNotificationDetails(n: Notification) {
    setNotificationOpen(false);

    if (n.unread) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
      try {
        await apiFetch(`/api/notifications/${encodeURIComponent(n.id)}/read`, { method: 'POST' });
      } catch {
        // ignore
      }
    }

    if (n.type === 'lease') {
      navigate('/contracts');
    } else if (n.type === 'payment') {
      navigate('/ledger');
    } else if (n.type === 'maintenance') {
      navigate('/maintenance');
    } else {
      setSelectedNotification(n);
      setNotificationDetailOpen(true);
    }
  }
  const [pickerRange, setPickerRange] = useState<[Date | null, Date | null]>(() => [
    dateRange.start ? parseISO(dateRange.start) : null,
    dateRange.end ? parseISO(dateRange.end) : null,
  ]);
  useEffect(() => {
    setPickerRange([
      dateRange.start ? parseISO(dateRange.start) : null,
      dateRange.end ? parseISO(dateRange.end) : null,
    ]);
  }, [dateRange.start, dateRange.end]);
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setCurrentTheme(root.classList.contains('dark') ? 'dark' : 'light');
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const showDateRangePicker = true;
  const name =
    session != null
      ? `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.username
      : '';
  const role = session?.role.name ?? '';
  const initials = (() => {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || 'U';
  })();

  function handleDateRangeChange(next: [Date | null, Date | null]) {
    const [start, end] = next;
    setPickerRange(next);
    if (start != null && end != null) {
      setDateRange({ start: toYYYYMMDD(start), end: toYYYYMMDD(end) });
    }
  }

  async function handleAppThemeChange(mode: AppThemeMode, originEl: HTMLElement | null) {
    if (themeLoading) return;
    setThemeLoading(mode);
    try {
      await animateThemeRippleFromElement({
        mode,
        element: originEl,
        onApplyTheme: () => applyTheme(mode),
      });
      toast.success(mode === 'dark' ? 'Dark mode on' : 'Light mode on');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not change theme.';
      toast.error(message);
    } finally {
      setThemeLoading(null);
    }
  }
  const nextTheme: AppThemeMode = currentTheme === 'dark' ? 'light' : 'dark';
  const nextThemeLabel = nextTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <header className="h-16 bg-white dark:bg-slate-900 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {showDateRangePicker && (
          <motion.div
            initial={{ opacity: 0, x: -16, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className="shrink-0 min-w-[240px] max-w-[320px] w-full sm:w-auto"
          >
            <AppDatePicker
              mode="range"
              value={pickerRange}
              onChange={(next) => handleDateRangeChange(next as [Date | null, Date | null])}
              placeholder="Date range"
              fullWidth
            />
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Language + theme cluster */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50/80 p-1 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-800/50">
          <div
            className="relative flex items-center rounded-full p-0.5"
            role="group"
            aria-label={t('header.languageLabel')}
          >
            <span className="sr-only">{t('header.languageLabel')}</span>
            {(['en', 'ko'] as const).map((lang) => {
              const active = currentLanguage.toLowerCase().startsWith(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => void i18n.changeLanguage(lang)}
                  className={cn(
                    'relative z-10 h-7 min-w-[2.25rem] cursor-pointer rounded-full px-2.5 text-xs font-bold tracking-wide transition-colors',
                    active
                      ? 'text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100',
                  )}
                  aria-pressed={active}
                >
                  {active && (
                    <motion.span
                      layoutId="header-lang-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-brand-blue shadow-[0_6px_14px_-6px_rgba(75,137,205,0.85)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    />
                  )}
                  <motion.span
                    key={`${lang}-${active ? 'on' : 'off'}`}
                    initial={{ y: 4, opacity: 0.5 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    className="relative inline-block"
                  >
                    {lang.toUpperCase()}
                  </motion.span>
                </button>
              );
            })}
          </div>

          <div className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-600/80" aria-hidden />

          <motion.button
            type="button"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 480, damping: 24 }}
            className={cn(
              'relative flex h-7 min-w-[5.75rem] cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-full px-2.5',
              'text-xs font-semibold text-slate-600 dark:text-slate-200',
              'hover:bg-white/80 dark:hover:bg-slate-700/60',
              'disabled:cursor-wait disabled:opacity-70',
            )}
            onClick={(e) => void handleAppThemeChange(nextTheme, e.currentTarget as HTMLElement)}
            disabled={themeLoading !== null}
            title={`Switch system to ${nextThemeLabel.toLowerCase()} mode`}
          >
            <span className="relative flex h-3.5 w-3.5 items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={nextTheme}
                  initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {nextTheme === 'dark' ? (
                    <Moon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={themeLoading ? 'loading' : nextThemeLabel}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="inline-block"
              >
                {themeLoading ? 'Switching...' : nextThemeLabel}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        <div className="relative shrink-0 [perspective:800px]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'relative h-10 w-10 transition-transform duration-200',
              notificationOpen && 'scale-95',
              unreadCount > 0 && !notificationOpen && 'notify-bell-wobble',
            )}
            aria-expanded={notificationOpen}
            aria-label={t('notifications.title')}
            onClick={() => setNotificationOpen((open) => !open)}
          >
            <Bell className="size-7 text-slate-600 dark:text-slate-300" />
            {unreadCount > 0 ? (
              <span
                className={cn(
                  'absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1',
                  'rounded-full bg-rose-600 text-white',
                  'text-[11px] font-bold leading-[20px] text-center',
                  'border-2 border-white dark:border-slate-900',
                  'shadow-[0_4px_10px_-2px_rgba(225,29,72,0.55)]',
                  'notify-badge-pulse',
                )}
                aria-label={t('notifications.unread_messages', { count: unreadCount })}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Button>
          <NotificationPanel
            isOpen={notificationOpen}
            onClose={() => setNotificationOpen(false)}
            notifications={filteredNotifications}
            onMarkAllRead={async () => {
              setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
              try {
                await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
              } catch {
                // ignore
              }
            }}
            onNotificationClick={(n) => void openNotificationDetails(n)}
          />
        </div>

        <div className="hidden h-8 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-slate-600 sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className={cn(
                  'group relative flex items-center gap-2 overflow-hidden rounded-full border border-slate-200/80 dark:border-slate-700/80',
                  'bg-white/70 dark:bg-slate-900/55 backdrop-blur-md px-2 py-1.5',
                  'shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] hover:shadow-[0_14px_28px_-14px_rgba(75,137,205,0.45)]',
                  'transition-[box-shadow,border-color] duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
                  'data-[popup-open]:border-brand-blue/40 data-[popup-open]:shadow-[0_16px_32px_-14px_rgba(75,137,205,0.5)]',
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[popup-open]:opacity-100"
                  style={{
                    background:
                      'linear-gradient(120deg, transparent 20%, rgba(75,137,205,0.12) 45%, transparent 70%)',
                  }}
                />
                <Avatar className="relative h-8 w-8 ring-2 ring-transparent transition-[box-shadow,transform] duration-300 group-hover:ring-brand-blue/30 group-hover:scale-105 group-data-[popup-open]:ring-brand-blue/45">
                  <AvatarImage src={session?.user.avatarUrl ?? undefined} className="object-cover" />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left hidden sm:block">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {name || '—'}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {role || '—'}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform duration-300 ease-out group-data-[popup-open]:rotate-180" />
              </motion.button>
            }
          />
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className={cn(
              'w-56 rounded-2xl border border-slate-200/80 dark:border-slate-700/80',
              'bg-white/85 dark:bg-slate-900/75 backdrop-blur-xl',
              'shadow-[0_24px_48px_-20px_rgba(15,23,42,0.45)]',
              'data-open:zoom-in-95 data-open:slide-in-from-top-3',
            )}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{name || '—'}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{role || '—'}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="transition-transform focus:translate-x-0.5"
                onClick={() => {
                  setNotificationOpen(false);
                  onOpenSettings?.();
                }}
              >
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="transition-transform focus:translate-x-0.5"
                onClick={() => {
                  setNotificationOpen(false);
                  onLogout?.();
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Modal
        isOpen={notificationDetailOpen}
        onClose={() => {
          setNotificationDetailOpen(false);
          setSelectedNotification(null);
        }}
        title={selectedNotification?.title ?? t('notifications.title')}
        subtitle={selectedNotification ? formatNotificationTime(selectedNotification.time) : undefined}
        maxWidth="lg"
        variant="glass"
      >
        {selectedNotification ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600/80 dark:text-slate-200/70">
              {selectedNotification.type}
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/55 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
              <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                {selectedNotification.message}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">—</div>
        )}
      </Modal>
    </header>
  );
}
