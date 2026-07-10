import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  Loader2,
  ReceiptText,
  StickyNote,
  Wallet,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import { Button, modalDismissButtonClass } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { contractStatusVariant } from '@/lib/statusBadge';
import { fetchAuditLogs } from '@/lib/auditLogsApi';
import { fetchContractInvoices } from '@/lib/invoicesApi';
import { fetchPayments } from '@/lib/paymentsApi';
import { fetchContractSpecialRequests } from '@/lib/specialRequestsApi';
import { fetchContractInspection } from '@/lib/unitInspectionApi';
import {
  buildLedgerRows,
  buildLogisticsNotes,
  buildTimelineEvents,
  computeFinancialSummary,
  formatHistoryDateTime,
  formatHistoryPhp,
  formatBillingPeriod,
  pickCurrentLease,
  type HistoryTab,
  type LedgerRow,
} from '@/lib/tenantHistoryUtils';
import type { Contract, Tenant, Unit, UnitInspectionPayload } from '@/types';

export type TenantHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  contracts: Contract[];
  units: Unit[];
};

const HISTORY_TAB_TRIGGER =
  'flex-none rounded-none border-0 bg-transparent px-0 pb-3 text-sm font-medium shadow-none text-slate-400 transition-colors hover:text-slate-600 data-active:bg-transparent data-active:text-slate-900 data-active:shadow-none dark:text-slate-500 dark:hover:text-slate-300 dark:data-active:text-slate-50';

function ledgerStatusClass(status: LedgerRow['status']): string {
  if (status === 'Paid') return 'text-emerald-600 dark:text-emerald-400';
  if (status === 'Overdue') return 'text-rose-600 dark:text-rose-400';
  if (status === 'Partial') return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-500 dark:text-slate-400';
}

function ledgerStatusDotClass(status: LedgerRow['status']): string {
  if (status === 'Paid') return 'bg-emerald-500';
  if (status === 'Overdue') return 'bg-rose-500';
  if (status === 'Partial') return 'bg-amber-500';
  return 'bg-slate-400';
}

function reliabilityToneClass(tone: 'success' | 'warning' | 'danger' | 'neutral'): string {
  if (tone === 'success') return 'text-emerald-700 dark:text-emerald-400';
  if (tone === 'warning') return 'text-amber-700 dark:text-amber-400';
  if (tone === 'danger') return 'text-rose-700 dark:text-rose-400';
  return 'text-slate-600 dark:text-slate-400';
}

function reliabilityBarClass(tone: 'success' | 'warning' | 'danger' | 'neutral'): string {
  if (tone === 'success') return 'bg-emerald-500';
  if (tone === 'warning') return 'bg-amber-500';
  if (tone === 'danger') return 'bg-rose-500';
  return 'bg-slate-400';
}

const NOTE_CATEGORY_META: Record<
  LogisticsNote['category'],
  { icon: React.ComponentType<{ className?: string }>; iconWrap: string }
> = {
  incident: {
    icon: AlertTriangle,
    iconWrap: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  },
  maintenance: {
    icon: Wrench,
    iconWrap: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  },
  lease: {
    icon: FileText,
    iconWrap: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
  },
  admin: {
    icon: StickyNote,
    iconWrap: 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-300',
  },
};

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
      <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
      {children}
    </h3>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="font-semibold text-slate-500 dark:text-slate-500">{label}: </span>
      <span className="text-slate-700 dark:text-slate-300">{value}</span>
    </div>
  );
}

