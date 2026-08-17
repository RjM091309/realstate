import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isValid, parseISO } from 'date-fns';
import { Ban, Loader2, Plus, Search, ShieldAlert, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BlacklistFormModal } from '@/components/blacklist/BlacklistFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import {
  fetchBlacklist,
  removeBlacklistById,
  type BlacklistRecord,
  type BlacklistTypeFilter,
} from '@/lib/blacklistApi';
import { entityTypeLabel } from '@/lib/blacklistUtils';

type BlacklistPanelProps = {
  canCreate?: boolean;
  canUpdate?: boolean;
};

const TAB_BTN =
  'h-8 rounded-lg px-3 text-xs font-semibold transition-colors';

function formatRowDate(value: string): string {
  if (!value?.trim()) return '—';
  try {
    const d = parseISO(value.length === 10 ? value : value);
    if (isValid(d)) return format(d, 'MMM d, yyyy');
  } catch {
    // keep raw
  }
  return value;
}

export function BlacklistPanel({ canCreate = false, canUpdate = false }: BlacklistPanelProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<BlacklistRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState<BlacklistTypeFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchBlacklist({ type: typeFilter, search: searchQuery });
      setRecords(list);
    } catch {
      setRecords([]);
      toast.warning(t('views.crm.blacklist.loadError'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, t, typeFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSearchSubmit = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') handleSearchSubmit();
  };

  const handleRemove = async (record: BlacklistRecord) => {
    if (!canUpdate) return;
    if (!window.confirm(t('views.crm.blacklist.removeConfirm', { name: record.name }))) return;
    setRemovingId(record.id);
    try {
      await removeBlacklistById(record.id);
      toast.success(t('views.crm.blacklist.removed'));
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.blacklist.removeError'));
    } finally {
      setRemovingId(null);
    }
  };

  const typeTabs = useMemo(
    () =>
      [
        { id: 'all' as const, label: t('views.crm.blacklist.filters.all') },
        { id: 'tenant' as const, label: t('views.crm.blacklist.tenant') },
        { id: 'broker' as const, label: t('views.crm.blacklist.broker') },
      ] satisfies { id: BlacklistTypeFilter; label: string }[],
    [t],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 shrink-0 text-rose-500" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {t('views.crm.blacklist.title')}
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {t('views.crm.blacklist.description')}
          </p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            className="h-9 shrink-0 rounded-xl bg-brand-blue text-white shadow-sm hover:bg-[#3d7ab8]"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t('views.crm.blacklist.addRecord')}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {typeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                TAB_BTN,
                typeFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
              onClick={() => setTypeFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => {
              const next = e.target.value;
              setSearchInput(next);
              if (!next.trim()) setSearchQuery('');
            }}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => {
              if (searchInput.trim() !== searchQuery) handleSearchSubmit();
            }}
            placeholder={t('views.crm.blacklist.searchPlaceholder')}
            className="h-9 rounded-xl border-transparent bg-white pl-9 pr-3 text-sm shadow-sm dark:border-transparent dark:bg-slate-950/80"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-900">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('views.crm.blacklist.loading')}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <ShieldAlert className="mb-3 h-10 w-10 text-rose-300 dark:text-rose-700" aria-hidden />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('views.crm.blacklist.emptyCards')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((row) => (
              <li
                key={row.id}
                className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                    <StatusBadge
                      tone={row.entityType === 'broker' ? 'neutral' : 'danger'}
                      className="!px-2 !py-0.5 !text-[10px]"
                    >
                      {entityTypeLabel(row, t)}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{row.reason}</p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {t('views.crm.blacklist.dateAdded')}
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums text-slate-700 dark:text-slate-200">
                    {formatRowDate(row.date)}
                  </p>
                </div>

                {canUpdate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-lg border-slate-200 px-2.5 text-xs font-semibold text-slate-600 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 dark:border-slate-700 dark:text-slate-300"
                    onClick={() => void handleRemove(row)}
                    disabled={removingId === row.id}
                    title={t('views.crm.blacklist.whitelist')}
                  >
                    {removingId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <UserMinus className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
                        <span>{t('views.crm.blacklist.whitelist')}</span>
                      </>
                    )}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <BlacklistFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
