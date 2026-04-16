import React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Building2, DollarSign, Wrench, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NotificationType = 'lease' | 'payment' | 'maintenance' | 'success';

export type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  type: NotificationType;
  unread: boolean;
};

/** Sample notifications for demos; replace with API-driven data in production. */
export function createDefaultNotifications(t: TFunction): Notification[] {
  return [
    {
      id: '1',
      title: t('notifications.lease_inquiry_title'),
      message: t('notifications.lease_inquiry_message'),
      time: t('notifications.time_2_mins_ago'),
      type: 'lease',
      unread: true,
    },
    {
      id: '2',
      title: t('notifications.rent_payment_title'),
      message: t('notifications.rent_payment_message'),
      time: t('notifications.time_15_mins_ago'),
      type: 'payment',
      unread: true,
    },
    {
      id: '3',
      title: t('notifications.maintenance_title'),
      message: t('notifications.maintenance_message'),
      time: t('notifications.time_1_hour_ago'),
      type: 'maintenance',
      unread: false,
    },
    {
      id: '4',
      title: t('notifications.lease_signed_title'),
      message: t('notifications.lease_signed_message'),
      time: t('notifications.time_2_hours_ago'),
      type: 'success',
      unread: false,
    },
  ];
}

type NotificationPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  /** When omitted, the panel loads translated defaults and manages unread locally. */
  notifications?: Notification[];
  onMarkAllRead?: () => void;
};

export function NotificationPanel({
  isOpen,
  onClose,
  notifications: notificationsProp,
  onMarkAllRead,
}: NotificationPanelProps) {
  const { t } = useTranslation();
  const defaults = React.useMemo(() => createDefaultNotifications(t), [t]);

  const [internalList, setInternalList] = React.useState<Notification[]>(defaults);
  React.useEffect(() => {
    setInternalList(defaults);
  }, [defaults]);

  const isControlled = notificationsProp !== undefined;
  const notifications = isControlled ? notificationsProp : internalList;

  const unreadCount = notifications.filter((n) => n.unread).length;

  function handleMarkAllRead() {
    if (onMarkAllRead) {
      onMarkAllRead();
      return;
    }
    if (!isControlled) {
      setInternalList((prev) => prev.map((n) => ({ ...n, unread: false })));
    }
  }

  const showMarkAll = Boolean(onMarkAllRead) || !isControlled;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[45] bg-black/10"
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('notifications.title')}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(28rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl ring-1 ring-black/5"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Bell size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold leading-tight">{t('notifications.title')}</h3>
                  <p className="text-xs font-medium text-brand-muted">
                    {t('notifications.unread_messages', { count: unreadCount })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 cursor-pointer rounded-lg p-2 text-brand-muted transition-colors hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'cursor-pointer rounded-xl border border-transparent p-3 transition-colors hover:bg-slate-50',
                      notification.unread ? 'bg-slate-50/80' : 'bg-white',
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        {notification.type === 'lease' && <Building2 size={16} />}
                        {notification.type === 'payment' && <DollarSign size={16} />}
                        {notification.type === 'maintenance' && <Wrench size={16} />}
                        {notification.type === 'success' && <CheckCircle size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-start justify-between gap-2">
                          <h4 className="truncate text-sm font-semibold leading-snug">{notification.title}</h4>
                          {notification.unread && (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-brand-muted line-clamp-2">{notification.message}</p>
                        <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-brand-muted/70">
                          {notification.time}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-brand-muted">
                  <Bell size={40} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">{t('notifications.no_notifications')}</p>
                </div>
              )}
            </div>

            {showMarkAll && (
              <div className="shrink-0 border-t border-slate-100 p-3">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  {t('notifications.mark_all_as_read')}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
