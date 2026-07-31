import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, TrendingUp, Users, CalendarDays, PhoneCall, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { contractStatusVariant } from '@/lib/statusBadge';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Contract, Tenant, Unit } from '@/types';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { useAuth } from '@/context/AuthContext';

export function AgentPortalView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const agentName = useMemo(() => {
    const fn = session?.user?.firstName ?? '';
    const ln = session?.user?.lastName ?? '';
    const full = `${fn} ${ln}`.trim();
    return full || session?.user?.username || 'Agent';
  }, [session?.user?.firstName, session?.user?.lastName, session?.user?.username]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [c, u, t0] = await Promise.all([fetchContracts(), fetchUnits(), fetchTenants()]);
        if (cancelled) return;
        setContracts(c);
        setUnits(u);
        setTenants(t0);
      } catch {
        if (cancelled) return;
        setContracts([]);
        setUnits([]);
        setTenants([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const assignedContracts = useMemo(() => {
    const uid = session?.user?.id;
    if (!uid) return [];
    const raw = String(uid);
    const legacy = `a${raw}`;
    return contracts.filter((c) => String(c.agentId) === raw || String(c.agentId) === legacy);
  }, [contracts, session?.user?.id]);

  const clientCount = useMemo(() => new Set(assignedContracts.map((c) => c.tenantId)).size, [assignedContracts]);

  const contractColumns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        header: t('views.agentPortal.contracts.unit'),
        render: (contract) => {
          const unit = units.find((u) => String(u.id) === String(contract.unitId));
          return <span>{unit?.unitNumber ?? '—'}</span>;
        },
      },
      {
        header: t('views.agentPortal.contracts.tenant'),
        render: (contract) => {
          const tenant = tenants.find((x) => String(x.id) === String(contract.tenantId));
          return <span>{tenant?.name ?? '—'}</span>;
        },
      },
      {
        header: t('views.agentPortal.contracts.endDate'),
        render: (contract) => <span>{format(new Date(contract.endDate), 'MMM dd, yyyy')}</span>,
      },
      {
        header: t('views.agentPortal.contracts.status'),
        render: (contract) => {
          const { status } = contract;
          const label =
            status === 'Active'
              ? t('views.agentPortal.contracts.active')
              : status === 'Expired'
                ? t('views.agentPortal.contracts.expired')
                : status === 'Terminated'
                  ? t('views.agentPortal.contracts.terminated')
                  : status;
          const variant = contractStatusVariant(status);

          return (
            <StatusBadge tone={variant}>
              {label}
            </StatusBadge>
          );
        },
      },
    ],
    [t, units, tenants]
  );

  const openResource = (docKey: 'contractTemplates' | 'rateCards' | 'policyGuide') => {
    const map: Record<typeof docKey, string> = {
      contractTemplates: '/resources/contract-templates.html',
      rateCards: '/resources/rate-cards.html',
      policyGuide: '/resources/policy-guide.html',
    };
    const url = `${window.location.origin}${map[docKey]}`;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) toast.error('Popup blocked. Please allow popups then try again.');
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 animate-in fade-in duration-500 dark:bg-slate-950 dark:text-slate-100">
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-800 via-indigo-700 to-indigo-950 text-white shadow-[inset_0_-1px_0_0_rgb(255_255_255/0.08)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-20%,rgb(196_181_253/0.35),transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
            <div className="flex min-w-0 flex-1 items-center gap-4 lg:border-r lg:border-white/[0.18] lg:pr-10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <Briefcase className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 py-0.5">
                <div className="text-sm font-medium tracking-wide text-white/75">{t('views.agentPortal.portalLabel')}</div>
                <h1 className="mt-0.5 truncate text-2xl font-bold sm:text-3xl">{t('views.agentPortal.welcome', { name: agentName })}</h1>
                <div className="mt-1 truncate text-sm text-white/75">{t('views.agentPortal.subtitle')}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:min-w-[min(100%,20rem)] lg:flex-col lg:justify-center lg:pl-10 xl:min-w-[22rem] xl:flex-row xl:flex-wrap xl:items-center">
              <Button
                type="button"
                className="h-9 border border-white/40 !bg-white !text-indigo-700 shadow-sm hover:!bg-indigo-50 hover:!text-indigo-800 dark:border-white/50 dark:!bg-white dark:!text-indigo-800 dark:hover:!bg-indigo-50 dark:hover:!text-indigo-900"
              >
                <PhoneCall className="mr-2 h-4 w-4" aria-hidden />
                {t('views.agentPortal.contactManagement')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/[0.04] dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-stretch">
          <main className="min-w-0 flex-1 space-y-6 bg-white p-6 sm:p-8 dark:bg-slate-950">
            <Card className="border border-slate-200/80 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/50 dark:hover:border-slate-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-700 dark:text-indigo-400" aria-hidden />
                  {t('views.agentPortal.overview.title')}
                </CardTitle>
                <CardDescription className="dark:text-slate-400">{t('views.agentPortal.overview.description')}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    {t('views.agentPortal.stats.activeDeals')}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{assignedContracts.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {t('views.agentPortal.stats.clients')}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{clientCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {t('views.agentPortal.stats.upcomingRenewals')}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {assignedContracts.filter((c) => c.status === 'Active').length}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/80 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/50 dark:hover:border-slate-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-700 dark:text-indigo-400" aria-hidden />
                  {t('views.agentPortal.contracts.title')}
                </CardTitle>
                <CardDescription className="dark:text-slate-400">{t('views.agentPortal.contracts.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-10 text-sm text-slate-500 dark:text-slate-400">Loading contracts…</div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/50">
                    <DataTable
                      data={assignedContracts}
                      columns={contractColumns}
                      keyExtractor={(c) => c.id}
                      embedded
                      highlightFirstColumn={false}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </main>

          <aside className="min-w-0 space-y-6 border-t border-slate-200/90 bg-slate-50/80 p-6 sm:p-8 lg:w-[min(22rem,100%)] lg:shrink-0 lg:border-t-0 lg:border-l lg:border-slate-200/90 dark:border-slate-800 dark:bg-slate-950/80">
            <section className="space-y-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-indigo-700 dark:text-indigo-400" aria-hidden />
                  {t('views.agentPortal.tasks.title')}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('views.agentPortal.tasks.description')}</p>
              </div>
              <div className="space-y-2">
                {['followUps', 'scheduleVisits', 'sendProposals'].map((taskKey) => (
                  <div
                    key={taskKey}
                    className="rounded-xl border border-slate-200/90 bg-white p-3 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-slate-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                        <span className="leading-snug">{t(`views.agentPortal.tasks.${taskKey}`)}</span>
                      </div>
                      <Badge variant="outline" className="shrink-0 dark:border-slate-600 dark:text-slate-300">
                        {t('views.agentPortal.tasks.today')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-200/80 pt-6 dark:border-slate-800">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  <FileText className="h-4 w-4 text-indigo-700 dark:text-indigo-400" aria-hidden />
                  {t('views.agentPortal.docs.title')}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('views.agentPortal.docs.description')}</p>
              </div>
              <div className="space-y-2">
                {['contractTemplates', 'rateCards', 'policyGuide'].map((docKey) => (
                  <div
                    key={docKey}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white p-3 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-slate-600"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                      <span className="truncate">{t(`views.agentPortal.docs.${docKey}`)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-slate-800"
                      onClick={() => openResource(docKey as 'contractTemplates' | 'rateCards' | 'policyGuide')}
                    >
                      {t('views.agentPortal.docs.open')}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
