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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useDateRange, toYYYYMMDD } from '@/context/DateRangeContext';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import { setSystemTheme, type SystemThemeMode } from '@/lib/systemThemeApi';
import { applyTheme } from '@/lib/theme';
import { toast } from 'sonner';
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

  const visibleOperational =
    allowedTabIds && allowedTabIds.length > 0
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
                    window.open(`${window.location.origin}${window.location.pathname}?view=portal`, '_blank');
                    return;
                  }
                  if (item.id === 'agentPortal') {
                    window.open(`${window.location.origin}${window.location.pathname}?view=agent-portal`, '_blank');
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

        {/* Settings & Logout */}
        <div className={cn('border-t border-slate-800/60 space-y-0.5', isCollapsed ? 'p-3' : 'px-3 py-3')}>
          <button
            title={isCollapsed ? t('nav.settings') : undefined}
            onClick={() => setActiveTab('settings')}
            className={cn(
              'w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150',
              isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
              activeTab === 'settings'
                ? 'bg-indigo-500/15 text-indigo-300'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
            )}
          >
            <Settings className={cn('shrink-0', isCollapsed ? 'w-5 h-5' : 'w-[17px] h-[17px]')} />
            <span className={cn(
              'truncate transition-all duration-300 overflow-hidden',
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}>
              {t('nav.settings')}
            </span>
          </button>
          <button
            type="button"
            title={isCollapsed ? t('nav.logout') : undefined}
            onClick={() => onLogout?.()}
            className={cn(
              'w-full flex items-center rounded-lg text-sm font-medium text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-150',
              isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            )}
          >
            <LogOut className={cn('shrink-0', isCollapsed ? 'w-5 h-5' : 'w-[17px] h-[17px]')} />
            <span className={cn(
              'truncate transition-all duration-300 overflow-hidden',
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}>
              {t('nav.logout')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function TopNav() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;
  const { session } = useAuth();
  const { dateRange, setDateRange } = useDateRange();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [themeLoading, setThemeLoading] = useState<SystemThemeMode | null>(null);
  const [currentTheme, setCurrentTheme] = useState<SystemThemeMode>('light');
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    createDefaultNotifications(t),
  );
  useEffect(() => {
    setNotifications((prev) => {
      const next = createDefaultNotifications(t);
      return next.map((n) => {
        const old = prev.find((p) => p.id === n.id);
        return old ? { ...n, unread: old.unread } : n;
      });
    });
  }, [t, i18n.language]);
  const unreadCount = notifications.filter((n) => n.unread).length;
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

  function handleDateRangeChange(next: [Date | null, Date | null]) {
    const [start, end] = next;
    setPickerRange(next);
    if (start != null && end != null) {
      setDateRange({ start: toYYYYMMDD(start), end: toYYYYMMDD(end) });
    }
  }

  async function handleSystemThemeChange(mode: SystemThemeMode) {
    if (themeLoading) return;
    setThemeLoading(mode);
    try {
      await setSystemTheme(mode);
      applyTheme(mode);
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
            onClick={() => void handleSystemThemeChange(nextTheme)}
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
            className="relative"
            aria-expanded={notificationOpen}
            aria-label={t('notifications.title')}
            onClick={() => setNotificationOpen((open) => !open)}
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {unreadCount > 0 ? (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500" />
            ) : null}
          </Button>
          <NotificationPanel
            isOpen={notificationOpen}
            onClose={() => setNotificationOpen(false)}
            notifications={notifications}
            onMarkAllRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
            }
          />
        </div>
        <div className="h-8 w-px bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{role}</p>
          </div>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>
              {(() => {
                const parts = name.split(/\s+/).filter(Boolean);
                if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
                return name.slice(0, 2).toUpperCase() || 'U';
              })()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
