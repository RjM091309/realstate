import React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Building2, DollarSign, Wrench, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function formatTimeAgo(timeStr: string) {
  if (!timeStr) return '';
  try {
    // If timeStr is already localized like "2 mins ago", Date parsing might return Invalid Date
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    // Basic sanity check to avoid weird parses
    if (d.getFullYear() < 2000) return timeStr;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return timeStr;
  }
}

function formatAbsoluteTime(timeStr: string, locale: string) {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    if (Number.isNaN(d.getTime())) return '';
    if (d.getFullYear() < 2000) return '';
    return new Intl.DateTimeFormat(locale || undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

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
  onNotificationClick?: (notification: Notification) => void;
};

export function NotificationPanel({
  isOpen,
  onClose,
  notifications: notificationsProp,
  onMarkAllRead,
  onNotificationClick,
}: NotificationPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
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
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[45] bg-slate-900/15 dark:bg-black/40"
            aria-hidden
          />

          {/* Perspective stage — keeps 3D transforms readable */}
          <div className="pointer-events-none absolute right-0 top-full z-50 mt-3 [perspective:1400px]">
            {/* Entrance / exit + opening wobble */}
            <motion.div
              initial={{
                opacity: 0,
                y: -22,
                scale: 0.86,
                rotateX: 22,
                rotateY: -14,
                rotateZ: -3,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                rotateX: 0,
                rotateY: 0,
                rotateZ: [0, 2.8, -2.2, 1.4, -0.6, 0],
              }}
              exit={{
                opacity: 0,
                y: -14,
                scale: 0.92,
                rotateX: 14,
                rotateY: -8,
                rotateZ: 2,
                transition: { duration: 0.18, ease: 'easeIn' },
              }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 20,
                mass: 0.8,
                rotateZ: { duration: 0.65, ease: 'easeOut', delay: 0.05 },
              }}
              style={{ transformStyle: 'preserve-3d', transformOrigin: 'top right' }}
              className="pointer-events-auto"
            >
              {/* Idle float — subtle 3D hover while open */}
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={t('notifications.title')}
                animate={{
                  y: [0, -6, 0],
                  rotateX: [1.5, -1.5, 1.5],
                  rotateY: [-1.2, 1.2, -1.2],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                style={{ transformStyle: 'preserve-3d' }}
                className={cn(
                  'relative flex max-h-[min(28rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl',
                  'border border-white/70 dark:border-slate-700/60',
                  'bg-white/90 dark:bg-slate-950/75 backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl',
                  // Layered 3D floating shadow stack
                  'shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_28px_50px_-18px_rgba(15,23,42,0.45),0_12px_24px_-12px_rgba(75,137,205,0.35),0_2px_6px_rgba(15,23,42,0.08)]',
                  'dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_28px_50px_-14px_rgba(0,0,0,0.75),0_12px_28px_-10px_rgba(75,137,205,0.25)]',
                )}
              >
                {/* Soft specular highlight for glass/3D sheen */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/70 via-white/20 to-transparent dark:from-white/10 dark:via-white/5"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-brand-blue/20 blur-2xl dark:bg-brand-blue/25"
                />

                <div className="relative flex shrink-0 items-center justify-between px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <motion.div
                      animate={{ rotate: [0, -12, 10, -6, 0] }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/15 to-slate-100 text-brand-blue shadow-sm dark:from-brand-blue/25 dark:to-slate-800 dark:text-sky-300"
                    >
                      <Bell size={18} />
                    </motion.div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                        {t('notifications.title')}
                      </h3>
                      <p className="text-xs font-medium text-brand-muted dark:text-slate-400">
                        {t('notifications.unread_messages', { count: unreadCount })}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-brand-muted dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="custom-scrollbar relative min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                  {notifications.length > 0 ? (
                    notifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10, rotateX: 8 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 26,
                          delay: 0.06 + index * 0.04,
                        }}
                        role={onNotificationClick ? 'button' : undefined}
                        tabIndex={onNotificationClick ? 0 : undefined}
                        onClick={() => onNotificationClick?.(notification)}
                        onKeyDown={(e) => {
                          if (!onNotificationClick) return;
                          if (e.key === 'Enter' || e.key === ' ') onNotificationClick(notification);
                        }}
                        whileHover={{
                          y: -2,
                          scale: 1.01,
                          transition: { type: 'spring', stiffness: 500, damping: 28 },
                        }}
                        className={cn(
                          'cursor-pointer rounded-xl border p-3 transition-colors',
                          'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60',
                          notification.unread
                            ? [
                                'bg-brand-blue/10 border-brand-blue/20',
                                'shadow-[0_6px_18px_-10px_rgba(75,137,205,0.45)]',
                                'dark:bg-brand-blue/10 dark:border-brand-blue/30 dark:shadow-none',
                              ].join(' ')
                            : 'bg-white/50 border-transparent dark:bg-slate-950/20 opacity-80',
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                            {notification.type === 'lease' && <Building2 size={16} />}
                            {notification.type === 'payment' && <DollarSign size={16} />}
                            {notification.type === 'maintenance' && <Wrench size={16} />}
                            {notification.type === 'success' && <CheckCircle size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-start justify-between gap-2">
                              <h4
                                className={cn(
                                  'truncate text-sm leading-snug text-slate-900 dark:text-slate-100',
                                  notification.unread ? 'font-bold' : 'font-semibold',
                                )}
                              >
                                {notification.title}
                              </h4>
                              {notification.unread && (
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue dark:bg-brand-blue" />
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-brand-muted dark:text-slate-300/80 line-clamp-2">
                              {notification.message}
                            </p>
                            <span className="mt-1.5 inline-block text-[10px] font-medium tracking-wide text-brand-muted/70 dark:text-slate-400/80">
                              {(() => {
                                const ago = formatTimeAgo(notification.time);
                                const abs = formatAbsoluteTime(notification.time, locale);
                                return abs ? `${ago} • ${abs}` : ago;
                              })()}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-brand-muted dark:text-slate-400">
                      <Bell size={40} className="mb-3 opacity-20" />
                      <p className="text-sm font-medium">{t('notifications.no_notifications')}</p>
                    </div>
                  )}
                </div>

                {showMarkAll && (
                  <div className="relative shrink-0 p-3">
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className={cn(
                        'w-full cursor-pointer rounded-xl py-2.5 text-sm font-medium shadow-sm transition-colors',
                        'bg-white/80 dark:bg-slate-900/50 backdrop-blur',
                        'text-slate-700 dark:text-slate-100',
                        'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                        'border border-slate-200/70 dark:border-slate-700/50',
                      )}
                    >
                      {t('notifications.mark_all_as_read')}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
