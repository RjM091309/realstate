import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  Calendar, 
  Settings,
  LogOut,
  Search,
  Bell,
  UserCircle,
  Briefcase,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useDateRange, toYYYYMMDD } from '@/context/DateRangeContext';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
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
  const operationalItems = [
    { id: 'dashboard', label: t('nav.menu.dashboard'), icon: LayoutDashboard },
    { id: 'units', label: t('nav.menu.units'), icon: Building2 },
    { id: 'contracts', label: t('nav.menu.contracts'), icon: FileText },
    { id: 'crm', label: t('nav.menu.crm'), icon: Users },
    { id: 'ledger', label: t('nav.menu.ledger'), icon: FileText },
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

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800">
      <div className="p-6">
        <div className="flex items-center gap-2.5 mb-8">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-white/10"
            aria-hidden
          >
            <Building2 className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">{t('nav.appName')}</span>
        </div>

        <nav className="space-y-0.5" aria-label="Main">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'portal') {
                  const url = `${window.location.origin}${window.location.pathname}?view=portal`;
                  window.open(url, '_blank');
                  return;
                }
                if (item.id === 'agentPortal') {
                  const url = `${window.location.origin}${window.location.pathname}?view=agent-portal`;
                  window.open(url, '_blank');
                  return;
                }
                setActiveTab(item.id);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0 opacity-90" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors">
          <Settings className="w-4 h-4" />
          {t('nav.settings')}
        </button>
        <button
          type="button"
          onClick={() => onLogout?.()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-rose-400 hover:bg-rose-900/20 transition-colors mt-1"
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </button>
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

  return (
    <header className="h-16 border-bottom bg-white flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
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
        <div className="hidden sm:flex items-center gap-1 rounded-md border border-slate-200 p-1">
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
