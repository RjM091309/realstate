import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button, modalOutlineButtonClass } from '@/components/ui/button';
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
import { fetchContracts } from '@/lib/contractsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { deletePayment, fetchPayments, updatePayment } from '@/lib/paymentsApi';
import {
  computeContractLedgerMetrics,
  computeLedgerSummary,
  isLedgerPaymentPastDue,
  ledgerCurrentMonthKey,
  ledgerTodayYmd,
  paymentMatchesLedgerTab,
  toLedgerYmd,
  type LedgerTab,
} from '@/lib/ledgerUtils';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import type { Contract, Payment, Tenant, Unit } from '@/types';

const LEDGER_SELECT_CLASS = '[&_.unit-form-select-control]:!min-h-12';
const LEDGER_TABS: LedgerTab[] = ['this_month', 'outstanding', 'paid'];

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

export function LeaseLedgerView() {
  const { t } = useTranslation();
  const { session } = useAuth();
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
  const [refLoading, setRefLoading] = useState(false);
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);

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
      payments.filter(
        (p) =>
          paymentMatchesQuery(p, searchTerm, units, contracts, tenants) &&
          paymentMatchesLedgerTab(p, ledgerTab, ledgerMonth) &&
          (!ledgerFilterUnitId || p.unitId === ledgerFilterUnitId),
      ),
    [payments, searchTerm, units, contracts, tenants, ledgerTab, ledgerMonth, ledgerFilterUnitId],
  );

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

  const handlePreviewInvoice = useCallback((contractId: string) => {
    const url = `${window.location.origin}/preview?type=invoice&id=${encodeURIComponent(contractId)}`;
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
      ['Payment ID', 'Contract ID', 'Unit', 'Tenant', 'Due Date', 'Paid Date', 'Status', 'Amount'],
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
    if (!contractId && !paymentId) return;
    deepLinkHandledRef.current = true;
    let resolvedContractId = contractId;
    if (!resolvedContractId && paymentId) {
      resolvedContractId = payments.find((p) => String(p.id) === String(paymentId))?.contractId ?? null;
    }
    if (resolvedContractId) openScheduleModal(resolvedContractId, paymentId);
    const next = new URLSearchParams(searchParams);
    next.delete('contractId');
    next.delete('paymentId');
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
  }, []);

  const patchPaymentInList = useCallback((updated: Payment) => {
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

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

  const handleQuickMarkPaid = useCallback(
    async (payment: Payment) => {
      setScheduleBusyId(payment.id);
      try {
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: toLedgerYmd(payment.dueDate),
          paidDate: ledgerTodayYmd(),
          status: 'Paid',
        });
        patchPaymentInList(updated);
        toast.success(t('views.ledger.markedPaid'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.updateStatusError'));
      } finally {
        setScheduleBusyId(null);
      }
    },
    [patchPaymentInList, t],
  );

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

  const ledgerColumns: ColumnDef<Payment>[] = useMemo(() => {
    const cols: ColumnDef<Payment>[] = [
      {
        header: t('views.ledger.table.unit'),
        render: (payment) => {
          const unit = units.find((u) => u.id === payment.unitId);
          return (
            <div className="min-w-0">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{unit?.unitNumber ?? '—'}</span>
              {unit?.buildingName ? (
                <span className="mt-0.5 block text-xs text-slate-500">{unit.buildingName}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        header: t('views.ledger.table.tenant'),
        render: (payment) => {
          const contract = contracts.find((c) => c.id === payment.contractId);
          const tenant = contract ? tenants.find((ten) => ten.id === contract.tenantId) : null;
          return <span className="normal-case text-slate-700 dark:text-slate-200">{tenant?.name ?? '—'}</span>;
        },
      },
      {
        header: t('views.ledger.table.outstandingBalance'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
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
        header: t('views.ledger.table.overdueDays'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
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
        header: t('views.ledger.table.totalPaid'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
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
        header: t('views.ledger.table.status'),
        render: (payment) => {
          const status = displayPaymentStatus(payment);
          return (
            <StatusBadge tone={paymentStatusVariant(status)}>
              {status === 'Paid'
                ? t('views.ledger.table.paid')
                : status === 'Overdue'
                  ? t('views.ledger.table.overdue')
                  : t('views.ledger.table.pending')}
            </StatusBadge>
          );
        },
      },
      {
        header: t('views.ledger.table.leaseStatus'),
        render: (payment) => {
          const m = getContractMetrics(payment.contractId);
          const status = m.leaseStatus;
          return (
            <StatusBadge tone={contractStatusVariant(status)}>
              {status}
            </StatusBadge>
          );
        },
      },
      {
        header: t('views.ledger.table.daysUntilExpiry'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
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
        header: t('views.ledger.table.paidDate'),
        render: (payment) => (
          <span className="tabular-nums text-slate-600 dark:text-slate-300">
            {payment.paidDate ? formatPaymentDate(payment.paidDate) : '—'}
          </span>
        ),
      });
    }
    if (canDelete) {
      cols.push({
        header: t('views.ledger.table.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (payment) => (
          <Button
            variant="ghost"
            size="icon"
            title={t('views.ledger.deletePayment')}
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400"
            onClick={(e) => {
              e.stopPropagation();
              void handleDeletePayment(payment);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      });
    }
    return cols;
  }, [
    ledgerTab,
    t,
    units,
    contracts,
    tenants,
    canDelete,
    getContractMetrics,
    handleDeletePayment,
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
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('views.ledger.overdueBalance')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
              ₱{summary.overdueBalance.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('views.ledger.totalPaid')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
              ₱{summary.totalPaidAll.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('views.ledger.actualCollected')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              ₱{summary.actualCollected.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">{formatLedgerMonthLabel(summary.monthKey)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setLedgerMonth((m) => shiftLedgerMonth(m, -1))}
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
            onClick={() => setLedgerMonth((m) => shiftLedgerMonth(m, 1))}
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
              onClick={() => setLedgerMonth(ledgerCurrentMonthKey())}
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
            onClick={() => setLedgerTab(tab)}
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
              onRowClick={canUpdate ? (p) => openEditModal(p) : undefined}
            />
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isScheduleModalOpen}
        onClose={closeModal}
        title={t('views.ledger.monthlyScheduleTitle')}
        maxWidth="3xl"
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

              {schedulePayments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                  {t('views.ledger.scheduleEmpty')}
                </p>
              ) : (
                <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2.5">{t('views.ledger.table.dueDate')}</th>
                        <th className="px-3 py-2.5 text-right">{t('views.ledger.table.amount')}</th>
                        <th className="px-3 py-2.5">{t('views.ledger.table.status')}</th>
                        <th className="px-3 py-2.5 text-right">{t('views.ledger.table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {schedulePayments.map((payment) => {
                        const due = toLedgerYmd(payment.dueDate);
                        const dueDate = due ? parseISO(due) : null;
                        const dueLabel =
                          dueDate && !Number.isNaN(dueDate.getTime()) ? format(dueDate, 'MMM dd, yyyy') : due || '—';
                        const status = displayPaymentStatus(payment);
                        const highlighted = highlightPaymentId === payment.id;
                        const busy = scheduleBusyId === payment.id;
                        return (
                          <tr
                            key={payment.id}
                            className={cn(
                              'bg-white dark:bg-slate-950',
                              highlighted && 'bg-brand-blue/10 dark:bg-brand-blue/10',
                            )}
                          >
                            <td className="px-3 py-2.5 font-medium normal-case text-slate-800 dark:text-slate-100">
                              {dueLabel}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                              ₱{Number(payment.amount || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge tone={paymentStatusVariant(status)}>
                                {status === 'Paid'
                                  ? t('views.ledger.table.paid')
                                  : status === 'Overdue'
                                    ? t('views.ledger.table.overdue')
                                    : t('views.ledger.table.pending')}
                              </StatusBadge>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {canUpdate && payment.status === 'Paid' ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-lg px-2.5 text-xs"
                                  disabled={busy}
                                  onClick={() => void handleQuickMarkPending(payment)}
                                >
                                  {t('views.ledger.markPending')}
                                </Button>
                              ) : canUpdate && isLedgerPaymentPastDue(payment) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 rounded-lg bg-brand-blue px-2.5 text-xs text-white hover:bg-[#3d7ab8]"
                                  disabled={busy}
                                  onClick={() => void handleQuickMarkPaid(payment)}
                                >
                                  {t('views.ledger.markPaid')}
                                </Button>
                              ) : payment.status !== 'Paid' ? (
                                <span className="text-xs text-slate-400">{t('views.ledger.notDueYet')}</span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
    </div>
  );
}
