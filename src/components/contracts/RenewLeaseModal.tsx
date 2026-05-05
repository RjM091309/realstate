import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { addDays, addYears, format, parseISO } from 'date-fns';
import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import { renewContract } from '@/lib/contractsApi';
import { cn } from '@/lib/utils';
import type { Contract } from '@/types';

export type BalanceHandling = 'carry_over' | 'require_payment';

export type RenewLeaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Unit label shown in the title, e.g. "210-A" */
  unitNumber: string;
  /** Primary tenant display name */
  tenantName: string;
  /** Current lease row being renewed */
  contract: Contract | null;
  /** Unpaid rent + fees from payment schedule (sum of non-paid rows for this contract) */
  unpaidBalance: number;
  /** Called after successful API renewal */
  onRenewed?: (contract: Contract) => void;
  /** Optional loading indicator override */
  className?: string;
};

function formatPhp(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0.00';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stripDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rentWithFivePercentIncrease(base: number): number {
  return Math.round(base * 1.05 * 100) / 100;
}

function defaultRenewRange(previous: Contract): { start: Date; end: Date; suggestedRent: number } {
  const prevEnd = stripDate(parseISO(previous.endDate));
  const start = addDays(prevEnd, 1);
  const end = addYears(start, 1);
  const rawBase = Number(previous.monthlyRent);
  const bumped = rentWithFivePercentIncrease(rawBase);
  return {
    start,
    end,
    suggestedRent: Number.isFinite(bumped) && bumped > 0 ? bumped : rawBase,
  };
}

export function RenewLeaseModal({
  isOpen,
  onClose,
  unitNumber,
  tenantName,
  contract,
  unpaidBalance,
  onRenewed,
  className,
}: RenewLeaseModalProps) {
  const [balanceHandling, setBalanceHandling] = useState<BalanceHandling>('carry_over');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [monthlyRent, setMonthlyRent] = useState('');
  const [notes, setNotes] = useState('');
  const [keepHistory, setKeepHistory] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !contract) return;
    const { start, end, suggestedRent } = defaultRenewRange(contract);
    setStartDate(start);
    setEndDate(end);
    setMonthlyRent(String(suggestedRent));
    setNotes('');
    setKeepHistory(true);
    setBalanceHandling('carry_over');
    setSubmitError(null);
    setFieldError(null);
  }, [isOpen, contract?.id, contract]);

  const showBalanceBanner = unpaidBalance > 0;

  const applySuggestedIncrease = useCallback(() => {
    if (!contract) return;
    const base = Number(contract.monthlyRent);
    if (!Number.isFinite(base) || base <= 0) return;
    setMonthlyRent(String(rentWithFivePercentIncrease(base)));
  }, [contract]);

  const validationMessage = useMemo(() => {
    if (!startDate || !endDate) return 'Please select start and end dates.';
    if (endDate <= startDate) return 'Lease end date must be after the start date.';
    const rent = Number(monthlyRent);
    if (!Number.isFinite(rent) || rent <= 0) return 'Monthly rent must be greater than zero.';
    return null;
  }, [startDate, endDate, monthlyRent]);

  const handleSubmit = async () => {
    setSubmitError(null);
    setFieldError(null);
    if (!contract) return;
    const v = validationMessage;
    if (v) {
      setFieldError(v);
      return;
    }
    if (balanceHandling === 'require_payment' && unpaidBalance > 0) {
      setSubmitError('Tenant must settle balance before renewal');
      return;
    }
    if (!startDate || !endDate) return;

    setSubmitting(true);
    try {
      const next = await renewContract(contract.id, {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        monthlyRent: Number(monthlyRent),
        balanceHandling,
        keepHistory,
        notes: notes.trim() || null,
      });
      onRenewed?.(next);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Renewal failed';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
      <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={submitting}>
        Cancel
      </Button>
      <Button
        type="button"
        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
        onClick={() => void handleSubmit()}
        disabled={submitting || !contract}
      >
        {submitting ? 'Renewing…' : 'Renew Lease'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Renew Lease for Unit ${unitNumber}`}
      subtitle={tenantName ? `Tenant: ${tenantName}` : undefined}
      maxWidth="lg"
      variant="glass"
      footer={footer}
    >
      <div className={cn('space-y-5', className)}>
        {showBalanceBanner && (
          <div
            className={cn(
              'flex gap-3 rounded-2xl border px-4 py-3 text-sm',
              'border-amber-300/80 bg-amber-50 text-amber-950',
              'dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100',
            )}
            role="status"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            <p>
              <span className="font-semibold">Unpaid balance.</span>{' '}
              This tenant has {formatPhp(unpaidBalance)} unpaid balance.
            </p>
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Balance before renewal</legend>
          <label
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-colors',
              balanceHandling === 'carry_over'
                ? 'border-indigo-400 bg-indigo-50/80 dark:border-indigo-500/50 dark:bg-indigo-500/10'
                : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80',
            )}
          >
            <input
              type="radio"
              name="balanceHandling"
              className="mt-1"
              checked={balanceHandling === 'carry_over'}
              onChange={() => setBalanceHandling('carry_over')}
            />
            <span>
              <span className="font-medium text-slate-900 dark:text-slate-50">Carry over unpaid balance to new contract</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Outstanding schedule rows stay linked; notes will record the carried amount.
              </span>
            </span>
          </label>
          <label
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-colors',
              balanceHandling === 'require_payment'
                ? 'border-indigo-400 bg-indigo-50/80 dark:border-indigo-500/50 dark:bg-indigo-500/10'
                : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80',
            )}
          >
            <input
              type="radio"
              name="balanceHandling"
              className="mt-1"
              checked={balanceHandling === 'require_payment'}
              onChange={() => setBalanceHandling('require_payment')}
            />
            <span>
              <span className="font-medium text-slate-900 dark:text-slate-50">Require full payment before renewal</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Blocks renewal until the schedule shows no unpaid balance.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>New Lease Start Date</Label>
            <AppDatePicker
              mode="single"
              value={startDate}
              onChange={(d) => setStartDate((d as Date | null) ?? null)}
              placeholder="Start date"
              fullWidth
              inputClassName="h-12 rounded-xl text-sm max-w-none"
            />
          </div>
          <div className="space-y-2">
            <Label>New Lease End Date</Label>
            <AppDatePicker
              mode="single"
              value={endDate}
              onChange={(d) => setEndDate((d as Date | null) ?? null)}
              placeholder="End date"
              fullWidth
              inputClassName="h-12 rounded-xl text-sm max-w-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>New Monthly Rent</Label>
            <button
              type="button"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              onClick={applySuggestedIncrease}
            >
              Suggest +5%
            </button>
          </div>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-12 rounded-xl border-slate-200 dark:border-slate-600"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
          />
          {contract ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Previous rent: {formatPhp(Number(contract.monthlyRent))}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            className="min-h-[88px] rounded-xl border-slate-200 dark:border-slate-600"
            placeholder="Optional terms, reminders, or internal notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 rounded border-slate-300"
            checked={keepHistory}
            onChange={(e) => setKeepHistory(e.target.checked)}
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Keep history and create new lease record
          </span>
        </label>

        {fieldError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {fieldError}
          </p>
        ) : null}
        {submitError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
