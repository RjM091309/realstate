import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Database, History, Loader2, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { cn } from '@/lib/utils';
import { fetchAuditLogs, type AuditLog } from '@/lib/auditLogsApi';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionBadgeClass(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes('delete') || normalized.includes('remove') || normalized.includes('void')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30';
  }
  if (normalized.includes('update') || normalized.includes('edit') || normalized.includes('renew')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
  }
  if (normalized.includes('create') || normalized.includes('upload') || normalized.includes('issue')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
  }
  return 'bg-brand-blue/10 text-brand-blue border-brand-blue/20 dark:bg-brand-blue/15 dark:text-brand-blue dark:border-brand-blue/30';
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/15 dark:text-brand-blue">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export function AuditLogsView() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const next = await fetchAuditLogs({ limit: 200 });
      setLogs(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('views.auditLogs.loadError'));
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadLogs('initial');
  }, [loadLogs]);

  const modules = useMemo(() => uniqueSorted(logs.map((log) => log.moduleName)), [logs]);
  const actions = useMemo(() => uniqueSorted(logs.map((log) => log.action)), [logs]);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (moduleFilter !== 'all' && log.moduleName !== moduleFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (!needle) return true;
      return [
        log.id,
        log.actorUserId,
        log.moduleName,
        log.recordTable,
        log.recordId,
        log.action,
        log.changeSummary,
        log.createdAt,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [actionFilter, logs, moduleFilter, query]);

  const recentActors = useMemo(() => new Set(logs.map((log) => log.actorUserId).filter(Boolean)).size, [logs]);

  const columns: ColumnDef<AuditLog>[] = useMemo(
    () => [
      {
        header: t('views.auditLogs.columns.time'),
        render: (log) => (
          <div className="min-w-[150px] font-mono text-xs text-slate-700 dark:text-slate-300">{log.createdAt || '—'}</div>
        ),
      },
      {
        header: t('views.auditLogs.columns.actor'),
        render: (log) => (
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {log.actorUserId || '?'}
            </span>
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {log.actorUserId ? t('views.auditLogs.actorLabel', { id: log.actorUserId }) : t('views.auditLogs.systemActor')}
            </span>
          </div>
        ),
      },
      {
        header: t('views.auditLogs.columns.module'),
        render: (log) => (
          <div>
            <div className="font-medium text-slate-900 dark:text-white">{formatLabel(log.moduleName) || '—'}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{formatLabel(log.recordTable) || '—'}</div>
          </div>
        ),
      },
      {
        header: t('views.auditLogs.columns.record'),
        render: (log) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
            {log.recordId ? `#${log.recordId}` : '—'}
          </span>
        ),
      },
      {
        header: t('views.auditLogs.columns.action'),
        render: (log) => (
          <Badge className={cn('border font-medium', actionBadgeClass(log.action))}>{formatLabel(log.action) || '—'}</Badge>
        ),
      },
      {
        header: t('views.auditLogs.columns.summary'),
        render: (log) => (
          <p className="max-w-xl whitespace-normal text-sm leading-6 text-slate-700 dark:text-slate-300">
            {log.changeSummary || t('views.auditLogs.noSummary')}
          </p>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue dark:border-brand-blue/20 dark:bg-brand-blue/10 dark:text-brand-blue">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('views.auditLogs.badge')}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('views.auditLogs.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('views.auditLogs.subtitle')}</p>
        </div>
        <Button
          type="button"
          className="w-full bg-brand-blue text-white hover:bg-[#3d7ab8] sm:w-auto dark:bg-brand-blue dark:hover:bg-[#3d7ab8]"
          onClick={() => void loadLogs('refresh')}
          disabled={loading || refreshing}
        >
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {t('views.auditLogs.refresh')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={t('views.auditLogs.stats.total')} value={logs.length} icon={<History className="h-5 w-5" />} />
        <StatCard label={t('views.auditLogs.stats.modules')} value={modules.length} icon={<Database className="h-5 w-5" />} />
        <StatCard label={t('views.auditLogs.stats.actors')} value={recentActors} icon={<UserRound className="h-5 w-5" />} />
      </div>

      <Card className="border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-brand-blue dark:text-brand-blue" />
                {t('views.auditLogs.activityTitle')}
              </CardTitle>
              <CardDescription>{t('views.auditLogs.activityDesc')}</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('views.auditLogs.searchPlaceholder')}
                  className="h-10 rounded-xl border-slate-200 bg-white pl-9 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-brand-blue dark:focus:ring-brand-blue/40"
              >
                <option value="all">{t('views.auditLogs.allModules')}</option>
                {modules.map((moduleName) => (
                  <option key={moduleName} value={moduleName}>
                    {formatLabel(moduleName)}
                  </option>
                ))}
              </select>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-brand-blue dark:focus:ring-brand-blue/40"
              >
                <option value="all">{t('views.auditLogs.allActions')}</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {formatLabel(action)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="m-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {loading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-brand-blue dark:text-brand-blue" />
              <p className="text-sm">{t('common.loading')}</p>
            </div>
          ) : (
            <DataTable
              data={filteredLogs}
              columns={columns}
              keyExtractor={(log) => log.id}
                            embedded
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
