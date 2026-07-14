import { format, isValid, parseISO } from 'date-fns';
import type { BlacklistEntityType, BlacklistRecord, BlacklistTypeFilter } from '@/lib/blacklistApi';

export type BlacklistFilters = {
  type: BlacklistTypeFilter;
  search: string;
};

export const DEFAULT_BLACKLIST_FILTERS: BlacklistFilters = {
  type: 'all',
  search: '',
};

export function formatBlacklistDate(value?: string): string {
  if (!value?.trim()) return '—';
  try {
    const d = parseISO(value.length === 10 ? value : value);
    if (isValid(d)) return format(d, 'MMM d, yyyy');
  } catch {
    // fall through
  }
  return value;
}

export function entityTypeLabel(
  record: Pick<BlacklistRecord, 'entityType' | 'type'>,
  t: (key: string) => string,
): string {
  return record.entityType === 'broker'
    ? t('views.crm.blacklist.broker')
    : t('views.crm.blacklist.tenant');
}

export function entityTypeTone(entityType: BlacklistEntityType): 'rose' | 'slate' {
  return entityType === 'broker' ? 'slate' : 'rose';
}

export function filterBlacklistClientSide(
  records: BlacklistRecord[],
  filters: BlacklistFilters,
): BlacklistRecord[] {
  const q = filters.search.trim().toLowerCase();
  const typeFiltered =
    filters.type === 'all'
      ? records
      : records.filter((r) => r.entityType === filters.type);

  if (!q) return typeFiltered;

  return typeFiltered.filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      row.reason.toLowerCase().includes(q) ||
      (row.email ?? '').toLowerCase().includes(q) ||
      (row.phone ?? '').includes(q) ||
      (row.governmentId ?? '').toLowerCase().includes(q),
  );
}

export function emptyBlacklistForm() {
  return {
    entityType: 'tenant' as BlacklistEntityType,
    name: '',
    email: '',
    phone: '',
    governmentId: '',
    reason: '',
  };
}

export type BlacklistFormState = ReturnType<typeof emptyBlacklistForm>;
