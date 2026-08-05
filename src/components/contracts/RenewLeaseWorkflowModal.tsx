import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Info,
  TrendingUp,
} from 'lucide-react';
import { addMonths, addYears, differenceInCalendarDays, differenceInCalendarMonths, format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal } from '@/components/modal';
import { StatusBadge } from '@/components/status-badge';
import { Button, modalActionButtonClass, modalDismissButtonClass, modalOutlineButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import { cn } from '@/lib/utils';
import { leaseRenewalStatusVariant } from '@/lib/statusBadge';
import type { Contract, LeaseRenewalPayload, LeaseRenewalTerms, LeaseRenewalWorkflowStep } from '@/types';
import {
  activateRenewal,
  approveManagerRenewal,
  downloadRenewalDraftPdf,
  downloadRenewalStatementPdf,
  fetchContractRenewal,
  openRenewalDraftPdf,
  patchRenewal,
  recordTenantSignature,
  saveRenewalDraft,
} from '@/lib/leaseRenewalApi';
import {
  computeIncreasePct,
  formatPhp,
  formatRentInput,
  parseRentInput,
  rentWithPercentIncrease,
  termsFromEndDateChange,
  termsFromStartAndTerm,
} from '@/lib/leaseRenewalUtils';

export type RenewLeaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  unitNumber: string;
  tenantName: string;
  contract: Contract | null;
  unpaidBalance: number;
  onRenewed?: (contract: Contract) => void;
  className?: string;
};

const STEPS: Array<{ key: LeaseRenewalWorkflowStep; labelKey: string }> = [
  { key: 'summary', labelKey: 'stepSummary' },
  { key: 'balance', labelKey: 'stepBalance' },
  { key: 'terms', labelKey: 'stepTerms' },
  { key: 'agreement', labelKey: 'stepAgreement' },
  { key: 'approval', labelKey: 'stepApproval' },
  { key: 'activation', labelKey: 'stepActivation' },
];

const STEP_INDEX: Record<LeaseRenewalWorkflowStep, number> = {
  summary: 0,
  balance: 1,
  terms: 2,
  agreement: 3,
  approval: 4,
  activation: 5,
};

const RENEW_LEASE_PANEL =
  'rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-600 dark:bg-slate-950/80';

const RENEW_LEASE_SHELL =
  'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-950/80';

function renewalStatusLabelKey(status: string): string {
  const map: Record<string, string> = {
    pending_renewal: 'statusPendingRenewal',
    awaiting_payment: 'statusAwaitingPayment',
    pending_signature: 'statusPendingSignature',
    ready_to_activate: 'statusReadyToActivate',
    active: 'statusActive',
    declined: 'statusDeclined',
  };
  return map[status] ?? 'statusPendingRenewal';
}