export function TenantHistoryModal({ isOpen, onClose, tenant, contracts, units }: TenantHistoryModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<HistoryTab>('lease');
  const [loading, setLoading] = useState(false);
  const [profileLogs, setProfileLogs] = useState<Awaited<ReturnType<typeof fetchAuditLogs>>>([]);
  const [contractLogs, setContractLogs] = useState<Awaited<ReturnType<typeof fetchAuditLogs>>>([]);
  const [invoices, setInvoices] = useState<Awaited<ReturnType<typeof fetchContractInvoices>>>([]);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof fetchPayments>>>([]);
  const [specialRequests, setSpecialRequests] = useState<Awaited<ReturnType<typeof fetchContractSpecialRequests>>>([]);
  const [inspection, setInspection] = useState<UnitInspectionPayload | null>(null);

  const tenantContracts = useMemo(() => {
    if (!tenant) return [];
    return contracts
      .filter((c) => c.tenantId === tenant.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [contracts, tenant]);

  const currentLease = useMemo(() => pickCurrentLease(tenantContracts), [tenantContracts]);
  const currentUnit = useMemo(
    () => (currentLease ? units.find((u) => u.id === currentLease.unitId) : undefined),
    [currentLease, units],
  );

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('lease');
      return;
    }
    if (!tenant) return;

    let cancelled = false;
    setLoading(true);
    setProfileLogs([]);
    setContractLogs([]);
    setInvoices([]);
    setPayments([]);
    setSpecialRequests([]);
    setInspection(null);

    void (async () => {
      try {
        const contractIds = tenantContracts.map((c) => c.id);
        const primaryContractId = pickCurrentLease(tenantContracts)?.id;

        const [logs, allPayments, contractLogBatches, invoiceBatches, requestBatches, inspectionPayload] =
          await Promise.all([
            fetchAuditLogs({ recordTable: 'tenant_profile', recordId: tenant.id, limit: 50 }),
            fetchPayments(),
            Promise.all(
              contractIds.map((id) =>
                fetchAuditLogs({ recordTable: 'lease_contract', recordId: id, limit: 30 }).catch(() => []),
              ),
            ),
            Promise.all(contractIds.map((id) => fetchContractInvoices(id).catch(() => []))),
            Promise.all(contractIds.map((id) => fetchContractSpecialRequests(id).catch(() => []))),
            primaryContractId
              ? fetchContractInspection(primaryContractId).catch(() => null)
              : Promise.resolve(null),
          ]);

        if (cancelled) return;

        setProfileLogs(logs);
        setContractLogs(contractLogBatches.flat());
        setInvoices(invoiceBatches.flat());
        setPayments(allPayments.filter((p) => contractIds.includes(p.contractId)));
        setSpecialRequests(requestBatches.flat());
        setInspection(inspectionPayload);
      } catch {
        if (!cancelled) toast.error(t('views.crm.history.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, tenant?.id, tenantContracts, t]);

  const timelineEvents = useMemo(() => {
    if (!tenant) return [];
    return buildTimelineEvents({
      tenant,
      profileLogs,
      contractLogs,
      contracts: tenantContracts,
      inspection,
      t,
    });
  }, [tenant, profileLogs, contractLogs, tenantContracts, inspection, t]);

  const financialSummary = useMemo(
    () => computeFinancialSummary(payments, invoices, t),
    [payments, invoices, t],
  );

  const ledgerRows = useMemo(() => buildLedgerRows(invoices, payments), [invoices, payments]);

  const logisticsNotes = useMemo(() => {
    if (!tenant) return [];
    return buildLogisticsNotes({
      tenant,
      contracts: tenantContracts,
      specialRequests,
      inspection,
      profileLogs,
      t,
    });
  }, [tenant, tenantContracts, specialRequests, inspection, profileLogs, t]);

  const registeredLabel = tenant?.createdAt ? formatHistoryDateTime(tenant.createdAt) : '—';

  return (
    <Modal
      isOpen={isOpen && !!tenant}
      onClose={onClose}
      title={tenant ? t('views.crm.history.modalTitle', { name: tenant.name }) : t('views.crm.table.history')}
      subtitle={
        tenant?.createdAt
          ? t('views.crm.history.registeredAt', { dateTime: registeredLabel })
          : undefined
      }
      maxWidth="3xl"
      variant="glass"
      compact
      footer={
        <div className="flex justify-end w-full">
          <Button type="button" className={modalDismissButtonClass} onClick={onClose}>
            {t('views.crm.blacklist.close')}
          </Button>
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as HistoryTab)} className="tenant-history-modal gap-0">
        <TabsList
          variant="line"
          className="mb-6 h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-0 bg-transparent p-0"
        >
          <TabsTrigger value="lease" className={HISTORY_TAB_TRIGGER}>
            <CalendarClock className="mr-1.5 inline-block h-4 w-4 align-[-3px]" aria-hidden />
            {t('views.crm.history.tabs.lease')}
          </TabsTrigger>
          <TabsTrigger value="financial" className={HISTORY_TAB_TRIGGER}>
            <Wallet className="mr-1.5 inline-block h-4 w-4 align-[-3px]" aria-hidden />
            {t('views.crm.history.tabs.financial')}
          </TabsTrigger>
          <TabsTrigger value="notes" className={HISTORY_TAB_TRIGGER}>
            <StickyNote className="mr-1.5 inline-block h-4 w-4 align-[-3px]" aria-hidden />
            {t('views.crm.history.tabs.notes')}
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden />
          </div>
        ) : (
          <>
            <TabsContent value="lease" className="mt-0 max-h-[min(60vh,28rem)] space-y-8 overflow-y-auto pr-1">
              <section>
                <SectionHeading icon={FileText}>
                  {t('views.crm.history.leaseDossier')}
                </SectionHeading>
                {currentLease ? (
                  <div className="rounded-2xl bg-slate-50/80 p-4 text-sm dark:bg-slate-800/40">
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-3">
                      <div className="min-w-0 font-semibold text-slate-900 dark:text-slate-100">
                        <span className="font-mono text-xs uppercase tracking-wide">
                          {currentLease.contractNo ?? currentLease.id}
                        </span>
                        {currentUnit ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                            {currentUnit.unitNumber}
                            {currentUnit.buildingName ? ` · ${currentUnit.buildingName}` : ''}
                          </span>
                        ) : null}
                      </div>
                      <StatusBadge
                        tone={
                          currentLease.status === 'Active'
                            ? 'success'
                            : contractStatusVariant(currentLease.status)
                        }
                      >
                        {currentLease.status}
                      </StatusBadge>
                    </div>
                    <div className="grid gap-2.5 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2">
                      <DetailRow
                        label={t('views.crm.history.monthlyRent')}
                        value={formatHistoryPhp(currentLease.monthlyRent)}
                      />
                      <DetailRow
                        label={t('views.crm.history.leasePeriod')}
                        value={formatBillingPeriod(currentLease.startDate, currentLease.endDate)}
                      />
                      <DetailRow
                        label={t('views.crm.history.unitNumber')}
                        value={currentUnit?.unitNumber ?? '—'}
                      />
                      <DetailRow
                        label={t('views.crm.history.building')}
                        value={currentUnit?.buildingName ?? '—'}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {t('views.crm.history.leasesEmpty')}
                  </p>
                )}
              </section>

              <section>
                <SectionHeading icon={CalendarClock}>
                  {t('views.crm.history.timeline')}
                </SectionHeading>
                {timelineEvents.length === 0 ? (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {t('views.crm.history.activityEmpty')}
                  </p>
                ) : (
                  <ol className="relative ml-1 space-y-6 border-none pl-6">
                    <span
                      className="pointer-events-none absolute left-[5px] top-1.5 bottom-1.5 w-px bg-gradient-to-b from-indigo-300 via-slate-200 to-transparent dark:from-indigo-500/50 dark:via-slate-700"
                      aria-hidden
                    />
                    {timelineEvents.map((event, index) => (
                      <li key={event.id} className="relative text-sm">
                        <span
                          className={cn(
                            'absolute -left-6 top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-900',
                            event.pinned
                              ? 'bg-emerald-500'
                              : index === 0
                                ? 'bg-indigo-500'
                                : 'bg-slate-300 dark:bg-slate-600',
                          )}
                          aria-hidden
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{event.title}</p>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {formatHistoryDateTime(event.at)}
                          </span>
                        </div>
                        {event.detail ? (
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {event.detail}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </TabsContent>

            <TabsContent value="financial" className="mt-0 max-h-[min(60vh,28rem)] space-y-8 overflow-y-auto pr-1">
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/40">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('views.crm.history.financial.onTimeLabel')}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-2xl font-semibold tabular-nums',
                      reliabilityToneClass(financialSummary.reliabilityTone),
                    )}
                  >
                    {financialSummary.onTimePercent != null ? `${financialSummary.onTimePercent}%` : '—'}
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/60">
                    <div
                      className={cn('h-full rounded-full transition-all', reliabilityBarClass(financialSummary.reliabilityTone))}
                      style={{ width: `${financialSummary.onTimePercent ?? 0}%` }}
                    />
                  </div>
                  <p className={cn('mt-2 text-xs font-medium', reliabilityToneClass(financialSummary.reliabilityTone))}>
                    {financialSummary.reliabilityLabel}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/40">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('views.crm.history.financial.outstandingLabel')}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-2xl font-semibold tabular-nums',
                      financialSummary.outstandingBalance > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {formatHistoryPhp(financialSummary.outstandingBalance)}
                  </p>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {financialSummary.outstandingBalance > 0
                      ? t('views.crm.history.financial.outstandingHint')
                      : t('views.crm.history.financial.settledHint')}
                  </p>
                </div>
              </section>

              <section>
                <SectionHeading icon={ReceiptText}>
                  {t('views.crm.history.financial.invoiceNo')}
                </SectionHeading>
                {ledgerRows.length === 0 ? (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {t('views.crm.history.financial.empty')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {ledgerRows.map((row) => (
                      <div key={row.id} className="rounded-xl bg-slate-50/70 p-3.5 text-sm dark:bg-slate-800/30">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{row.invoiceNo}</span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-medium',
                              ledgerStatusClass(row.status),
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', ledgerStatusDotClass(row.status))} aria-hidden />
                            {t(`views.crm.history.financial.statuses.${row.status}`)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                          <DetailRow
                            label={t('views.crm.history.financial.billingPeriod')}
                            value={row.billingPeriod}
                          />
                          <DetailRow
                            label={t('views.crm.history.financial.amount')}
                            value={formatHistoryPhp(row.amount)}
                          />
                          <DetailRow
                            label={t('views.crm.history.financial.paymentDate')}
                            value={
                              row.paymentDate
                                ? format(new Date(`${row.paymentDate}T12:00:00`), 'MMM dd, yyyy')
                                : '—'
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>

            <TabsContent value="notes" className="mt-0 max-h-[min(60vh,28rem)] overflow-y-auto pr-1">
              {logisticsNotes.length === 0 ? (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t('views.crm.history.notes.empty')}
                </p>
              ) : (
                <div className="space-y-3">
                  {logisticsNotes.map((note) => {
                    const meta = NOTE_CATEGORY_META[note.category] ?? NOTE_CATEGORY_META.admin;
                    const CategoryIcon = meta.icon;
                    return (
                      <div key={note.id} className="flex gap-3 rounded-xl bg-slate-50/70 p-3.5 text-sm dark:bg-slate-800/30">
                        <span
                          className={cn(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                            meta.iconWrap,
                          )}
                          aria-hidden
                        >
                          <CategoryIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="min-w-0 font-semibold text-slate-900 dark:text-slate-100">{note.title}</p>
                            {note.status ? (
                              <span className="shrink-0 text-xs capitalize text-slate-400">{note.status.replace(/_/g, ' ')}</span>
                            ) : null}
                          </div>
                          {note.body ? (
                            <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                              {note.body}
                            </p>
                          ) : null}
                          {note.at ? (
                            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                              {formatHistoryDateTime(note.at)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </Modal>
  );
}
