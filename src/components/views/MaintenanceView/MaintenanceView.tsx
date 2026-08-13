import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  UserRound,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { MetricStatCard } from '@/components/MetricStatCard';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  fetchMaintenanceRequests,
  updateMaintenanceRequestStatus,
  type MaintenanceRequestRow,
  type MaintenanceStatus,
} from '@/lib/specialRequestsApi';
import { maintenanceStatusVariant, statusBadgeClass } from '@/lib/statusBadge';

type StatusFilter = 'all' | MaintenanceStatus;

const PAGE_VARIANTS = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 320, damping: 28 },
  },
};

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_TABS: StatusFilter[] = ['all', 'open', 'in_progress', 'resolved', 'cancelled'];

export function MaintenanceView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canUpdate = Boolean(session?.crud?.maintenance?.update);

  const [requests, setRequests] = useState<MaintenanceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<MaintenanceRequestRow | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchMaintenanceRequests();
      setRequests(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('views.maintenance.loadError'));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const stats = useMemo(() => {
    const open = requests.filter((r) => r.status === 'open').length;
    const inProgress = requests.filter((r) => r.status === 'in_progress').length;
    const resolved = requests.filter((r) => r.status === 'resolved').length;
    return { total: requests.length, open, inProgress, resolved };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!needle) return true;
      return [
        r.id,
        r.title,
        r.details,
        r.contractNo,
        r.unitLabel,
        r.buildingName,
        r.tenantName,
        r.status,
        r.requestSource,
        r.createdAt,
      ].some((value) => String(value ?? '').toLowerCase().includes(needle));
    });
  }, [query, requests, statusFilter]);

  const handleStatusChange = async (status: MaintenanceStatus) => {
    if (!selected || !canUpdate) return;
    setSavingStatus(true);
    try {
      const updated = await updateMaintenanceRequestStatus(selected.id, status);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelected(updated);
      toast.success(t('views.maintenance.statusUpdated'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.maintenance.statusUpdateError'));
    } finally {
      setSavingStatus(false);
    }
  };

  const columns: ColumnDef<MaintenanceRequestRow>[] = useMemo(
    () => [
      {
        header: t('views.maintenance.columns.ticket'),
        render: (row) => (
          <div className="min-w-[180px]">
            <div className="font-medium text-slate-900 dark:text-white">{row.title}</div>
            <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">#{row.id}</div>
          </div>
        ),
      },
      {
        header: t('views.maintenance.columns.unit'),
        render: (row) => (
          <div className="min-w-[120px]">
            <div className="font-medium text-slate-800 dark:text-slate-200">{row.unitLabel || '—'}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{row.buildingName || '—'}</div>
          </div>
        ),
      },
      {
        header: t('views.maintenance.columns.tenant'),
        render: (row) => (
          <div className="flex min-w-[120px] items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="text-sm text-slate-700 dark:text-slate-200">{row.tenantName || '—'}</span>
          </div>
        ),
      },
      {
        header: t('views.maintenance.columns.contract'),
        render: (row) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{row.contractNo || '—'}</span>
        ),
      },
      {
        header: t('views.maintenance.columns.status'),
        render: (row) => (
          <motion.div
            animate={row.status === 'open' ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={row.status === 'open' ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
          >
            <Badge className={statusBadgeClass(maintenanceStatusVariant(row.status))}>
              {t(`views.maintenance.statuses.${row.status}`, { defaultValue: formatLabel(row.status) })}
            </Badge>
          </motion.div>
        ),
      },
      {
        header: t('views.maintenance.columns.source'),
        render: (row) => (
          <span className="text-sm capitalize text-slate-600 dark:text-slate-300">
            {formatLabel(row.requestSource ?? 'tenant')}
          </span>
        ),
      },
      {
        header: t('views.maintenance.columns.reported'),
        render: (row) => (
          <div className="min-w-[130px] font-mono text-xs text-slate-600 dark:text-slate-300">{row.createdAt || '—'}</div>
        ),
      },
      {
        header: '',
        render: (row) => (
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
              onClick={() => setSelected(row)}
            >
              {t('views.maintenance.viewDetails')}
            </Button>
          </motion.div>
        ),
      },
    ],
    [t],
  );

  const statItems = [
    {
      label: t('views.maintenance.stats.open'),
      value: stats.open,
      subtext: t('views.maintenance.stats.openHint'),
      subtextVariant: stats.open > 0 ? ('alert' as const) : ('neutral' as const),
      iconColor: 'bg-brand-orange',
      icon: <AlertCircle className="h-6 w-6" />,
      filter: 'open' as StatusFilter,
    },
    {
      label: t('views.maintenance.stats.inProgress'),
      value: stats.inProgress,
      subtext: t('views.maintenance.stats.inProgressHint'),
      subtextVariant: stats.inProgress > 0 ? ('up' as const) : ('neutral' as const),
      iconColor: 'bg-brand-blue',
      icon: <Clock3 className="h-6 w-6" />,
      filter: 'in_progress' as StatusFilter,
    },
    {
      label: t('views.maintenance.stats.resolved'),
      value: stats.resolved,
      subtext: t('views.maintenance.stats.resolvedHint'),
      subtextVariant: stats.resolved > 0 ? ('up' as const) : ('neutral' as const),
      iconColor: 'bg-brand-green',
      icon: <CheckCircle2 className="h-6 w-6" />,
      filter: 'resolved' as StatusFilter,
    },
    {
      label: t('views.maintenance.stats.total'),
      value: stats.total,
      subtext: t('views.maintenance.stats.totalHint'),
      subtextVariant: 'neutral' as const,
      iconColor: 'bg-[#334155]',
      icon: <Wrench className="h-6 w-6" />,
      filter: 'all' as StatusFilter,
    },
  ];

  return (
    <motion.div className="space-y-6" variants={PAGE_VARIANTS} initial="hidden" animate="show">
      <motion.div variants={SECTION_VARIANTS}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('views.maintenance.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('views.maintenance.subtitle')}</p>
      </motion.div>

      <motion.div variants={SECTION_VARIANTS} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statItems.map((item, index) => (
          <MetricStatCard
            key={item.label}
            index={index}
            label={item.label}
            value={item.value}
            subtext={item.subtext}
            subtextVariant={item.subtextVariant}
            iconColor={item.iconColor}
            icon={item.icon}
            onClick={() => setStatusFilter(item.filter)}
            subtextLink={false}
          />
        ))}
      </motion.div>

      <motion.div variants={SECTION_VARIANTS}>
        <Card className="overflow-hidden border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.2 }}
                    >
                      <Building2 className="h-5 w-5 text-brand-blue" />
                    </motion.span>
                    {t('views.maintenance.ticketsTitle')}
                  </CardTitle>
                  <CardDescription>{t('views.maintenance.ticketsDesc')}</CardDescription>
                </div>
                <div className="relative min-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('views.maintenance.searchPlaceholder')}
                    className="h-10 rounded-xl border-slate-200 bg-white pl-9 transition-[border-color,box-shadow] focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map((tab, tabIndex) => {
                  const count = tab === 'all' ? requests.length : requests.filter((r) => r.status === tab).length;
                  const active = statusFilter === tab;
                  return (
                    <motion.button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 + tabIndex * 0.04, duration: 0.3 }}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        'relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                        active
                          ? 'border-brand-blue bg-brand-blue text-white shadow-md shadow-brand-blue/25'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-blue/30 hover:text-brand-blue dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300',
                      )}
                    >
                      {t(`views.maintenance.tabs.${tab}`)}
                      <motion.span
                        key={`${tab}-${count}`}
                        initial={{ scale: 0.85, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px]',
                          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                        )}
                      >
                        {count}
                      </motion.span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="m-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              ) : null}

              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                  <p className="text-sm">{t('common.loading')}</p>
                </motion.div>
              ) : filteredRequests.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                  className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 text-center"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0], rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Wrench className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                  </motion.div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('views.maintenance.emptyTitle')}</p>
                  <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{t('views.maintenance.emptyDesc')}</p>
                </motion.div>
              ) : (
                <motion.div
                  key={`table-${statusFilter}-${query}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  <DataTable data={filteredRequests} columns={columns} keyExtractor={(row) => row.id} embedded />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? t('views.maintenance.detailTitle')}
        maxWidth="lg"
      >
        {selected ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={statusBadgeClass(maintenanceStatusVariant(selected.status))}>
                {t(`views.maintenance.statuses.${selected.status}`, { defaultValue: formatLabel(selected.status) })}
              </Badge>
              <span className="font-mono text-xs text-slate-500">#{selected.id}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: t('views.maintenance.detail.unit'), value: selected.unitLabel },
                { label: t('views.maintenance.detail.building'), value: selected.buildingName },
                { label: t('views.maintenance.detail.tenant'), value: selected.tenantName },
                { label: t('views.maintenance.detail.contract'), value: selected.contractNo },
                { label: t('views.maintenance.detail.reported'), value: selected.createdAt },
                { label: t('views.maintenance.detail.updated'), value: selected.updatedAt },
              ].map((field, i) => (
                <motion.div
                  key={field.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.25 }}
                >
                  <DetailField label={field.label} value={field.value} />
                </motion.div>
              ))}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('views.maintenance.detail.description')}
              </p>
              <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {selected.details}
              </p>
            </div>

            {canUpdate ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('views.maintenance.detail.updateStatus')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['open', 'in_progress', 'resolved', 'cancelled'] as MaintenanceStatus[]).map((status) => (
                    <motion.div key={status} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                      <Button
                        type="button"
                        size="sm"
                        variant={selected.status === status ? 'default' : 'outline'}
                        className={cn(
                          'rounded-lg',
                          selected.status === status && 'bg-brand-blue hover:bg-[#3d7ab8]',
                        )}
                        disabled={savingStatus || selected.status === status}
                        onClick={() => void handleStatusChange(status)}
                      >
                        {t(`views.maintenance.statuses.${status}`, { defaultValue: formatLabel(status) })}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t('views.maintenance.readOnlyHint')}</p>
            )}
          </motion.div>
        ) : null}
      </Modal>
    </motion.div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{value?.trim() ? value : '—'}</p>
    </div>
  );
}