export function RenewLeaseWorkflowModal({
  isOpen,
  onClose,
  unitNumber,
  tenantName,
  contract,
  unpaidBalance: _unpaidBalanceProp,
  onRenewed,
  className,
}: RenewLeaseModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<LeaseRenewalPayload | null>(null);
  const [step, setStep] = useState<LeaseRenewalWorkflowStep>('summary');

  const [carryOver, setCarryOver] = useState(false);
  const [carryOverReason, setCarryOverReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [rentInput, setRentInput] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [leaseTerm, setLeaseTerm] = useState('12');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [advanceRent, setAdvanceRent] = useState('');
  const [parkingFee, setParkingFee] = useState('');
  const [associationDues, setAssociationDues] = useState('');
  const [renewalFee, setRenewalFee] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [activationDate, setActivationDate] = useState<Date | null>(new Date());

  const loadRenewal = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContractRenewal(contract.id);
      setPayload(data);
      setStep(data.renewal.workflowStep ?? 'summary');
      const terms = (data.renewal.terms ?? {}) as Partial<LeaseRenewalTerms>;
      setCarryOver(Boolean(data.renewal.carryOverBalance));
      setCarryOverReason(data.renewal.carryOverReason ?? '');
      setInternalNotes(data.renewal.internalNotes ?? '');
      setRentInput(formatRentInput(String(terms.monthlyRent ?? '')));
      setStartDate(terms.startDate ? parseISO(terms.startDate) : null);
      setEndDate(terms.endDate ? parseISO(terms.endDate) : null);
      setLeaseTerm(String(terms.leaseTerm ?? '12'));
      setSecurityDeposit(String(terms.securityDeposit ?? 0));
      setAdvanceRent(String(terms.advanceRent ?? 0));
      setParkingFee(String(terms.parkingFee ?? 0));
      setAssociationDues(String(terms.associationDues ?? 0));
      setRenewalFee(String(terms.renewalFee ?? 0));
      setManagerNotes(data.renewal.managerApprovalNotes ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load renewal');
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    if (isOpen && contract) void loadRenewal();
    if (!isOpen) {
      setPayload(null);
      setStep('summary');
      setError(null);
    }
  }, [isOpen, contract?.id, loadRenewal, contract]);

  const renewal = payload?.renewal;
  const summary = payload?.summary;
  const outstanding = renewal?.outstandingBalance ?? 0;
  const breakdown = renewal?.balanceBreakdown ?? {
    outstandingRent: 0,
    utilities: 0,
    penalties: 0,
    parkingFees: 0,
    otherCharges: 0,
    remainingScheduled: 0,
    overdueMonths: 0,
    remainingMonths: 0,
  };
  const remainingScheduled = Number(breakdown.remainingScheduled ?? 0);
  const remainingMonths = Number(breakdown.remainingMonths ?? 0);
  const previousRent = summary?.currentMonthlyRent ?? Number(contract?.monthlyRent ?? 0);
  const currentRent = parseRentInput(rentInput);
  const increaseAmount = Number.isFinite(currentRent) ? currentRent - previousRent : 0;
  const increasePct = computeIncreasePct(previousRent, currentRent);

  const balanceBlocked = outstanding > 0 && !carryOver;
  const readyForActivation =
    Boolean(renewal) &&
    renewal.approvalStatus === 'approved' &&
    renewal.tenantSignatureStatus === 'signed' &&
    !balanceBlocked &&
    (!carryOver || Boolean(carryOverReason.trim()));

  const persistPatch = useCallback(
    async (patch: Parameters<typeof patchRenewal>[1], nextStep?: LeaseRenewalWorkflowStep) => {
      if (!renewal) return;
      setSaving(true);
      try {
        const data = await patchRenewal(renewal.id, {
          ...patch,
          workflowStep: nextStep ?? patch.workflowStep,
        });
        setPayload(data);
        if (nextStep) setStep(nextStep);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed');
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [renewal],
  );

  const buildTermsPatch = useCallback(() => {
    if (!startDate || !endDate) return null;
    const monthlyRent = parseRentInput(rentInput);
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return null;
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      leaseTerm,
      monthlyRent,
      previousRent,
      securityDeposit: Number(securityDeposit) || 0,
      advanceRent: Number(advanceRent) || 0,
      parkingFee: Number(parkingFee) || 0,
      associationDues: Number(associationDues) || 0,
      renewalFee: Number(renewalFee) || 0,
      rentIncreasePercentage: computeIncreasePct(previousRent, monthlyRent),
    };
  }, [
    startDate,
    endDate,
    rentInput,
    leaseTerm,
    previousRent,
    securityDeposit,
    advanceRent,
    parkingFee,
    associationDues,
    renewalFee,
  ]);

  const goNext = async () => {
    if (!renewal) return;
    const idx = STEP_INDEX[step];
    const next = STEPS[idx + 1]?.key;
    if (!next) return;

    try {
      if (step === 'balance') {
        if (balanceBlocked) {
          toast.error(t('views.contracts.renewLease.workflow.balanceBlocked'));
          return;
        }
        if (carryOver && outstanding > 0 && !carryOverReason.trim()) {
          toast.error(t('views.contracts.renewLease.workflow.carryOverReasonRequired'));
          return;
        }
        await persistPatch(
          {
            carryOverBalance: carryOver,
            carryOverReason: carryOverReason.trim(),
            internalNotes: internalNotes.trim(),
            workflowStep: 'balance',
          },
          next,
        );
        return;
      }

      if (step === 'terms') {
        const terms = buildTermsPatch();
        if (!terms) {
          toast.error(t('views.contracts.renewLease.validationRent'));
          return;
        }
        await persistPatch({ terms, workflowStep: 'terms' }, next);
        return;
      }

      await persistPatch({ workflowStep: step }, next);
    } catch {
      // toast shown
    }
  };

  const goBack = () => {
    const idx = STEP_INDEX[step];
    const prev = STEPS[idx - 1]?.key;
    if (prev) setStep(prev);
  };

  const handleSaveDraft = async () => {
    if (!renewal) return;
    setSaving(true);
    try {
      const terms = buildTermsPatch();
      if (terms) {
        await patchRenewal(renewal.id, {
          carryOverBalance: carryOver,
          carryOverReason: carryOverReason.trim(),
          internalNotes: internalNotes.trim(),
          terms,
          managerApprovalNotes: managerNotes.trim(),
        });
      }
      const data = await saveRenewalDraft(renewal.id);
      setPayload(data);
      toast.success(t('views.contracts.renewLease.workflow.draftSaved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewAgreement = async () => {
    if (!renewal) return;
    try {
      await openRenewalDraftPdf(renewal.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    }
  };

  const handleActivate = async () => {
    if (!renewal || !readyForActivation) return;
    setActivating(true);
    try {
      const result = await activateRenewal(renewal.id, {
        activationDate: activationDate ? format(activationDate, 'yyyy-MM-dd') : undefined,
      });
      setPayload(result);
      onRenewed?.(result.contract);
      toast.success(t('views.contracts.renewLease.renewed'));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.contracts.renewLease.workflow.activateError'));
    } finally {
      setActivating(false);
    }
  };

  const applyRentIncrease = (pct: number) => {
    const next = rentWithPercentIncrease(previousRent, pct);
    setRentInput(formatRentInput(String(next)));
  };

  const leaseTermLabel = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) return null;
    const months = differenceInCalendarMonths(endDate, startDate);
    const days = differenceInCalendarDays(endDate, startDate);
    return t('views.contracts.renewLease.leaseTerm', { months, days });
  }, [startDate, endDate, t]);

  const stepper = (
    <div className="renew-lease-stepper mb-4 overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-1">
        {STEPS.map((s, i) => {
          const active = step === s.key;
          const done = STEP_INDEX[step] > i;
          return (
            <React.Fragment key={s.key}>
              {i > 0 ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
              ) : null}
              <button
                type="button"
                onClick={() => setStep(s.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors',
                  active
                    ? 'border-brand-blue bg-brand-blue/10 text-brand-blue dark:border-brand-blue/50 dark:bg-brand-blue/20 dark:text-blue-100'
                    : done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-100'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-300',
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : null}
                {t(`views.contracts.renewLease.workflow.${s.labelKey}`)}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  const renderSummaryStep = () => (
    <div className="space-y-4">
      {renewal ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={leaseRenewalStatusVariant(renewal.renewalStatus)}>
            {t(`views.contracts.renewLease.workflow.${renewalStatusLabelKey(renewal.renewalStatus)}`)}
          </StatusBadge>
        </div>
      ) : null}
      <div className={cn('renew-lease-summary grid gap-3 sm:grid-cols-2 lg:grid-cols-3', RENEW_LEASE_PANEL)}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.contractNo')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {summary?.contractNumber ?? contract?.contractNo ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.workflow.unitNumber')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">{unitNumber || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.workflow.tenantName')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {summary?.tenantName ?? tenantName ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.workflow.currentLeasePeriod')}
          </div>
          <div className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">
            {summary?.currentLeaseStart
              ? `${format(parseISO(summary.currentLeaseStart), 'MMM d, yyyy')} — ${format(parseISO(summary.currentLeaseEnd!), 'MMM d, yyyy')}`
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.workflow.leaseExpiration')}
          </div>
          <div className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">
            {summary?.currentLeaseEnd ? format(parseISO(summary.currentLeaseEnd), 'MMM d, yyyy') : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.workflow.tenantSince')}
          </div>
          <div className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">
            {summary?.tenantSince ? format(parseISO(summary.tenantSince), 'MMM d, yyyy') : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.workflow.previousRenewals')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {summary?.previousRenewals ?? 0}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.previousRent')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">{formatPhp(previousRent)}</div>
        </div>
      </div>
    </div>
  );

  const renderBalanceStep = () => (
    <div className="space-y-4">
      <div className={cn('renew-lease-shell', RENEW_LEASE_SHELL)}>
        <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t('views.contracts.renewLease.workflow.balanceBreakdown')}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['outstandingRent', breakdown.outstandingRent],
              ['utilities', breakdown.utilities],
              ['penalties', breakdown.penalties],
              ['parkingFees', breakdown.parkingFees],
              ['otherCharges', breakdown.otherCharges],
            ] as const
          ).map(([key, val]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-600/70"
            >
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {t(`views.contracts.renewLease.workflow.${key}`)}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatPhp(Number(val ?? 0))}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-brand-blue/20 bg-brand-blue/10 px-3 py-2.5 dark:border-brand-blue/30 dark:bg-brand-blue/20">
          <span className="text-sm font-semibold text-brand-blue dark:text-blue-100">
            {t('views.contracts.renewLease.workflow.totalOutstanding')}
          </span>
          <span className="text-base font-bold text-brand-blue dark:text-blue-50">{formatPhp(outstanding)}</span>
        </div>
        {remainingScheduled > 0 ? (
          <div className="mt-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-600/70 dark:bg-slate-800/50">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('views.contracts.renewLease.workflow.remainingScheduled')}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {formatPhp(remainingScheduled)}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {t('views.contracts.renewLease.workflow.remainingScheduledHint', {
                months: remainingMonths,
                monthly: formatPhp(previousRent),
              })}
            </p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            disabled={!renewal}
            onClick={() =>
              renewal &&
              void downloadRenewalStatementPdf(renewal.id, `statement-${summary?.contractNumber ?? renewal.id}.pdf`).catch(
                (e) => toast.error(e.message),
              )
            }
          >
            <FileText className="mr-1.5 h-4 w-4" />
            {t('views.contracts.renewLease.workflow.viewStatement')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            disabled={!renewal}
            onClick={() =>
              renewal &&
              void downloadRenewalStatementPdf(renewal.id, `statement-${summary?.contractNumber ?? renewal.id}.pdf`).catch(
                (e) => toast.error(e.message),
              )
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            {t('views.contracts.renewLease.workflow.downloadStatement')}
          </Button>
        </div>
      </div>

      {outstanding > 0 ? (
        <label className="renew-lease-option flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200/90 px-3.5 py-3 dark:border-slate-600/80">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-slate-300"
            checked={carryOver}
            onChange={(e) => setCarryOver(e.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {t('views.contracts.renewLease.workflow.allowCarryOver')}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {t('views.contracts.renewLease.carryOverHint')}
            </span>
          </span>
        </label>
      ) : null}

      {carryOver && outstanding > 0 ? (
        <div className="space-y-3">
          <div>
            <Label>{t('views.contracts.renewLease.workflow.carryOverReason')}</Label>
            <Textarea
              value={carryOverReason}
              onChange={(e) => setCarryOverReason(e.target.value)}
              className="mt-1.5 min-h-[72px] rounded-xl"
              placeholder={t('views.contracts.renewLease.workflow.carryOverReasonPlaceholder')}
            />
          </div>
          <div>
            <Label>{t('views.contracts.renewLease.workflow.internalNotes')}</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="mt-1.5 min-h-[72px] rounded-xl"
              placeholder={t('views.contracts.renewLease.notesPlaceholder')}
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderTermsStep = () => (
    <div className={cn('renew-lease-shell space-y-4', RENEW_LEASE_SHELL)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('views.contracts.renewLease.newStartDate')}</Label>
          <div className="mt-1.5">
            <AppDatePicker
              mode="single"
              value={startDate}
              onChange={(d) => {
                if (!d) return;
                setStartDate(d);
                const patch = termsFromStartAndTerm(d, leaseTerm);
                if (patch.endDate) setEndDate(parseISO(patch.endDate));
              }}
            />
          </div>
        </div>
        <div>
          <Label>{t('views.contracts.renewLease.newEndDate')}</Label>
          <div className="mt-1.5">
            <AppDatePicker
              mode="single"
              value={endDate}
              onChange={(d) => {
                if (!d || !startDate) return;
                setEndDate(d);
                const patch = termsFromEndDateChange(format(startDate, 'yyyy-MM-dd'), d);
                if (patch.leaseTerm) setLeaseTerm(patch.leaseTerm);
              }}
            />
          </div>
        </div>
      </div>

      <div>
        <Label>{t('views.contracts.renewLease.workflow.leaseTermPreset')}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['12', '24', 'custom'] as const).map((term) => (
            <Button
              key={term}
              type="button"
              size="sm"
              variant={leaseTerm === term ? 'default' : 'outline'}
              className="h-9 rounded-lg"
              onClick={() => {
                setLeaseTerm(term);
                if (startDate) {
                  const patch = termsFromStartAndTerm(startDate, term);
                  if (patch.endDate) setEndDate(parseISO(patch.endDate));
                }
              }}
            >
              {t(`views.contracts.renewLease.workflow.term${term}`)}
            </Button>
          ))}
        </div>
        {leaseTermLabel ? <p className="mt-2 text-xs text-slate-500">{leaseTermLabel}</p> : null}
      </div>

      <div>
        <Label>{t('views.contracts.renewLease.newMonthlyRent')}</Label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <Input
            value={rentInput}
            onChange={(e) => setRentInput(e.target.value)}
            onBlur={() => setRentInput(formatRentInput(rentInput))}
            className="h-11 rounded-xl"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-11 rounded-xl" onClick={() => applyRentIncrease(5)}>
              <TrendingUp className="mr-1 h-4 w-4" />
              {t('views.contracts.renewLease.workflow.suggest5')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-11 rounded-xl" onClick={() => applyRentIncrease(10)}>
              {t('views.contracts.renewLease.workflow.suggest10')}
            </Button>
          </div>
        </div>
        <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-600 dark:bg-slate-950/80 sm:grid-cols-2">
          <div>
            <span className="text-slate-500">{t('views.contracts.renewLease.previousRent')}: </span>
            <span className="font-semibold">{formatPhp(previousRent)}</span>
          </div>
          <div>
            <span className="text-slate-500">{t('views.contracts.renewLease.workflow.newRent')}: </span>
            <span className="font-semibold">{formatPhp(currentRent)}</span>
          </div>
          <div>
            <span className="text-slate-500">{t('views.contracts.renewLease.workflow.increaseAmount')}: </span>
            <span className="font-semibold">{formatPhp(increaseAmount)}</span>
          </div>
          <div>
            <span className="text-slate-500">{t('views.contracts.renewLease.workflow.increasePercentage')}: </span>
            <span className="font-semibold">{increasePct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('views.contracts.renewLease.workflow.securityDeposit')}</Label>
          <Input value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
        </div>
        <div>
          <Label>{t('views.contracts.renewLease.workflow.advanceRent')}</Label>
          <Input value={advanceRent} onChange={(e) => setAdvanceRent(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
        </div>
        <div>
          <Label>{t('views.contracts.renewLease.workflow.parkingFee')}</Label>
          <Input value={parkingFee} onChange={(e) => setParkingFee(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
        </div>
        <div>
          <Label>{t('views.contracts.renewLease.workflow.associationDues')}</Label>
          <Input value={associationDues} onChange={(e) => setAssociationDues(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
        </div>
        <div>
          <Label>{t('views.contracts.renewLease.workflow.renewalFee')}</Label>
          <Input value={renewalFee} onChange={(e) => setRenewalFee(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
        </div>
      </div>
    </div>
  );

  const renderAgreementStep = () => {
    const terms = buildTermsPatch();
    return (
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="renew-lease-summary rounded-xl border border-slate-200/90 p-4 dark:border-slate-600/80">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              {t('views.contracts.renewLease.workflow.oldContract')}
            </div>
            <div className="space-y-1 text-sm">
              <div>{summary?.contractNumber}</div>
              <div className="text-slate-600 dark:text-slate-300">{formatPhp(previousRent)} / mo</div>
            </div>
          </div>
          <div className={cn('renew-lease-summary', RENEW_LEASE_PANEL)}>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-blue dark:text-brand-blue">
              {t('views.contracts.renewLease.workflow.newContract')}
            </div>
            <div className="space-y-1 text-sm">
              <div>{terms ? `${format(parseISO(terms.startDate), 'MMM d, yyyy')} — ${format(parseISO(terms.endDate), 'MMM d, yyyy')}` : '—'}</div>
              <div className="font-semibold">{terms ? formatPhp(terms.monthlyRent) : '—'} / mo</div>
            </div>
          </div>
        </div>
        <div className="renew-lease-shell rounded-xl border border-slate-200/90 p-4 dark:border-slate-600/80">
          <div className="mb-2 text-sm font-semibold">{t('views.contracts.renewLease.workflow.newCharges')}</div>
          <div className="grid gap-1 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
            <div>{t('views.contracts.renewLease.workflow.parkingFee')}: {formatPhp(Number(parkingFee) || 0)}</div>
            <div>{t('views.contracts.renewLease.workflow.associationDues')}: {formatPhp(Number(associationDues) || 0)}</div>
            <div>{t('views.contracts.renewLease.workflow.renewalFee')}: {formatPhp(Number(renewalFee) || 0)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => void handlePreviewAgreement()} disabled={!renewal}>
            <FileText className="mr-1.5 h-4 w-4" />
            {t('views.contracts.renewLease.workflow.previewAgreement')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={!renewal}
            onClick={() =>
              renewal &&
              void downloadRenewalDraftPdf(renewal.id, `renewal-draft-${summary?.contractNumber ?? renewal.id}.pdf`).catch((e) =>
                toast.error(e.message),
              )
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            {t('views.contracts.renewLease.workflow.downloadDraft')}
          </Button>
        </div>
      </div>
    );
  };

  const renderApprovalStep = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="renew-lease-shell rounded-xl border p-4">
          <div className="text-xs font-bold uppercase text-slate-400">{t('views.contracts.renewLease.workflow.tenantSignature')}</div>
          <StatusBadge tone={renewal?.tenantSignatureStatus === 'signed' ? 'success' : 'warning'} className="mt-2">
            {t(`views.contracts.renewLease.workflow.sig_${renewal?.tenantSignatureStatus ?? 'pending'}`)}
          </StatusBadge>
          {renewal?.signedAt ? (
            <p className="mt-2 text-xs text-slate-500">
              {t('views.contracts.renewLease.workflow.dateSigned')}: {format(parseISO(renewal.signedAt), 'MMM d, yyyy h:mm a')}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="mt-3 h-9 rounded-lg"
            disabled={!renewal || saving}
            onClick={() =>
              renewal &&
              void recordTenantSignature(renewal.id, { status: 'signed' })
                .then(setPayload)
                .then(() => toast.success(t('views.contracts.renewLease.workflow.tenantSigned')))
                .catch((e) => toast.error(e.message))
            }
          >
            {t('views.contracts.renewLease.workflow.recordTenantSign')}
          </Button>
        </div>
        <div className="renew-lease-shell rounded-xl border p-4">
          <div className="text-xs font-bold uppercase text-slate-400">{t('views.contracts.renewLease.workflow.managerApproval')}</div>
          <StatusBadge tone={renewal?.approvalStatus === 'approved' ? 'success' : renewal?.approvalStatus === 'rejected' ? 'danger' : 'info'} className="mt-2">
            {t(`views.contracts.renewLease.workflow.approval_${renewal?.approvalStatus ?? 'pending'}`)}
          </StatusBadge>
          <Textarea
            value={managerNotes}
            onChange={(e) => setManagerNotes(e.target.value)}
            className="mt-3 min-h-[64px] rounded-xl text-sm"
            placeholder={t('views.contracts.renewLease.workflow.approvalNotesPlaceholder')}
          />
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700"
              disabled={!renewal || saving}
              onClick={() =>
                renewal &&
                void approveManagerRenewal(renewal.id, { status: 'approved', notes: managerNotes.trim() })
                  .then(setPayload)
                  .then(() => toast.success(t('views.contracts.renewLease.workflow.managerApproved')))
                  .catch((e) => toast.error(e.message))
              }
            >
              {t('views.contracts.renewLease.workflow.approve')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-lg"
              disabled={!renewal || saving}
              onClick={() =>
                renewal &&
                void approveManagerRenewal(renewal.id, { status: 'rejected', notes: managerNotes.trim() })
                  .then(setPayload)
                  .catch((e) => toast.error(e.message))
              }
            >
              {t('views.contracts.renewLease.workflow.reject')}
            </Button>
          </div>
        </div>
      </div>
      {payload?.logs?.length ? (
        <div className="renew-lease-shell max-h-40 overflow-y-auto rounded-xl border p-3 text-xs">
          {payload.logs.slice(0, 8).map((log) => (
            <div key={log.id} className="border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-700">
              <span className="text-slate-400">{format(parseISO(log.createdAt), 'MMM d, h:mm a')}</span>
              <span className="ml-2 text-slate-700 dark:text-slate-200">{log.message}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  const renderActivationStep = () => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('views.contracts.renewLease.workflow.activationDate')}</Label>
          <div className="mt-1.5">
            <AppDatePicker mode="single" value={activationDate} onChange={setActivationDate} />
          </div>
        </div>
        <div>
          <Label>{t('views.contracts.renewLease.workflow.newContractNumber')}</Label>
          <Input
            readOnly
            value={payload?.newContractPreview?.contractNumber ?? t('views.contracts.renewLease.workflow.generatedOnActivate')}
            className="mt-1.5 h-11 rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-950/80"
          />
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t('views.contracts.renewLease.keepHistory')}</p>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 'summary':
        return renderSummaryStep();
      case 'balance':
        return renderBalanceStep();
      case 'terms':
        return renderTermsStep();
      case 'agreement':
        return renderAgreementStep();
      case 'approval':
        return renderApprovalStep();
      case 'activation':
        return renderActivationStep();
      default:
        return null;
    }
  };

  const footer = (
    <div className="renew-lease-footer sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white px-1 pt-3 dark:border-slate-600 dark:bg-slate-950">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" className={modalDismissButtonClass} onClick={onClose} disabled={activating}>
              {t('views.contracts.cancel')}
            </Button>
            <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={() => void handleSaveDraft()} disabled={saving || !renewal}>
              {t('views.contracts.renewLease.workflow.saveDraft')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STEP_INDEX[step] > 0 ? (
              <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={goBack}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('views.contracts.renewLease.workflow.back')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={() => void handlePreviewAgreement()} disabled={!renewal}>
              {t('views.contracts.renewLease.workflow.previewAgreement')}
            </Button>
            {step !== 'activation' ? (
              <Button
                type="button"
                variant="outline"
                className={modalOutlineButtonClass}
                onClick={() => void goNext()}
                disabled={saving || loading}
              >
                {t('views.contracts.renewLease.workflow.next')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className={modalActionButtonClass}
                onClick={() => void handleActivate()}
                disabled={activating || !readyForActivation}
              >
                {activating ? t('views.contracts.renewLease.renewing') : t('views.contracts.renewLease.workflow.activateLease')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('views.contracts.renewLease.title', { unit: unitNumber })}
      subtitle={tenantName ? t('views.contracts.renewLease.tenant', { name: tenantName }) : undefined}
      maxWidth="3xl"
      variant="glass"
      compact
      footer={footer}
    >
      <div className={cn('renew-lease-modal space-y-4', className)}>
        {stepper}

        {outstanding > 0 && !carryOver ? (
          <div
            className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            <p>{t('views.contracts.renewLease.workflow.outstandingWarning', { amount: formatPhp(outstanding) })}</p>
          </div>
        ) : remainingScheduled > 0 ? (
          <div
            className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-500/40 dark:bg-sky-950 dark:text-sky-100"
            role="status"
          >
            <Info className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
            <div className="space-y-0.5">
              <p className="font-medium">
                {t('views.contracts.renewLease.workflow.remainingScheduledWarning', {
                  amount: formatPhp(remainingScheduled),
                  months: remainingMonths,
                  monthly: formatPhp(previousRent),
                })}
              </p>
              <p className="text-xs opacity-90">
                {t('views.contracts.renewLease.workflow.remainingScheduledWarningHint')}
              </p>
            </div>
          </div>
        ) : null}

        {readyForActivation && step === 'activation' ? (
          <div
            className="flex gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-100"
            role="status"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
            <p>{t('views.contracts.renewLease.workflow.readyBanner')}</p>
          </div>
        ) : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('views.contracts.renewLease.workflow.loading')}</p>
        ) : error ? (
          <p className="py-4 text-center text-sm text-rose-600">{error}</p>
        ) : (
          renderStep()
        )}
      </div>
    </Modal>
  );
}

export { RenewLeaseWorkflowModal as RenewLeaseModal };
