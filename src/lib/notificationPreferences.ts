/** Persisted in localStorage; drives Settings + header bell filtering. */

export const NOTIFICATION_TYPES = ['lease', 'payment', 'maintenance', 'success'] as const;
export type NotificationTypeFilter = (typeof NOTIFICATION_TYPES)[number];

const STORAGE_KEY = 'realstate_notification_preferences';

export type NotificationPreferences = {
  inAppMaster: boolean;
  inAppByType: Record<NotificationTypeFilter, boolean>;
  emailPayments: boolean;
  emailLeaseContracts: boolean;
  emailMaintenance: boolean;
  emailWeeklyDigest: boolean;
};

export const defaultNotificationPreferences = (): NotificationPreferences => ({
  inAppMaster: true,
  inAppByType: {
    lease: true,
    payment: true,
    maintenance: true,
    success: true,
  },
  emailPayments: true,
  emailLeaseContracts: true,
  emailMaintenance: true,
  emailWeeklyDigest: false,
});

export function loadNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNotificationPreferences();
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences> | null;
    if (!parsed || typeof parsed !== 'object') return defaultNotificationPreferences();
    const base = defaultNotificationPreferences();
    return {
      ...base,
      ...parsed,
      inAppByType: { ...base.inAppByType, ...parsed.inAppByType },
    };
  } catch {
    return defaultNotificationPreferences();
  }
}

export function saveNotificationPreferences(next: NotificationPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('realstate-notification-prefs-changed'));
}

/** Subscribe to same-tab saves and cross-tab storage sync. */
export function subscribeNotificationPreferences(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  const onCustom = () => onChange();
  window.addEventListener('storage', onStorage);
  window.addEventListener('realstate-notification-prefs-changed', onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('realstate-notification-prefs-changed', onCustom);
  };
}

export function filterNotificationsByPreferences<
  T extends { type: NotificationTypeFilter | string },
>(list: T[], prefs: NotificationPreferences): T[] {
  if (!prefs.inAppMaster) return [];
  return list.filter((n) => {
    const key = n.type as NotificationTypeFilter;
    if (key in prefs.inAppByType) {
      return prefs.inAppByType[key];
    }
    return true;
  });
}

export function effectiveUnreadCount<
  T extends { type: NotificationTypeFilter | string; unread: boolean },
>(list: T[], prefs: NotificationPreferences): number {
  return filterNotificationsByPreferences(list, prefs).filter((n) => n.unread).length;
}
