import React, { useEffect, useState } from 'react';
import { parseISO } from 'date-fns';
import {
  LayoutDashboard,
  Building2,
  Users,
  FilePen,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  Search,
  Bell,
  UserCircle,
  Briefcase,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { setSystemTheme, type SystemThemeMode } from '../lib/systemThemeApi';
import { applyTheme } from '@/lib/theme';
import { animateThemeRippleFromElement } from '@/lib/themeRipple';
import { apiFetch, getToken } from '@/lib/api';
import { toast } from 'sonner';
import { io, type Socket } from 'socket.io-client';
import { Modal } from '@/components/modal';
import {
  NotificationPanel,
  createDefaultNotifications,
  type Notification,
} from '@/components/NotificationPanel';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  /** From DB `branch_sidebar_permissions`; omit to show all items */
  allowedTabIds?: string[];
  /** Administrator (role id 1) — show Control Panel access screen */
  isAdmin?: boolean;
  onLogout?: () => void;
}

export function Sidebar({ activeTab, setActiveTab, allowedTabIds, isAdmin, onLogout }: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const operationalItems = [
    { id: 'dashboard', label: t('nav.menu.dashboard'), icon: LayoutDashboard },
    { id: 'units', label: t('nav.menu.units'), icon: Building2 },
    { id: 'contracts', label: t('nav.menu.contracts'), icon: FilePen },
    { id: 'crm', label: t('nav.menu.crm'), icon: Users },
    { id: 'ledger', label: t('nav.menu.ledger'), icon: BookOpen },
    { id: 'calendar', label: t('nav.menu.calendar'), icon: Calendar },
    { id: 'agentPortal', label: t('nav.menu.agentPortal'), icon: Briefcase },
    { id: 'portal', label: t('nav.menu.portal'), icon: UserCircle },
  ];

  const hasAllowedTabs = Array.isArray(allowedTabIds);
  const visibleOperational = hasAllowedTabs
    ? operationalItems.filter((item) => allowedTabIds.includes(item.id))
    : operationalItems;

  const accessItem = isAdmin
    ? [{ id: 'access', label: t('nav.menu.controlPanelAccess'), icon: SlidersHorizontal }]
    : [];

  const navItems = [...visibleOperational, ...accessItem];

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
        'relative flex flex-col h-full bg-slate-900 text-slate-300 border-r border-slate-800/60 transition-all duration-300 ease-in-out shrink-0',
        isCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3.5 top-7 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all z-50 shadow-lg"
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Logo */}
      <div className={cn('transition-all duration-300', isCollapsed ? 'px-4 pt-5 pb-4' : 'px-5 pt-6 pb-4')}>
        <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 ring-1 ring-white/10"
            aria-hidden
          >
            <Building2 className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
          <span
            className={cn(
              'text-lg font-bold text-white tracking-tight overflow-hidden transition-all duration-300',
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            {t('nav.appName')}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-800/80" />

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto transition-all duration-300 py-3 px-3">
        <nav className="space-y-0.5" aria-label="Main">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={isCollapsed ? item.label : undefined}
                onClick={() => {
                  if (item.id === 'portal') {
                    window.open(`${window.location.origin}/portal`, '_blank');
                    return;
                  }
                  if (item.id === 'agentPortal') {
                    window.open(`${window.location.origin}/agent-portal`, '_blank');
                    return;
                  }
                  setActiveTab(item.id);
                }}
                className={cn(
                  'relative w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                )}
              >
                {/* Left accent bar for active */}
                {isActive && !isCollapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-full" />
                )}
                <item.icon
                  className={cn(
                    'shrink-0 transition-colors',
                    isCollapsed ? 'w-5 h-5' : 'w-[17px] h-[17px]',
                    isActive ? 'text-indigo-400' : ''
                  )}
                />
                <span
                  className={cn(
                    'truncate transition-all duration-300 overflow-hidden',
                    isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
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
      <div className="border-t border-slate-800/80">
        {/* User profile card */}
        <div className={cn(
          'flex items-center gap-3 transition-all duration-300',
          isCollapsed ? 'justify-center p-3' : 'px-4 py-3.5'
        )}>
          <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold">
            {userInitials}
          </div>
          <div className={cn(
            'min-w-0 overflow-hidden transition-all duration-300',
            isCollapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100'
          )}>
            <p className="text-xs font-semibold text-slate-200 truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 truncate">{userRole}</p>
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
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;
  const { session, refreshSession } = useAuth();
  const { dateRange, setDateRange } = useDateRange();
  const socketRef = React.useRef<Socket | null>(null);
  const refreshTimeoutRef = React.useRef<number | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [themeLoading, setThemeLoading] = useState<SystemThemeMode | null>(null);
  const [currentTheme, setCurrentTheme] = useState<SystemThemeMode>('light');
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    createDefaultNotifications(t),
  );
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
    if (!session) return;
    void refreshNotifications();
    const id = window.setInterval(() => void refreshNotifications(), 30_000);
    return () => window.clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const token = getToken();
    const devUserId = localStorage.getItem('realstate_dev_user_id');
    const socket = io('http://localhost:2550', {
      transports: ['websocket'],
      auth: { token, devUserId },
    });
    socketRef.current = socket;

    socket.on('notifications:changed', () => {
      void refreshNotifications();
    });

    socket.on('access:changed', (payload: { roleId?: number } | undefined) => {
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

    return () => {
      socket.off('notifications:changed');
      socket.off('access:changed');
      socket.disconnect();
      socketRef.current = null;
      if (refreshTimeoutRef.current != null) window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    };
  }, [session]);
  const unreadCount = notifications.filter((n) => n.unread).length;

  function formatNotificationTime(value: string) {
    const v = String(value ?? '').trim();
    if (!v) return '';
    const dt = new Date(v);
    if (Number.isNaN(dt.getTime())) return v;
    return dt.toLocaleString();
  }

  async function openNotificationDetails(n: Notification) {
    setSelectedNotification(n);
    setNotificationDetailOpen(true);
    setNotificationOpen(false);
    if (!n.unread) return;

    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    try {
      await apiFetch(`/api/notifications/${encodeURIComponent(n.id)}/read`, { method: 'POST' });
    } catch {
      // ignore
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

  async function handleSystemThemeChange(mode: SystemThemeMode, originEl: HTMLElement | null) {
    if (themeLoading) return;
    setThemeLoading(mode);
    try {
      await setSystemTheme(mode);
      await animateThemeRippleFromElement({
        mode,
        element: originEl,
        onApplyTheme: () => applyTheme(mode),
      });
      toast.success(`System theme switched to ${mode}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch system theme.';
      toast.error(message);
    } finally {
      setThemeLoading(null);
    }
  }
  const nextTheme: SystemThemeMode = currentTheme === 'dark' ? 'light' : 'dark';
  const nextThemeLabel = nextTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder={t('header.searchPlaceholder')}
            className="h-9 rounded-full pl-10 pr-3 border border-[var(--border)] hover:border-slate-300 focus:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300 transition-all"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--control-bg) 70%, transparent)',
              borderColor: 'color-mix(in oklab, var(--border) 88%, #cbd5e1)',
            }}
          />
        </div>

        {showDateRangePicker && (
          <div className="shrink-0 min-w-[240px] max-w-[320px] w-full sm:w-auto">
            <AppDatePicker
              mode="range"
              value={pickerRange}
              onChange={(next) => handleDateRangeChange(next as [Date | null, Date | null])}
              placeholder="Date range"
              showPresets
              fullWidth
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-1">
          <span className="sr-only">{t('header.languageLabel')}</span>
          <Button
            variant={currentLanguage === 'en' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => i18n.changeLanguage('en')}
          >
            EN
          </Button>
          <Button
            variant={currentLanguage === 'ko' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => i18n.changeLanguage('ko')}
          >
            KO
          </Button>
        </div>
        <div className="hidden sm:flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 min-w-[92px] justify-center"
            onClick={(e) => void handleSystemThemeChange(nextTheme, e.currentTarget as HTMLElement)}
            disabled={themeLoading !== null}
            title={`Switch system to ${nextThemeLabel.toLowerCase()} mode`}
          >
            {nextTheme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 mr-1.5 transition-transform duration-300" />
            ) : (
              <Sun className="w-3.5 h-3.5 mr-1.5 transition-transform duration-300" />
            )}
            {themeLoading ? 'Switching...' : nextThemeLabel}
          </Button>
        </div>

        <div className="relative shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-10 w-10"
            aria-expanded={notificationOpen}
            aria-label={t('notifications.title')}
            onClick={() => setNotificationOpen((open) => !open)}
          >
            <Bell className="size-7 text-slate-600" />
            {unreadCount > 0 ? (
              <span
                className={cn(
                  'absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1',
                  'rounded-full bg-rose-600 text-white',
                  'text-[11px] font-bold leading-[20px] text-center',
                  'border-2 border-white dark:border-slate-900',
                  'shadow-sm',
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
            notifications={notifications}
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
        <div className="h-8 w-px bg-slate-200 hidden sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  'group flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md px-2 py-1.5 shadow-sm hover:shadow-md transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
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
                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform data-[popup-open]:rotate-180" />
              </button>
            }
          />
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/70 backdrop-blur-md shadow-xl"
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
