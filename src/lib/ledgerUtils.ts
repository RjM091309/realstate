import { addDays, differenceInCalendarDays, endOfMonth, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import type { Contract, Payment } from '@/types';

export type LedgerTab = 'outstanding' | 'this_month' | 'paid';

export type ContractLedgerMetrics = {
  contractId: string;
  outstandingBalance: number;
  nextDueDate: string | null;
  overdueDays: number | null;
  totalPaid: number;
  leaseStatus: string;
  daysUntilExpiry: number | null;
};

export function ledgerCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function toLedgerYmd(value?: string | null): string {
  if (!value?.trim()) return '';
  const slice = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) return slice;
  try {
    const d = parseISO(value.trim());
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function ledgerTodayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isPaymentDueInMonth(payment: Payment, monthKey: string): boolean {
  const due = toLedgerYmd(payment.dueDate);
  if (!due || !monthKey) return false;
  return due.startsWith(monthKey);
}

export function isPaymentPaidInMonth(payment: Payment, monthKey: string): boolean {
  if (payment.status !== 'Paid' || !payment.paidDate) return false;
  const paid = toLedgerYmd(payment.paidDate);
  if (!paid || !monthKey) return false;
  return paid.startsWith(monthKey);
}

export function isPaymentPaidBetween(
  payment: Payment,
  fromYmd: string,
  toYmd: string,
): boolean {
  if (payment.status !== 'Paid') return false;
  const paid = toLedgerYmd(payment.paidDate || payment.dueDate);
  if (!paid || paid.length < 10) return false;
  return paid >= fromYmd.slice(0, 10) && paid <= toYmd.slice(0, 10);
}

export function isLedgerPaymentPastDue(payment: Payment): boolean {
  if (payment.status === 'Paid') return false;
  if (payment.status === 'Overdue') return true;
  const due = toLedgerYmd(payment.dueDate);
  if (!due) return false;
  return due <= ledgerTodayYmd();
}

export function isLedgerPaymentFutureScheduled(payment: Payment): boolean {
  if (payment.status === 'Paid') return false;
  const due = toLedgerYmd(payment.dueDate);
  if (!due) return false;
  return due > ledgerTodayYmd();
}

export function isLedgerPaymentDueSoon(payment: Payment, withinDays = 7): boolean {
  if (payment.status === 'Paid') return false;
  const due = toLedgerYmd(payment.dueDate);
  if (!due) return false;
  const today = ledgerTodayYmd();
  const limit = toLedgerYmd(addDays(new Date(), withinDays).toISOString());
  return due >= today && due <= limit;
}

export function paymentMatchesLedgerTab(
  payment: Payment,
  tab: LedgerTab,
  monthKey: string,
): boolean {
  switch (tab) {
    case 'outstanding':
      return isLedgerPaymentPastDue(payment);
    case 'this_month':
      return isPaymentDueInMonth(payment, monthKey);
    case 'paid':
      return isPaymentPaidInMonth(payment, monthKey);
    default:
      return false;
  }
}

export function computeContractLedgerMetrics(
  contractId: string,
  payments: Payment[],
  contract?: Contract,
): ContractLedgerMetrics {
  const contractPayments = payments.filter((p) => String(p.contractId) === String(contractId));
  const overduePayments = contractPayments.filter(isLedgerPaymentPastDue);
  const outstandingBalance = overduePayments.reduce((sum, p) => sum + p.amount, 0);

  const unpaid = contractPayments
    .filter((p) => p.status !== 'Paid')
    .slice()
    .sort((a, b) => toLedgerYmd(a.dueDate).localeCompare(toLedgerYmd(b.dueDate)));
  const nextDueDate = unpaid[0]?.dueDate ? toLedgerYmd(unpaid[0].dueDate) : null;

  let overdueDays: number | null = null;
  if (overduePayments.length > 0) {
    const oldestDue = overduePayments
      .map((p) => toLedgerYmd(p.dueDate))
      .filter(Boolean)
      .sort()[0];
    if (oldestDue) {
      try {
        overdueDays = Math.max(
          0,
          differenceInCalendarDays(parseISO(ledgerTodayYmd()), parseISO(oldestDue)),
        );
      } catch {
        overdueDays = null;
      }
    }
  }

  const totalPaid = contractPayments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  let daysUntilExpiry: number | null = null;
  const endYmd = contract?.endDate ? toLedgerYmd(contract.endDate) : '';
  if (endYmd) {
    try {
      daysUntilExpiry = differenceInCalendarDays(parseISO(endYmd), parseISO(ledgerTodayYmd()));
    } catch {
      daysUntilExpiry = null;
    }
  }

  return {
    contractId,
    outstandingBalance,
    nextDueDate,
    overdueDays,
    totalPaid,
    leaseStatus: contract?.status ?? '—',
    daysUntilExpiry,
  };
}

export function computeLedgerSummary(payments: Payment[]) {
  const monthKey = ledgerCurrentMonthKey();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const expectedCollection = payments
    .filter((p) => isPaymentDueInMonth(p, monthKey))
    .reduce((sum, p) => sum + p.amount, 0);

  const actualCollected = payments
    .filter((p) => isPaymentPaidInMonth(p, monthKey))
    .reduce((sum, p) => sum + p.amount, 0);

  const overdueBalance = payments
    .filter(isLedgerPaymentPastDue)
    .reduce((sum, p) => sum + p.amount, 0);

  const scheduledBalance = payments
    .filter(isLedgerPaymentFutureScheduled)
    .reduce((sum, p) => sum + p.amount, 0);

  const overdueCount = payments.filter(isLedgerPaymentPastDue).length;
  const thisMonthCount = payments.filter((p) => isPaymentDueInMonth(p, monthKey)).length;
  const totalPaidAll = payments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    expectedCollection,
    actualCollected,
    overdueBalance,
    scheduledBalance,
    overdueCount,
    thisMonthCount,
    totalPaidAll,
    monthKey,
  };
}
