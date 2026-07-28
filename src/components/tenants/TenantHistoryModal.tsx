import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  onEditTenant?: () => void;
};

const TAB_TRIGGER =
  'rounded-none border-0 bg-transparent px-0 pb-2 text-sm font-medium text-slate-400 shadow-none hover:text-slate-700 data-active:bg-transparent data-active:text-slate-900 data-active:shadow-none dark:text-slate-500 dark:hover:text-slate-300 dark:data-active:text-slate-50';

function ledgerStatusClass(status: LedgerRow['status']): string {
  if (status === 'Paid') return 'text-emerald-600';
  if (status === 'Overdue') return 'text-rose-600';
  if (status === 'Partial') return 'text-amber-600';
  return 'text-slate-500';
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 dark:text-slate-100">{value ?? '—'}</dd>
    </div>
  );
}

export function TenantHistoryModal({
  isOpen,
  onClose,
  tenant,
  contracts,
  units,
  onEditTenant,
}: TenantHistoryModalProps) {
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
  const pastLeases = useMemo(
    () => tenantContracts.filter((c) => !currentLease || c.id !== currentLease.id),
    [tenantContracts, currentLease],
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
  const kycVerified = tenant?.kycVerified !== false;
  const unitLabel = currentUnit
    ? `${currentUnit.unitNumber}${currentUnit.buildingName ? ` · ${currentUnit.buildingName}` : ''}`
    : null;

  const metaBits = [
    tenant?.email,
    tenant?.phone,
    unitLabel,
    tenant
      ? kycVerified
        ? t('views.crm.table.verified')
        : t('views.crm.table.verificationPending')
      : null,
    tenant?.isBlacklisted ? t('views.crm.table.blacklisted') : t('views.crm.table.active'),
  ].filter(Boolean);

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
      maxWidth="2xl"
      variant="glass"
      compact
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={onClose}>
            {t('views.crm.details.close')}
          </Button>
          {onEditTenant ? (
            <Button type="button" className={modalPrimaryButtonClass} onClick={onEditTenant}>
              {t('views.crm.details.editTenant')}
            </Button>
          ) : null}
        </div>
      }
    >
      {tenant ? (
        <div className="tenant-history-modal max-h-[min(68vh,34rem)] space-y-6 overflow-y-auto pr-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">{metaBits.join(' · ')}</p>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as HistoryTab)}
            className="gap-0"
          >
            <TabsList
              variant="line"
              className="mb-5 h-auto w-full justify-start gap-6 rounded-none border-0 bg-transparent p-0"
            >
              <TabsTrigger value="lease" className={TAB_TRIGGER}>
                {t('views.crm.history.tabs.lease')}
              </TabsTrigger>
              <TabsTrigger value="financial" className={TAB_TRIGGER}>
                {t('views.crm.history.tabs.financial')}
              </TabsTrigger>
              <TabsTrigger value="notes" className={TAB_TRIGGER}>
                {t('views.crm.history.tabs.notes')}
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
              </div>
            ) : (
              <>
                <TabsContent value="lease" className="mt-0 space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t('views.crm.history.leaseDossier')}
                    </h3>
                    {currentLease ? (
                      <>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {currentLease.contractNo ?? currentLease.id}
                            {unitLabel ? (
                              <span className="font-normal text-slate-500"> · {unitLabel}</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-slate-500">{currentLease.status}</p>
                        </div>
                        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                          <Field
                            label={t('views.crm.history.monthlyRent')}
                            value={formatHistoryPhp(currentLease.monthlyRent)}
                          />
                          <Field
                            label={t('views.crm.history.leasePeriod')}
                            value={formatBillingPeriod(currentLease.startDate, currentLease.endDate)}
                          />
                          <Field
                            label={t('views.crm.history.securityDeposit')}
                            value={formatHistoryPhp(currentLease.securityDeposit)}
                          />
                          <Field
                            label={t('views.crm.history.advanceRent')}
                            value={formatHistoryPhp(currentLease.advanceRent)}
                          />
                          {currentLease.agentName ? (
                            <Field label={t('views.crm.history.agent')} value={currentLease.agentName} />
                          ) : null}
                          {currentLease.remarks ? (
                            <Field label={t('views.crm.history.remarks')} value={currentLease.remarks} />
                          ) : null}
                        </dl>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">{t('views.crm.history.leasesEmpty')}</p>
                    )}
                  </section>

                  {pastLeases.length > 0 ? (
                    <section className="space-y-3">
                      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {t('views.crm.history.leases')}
                      </h3>
                      <ul className="space-y-3">
                        {pastLeases.map((lease) => {
                          const unit = units.find((u) => u.id === lease.unitId);
                          return (
                            <li
                              key={lease.id}
                              className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                            >
                              <div>
                                <p className="text-slate-900 dark:text-slate-100">
                                  {lease.contractNo ?? lease.id}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {unit
                                    ? `${unit.unitNumber}${unit.buildingName ? ` · ${unit.buildingName}` : ''}`
                                    : '—'}
                                  {' · '}
                                  {formatBillingPeriod(lease.startDate, lease.endDate)}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500">
                                {formatHistoryPhp(lease.monthlyRent)} · {lease.status}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ) : null}

                  <section className="space-y-3">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t('views.crm.history.timeline')}
                    </h3>
                    {timelineEvents.length === 0 ? (
                      <p className="text-sm text-slate-500">{t('views.crm.history.activityEmpty')}</p>
                    ) : (
                      <ul className="space-y-3">
                        {timelineEvents.map((event) => (
                          <li
                            key={event.id}
                            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="text-slate-900 dark:text-slate-100">{event.title}</p>
                              {event.detail ? (
                                <p className="mt-0.5 text-xs text-slate-500">{event.detail}</p>
                              ) : null}
                            </div>
                            <p className="shrink-0 text-xs text-slate-400">
                              {formatHistoryDateTime(event.at)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </TabsContent>

                <TabsContent value="financial" className="mt-0 space-y-8">
                  <dl className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-400">
                        {t('views.crm.history.financial.onTimeLabel')}
                      </dt>
                      <dd className="mt-1 text-xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {financialSummary.onTimePercent != null
                          ? `${financialSummary.onTimePercent}%`
                          : '—'}
                      </dd>
                      <p className="mt-1 text-xs text-slate-500">{financialSummary.reliabilityLabel}</p>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">
                        {t('views.crm.history.financial.outstandingLabel')}
                      </dt>
                      <dd
                        className={cn(
                          'mt-1 text-xl font-medium tabular-nums',
                          financialSummary.outstandingBalance > 0
                            ? 'text-rose-600'
                            : 'text-slate-900 dark:text-slate-100',
                        )}
                      >
                        {formatHistoryPhp(financialSummary.outstandingBalance)}
                      </dd>
                    </div>
                  </dl>

                  <section className="space-y-3">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t('views.crm.history.financial.invoiceNo')}
                    </h3>
                    {ledgerRows.length === 0 ? (
                      <p className="text-sm text-slate-500">{t('views.crm.history.financial.empty')}</p>
                    ) : (
                      <ul className="space-y-3">
                        {ledgerRows.map((row) => (
                          <li key={row.id} className="text-sm">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-slate-900 dark:text-slate-100">{row.invoiceNo}</p>
                              <p className={cn('text-xs', ledgerStatusClass(row.status))}>
                                {t(`views.crm.history.financial.statuses.${row.status}`)}
                              </p>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {row.billingPeriod}
                              {' · '}
                              {formatHistoryPhp(row.amount)}
                              {row.paymentDate
                                ? ` · ${format(new Date(`${row.paymentDate}T12:00:00`), 'MMM dd, yyyy')}`
                                : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </TabsContent>

                <TabsContent value="notes" className="mt-0 space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {t('views.crm.history.tabs.notes')}
                  </h3>
                  {logisticsNotes.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('views.crm.history.notes.empty')}</p>
                  ) : (
                    <ul className="space-y-4">
                      {logisticsNotes.map((note) => (
                        <li key={note.id} className="text-sm">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-slate-900 dark:text-slate-100">{note.title}</p>
                            {note.at ? (
                              <p className="text-xs text-slate-400">{formatHistoryDateTime(note.at)}</p>
                            ) : null}
                          </div>
                          {note.body ? (
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">
                              {note.body}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      ) : null}
    </Modal>
  );
}
