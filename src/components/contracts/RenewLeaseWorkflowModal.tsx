import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
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

type UiPhase = 'overview' | 'terms' | 'finish';

const UI_PHASES: Array<{ phase: UiPhase; labelKey: string; firstStep: LeaseRenewalWorkflowStep }> = [
  { phase: 'overview', labelKey: 'stepOverview', firstStep: 'summary' },
  { phase: 'terms', labelKey: 'stepTerms', firstStep: 'terms' },
  { phase: 'finish', labelKey: 'stepFinish', firstStep: 'agreement' },
];

function stepToPhase(step: LeaseRenewalWorkflowStep): UiPhase {
  if (step === 'summary' || step === 'balance') return 'overview';
  if (step === 'terms') return 'terms';
  return 'finish';
}

function phaseIndex(phase: UiPhase): number {
  return UI_PHASES.findIndex((p) => p.phase === phase);
}

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
  const [showMoreFees, setShowMoreFees] = useState(false);

  const uiPhase = stepToPhase(step);

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

    try {
      if (uiPhase === 'overview') {
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
          'terms',
        );
        return;
      }

      if (uiPhase === 'terms') {
        const terms = buildTermsPatch();
        if (!terms) {
          toast.error(t('views.contracts.renewLease.validationRent'));
          return;
        }
        await persistPatch({ terms, workflowStep: 'terms' }, 'agreement');
        return;
      }
    } catch {
      // toast shown
    }
  };

  const goBack = () => {
    if (uiPhase === 'terms') setStep('summary');
    else if (uiPhase === 'finish') setStep('terms');
  };

  const goToPhase = (phase: UiPhase) => {
    const target = UI_PHASES.find((p) => p.phase === phase);
    if (target) setStep(target.firstStep);
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
    <div className="renew-lease-stepper mb-4">
      <div className="flex items-center gap-2">
        {UI_PHASES.map((s, i) => {
          const active = uiPhase === s.phase;
          const done = phaseIndex(uiPhase) > i;
          return (
            <React.Fragment key={s.phase}>
              {i > 0 ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
              ) : null}
              <button
                type="button"
                onClick={() => goToPhase(s.phase)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-center text-xs font-semibold transition-colors',
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

  const renderOverviewStep = () => (
    <div className="space-y-4">
      {renewal ? (
        <StatusBadge tone={leaseRenewalStatusVariant(renewal.renewalStatus)}>
          {t(`views.contracts.renewLease.workflow.${renewalStatusLabelKey(renewal.renewalStatus)}`)}
        </StatusBadge>
      ) : null}

      <div className={cn('grid gap-3 sm:grid-cols-2', RENEW_LEASE_PANEL)}>
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
            {t('views.contracts.renewLease.previousRent')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-brand-blue dark:text-blue-300">{formatPhp(previousRent)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('views.contracts.renewLease.workflow.tenantName')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {summary?.tenantName ?? tenantName ?? '—'}
          </div>
        </div>
      </div>

      {outstanding > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-950/80">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            {t('views.contracts.renewLease.workflow.outstandingWarning', { amount: formatPhp(outstanding) })}
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={carryOver}
              onChange={(e) => setCarryOver(e.target.checked)}
            />
            <span className="text-sm text-slate-800 dark:text-slate-100">
              {t('views.contracts.renewLease.workflow.allowCarryOver')}
            </span>
          </label>
          {carryOver ? (
            <Textarea
              value={carryOverReason}
              onChange={(e) => setCarryOverReason(e.target.value)}
              className="mt-2 min-h-[64px] rounded-xl bg-white dark:bg-slate-950"
              placeholder={t('views.contracts.renewLease.workflow.carryOverReasonPlaceholder')}
            />
          ) : null}
        </div>
      ) : remainingScheduled > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/80 dark:text-sky-100">
          <p>
            {t('views.contracts.renewLease.workflow.remainingScheduledWarning', {
              amount: formatPhp(remainingScheduled),
              months: remainingMonths,
              monthly: formatPhp(previousRent),
            })}
          </p>
          <p className="mt-1 text-xs opacity-90">
            {t('views.contracts.renewLease.workflow.remainingScheduledWarningHint')}
          </p>
        </div>
      ) : null}
    </div>
  );

  const renderTermsStep = () => (
    <div className={cn('renew-lease-shell space-y-4', RENEW_LEASE_SHELL)}>
      <div>
        <Label>{t('views.contracts.renewLease.workflow.leaseTermPreset')}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['12', '24'] as const).map((term) => (
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
        {startDate && endDate ? (
          <p className="mt-2 text-xs text-slate-500">
            {format(startDate, 'MMM d, yyyy')} — {format(endDate, 'MMM d, yyyy')}
            {leaseTermLabel ? ` · ${leaseTermLabel}` : ''}
          </p>
        ) : null}
      </div>

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
        <Label>{t('views.contracts.renewLease.newMonthlyRent')}</Label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={rentInput}
            onChange={(e) => setRentInput(e.target.value)}
            onBlur={() => setRentInput(formatRentInput(rentInput))}
            placeholder={formatRentInput(String(previousRent))}
            className="h-11 rounded-xl"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => applyRentIncrease(5)}>
              {t('views.contracts.renewLease.workflow.suggest5')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => applyRentIncrease(10)}>
              {t('views.contracts.renewLease.workflow.suggest10')}
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {t('views.contracts.renewLease.previousRent')}: {formatPhp(previousRent)}
          {increaseAmount !== 0 ? (
            <span className="ml-2 text-brand-blue">
              ({increasePct > 0 ? '+' : ''}{increasePct.toFixed(1)}%)
            </span>
          ) : null}
        </p>
      </div>

      <button
        type="button"
        className="text-xs font-semibold text-brand-blue hover:underline dark:text-blue-300"
        onClick={() => setShowMoreFees((v) => !v)}
      >
        {showMoreFees
          ? t('views.contracts.renewLease.workflow.hideMoreFees')
          : t('views.contracts.renewLease.workflow.showMoreFees')}
      </button>
      {showMoreFees ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t('views.contracts.renewLease.workflow.securityDeposit')}</Label>
            <Input value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
          </div>
          <div>
            <Label>{t('views.contracts.renewLease.workflow.advanceRent')}</Label>
            <Input value={advanceRent} onChange={(e) => setAdvanceRent(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
          </div>
          <div>
            <Label>{t('views.contracts.renewLease.workflow.parkingFee')}</Label>
            <Input value={parkingFee} onChange={(e) => setParkingFee(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
          </div>
          <div>
            <Label>{t('views.contracts.renewLease.workflow.associationDues')}</Label>
            <Input value={associationDues} onChange={(e) => setAssociationDues(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
          </div>
          <div>
            <Label>{t('views.contracts.renewLease.workflow.renewalFee')}</Label>
            <Input value={renewalFee} onChange={(e) => setRenewalFee(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderFinishStep = () => {
    const terms = buildTermsPatch();
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={cn('p-3', RENEW_LEASE_PANEL)}>
            <div className="text-[10px] font-bold uppercase text-slate-400">{t('views.contracts.renewLease.workflow.oldContract')}</div>
            <div className="mt-1 text-sm font-semibold">{formatPhp(previousRent)} / mo</div>
          </div>
          <div className={cn('border-brand-blue/30 bg-brand-blue/5 p-3', RENEW_LEASE_PANEL)}>
            <div className="text-[10px] font-bold uppercase text-brand-blue">{t('views.contracts.renewLease.workflow.newContract')}</div>
            <div className="mt-1 text-sm font-semibold text-brand-blue dark:text-blue-200">
              {terms ? formatPhp(terms.monthlyRent) : '—'} / mo
            </div>
            <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {terms ? `${format(parseISO(terms.startDate), 'MMM d, yyyy')} — ${format(parseISO(terms.endDate), 'MMM d, yyyy')}` : '—'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => void handlePreviewAgreement()} disabled={!renewal}>
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            {t('views.contracts.renewLease.workflow.previewAgreement')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            disabled={!renewal}
            onClick={() =>
              renewal &&
              void downloadRenewalDraftPdf(renewal.id, `renewal-${summary?.contractNumber ?? renewal.id}.pdf`).catch((e) =>
                toast.error(e.message),
              )
            }
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t('views.contracts.renewLease.workflow.downloadDraft')}
          </Button>
        </div>

        <div className={cn('space-y-3 p-3', RENEW_LEASE_SHELL)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('views.contracts.renewLease.workflow.finishApprovals')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={renewal?.tenantSignatureStatus === 'signed' ? 'success' : 'warning'}>
              {t(`views.contracts.renewLease.workflow.sig_${renewal?.tenantSignatureStatus ?? 'pending'}`)}
            </StatusBadge>
            {renewal?.tenantSignatureStatus !== 'signed' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
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
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={renewal?.approvalStatus === 'approved' ? 'success' : renewal?.approvalStatus === 'rejected' ? 'danger' : 'info'}>
              {t(`views.contracts.renewLease.workflow.approval_${renewal?.approvalStatus ?? 'pending'}`)}
            </StatusBadge>
            {renewal?.approvalStatus !== 'approved' ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700"
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
            ) : null}
          </div>
        </div>

        <div>
          <Label>{t('views.contracts.renewLease.workflow.activationDate')}</Label>
          <div className="mt-1.5 max-w-xs">
            <AppDatePicker mode="single" value={activationDate} onChange={setActivationDate} />
          </div>
        </div>

        {!readyForActivation ? (
          <p className="text-xs text-slate-500">{t('views.contracts.renewLease.workflow.finishHint')}</p>
        ) : null}
      </div>
    );
  };

  const renderStep = () => {
    switch (uiPhase) {
      case 'overview':
        return renderOverviewStep();
      case 'terms':
        return renderTermsStep();
      case 'finish':
        return renderFinishStep();
      default:
        return null;
    }
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2">
        <Button type="button" className={modalDismissButtonClass} onClick={onClose} disabled={activating}>
          {t('views.contracts.cancel')}
        </Button>
        {uiPhase !== 'finish' ? (
          <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={() => void handleSaveDraft()} disabled={saving || !renewal}>
            {t('views.contracts.renewLease.workflow.saveDraft')}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {uiPhase !== 'overview' ? (
          <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={goBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('views.contracts.renewLease.workflow.back')}
          </Button>
        ) : null}
        {uiPhase === 'finish' ? (
          <Button
            type="button"
            className={modalActionButtonClass}
            onClick={() => void handleActivate()}
            disabled={activating || !readyForActivation}
          >
            {activating ? t('views.contracts.renewLease.renewing') : t('views.contracts.renewLease.workflow.activateLease')}
          </Button>
        ) : (
          <Button type="button" className={modalActionButtonClass} onClick={() => void goNext()} disabled={saving || loading}>
            {t('views.contracts.renewLease.workflow.next')}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
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

        {readyForActivation && uiPhase === 'finish' ? (
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
