import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Mail,
  RotateCcw,
  Search,
  Scale,
  Trash2,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import { paymentStatusVariant, contractStatusVariant } from '@/lib/statusBadge';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { SkeletonTable } from '@/components/skeleton';
import { cn } from '@/lib/utils';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchContracts, updateContract } from '@/lib/contractsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { createPayment, deletePayment, fetchPayments, updatePayment } from '@/lib/paymentsApi';
import { createContractInvoice } from '@/lib/invoicesApi';
import {
  computeContractLedgerMetrics,
  computeLedgerSummary,
  isLedgerPaymentPastDue,
  isPaymentPaidBetween,
  ledgerCurrentMonthKey,
  ledgerTodayYmd,
  paymentMatchesLedgerTab,
  toLedgerYmd,
  type LedgerTab,
} from '@/lib/ledgerUtils';
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useDateRange } from '@/context/DateRangeContext';
import { LEDGER_PAYMENT_METHODS, type Contract, type Payment, type PaymentMethod, type Tenant, type Unit } from '@/types';

const LEDGER_SELECT_CLASS = '[&_.unit-form-select-control]:!min-h-12';
const LEDGER_TABS: LedgerTab[] = ['this_month', 'outstanding', 'paid'];

type LedgerStatTone = 'danger' | 'success' | 'neutral';

function LedgerStatCard({
  label,
  value,
  subtitle,
  tone,
  icon,
  index = 0,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone: LedgerStatTone;
  icon: React.ReactNode;
  index?: number;
}) {
  const fromLeft = index % 2 === 0;
  const iconColor =
    tone === 'danger' ? 'bg-rose-500' : tone === 'success' ? 'bg-brand-green' : 'bg-brand-blue';
  const valueColor =
    tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'success'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-slate-800 dark:text-slate-100';
  const footerVariant =
    tone === 'danger' ? 'alert' : tone === 'success' ? 'up' : 'neutral';

  return (
    <motion.div
      initial="hidden"
      animate="show"
      whileHover="hover"
      variants={{
        hidden: {
          opacity: 0,
          x: fromLeft ? -36 : 36,
          y: 18,
          scale: 0.88,
        },
        show: {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: {
            type: 'spring',
            stiffness: 260,
            damping: 16,
            mass: 0.9,
            delay: 0.06 + index * 0.09,
          },
        },
        hover: {
          scale: 1.035,
          y: -4,
          borderColor: 'rgba(75,137,205,0.45)',
          boxShadow: '0 18px 36px -16px rgba(75,137,205,0.4), 0 8px 16px -10px rgba(15,23,42,0.2)',
          transition: { type: 'spring', stiffness: 420, damping: 18 },
        },
      }}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-100/90 bg-white/95 p-4 text-left',
        'shadow-[0_8px_24px_-14px_rgba(15,23,42,0.22)]',
        'dark:border-slate-800 dark:bg-slate-900/90',
        'dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)]',
      )}
    >
      <div className="relative mb-4 flex items-start justify-between">
        <motion.div
          initial={{ scale: 0, rotate: -28 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 460,
            damping: 14,
            delay: 0.18 + index * 0.08,
          }}
          variants={{
            show: { scale: 1, y: 0 },
            hover: { scale: 1.12, y: -3, transition: { type: 'spring', stiffness: 400, damping: 16 } },
          }}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg',
            'ring-1 ring-white/25',
            iconColor,
          )}
        >
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.4 + index * 0.15, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            {icon}
          </motion.span>
        </motion.div>
        <div className="text-right">
          <motion.p
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.08, duration: 0.35 }}
            className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            {label}
          </motion.p>
          <div className="overflow-hidden">
            <motion.h3
              key={value}
              initial={{ y: '110%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 18,
                delay: 0.22 + index * 0.08,
              }}
              className={cn('text-3xl font-bold tabular-nums', valueColor)}
            >
              {value}
            </motion.h3>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.32 + index * 0.08, duration: 0.4 }}
        style={{ transformOrigin: 'left center' }}
        className={cn(
          'relative mt-auto flex items-center gap-1 border-t border-slate-50 pt-3 text-xs font-medium transition-colors dark:border-slate-800',
          footerVariant === 'up' && 'text-brand-green',
          footerVariant === 'alert' && 'text-rose-500',
          footerVariant === 'neutral' && 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500',
        )}
      >
        {footerVariant === 'up' && (
          <motion.span
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <BadgeCheck className="h-3 w-3" />
          </motion.span>
        )}
        {footerVariant === 'alert' && <AlertCircle className="h-3 w-3" />}
        {subtitle ?? (tone === 'danger' ? 'Requires attention' : tone === 'success' ? 'All recorded payments' : '—')}
      </motion.div>
    </motion.div>
  );
}

function shiftLedgerMonth(monthKey: string, delta: number): string {
  try {
    const d = parseISO(`${monthKey}-01`);
    const next = delta < 0 ? subMonths(d, 1) : addMonths(d, 1);
    return format(next, 'yyyy-MM');
  } catch {
    return ledgerCurrentMonthKey();
  }
}

function formatLedgerMonthLabel(monthKey: string): string {
  try {
    return format(parseISO(`${monthKey}-01`), 'MMMM yyyy');
  } catch {
    return monthKey;
  }
}

function formatPaymentDate(value?: string | null): string {
  const ymd = toLedgerYmd(value);
  if (!ymd) return '—';
  try {
    const d = parseISO(ymd);
    return Number.isNaN(d.getTime()) ? ymd : format(d, 'MMM dd, yyyy');
  } catch {
    return ymd;
  }
}

function paymentMatchesQuery(
  p: Payment,
  q: string,
  units: Unit[],
  contracts: Contract[],
  tenants: Tenant[],
): boolean {
  if (!q.trim()) return true;
  const needle = q.toLowerCase().trim();
  const unit = units.find((u) => u.id === p.unitId);
  const contract = contracts.find((c) => c.id === p.contractId);
  const tenant = contract ? tenants.find((ten) => ten.id === contract.tenantId) : null;
  const hay = [
    p.id,
    p.contractId,
    unit?.unitNumber,
    unit?.buildingName,
    tenant?.name,
    String(p.amount),
    p.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

function displayPaymentStatus(payment: Payment): 'Paid' | 'Overdue' | 'Pending' {
  if (payment.status === 'Paid') return 'Paid';
  if (isLedgerPaymentPastDue(payment)) return 'Overdue';
  return 'Pending';
}

const KNOWN_PAYMENT_METHODS = new Set(['cash', 'bank_transfer', 'online', 'check', 'other']);

function paymentMethodLabel(method: string | undefined, t: (key: string) => string): string {
  if (!method) return '—';
  if (KNOWN_PAYMENT_METHODS.has(method)) {
    return t(`views.ledger.paymentMethods.${method}`);
  }
  return method;
}

export function LeaseLedgerView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { dateRange } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef(false);
  const initialTabSetRef = useRef(false);
  const canCreate = session?.crud?.ledger?.create ?? false;
  const canUpdate = session?.crud?.ledger?.update ?? false;
  const canDelete = session?.crud?.ledger?.delete ?? false;

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>('this_month');
  const [ledgerMonth, setLedgerMonth] = useState(ledgerCurrentMonthKey());
  const [ledgerFilterUnitId, setLedgerFilterUnitId] = useState<string | null>(null);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleContractId, setScheduleContractId] = useState<string | null>(null);
  const [highlightPaymentId, setHighlightPaymentId] = useState<string | null>(null);
  const [paidHighlightRange, setPaidHighlightRange] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [refLoading, setRefLoading] = useState(false);
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyDueDate, setPenaltyDueDate] = useState(ledgerTodayYmd());
  const [penaltyNote, setPenaltyNote] = useState('');

  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [settlementDeductions, setSettlementDeductions] = useState('0');

  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);
  const [markPaidPayment, setMarkPaidPayment] = useState<Payment | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
    void (async () => {
      let hadError = false;
      try {
        try {
          setPayments(await fetchPayments());
        } catch {
          hadError = true;
          setPayments([]);
        }
        try {
          setUnits(await fetchUnits());
        } catch {
          hadError = true;
          setUnits([]);
        }
        try {
          setContracts(await fetchContracts());
        } catch {
          hadError = true;
          setContracts([]);
        }
        try {
          setTenants(await fetchTenants());
        } catch {
          hadError = true;
          setTenants([]);
        }
        if (hadError) toast.warning(t('views.ledger.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const summary = useMemo(() => computeLedgerSummary(payments), [payments]);

  // Header date-range picker drives "Actually Collected" — an as-of-today
  // running total (overdueBalance/totalPaidAll) stays unfiltered on purpose.
  const rangeCollected = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return summary.actualCollected;
    return payments
      .filter((p) => isPaymentPaidBetween(p, dateRange.start, dateRange.end))
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments, dateRange.start, dateRange.end, summary.actualCollected]);

  const rangeCollectedLabel = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return formatLedgerMonthLabel(summary.monthKey);
    return `${formatPaymentDate(dateRange.start)} – ${formatPaymentDate(dateRange.end)}`;
  }, [dateRange.start, dateRange.end, summary.monthKey]);

  useEffect(() => {
    if (loading || initialTabSetRef.current) return;
    initialTabSetRef.current = true;
    if (summary.overdueCount > 0) setLedgerTab('outstanding');
    else setLedgerTab('this_month');
  }, [loading, summary.overdueCount]);

  const ensureReferenceDataLoaded = useCallback(async () => {
    if (refLoading) return;
    if (units.length && contracts.length && tenants.length) return;
    setRefLoading(true);
    let hadError = false;
    try {
      if (!units.length) {
        try {
          setUnits(await fetchUnits());
        } catch {
          hadError = true;
          setUnits([]);
        }
      }
      if (!contracts.length) {
        try {
          setContracts(await fetchContracts());
        } catch {
          hadError = true;
          setContracts([]);
        }
      }
      if (!tenants.length) {
        try {
          setTenants(await fetchTenants());
        } catch {
          hadError = true;
          setTenants([]);
        }
      }
    } finally {
      setRefLoading(false);
      if (hadError) toast.warning(t('views.ledger.loadError'));
    }
  }, [contracts.length, refLoading, t, tenants.length, units.length]);

  const contractMetricsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeContractLedgerMetrics>>();
    for (const contract of contracts) {
      map.set(contract.id, computeContractLedgerMetrics(contract.id, payments, contract));
    }
    for (const payment of payments) {
      if (!map.has(payment.contractId)) {
        map.set(payment.contractId, computeContractLedgerMetrics(payment.contractId, payments));
      }
    }
    return map;
  }, [contracts, payments]);

  const getContractMetrics = useCallback(
    (contractId: string) =>
      contractMetricsMap.get(contractId) ??
      computeContractLedgerMetrics(contractId, payments, contracts.find((c) => c.id === contractId)),
    [contractMetricsMap, payments, contracts],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((p) => {
        if (!paymentMatchesQuery(p, searchTerm, units, contracts, tenants)) return false;
        if (ledgerFilterUnitId && p.unitId !== ledgerFilterUnitId) return false;
        if (paidHighlightRange && ledgerTab === 'paid') {
          return isPaymentPaidBetween(p, paidHighlightRange.from, paidHighlightRange.to);
        }
        return paymentMatchesLedgerTab(p, ledgerTab, ledgerMonth);
      }),
    [
      payments,
      searchTerm,
      units,
      contracts,
      tenants,
      ledgerTab,
      ledgerMonth,
      ledgerFilterUnitId,
      paidHighlightRange,
    ],
  );

  const highlightedPaidIds = useMemo(() => {
    if (!paidHighlightRange) return null;
    return new Set(
      payments
        .filter((p) => isPaymentPaidBetween(p, paidHighlightRange.from, paidHighlightRange.to))
        .map((p) => p.id),
    );
  }, [payments, paidHighlightRange]);

  const tabCounts = useMemo(
    () =>
      LEDGER_TABS.reduce(
        (acc, tab) => {
          acc[tab] = payments.filter(
            (p) =>
              paymentMatchesQuery(p, searchTerm, units, contracts, tenants) &&
              paymentMatchesLedgerTab(p, tab, ledgerMonth) &&
              (!ledgerFilterUnitId || p.unitId === ledgerFilterUnitId),
          ).length;
          return acc;
        },
        {} as Record<LedgerTab, number>,
      ),
    [payments, searchTerm, units, contracts, tenants, ledgerMonth, ledgerFilterUnitId],
  );

  const unitFilterOptions = useMemo(
    () => [
      { value: '', label: t('views.ledger.filterAllUnits') },
      ...[...units]
        .sort((a, b) =>
          String(a.unitNumber ?? '').localeCompare(String(b.unitNumber ?? ''), undefined, { numeric: true }),
        )
        .map((u) => ({
          value: u.id,
          label: u.buildingName ? `${u.unitNumber} · ${u.buildingName}` : String(u.unitNumber ?? u.id),
        })),
    ],
    [units, t],
  );

  const contractOptions = useMemo(
    () =>
      [...contracts]
        .sort((a, b) => {
          const aActive = a.status === 'Active' ? 0 : 1;
          const bActive = b.status === 'Active' ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          const ua = units.find((u) => u.id === a.unitId)?.unitNumber ?? '';
          const ub = units.find((u) => u.id === b.unitId)?.unitNumber ?? '';
          return String(ua).localeCompare(String(ub), undefined, { numeric: true });
        })
        .map((c) => {
          const unit = units.find((u) => u.id === c.unitId);
          const tenant = tenants.find((tnt) => tnt.id === c.tenantId);
          return {
            value: c.id,
            label: `${unit?.unitNumber ?? c.unitId} · ${tenant?.name ?? c.tenantId}${
              c.status === 'Active' ? '' : ` (${c.status})`
            }`,
          };
        }),
    [contracts, units, tenants],
  );

  const schedulePickerCards = useMemo(() => {
    const activeOrWithPayments = contracts.filter(
      (c) => c.status === 'Active' || payments.some((p) => String(p.contractId) === String(c.id)),
    );
    const list = activeOrWithPayments.length > 0 ? activeOrWithPayments : contracts;
    return [...list]
      .sort((a, b) => {
        const aActive = a.status === 'Active' ? 0 : 1;
        const bActive = b.status === 'Active' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        const ua = units.find((u) => u.id === a.unitId)?.unitNumber ?? '';
        const ub = units.find((u) => u.id === b.unitId)?.unitNumber ?? '';
        return String(ua).localeCompare(String(ub), undefined, { numeric: true });
      })
      .map((c) => {
        const unit = units.find((u) => u.id === c.unitId);
        const tenant = tenants.find((tnt) => tnt.id === c.tenantId);
        const rows = payments.filter((p) => String(p.contractId) === String(c.id));
        const overdue = rows.filter(isLedgerPaymentPastDue).length;
        return {
          id: c.id,
          unitLabel: unit?.unitNumber ?? c.unitId,
          building: unit?.buildingName || '',
          tenantName: tenant?.name ?? '—',
          status: c.status,
          monthlyRent: Number(c.monthlyRent || 0),
          overdue,
          total: rows.length,
        };
      });
  }, [contracts, payments, tenants, units]);

  const handlePreviewInvoice = useCallback((id: string) => {
    const url = `${window.location.origin}/preview?type=invoice&id=${encodeURIComponent(id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const downloadCsv = useCallback((fileName: string, rows: string[][]) => {
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? '');
            const escaped = s.replace(/"/g, '""');
            return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportReport = useCallback(() => {
    const rows: string[][] = [
      ['Payment ID', 'Contract ID', 'Unit', 'Tenant', 'Due Date', 'Paid Date', 'Status', 'Payment Method', 'Amount'],
      ...filteredPayments.map((p) => {
        const unit = units.find((u) => u.id === p.unitId);
        const contract = contracts.find((c) => c.id === p.contractId);
        const tenant = contract ? tenants.find((ten) => ten.id === contract.tenantId) : null;
        return [
          p.id,
          p.contractId,
          unit?.unitNumber ?? p.unitId,
          tenant?.name ?? '',
          p.dueDate,
          p.paidDate ?? '',
          displayPaymentStatus(p),
          p.status === 'Paid' ? paymentMethodLabel(p.paymentMethod, t) : '',
          String(p.amount),
        ];
      }),
    ];
    downloadCsv(`lease_ledger_${format(new Date(), 'yyyyMMdd')}.csv`, rows);
    toast.success(t('views.ledger.exported'));
  }, [contracts, downloadCsv, filteredPayments, t, tenants, units]);

  const schedulePayments = useMemo(() => {
    if (!scheduleContractId) return [];
    return payments
      .filter((p) => String(p.contractId) === String(scheduleContractId))
      .slice()
      .sort((a, b) => toLedgerYmd(a.dueDate).localeCompare(toLedgerYmd(b.dueDate)));
  }, [payments, scheduleContractId]);

  const scheduleContract = useMemo(
    () => (scheduleContractId ? contracts.find((c) => c.id === scheduleContractId) ?? null : null),
    [contracts, scheduleContractId],
  );

  const scheduleTenant = useMemo(() => {
    if (!scheduleContract) return null;
    return tenants.find((tnt) => tnt.id === scheduleContract.tenantId) ?? null;
  }, [scheduleContract, tenants]);

  const scheduleUnit = useMemo(() => {
    if (!scheduleContract) return null;
    return units.find((u) => u.id === scheduleContract.unitId) ?? null;
  }, [scheduleContract, units]);

  const scheduleHasOverdue = useMemo(
    () => schedulePayments.some(isLedgerPaymentPastDue),
    [schedulePayments],
  );

  const scheduleUnpaidTotal = useMemo(
    () =>
      schedulePayments
        .filter((p) => p.status !== 'Paid')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [schedulePayments],
  );

  const canSettleContract =
    scheduleContract != null &&
    (scheduleContract.status === 'Active' || scheduleContract.status === 'Expired');

  const scheduleSummary = useMemo(() => {
    const paid = schedulePayments.filter((p) => p.status === 'Paid').length;
    const total = schedulePayments.length;
    const overdueAmount = schedulePayments
      .filter(isLedgerPaymentPastDue)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const scheduledAmount = schedulePayments
      .filter((p) => p.status !== 'Paid' && !isLedgerPaymentPastDue(p))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { paid, total, overdueAmount, scheduledAmount };
  }, [schedulePayments]);

  const openScheduleModal = useCallback(
    (contractId?: string | null, highlightId?: string | null) => {
      setScheduleContractId(contractId ?? null);
      setHighlightPaymentId(highlightId ?? null);
      setIsScheduleModalOpen(true);
      void ensureReferenceDataLoaded();
    },
    [ensureReferenceDataLoaded],
  );

  useEffect(() => {
    if (loading || deepLinkHandledRef.current) return;
    const contractId = searchParams.get('contractId');
    const paymentId = searchParams.get('paymentId');
    const tabParam = searchParams.get('tab');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const validTabs: LedgerTab[] = ['this_month', 'outstanding', 'paid'];
    const hasTabDeepLink = Boolean(tabParam && validTabs.includes(tabParam as LedgerTab));
    const hasPaidRangeDeepLink =
      (Boolean(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(fromParam || '')) ||
      (Boolean(toParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam || ''));
    const hasScheduleDeepLink = Boolean(contractId || paymentId);

    if (!hasTabDeepLink && !hasPaidRangeDeepLink && !hasScheduleDeepLink) return;
    deepLinkHandledRef.current = true;
    initialTabSetRef.current = true;

    if (hasTabDeepLink) {
      setLedgerTab(tabParam as LedgerTab);
    }

    if (hasPaidRangeDeepLink || tabParam === 'paid') {
      if (!hasTabDeepLink) setLedgerTab('paid');
      const from = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : null;
      const to = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : from;
      if (from && to) {
        setPaidHighlightRange({ from, to });
        setLedgerMonth(from.slice(0, 7));
      }
    }

    if (hasScheduleDeepLink) {
      let resolvedContractId = contractId;
      if (!resolvedContractId && paymentId) {
        resolvedContractId =
          payments.find((p) => String(p.id) === String(paymentId))?.contractId ?? null;
      }
      if (resolvedContractId) openScheduleModal(resolvedContractId, paymentId);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('contractId');
    next.delete('paymentId');
    next.delete('tab');
    next.delete('from');
    next.delete('to');
    setSearchParams(next, { replace: true });
  }, [loading, openScheduleModal, payments, searchParams, setSearchParams]);

  const openCreateModal = useCallback(() => openScheduleModal(null, null), [openScheduleModal]);

  const openEditModal = useCallback(
    (payment: Payment) => openScheduleModal(payment.contractId, payment.id),
    [openScheduleModal],
  );

  const closeModal = useCallback(() => {
    setIsScheduleModalOpen(false);
    setScheduleContractId(null);
    setHighlightPaymentId(null);
    setScheduleBusyId(null);
    setIsPenaltyOpen(false);
    setIsSettlementOpen(false);
    setIsMarkPaidOpen(false);
    setMarkPaidPayment(null);
  }, []);

  const patchPaymentInList = useCallback((updated: Payment) => {
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const mergePaidPayment = useCallback(
    (updated: Payment, method?: PaymentMethod): Payment =>
      updated.status === 'Paid'
        ? { ...updated, paymentMethod: updated.paymentMethod ?? method ?? 'cash' }
        : updated,
    [],
  );

  const reloadPayments = useCallback(async () => {
    try {
      setPayments(await fetchPayments());
    } catch {
      toast.warning(t('views.ledger.loadError'));
    }
  }, [t]);

  const reloadContracts = useCallback(async () => {
    try {
      setContracts(await fetchContracts());
    } catch {
      toast.warning(t('views.ledger.loadError'));
    }
  }, [t]);

  const handleDeletePayment = useCallback(
    async (payment: Payment) => {
      if (!window.confirm(t('views.ledger.deleteConfirm', { id: payment.id }))) return;
      try {
        await deletePayment(payment.id);
        setPayments((prev) => prev.filter((p) => p.id !== payment.id));
        toast.success(t('views.ledger.deleted'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.deleteError'));
      }
    },
    [t],
  );

  const openMarkPaidModal = useCallback((payment: Payment) => {
    setMarkPaidPayment(payment);
    setMarkPaidMethod('cash');
    setIsMarkPaidOpen(true);
  }, []);

  const closeMarkPaidModal = useCallback(() => {
    setIsMarkPaidOpen(false);
    setMarkPaidPayment(null);
  }, []);

  const handleConfirmMarkPaid = useCallback(async () => {
    if (!markPaidPayment) return;
    setScheduleBusyId(markPaidPayment.id);
    setActionBusy(true);
    try {
      const updated = await updatePayment(markPaidPayment.id, {
        contractId: markPaidPayment.contractId,
        unitId: markPaidPayment.unitId,
        amount: markPaidPayment.amount,
        dueDate: toLedgerYmd(markPaidPayment.dueDate),
        paidDate: ledgerTodayYmd(),
        status: 'Paid',
        remarks: markPaidPayment.remarks ?? '',
        paymentMethod: markPaidMethod,
      });
      patchPaymentInList(mergePaidPayment(updated, markPaidMethod));
      await reloadPayments();
      closeMarkPaidModal();
      toast.success(t('views.ledger.markedPaid'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.ledger.updateStatusError'));
    } finally {
      setScheduleBusyId(null);
      setActionBusy(false);
    }
  }, [closeMarkPaidModal, markPaidMethod, markPaidPayment, mergePaidPayment, patchPaymentInList, reloadPayments, t]);

  const handleQuickMarkPaid = openMarkPaidModal;

  const handleQuickMarkPending = useCallback(
    async (payment: Payment) => {
      setScheduleBusyId(payment.id);
      try {
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: toLedgerYmd(payment.dueDate),
          status: 'Pending',
          remarks: payment.remarks ?? '',
        });
        patchPaymentInList(updated);
        toast.success(t('views.ledger.markedPending'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.updateStatusError'));
      } finally {
        setScheduleBusyId(null);
      }
    },
    [patchPaymentInList, t],
  );

  const handleScheduleRemarksSave = useCallback(
    async (payment: Payment, rawValue: string) => {
      const next = rawValue.trim();
      const prev = (payment.remarks ?? '').trim();
      if (next === prev) return;

      setScheduleBusyId(payment.id);
      try {
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: toLedgerYmd(payment.dueDate),
          paidDate: payment.paidDate ? toLedgerYmd(payment.paidDate) : undefined,
          status: payment.status,
          remarks: next,
        });
        patchPaymentInList(updated);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.remarksSaveError'));
      } finally {
        setScheduleBusyId(null);
      }
    },
    [patchPaymentInList, t],
  );

  const handleIssueInvoice = useCallback(
    async (payment: Payment) => {
      if (!canCreate && !canUpdate) return;
      setScheduleBusyId(payment.id);
      try {
        const dueYmd = toLedgerYmd(payment.dueDate);
        const dueDate = dueYmd ? parseISO(dueYmd) : new Date();
        const invoice = await createContractInvoice(payment.contractId, {
          billingPeriodStart: format(startOfMonth(dueDate), 'yyyy-MM-dd'),
          billingPeriodEnd: format(endOfMonth(dueDate), 'yyyy-MM-dd'),
          dueDate: dueYmd || ledgerTodayYmd(),
          baseAmount: Number(payment.amount || 0),
          otherCharges: 0,
          discountAmount: 0,
          status: 'issued',
        });
        toast.success(t('views.ledger.issuedInvoice'));
        handlePreviewInvoice(invoice.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.issueInvoiceError'));
      } finally {
        setScheduleBusyId(null);
      }
    },
    [canCreate, canUpdate, handlePreviewInvoice, t],
  );

  const openPenaltyModal = useCallback(() => {
    if (!scheduleContract || !scheduleHasOverdue) {
      toast.error(t('views.ledger.penaltyNoOverdue'));
      return;
    }
    const suggested = Math.round(Number(scheduleContract.monthlyRent || 0) * 0.05);
    setPenaltyAmount(suggested > 0 ? String(suggested) : '');
    setPenaltyDueDate(ledgerTodayYmd());
    setPenaltyNote(t('views.ledger.penaltyNoteDefault'));
    setIsPenaltyOpen(true);
  }, [scheduleContract, scheduleHasOverdue, t]);

  const handleApplyPenalty = useCallback(async () => {
    if (!scheduleContract) return;
    const amount = Number(penaltyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t('views.ledger.validationAmount'));
      return;
    }
    const due = toLedgerYmd(penaltyDueDate) || ledgerTodayYmd();
    setActionBusy(true);
    try {
      const created = await createPayment({
        contractId: scheduleContract.id,
        unitId: scheduleContract.unitId,
        amount,
        dueDate: due,
        status: 'Overdue',
        remarks: (penaltyNote.trim() || t('views.ledger.penaltyNoteDefault')).slice(0, 255),
      });
      setPayments((prev) => [...prev, created]);
      setIsPenaltyOpen(false);
      toast.success(t('views.ledger.penaltyApplied'));
      await reloadPayments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.ledger.penaltyError'));
    } finally {
      setActionBusy(false);
    }
  }, [penaltyAmount, penaltyDueDate, penaltyNote, reloadPayments, scheduleContract, t]);

  const handleSendReminder = useCallback(
    (contractId?: string, focusPayment?: Payment) => {
      const contract = contractId
        ? contracts.find((c) => c.id === contractId) ?? scheduleContract
        : scheduleContract;
      if (!contract) return;
      const tenant = tenants.find((tnt) => tnt.id === contract.tenantId) ?? scheduleTenant;
      const unit = units.find((u) => u.id === contract.unitId) ?? scheduleUnit;
      if (!tenant || !unit) return;
      const email = String(tenant.email ?? '').trim();
      if (!email) {
        toast.error(t('views.ledger.reminderNoEmail'));
        return;
      }
      const contractPayments = payments.filter((p) => String(p.contractId) === String(contract.id));
      const overdue = contractPayments.filter(isLedgerPaymentPastDue);
      const target =
        focusPayment ??
        overdue[0] ??
        contractPayments.find((p) => p.status !== 'Paid');
      const amount = target
        ? Number(target.amount || 0)
        : overdue.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const dueDate = target ? formatPaymentDate(target.dueDate) : '—';
      const unitLabel = unit.unitNumber || unit.id;
      const subject = t('views.ledger.reminderSubject', { unit: unitLabel });
      const body = t('views.ledger.reminderBody', {
        tenant: tenant.name,
        unit: unitLabel,
        amount: amount.toLocaleString(),
        dueDate,
      });
      const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(href, '_blank', 'noopener,noreferrer');
      toast.success(t('views.ledger.reminderSent'));
    },
    [contracts, payments, scheduleContract, scheduleTenant, scheduleUnit, tenants, units, t],
  );

  const handleIssueOverdueInvoices = useCallback(async () => {
    if (!canCreate && !canUpdate) return;
    const overdue = schedulePayments.filter(
      (p) => p.status !== 'Paid' && isLedgerPaymentPastDue(p),
    );
    if (overdue.length === 0) {
      toast.error(t('views.ledger.issueOverdueNone'));
      return;
    }
    setActionBusy(true);
    let issued = 0;
    let lastInvoiceId: string | null = null;
    try {
      for (const payment of overdue) {
        const dueYmd = toLedgerYmd(payment.dueDate);
        const dueDate = dueYmd ? parseISO(dueYmd) : new Date();
        const invoice = await createContractInvoice(payment.contractId, {
          billingPeriodStart: format(startOfMonth(dueDate), 'yyyy-MM-dd'),
          billingPeriodEnd: format(endOfMonth(dueDate), 'yyyy-MM-dd'),
          dueDate: dueYmd || ledgerTodayYmd(),
          baseAmount: Number(payment.amount || 0),
          otherCharges: 0,
          discountAmount: 0,
          status: 'issued',
        });
        issued += 1;
        lastInvoiceId = invoice.id;
      }
      toast.success(t('views.ledger.issuedOverdueInvoices', { count: issued }));
      if (lastInvoiceId) handlePreviewInvoice(lastInvoiceId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.ledger.issueInvoiceError'));
    } finally {
      setActionBusy(false);
    }
  }, [canCreate, canUpdate, handlePreviewInvoice, schedulePayments, t]);

  const openSettlementModal = useCallback(() => {
    if (!canSettleContract) {
      toast.error(t('views.ledger.settlementNotAllowed'));
      return;
    }
    setSettlementDeductions('0');
    setIsSettlementOpen(true);
  }, [canSettleContract, t]);

  const settlementDeposit = Number(scheduleContract?.securityDeposit || 0);
  const settlementDeductionsNum = Math.max(0, Number(settlementDeductions) || 0);
  const settlementNet = settlementDeposit - scheduleUnpaidTotal - settlementDeductionsNum;

  const handleFinalSettlement = useCallback(async () => {
    if (!scheduleContract || !canSettleContract) return;
    setActionBusy(true);
    try {
      const remarks = t('views.ledger.settlementRemarks', {
        deposit: settlementDeposit.toLocaleString(),
        unpaid: scheduleUnpaidTotal.toLocaleString(),
        deductions: settlementDeductionsNum.toLocaleString(),
        net: settlementNet.toLocaleString(),
      });
      const updated = await updateContract(scheduleContract.id, {
        unitId: scheduleContract.unitId,
        tenantId: scheduleContract.tenantId,
        agentId: scheduleContract.agentId,
        startDate: scheduleContract.startDate,
        endDate: scheduleContract.endDate,
        monthlyRent: scheduleContract.monthlyRent,
        securityDeposit: scheduleContract.securityDeposit,
        advanceRent: scheduleContract.advanceRent,
        type: scheduleContract.type,
        status: 'Terminated',
        remarks: remarks.slice(0, 500),
      });
      if (Math.abs(settlementNet) > 0) {
        try {
          await createPayment({
            contractId: scheduleContract.id,
            unitId: scheduleContract.unitId,
            amount: Math.abs(settlementNet),
            dueDate: ledgerTodayYmd(),
            paidDate: settlementNet >= 0 ? ledgerTodayYmd() : undefined,
            status: settlementNet >= 0 ? 'Paid' : 'Overdue',
            remarks: 'Security deposit settlement',
          });
        } catch {
          // Settlement terminate succeeded; audit line is best-effort.
        }
      }
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      await reloadPayments();
      await reloadContracts();
      setIsSettlementOpen(false);
      toast.success(t('views.ledger.settlementDone'));
      closeModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.ledger.settlementError'));
    } finally {
      setActionBusy(false);
    }
  }, [
    canSettleContract,
    closeModal,
    reloadContracts,
    reloadPayments,
    scheduleContract,
    scheduleUnpaidTotal,
    settlementDeductionsNum,
    settlementDeposit,
    settlementNet,
    t,
  ]);

  const ledgerColumns: ColumnDef<Payment>[] = useMemo(() => {
    const center = {
      className: 'text-center',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
    } as const;

    const cols: ColumnDef<Payment>[] = [
      {
        ...center,
        header: t('views.ledger.table.unit'),
        render: (payment) => {
          const unit = units.find((u) => u.id === payment.unitId);
          return (
            <div className="min-w-0 text-center">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{unit?.unitNumber ?? '—'}</span>
              {unit?.buildingName ? (
                <span className="mt-0.5 block text-xs text-slate-500">{unit.buildingName}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        ...center,
        header: t('views.ledger.table.tenant'),
        render: (payment) => {
          const contract = contracts.find((c) => c.id === payment.contractId);
          const tenant = contract ? tenants.find((ten) => ten.id === contract.tenantId) : null;
          return <span className="normal-case text-slate-700 dark:text-slate-200">{tenant?.name ?? '—'}</span>;
        },
      },
      {
        ...center,
        header: t('views.ledger.table.outstandingBalance'),
        render: (payment) => {
          const m = getContractMetrics(payment.contractId);
          return (
            <span
              className={cn(
                'tabular-nums font-semibold',
                m.outstandingBalance > 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200',
              )}
            >
              ₱{m.outstandingBalance.toLocaleString()}
            </span>
          );
        },
      },
      {
        ...center,
        header: t('views.ledger.table.nextDueDate'),
        render: (payment) => {
          const m = getContractMetrics(payment.contractId);
          return (
            <span className="tabular-nums text-slate-700 dark:text-slate-200">
              {m.nextDueDate ? formatPaymentDate(m.nextDueDate) : '—'}
            </span>
          );
        },
      },
      {
        ...center,
        header: t('views.ledger.table.overdueDays'),
        render: (payment) => {
          const m = getContractMetrics(payment.contractId);
          if (m.overdueDays == null || m.overdueDays <= 0) return <span className="text-slate-400">—</span>;
          return (
            <span className="font-semibold tabular-nums text-rose-600">
              {t('views.ledger.table.overdueDaysValue', { count: m.overdueDays })}
            </span>
          );
        },
      },
      {
        ...center,
        header: t('views.ledger.table.totalPaid'),
        render: (payment) => {
          const m = getContractMetrics(payment.contractId);
          return (
            <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
              ₱{m.totalPaid.toLocaleString()}
            </span>
          );
        },
      },
      {
        ...center,
        header: t('views.ledger.table.status'),
        render: (payment) => {
          const status = displayPaymentStatus(payment);
          return (
            <div className="flex justify-center">
              <StatusBadge tone={paymentStatusVariant(status)}>
                {status === 'Paid'
                  ? t('views.ledger.table.paid')
                  : status === 'Overdue'
                    ? t('views.ledger.table.overdue')
                    : t('views.ledger.table.pending')}
              </StatusBadge>
            </div>
          );
        },
      },
      {
        ...center,
        header: t('views.ledger.table.paymentMethod'),
        render: (payment) => (
          <span className="normal-case text-xs font-medium text-slate-600 dark:text-slate-300">
            {payment.status === 'Paid' ? paymentMethodLabel(payment.paymentMethod ?? 'cash', t) : '—'}
          </span>
        ),
      },
      {
        ...center,
        header: t('views.ledger.table.leaseStatus'),
        render: (payment) => {
          const m = getContractMetrics(payment.contractId);
          const status = m.leaseStatus;
          return (
            <div className="flex justify-center">
              <StatusBadge tone={contractStatusVariant(status)}>
                {status}
              </StatusBadge>
            </div>
          );
        },
      },
      {
        ...center,
        header: t('views.ledger.table.daysUntilExpiry'),
        render: (payment) => {
          const m = getContractMetrics(payment.contractId);
          if (m.daysUntilExpiry == null) return <span className="text-slate-400">—</span>;
          if (m.daysUntilExpiry < 0) {
            return (
              <span className="text-xs font-medium text-rose-600">
                {t('views.ledger.table.expiredDays', { count: Math.abs(m.daysUntilExpiry) })}
              </span>
            );
          }
          return (
            <span className="tabular-nums text-slate-700 dark:text-slate-200">
              {t('views.ledger.table.daysUntilExpiryValue', { count: m.daysUntilExpiry })}
            </span>
          );
        },
      },
    ];
    if (ledgerTab === 'paid') {
      cols.push({
        ...center,
        header: t('views.ledger.table.paidDate'),
        render: (payment) => (
          <span className="tabular-nums text-slate-600 dark:text-slate-300">
            {payment.paidDate ? formatPaymentDate(payment.paidDate) : '—'}
          </span>
        ),
      });
    }
    if (canUpdate || canCreate || canDelete) {
      cols.push({
        ...center,
        header: t('views.ledger.table.actions'),
        render: (payment) => {
          const pastDue = isLedgerPaymentPastDue(payment);
          return (
            <div
              className="inline-flex items-center justify-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              {canUpdate && payment.status !== 'Paid' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('views.ledger.markPaid')}
                  className="h-8 w-8 text-brand-blue hover:bg-brand-blue/10"
                  onClick={() => void handleQuickMarkPaid(payment)}
                >
                  <BadgeCheck className="h-4 w-4" />
                </Button>
              ) : null}
              {(canCreate || canUpdate) && pastDue ? (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('views.ledger.sendReminder')}
                  className="h-8 w-8 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => handleSendReminder(payment.contractId, payment)}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              ) : null}
              {(canCreate || canUpdate) ? (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('views.ledger.viewMonthly')}
                  className="h-8 w-8 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => openScheduleModal(payment.contractId, payment.id)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('views.ledger.deletePayment')}
                  className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400"
                  onClick={() => void handleDeletePayment(payment)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          );
        },
      });
    }
    return cols;
  }, [
    ledgerTab,
    t,
    units,
    contracts,
    tenants,
    canCreate,
    canUpdate,
    canDelete,
    getContractMetrics,
    handleDeletePayment,
    handleQuickMarkPaid,
    handleSendReminder,
    openScheduleModal,
  ]);

  const ledgerTabLabel = (tab: LedgerTab) => {
    const count = tabCounts[tab];
    const base =
      tab === 'outstanding'
        ? t('views.ledger.tabs.outstanding')
        : tab === 'this_month'
          ? t('views.ledger.tabs.thisMonth')
          : t('views.ledger.tabs.paid');
    return count > 0 ? `${base} (${count})` : base;
  };

  const isCurrentLedgerMonth = ledgerMonth === ledgerCurrentMonthKey();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {t('views.ledger.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('views.ledger.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            {t('views.ledger.exportReport')}
          </Button>
          {(canCreate || canUpdate) && (
            <Button className="rounded-xl bg-brand-blue text-white hover:bg-[#3d7ab8]" onClick={openCreateModal}>
              {t('views.ledger.collectRent')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <LedgerStatCard
          index={0}
          label={t('views.ledger.overdueBalance')}
          value={`₱${summary.overdueBalance.toLocaleString()}`}
          subtitle="Requires attention"
          tone="danger"
          icon={<AlertCircle className="h-6 w-6" />}
        />
        <LedgerStatCard
          index={1}
          label={t('views.ledger.totalPaid')}
          value={`₱${summary.totalPaidAll.toLocaleString()}`}
          subtitle="All recorded payments"
          tone="success"
          icon={<BadgeCheck className="h-6 w-6" />}
        />
        <LedgerStatCard
          index={2}
          label={t('views.ledger.actualCollected')}
          value={`₱${rangeCollected.toLocaleString()}`}
          subtitle={rangeCollectedLabel}
          tone="neutral"
          icon={<Wallet className="h-6 w-6" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setPaidHighlightRange(null);
              setLedgerMonth((m) => shiftLedgerMonth(m, -1));
            }}
            aria-label={t('views.ledger.prevMonth')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
            {formatLedgerMonthLabel(ledgerMonth)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setPaidHighlightRange(null);
              setLedgerMonth((m) => shiftLedgerMonth(m, 1));
            }}
            aria-label={t('views.ledger.nextMonth')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentLedgerMonth ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-brand-blue"
              onClick={() => {
                setPaidHighlightRange(null);
                setLedgerMonth(ledgerCurrentMonthKey());
              }}
            >
              {t('views.ledger.todayMonth')}
            </Button>
          ) : null}
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('views.ledger.searchPlaceholder')}
            className="h-10 rounded-xl border-slate-200 pl-10 text-sm shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select2
          borderless={false}
          className="w-full min-w-[10rem] sm:w-44 [&_.unit-form-select-control]:!min-h-10"
          placeholder={t('views.ledger.filterAllUnits')}
          value={ledgerFilterUnitId ?? ''}
          onChange={(v) => setLedgerFilterUnitId(v ? String(v) : null)}
          options={unitFilterOptions}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {LEDGER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setPaidHighlightRange(null);
              setLedgerTab(tab);
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition',
              ledgerTab === tab
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {ledgerTabLabel(tab)}
          </button>
        ))}
      </div>

      {paidHighlightRange ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200">
          <p>
            {t('views.ledger.paidPeriodHighlight', {
              from: formatPaymentDate(paidHighlightRange.from),
              to: formatPaymentDate(paidHighlightRange.to),
              count: highlightedPaidIds?.size ?? 0,
            })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-brand-blue"
            onClick={() => setPaidHighlightRange(null)}
          >
            {t('views.ledger.clearPaidHighlight')}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 md:p-8">
          <SkeletonTable rows={8} columns={10} />
        </div>
      ) : (
        <Card className="gap-0 overflow-hidden border-none py-0 shadow-sm">
          <CardContent className="p-0">
            <DataTable
              data={filteredPayments}
              columns={ledgerColumns}
              keyExtractor={(p) => p.id}
              embedded
              stickyHeader
              compact
              rowClassName={(p) =>
                highlightedPaidIds?.has(p.id)
                  ? '[&>td]:!bg-emerald-50 [&>td]:dark:!bg-emerald-950/50 ring-2 ring-inset ring-emerald-400/70'
                  : undefined
              }
              onRowClick={canUpdate ? (p) => openEditModal(p) : undefined}
            />
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isScheduleModalOpen}
        onClose={closeModal}
        title={t('views.ledger.monthlyScheduleTitle')}
        maxWidth="4xl"
        variant="glass"
        compact
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {scheduleContractId ? (
              <Button
                type="button"
                variant="outline"
                className={modalOutlineButtonClass}
                onClick={() => handlePreviewInvoice(scheduleContractId)}
              >
                {t('views.ledger.table.viewInvoice')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={closeModal}>
              {t('views.ledger.closeSchedule')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {scheduleContractId ? (
            <>
              <div className="space-y-2">
                <Label>{t('views.ledger.scheduleContract')}</Label>
                <Select2
                  options={contractOptions}
                  value={scheduleContractId}
                  borderless={false}
                  className={LEDGER_SELECT_CLASS}
                  placeholder={t('views.ledger.chooseContract')}
                  onChange={(v) => {
                    setScheduleContractId((v ?? null) as string | null);
                    setHighlightPaymentId(null);
                  }}
                />
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                {t('views.ledger.scheduleSummaryLine', {
                  paid: scheduleSummary.paid,
                  total: scheduleSummary.total,
                  overdue: `₱${scheduleSummary.overdueAmount.toLocaleString()}`,
                })}
                {scheduleSummary.scheduledAmount > 0
                  ? ` · ${t('views.ledger.scheduleRemaining', {
                      amount: `₱${scheduleSummary.scheduledAmount.toLocaleString()}`,
                    })}`
                  : ''}
              </div>

              {(canCreate || canUpdate) && scheduleContract ? (
                <div className="flex flex-wrap gap-2">
                  {scheduleHasOverdue ? (
                    <>
                      {(canCreate || canUpdate) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 rounded-lg text-xs"
                          disabled={actionBusy}
                          onClick={() => void handleIssueOverdueInvoices()}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          {t('views.ledger.issueOverdueInvoices')}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 rounded-lg text-xs"
                        disabled={actionBusy}
                        onClick={openPenaltyModal}
                      >
                        <Scale className="h-3.5 w-3.5" aria-hidden />
                        {t('views.ledger.applyPenalty')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 rounded-lg text-xs"
                        disabled={actionBusy}
                        onClick={() => handleSendReminder()}
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden />
                        {t('views.ledger.sendReminder')}
                      </Button>
                    </>
                  ) : null}
                  {canSettleContract ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-lg text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      disabled={actionBusy}
                      onClick={openSettlementModal}
                    >
                      <Wallet className="h-3.5 w-3.5" aria-hidden />
                      {t('views.ledger.finalSettlement')}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {schedulePayments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                  {t('views.ledger.scheduleEmpty')}
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="max-h-[min(28rem,55vh)] overflow-auto">
                    <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[9.5rem]" />
                        <col className="w-[6.5rem]" />
                        <col className="w-[6.5rem]" />
                        <col className="w-[7rem]" />
                        <col />
                        <col className="w-[5.5rem]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2.5 text-center">{t('views.ledger.table.dueDate')}</th>
                          <th className="px-3 py-2.5 text-center">{t('views.ledger.table.amount')}</th>
                          <th className="px-3 py-2.5 text-center">{t('views.ledger.table.status')}</th>
                          <th className="px-3 py-2.5 text-center">{t('views.ledger.table.paymentMethod')}</th>
                          <th className="px-3 py-2.5 text-center">{t('views.ledger.table.remarks')}</th>
                          <th className="px-3 py-2.5 text-center">{t('views.ledger.table.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {schedulePayments.map((payment) => {
                          const due = toLedgerYmd(payment.dueDate);
                          const dueDate = due ? parseISO(due) : null;
                          const dueLabel =
                            dueDate && !Number.isNaN(dueDate.getTime())
                              ? format(dueDate, 'MMM dd, yyyy')
                              : due || '—';
                          const status = displayPaymentStatus(payment);
                          const highlighted = highlightPaymentId === payment.id;
                          const busy = scheduleBusyId === payment.id;
                          return (
                            <tr
                              key={payment.id}
                              className={cn(
                                'bg-white transition-colors hover:bg-slate-50/80 dark:bg-slate-950 dark:hover:bg-slate-900/60',
                                highlighted && '!bg-brand-blue/10 dark:!bg-brand-blue/10',
                              )}
                            >
                              <td className="whitespace-nowrap px-3 py-2 text-center font-medium tabular-nums normal-case text-slate-800 dark:text-slate-100">
                                {dueLabel}
                              </td>
                              <td className="px-3 py-2 text-center font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                ₱{Number(payment.amount || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <StatusBadge tone={paymentStatusVariant(status)}>
                                  {status === 'Paid'
                                    ? t('views.ledger.table.paid')
                                    : status === 'Overdue'
                                      ? t('views.ledger.table.overdue')
                                      : t('views.ledger.table.pending')}
                                </StatusBadge>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="text-xs font-medium normal-case text-slate-600 dark:text-slate-300">
                                  {payment.status === 'Paid'
                                    ? paymentMethodLabel(payment.paymentMethod ?? 'cash', t)
                                    : '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {canUpdate ? (
                                  <Input
                                    key={`${payment.id}-${payment.remarks ?? ''}`}
                                    className="mx-auto h-7 w-full min-w-0 max-w-[12rem] border-0 bg-transparent px-2 text-xs normal-case shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-brand-blue/30 dark:focus-visible:bg-slate-900"
                                    defaultValue={payment.remarks ?? ''}
                                    disabled={busy}
                                    maxLength={255}
                                    placeholder={t('views.ledger.table.remarksPlaceholder')}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    onBlur={(e) => void handleScheduleRemarksSave(payment, e.target.value)}
                                  />
                                ) : (
                                  <span className="block truncate text-xs normal-case text-slate-600 dark:text-slate-300">
                                    {payment.remarks?.trim() || '—'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div
                                  className="inline-flex w-[4.25rem] items-center justify-center gap-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  role="presentation"
                                >
                                  {canUpdate ? (
                                    <>
                                      {payment.status !== 'Paid' ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          title={t('views.ledger.markPaid')}
                                          className="h-8 w-8 shrink-0 text-brand-blue hover:bg-brand-blue/10"
                                          disabled={busy || actionBusy}
                                          onClick={() => void handleQuickMarkPaid(payment)}
                                        >
                                          <BadgeCheck className="h-4 w-4" />
                                        </Button>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          title={t('views.ledger.markPending')}
                                          className="h-8 w-8 shrink-0 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                          disabled={busy || actionBusy}
                                          onClick={() => void handleQuickMarkPending(payment)}
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {canCreate || canUpdate ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          title={t('views.ledger.issueInvoice')}
                                          className="h-8 w-8 shrink-0 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                          disabled={busy || actionBusy}
                                          onClick={() => void handleIssueInvoice(payment)}
                                        >
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">{t('views.ledger.schedulePickContract')}</p>
              {schedulePickerCards.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                  {t('views.ledger.scheduleNoContracts')}
                </p>
              ) : (
                <div className="grid max-h-[min(28rem,55vh)] gap-3 overflow-auto sm:grid-cols-2">
                  {schedulePickerCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setScheduleContractId(card.id);
                        setHighlightPaymentId(null);
                      }}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-blue/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {card.unitLabel}
                            {card.building ? (
                              <span className="font-normal text-slate-500"> · {card.building}</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs normal-case text-slate-500">{card.tenantName}</p>
                        </div>
                        {card.overdue > 0 ? (
                          <StatusBadge tone="danger">
                            {t('views.ledger.scheduleCardOverdue', { count: card.overdue })}
                          </StatusBadge>
                        ) : card.status ? (
                          <StatusBadge tone={card.status === 'Active' ? 'success' : 'neutral'}>{card.status}</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          ₱{card.monthlyRent.toLocaleString()}
                        </span>
                        {' / mo · '}
                        {t('views.ledger.scheduleCardUnpaid', { unpaid: card.overdue, total: card.total })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isPenaltyOpen}
        onClose={() => setIsPenaltyOpen(false)}
        title={t('views.ledger.penaltyTitle')}
        maxWidth="md"
        variant="glass"
        compact
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className={modalOutlineButtonClass}
              disabled={actionBusy}
              onClick={() => setIsPenaltyOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className={modalPrimaryButtonClass}
              disabled={actionBusy}
              onClick={() => void handleApplyPenalty()}
            >
              {t('views.ledger.applyPenalty')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="penalty-amount">{t('views.ledger.penaltyAmount')}</Label>
            <Input
              id="penalty-amount"
              type="number"
              min={1}
              step={1}
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="penalty-due">{t('views.ledger.penaltyDueDate')}</Label>
            <Input
              id="penalty-due"
              type="date"
              value={penaltyDueDate}
              onChange={(e) => setPenaltyDueDate(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="penalty-note">{t('views.ledger.penaltyNote')}</Label>
            <Input
              id="penalty-note"
              value={penaltyNote}
              maxLength={255}
              onChange={(e) => setPenaltyNote(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        title={t('views.ledger.settlementTitle')}
        maxWidth="md"
        variant="glass"
        compact
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className={modalOutlineButtonClass}
              disabled={actionBusy}
              onClick={() => setIsSettlementOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className={cn(modalPrimaryButtonClass, 'bg-rose-600 hover:bg-rose-700')}
              disabled={actionBusy || !canSettleContract}
              onClick={() => void handleFinalSettlement()}
            >
              {t('views.ledger.settlementConfirm')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">{t('views.ledger.settlementDeposit')}</span>
              <span className="font-semibold tabular-nums">₱{settlementDeposit.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">{t('views.ledger.settlementUnpaid')}</span>
              <span className="font-semibold tabular-nums text-rose-600">
                ₱{scheduleUnpaidTotal.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settlement-deductions">{t('views.ledger.settlementDeductions')}</Label>
            <Input
              id="settlement-deductions"
              type="number"
              min={0}
              step={1}
              value={settlementDeductions}
              onChange={(e) => setSettlementDeductions(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-sm dark:border-sky-500/20 dark:bg-sky-500/10">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {settlementNet >= 0
                  ? t('views.ledger.settlementNet')
                  : t('views.ledger.settlementNetOwed')}
              </span>
              <span
                className={cn(
                  'text-base font-bold tabular-nums',
                  settlementNet >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600',
                )}
              >
                ₱{Math.abs(settlementNet).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isMarkPaidOpen}
        onClose={closeMarkPaidModal}
        title={t('views.ledger.markPaidTitle')}
        maxWidth="sm"
        variant="glass"
        compact
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className={modalOutlineButtonClass}
              disabled={actionBusy}
              onClick={closeMarkPaidModal}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className={modalPrimaryButtonClass}
              disabled={actionBusy || !markPaidPayment}
              onClick={() => void handleConfirmMarkPaid()}
            >
              {t('views.ledger.markPaidConfirm')}
            </Button>
          </div>
        }
      >
        {markPaidPayment ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-300">{t('views.ledger.table.dueDate')}</span>
                <span className="font-semibold tabular-nums">{formatPaymentDate(markPaidPayment.dueDate)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-300">{t('views.ledger.table.amount')}</span>
                <span className="font-semibold tabular-nums">
                  ₱{Number(markPaidPayment.amount || 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('views.ledger.paymentMethod')}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {LEDGER_PAYMENT_METHODS.map((method) => {
                  const selected = markPaidMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setMarkPaidMethod(method)}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-sm font-medium transition',
                        selected
                          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue dark:border-sky-400 dark:bg-sky-500/10 dark:text-sky-300'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600',
                      )}
                    >
                      {t(`views.ledger.paymentMethods.${method}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
