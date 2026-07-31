import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, modalOutlineButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import { paymentStatusVariant } from '@/lib/statusBadge';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { SkeletonTable } from '@/components/skeleton';
import { cn } from '@/lib/utils';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { deletePayment, fetchPayments, updatePayment } from '@/lib/paymentsApi';
import { addDays, endOfMonth, format, isAfter, isBefore, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import type { Contract, Payment, PaymentStatus, Tenant, Unit } from '@/types';

const LEDGER_STATUS_FILTERS: PaymentStatus[] = ['Paid', 'Pending', 'Overdue'];

const LEDGER_SELECT_CLASS = '[&_.unit-form-select-control]:!min-h-12';

function defaultLedgerStatusFilters(): Set<PaymentStatus> {
  return new Set(LEDGER_STATUS_FILTERS);
}

function paymentMatchesLedgerFilters(
  p: Payment,
  statuses: Set<PaymentStatus>,
  unitId: string | null,
): boolean {
  if (unitId && p.unitId !== unitId) return false;
  return statuses.has(p.status);
}

/** Normalize API / form dates to YYYY-MM-DD. */
function toDateInputValue(value?: string | null): string {
  if (!value?.trim()) return '';
  const slice = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) return slice;
  try {
    return format(parseISO(value.trim()), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function todayYmd(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function formatPaymentDate(value?: string | null): string {
  const ymd = toDateInputValue(value);
  if (!ymd) return '—';
  try {
    const d = parseISO(ymd);
    return Number.isNaN(d.getTime()) ? ymd : format(d, 'MMM dd, yyyy');
  } catch {
    return ymd;
  }
}

/** True when the due date is today or earlier (can collect / mark paid). */
function isDueOrPast(dueDate?: string | null): boolean {
  const ymd = toDateInputValue(dueDate);
  if (!ymd) return false;
  return ymd <= todayYmd();
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

export function LeaseLedgerView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef(false);
  const canCreate = session?.crud?.ledger?.create ?? false;
  const canUpdate = session?.crud?.ledger?.update ?? false;
  const canDelete = session?.crud?.ledger?.delete ?? false;

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleContractId, setScheduleContractId] = useState<string | null>(null);
  const [highlightPaymentId, setHighlightPaymentId] = useState<string | null>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [ledgerFilterStatuses, setLedgerFilterStatuses] = useState<Set<PaymentStatus>>(defaultLedgerStatusFilters);
  const [ledgerFilterUnitId, setLedgerFilterUnitId] = useState<string | null>(null);
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
        if (hadError) {
          toast.warning(t('views.ledger.loadError'));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const ensureReferenceDataLoaded = useCallback(async () => {
    // This view loads reference data on mount, but we also re-check when opening the modal
    // to avoid an empty Contract dropdown if the initial request failed or the API restarted.
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

  const expectedCollection = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return payments
      .filter((p) => isWithinInterval(new Date(p.dueDate), { start, end }))
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const actualCollected = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return payments
      .filter((p) => p.status === 'Paid' && p.paidDate && isWithinInterval(new Date(p.paidDate), { start, end }))
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const outstandingBalance = useMemo(
    () => payments.filter((p) => p.status !== 'Paid').reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  const upcomingPayments = useMemo(
    () =>
      payments
        .filter((payment) => {
          const due = new Date(payment.dueDate);
          return payment.status !== 'Paid' && isAfter(due, new Date()) && isBefore(due, addDays(new Date(), 8));
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [payments],
  );

  const filteredUpcoming = useMemo(
    () =>
      upcomingPayments.filter(
        (p) =>
          paymentMatchesQuery(p, searchTerm, units, contracts, tenants) &&
          paymentMatchesLedgerFilters(p, ledgerFilterStatuses, ledgerFilterUnitId),
      ),
    [upcomingPayments, searchTerm, units, contracts, tenants, ledgerFilterStatuses, ledgerFilterUnitId],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          paymentMatchesQuery(p, searchTerm, units, contracts, tenants) &&
          paymentMatchesLedgerFilters(p, ledgerFilterStatuses, ledgerFilterUnitId),
      ),
    [payments, searchTerm, units, contracts, tenants, ledgerFilterStatuses, ledgerFilterUnitId],
  );

  const ledgerFilterActive = useMemo(() => {
    if (ledgerFilterUnitId) return true;
    return LEDGER_STATUS_FILTERS.some((s) => !ledgerFilterStatuses.has(s));
  }, [ledgerFilterStatuses, ledgerFilterUnitId]);

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

  const toggleLedgerFilterStatus = useCallback((status: PaymentStatus) => {
    setLedgerFilterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        if (next.size <= 1) return prev;
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const clearLedgerFilters = useCallback(() => {
    setLedgerFilterStatuses(defaultLedgerStatusFilters());
    setLedgerFilterUnitId(null);
  }, []);

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
      (c) =>
        c.status === 'Active' ||
        payments.some((p) => String(p.contractId) === String(c.id)),
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
        const unpaid = rows.filter((p) => p.status !== 'Paid').length;
        return {
          id: c.id,
          unitLabel: unit?.unitNumber ?? c.unitId,
          building: unit?.buildingName || '',
          tenantName: tenant?.name ?? '—',
          status: c.status,
          monthlyRent: Number(c.monthlyRent || 0),
          unpaid,
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
          p.status,
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
      .sort((a, b) => toDateInputValue(a.dueDate).localeCompare(toDateInputValue(b.dueDate)));
  }, [payments, scheduleContractId]);

  const scheduleContract = useMemo(
    () => contracts.find((c) => String(c.id) === String(scheduleContractId)) ?? null,
    [contracts, scheduleContractId],
  );

  const scheduleSummary = useMemo(() => {
    const paid = schedulePayments.filter((p) => p.status === 'Paid').length;
    const total = schedulePayments.length;
    const outstanding = schedulePayments
      .filter((p) => p.status !== 'Paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const leaseTotal = schedulePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const monthly = Number(scheduleContract?.monthlyRent || 0);
    const yearTotal = monthly > 0 ? monthly * 12 : leaseTotal;
    return { paid, total, outstanding, leaseTotal, yearTotal };
  }, [schedulePayments, scheduleContract]);

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
      resolvedContractId =
        payments.find((p) => String(p.id) === String(paymentId))?.contractId ?? null;
    }
    if (resolvedContractId) {
      openScheduleModal(resolvedContractId, paymentId);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('contractId');
    next.delete('paymentId');
    setSearchParams(next, { replace: true });
  }, [loading, openScheduleModal, payments, searchParams, setSearchParams]);

  const openCreateModal = useCallback(() => {
    openScheduleModal(null, null);
  }, [openScheduleModal]);

  const openEditModal = useCallback(
    (payment: Payment) => {
      openScheduleModal(payment.contractId, payment.id);
    },
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

  const handleDeletePayment = useCallback(async (payment: Payment) => {
    if (!window.confirm(t('views.ledger.deleteConfirm', { id: payment.id }))) return;
    try {
      await deletePayment(payment.id);
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      toast.success(t('views.ledger.deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.ledger.deleteError'));
    }
  }, [t]);

  const handleQuickMarkPaid = useCallback(
    async (payment: Payment) => {
      setScheduleBusyId(payment.id);
      try {
        const today = todayYmd();
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: toDateInputValue(payment.dueDate),
          paidDate: today,
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
          dueDate: toDateInputValue(payment.dueDate),
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

  const handleQuickMarkOverdue = useCallback(
    async (payment: Payment) => {
      setScheduleBusyId(payment.id);
      try {
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: toDateInputValue(payment.dueDate),
          status: 'Overdue',
        });
        patchPaymentInList(updated);
        toast.success(t('views.ledger.markedOverdue'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.updateStatusError'));
      } finally {
        setScheduleBusyId(null);
      }
    },
    [patchPaymentInList, t],
  );

  const upcomingColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        header: t('views.ledger.table.unit'),
        render: (payment) => {
          const unit = units.find((u) => u.id === payment.unitId);
          return <span className="font-bold text-slate-900">{unit?.unitNumber}</span>;
        },
      },
      {
        header: t('views.ledger.table.tenant'),
        render: (payment) => {
          const contract = contracts.find((c) => c.id === payment.contractId);
          const tenant = contract ? tenants.find((ten) => ten.id === contract.tenantId) : null;
          return <span>{tenant?.name}</span>;
        },
      },
      {
        header: t('views.ledger.table.dueDate'),
        render: (payment) => <span>{formatPaymentDate(payment.dueDate)}</span>,
      },
      {
        header: t('views.ledger.table.amount'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (payment) => <span className="font-semibold">₱{payment.amount.toLocaleString()}</span>,
      },
    ],
    [t, units, contracts, tenants],
  );

  const collectionColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        header: t('views.ledger.table.unit'),
        render: (payment) => {
          const unit = units.find((u) => u.id === payment.unitId);
          return <span className="font-bold text-slate-900">{unit?.unitNumber}</span>;
        },
      },
      {
        header: t('views.ledger.table.tenant'),
        render: (payment) => {
          const contract = contracts.find((c) => c.id === payment.contractId);
          const tenant = contract ? tenants.find((ten) => ten.id === contract.tenantId) : null;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-700">{tenant?.name}</span>
              <span className="text-xs text-slate-500">{units.find((u) => u.id === payment.unitId)?.buildingName}</span>
            </div>
          );
        },
      },
      {
        header: t('views.ledger.table.dueDate'),
        render: (payment) => <span>{formatPaymentDate(payment.dueDate)}</span>,
      },
      {
        header: t('views.ledger.table.amount'),
        render: (payment) => <span className="font-semibold">₱{payment.amount.toLocaleString()}</span>,
      },
      {
        header: t('views.ledger.table.status'),
        render: (payment) => (
          <div className="flex items-center gap-2">
            {payment.status === 'Paid' ? (
              <StatusBadge tone={paymentStatusVariant(payment.status)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {t('views.ledger.table.paid')}
              </StatusBadge>
            ) : payment.status === 'Overdue' ? (
              <StatusBadge tone={paymentStatusVariant(payment.status)}>
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                {t('views.ledger.table.overdue')}
              </StatusBadge>
            ) : (
              <StatusBadge tone={paymentStatusVariant(payment.status)}>
                <Clock className="w-3.5 h-3.5 mr-1" />
                {t('views.ledger.table.pending')}
              </StatusBadge>
            )}
          </div>
        ),
      },
      {
        header: t('views.ledger.table.paidDate'),
        render: (payment) => <span>{payment.paidDate ? formatPaymentDate(payment.paidDate) : '-'}</span>,
      },
      {
        header: t('views.ledger.table.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (payment) => (
          <div className="flex justify-end items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={t('views.ledger.table.viewInvoice')}
              onClick={(e) => {
                e.stopPropagation();
                handlePreviewInvoice(payment.contractId);
              }}
            >
              <FileText className="w-4 h-4" />
            </Button>
            {canDelete ? (
              <Button
                variant="ghost"
                size="icon"
                title={t('views.ledger.deletePayment')}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeletePayment(payment);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : null}
            {canUpdate && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" title={t('views.ledger.moreActions')} onClick={(e) => e.stopPropagation()} />}
                >
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {payment.status !== 'Paid' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickMarkPaid(payment);
                      }}
                    >
                      {t('views.ledger.markPaid')}
                    </DropdownMenuItem>
                  )}
                  {payment.status !== 'Overdue' && payment.status !== 'Paid' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickMarkOverdue(payment);
                      }}
                    >
                      {t('views.ledger.markOverdue')}
                    </DropdownMenuItem>
                  )}
                  {payment.status === 'Paid' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickMarkPending(payment);
                      }}
                    >
                      {t('views.ledger.markPending')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ),
      },
    ],
    [
      t,
      units,
      contracts,
      tenants,
      canUpdate,
      canDelete,
      handlePreviewInvoice,
      openEditModal,
      handleDeletePayment,
      handleQuickMarkPaid,
      handleQuickMarkPending,
      handleQuickMarkOverdue,
    ],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.ledger.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.ledger.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            {t('views.ledger.exportReport')}
          </Button>
          {(canCreate || canUpdate) && (
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={openCreateModal}>
              {t('views.ledger.monthlyPayments')}
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={isScheduleModalOpen}
        onClose={closeModal}
        title={t('views.ledger.monthlyScheduleTitle')}
        maxWidth="3xl"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
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

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                <span>
                  {t('views.ledger.scheduleProgress', {
                    paid: scheduleSummary.paid,
                    total: scheduleSummary.total,
                  })}
                </span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {t('views.ledger.scheduleYearTotal', {
                    amount: `₱${scheduleSummary.yearTotal.toLocaleString()}`,
                  })}
                </span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {t('views.ledger.scheduleOutstanding', {
                    amount: `₱${scheduleSummary.outstanding.toLocaleString()}`,
                  })}
                </span>
                {scheduleContract ? (
                  <span className="text-xs text-slate-500">
                    {t('views.ledger.scheduleRentHint', {
                      amount: `₱${Number(scheduleContract.monthlyRent || 0).toLocaleString()}`,
                    })}
                  </span>
                ) : null}
              </div>

              {schedulePayments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t('views.ledger.scheduleEmpty')}
                </p>
              ) : (
                <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5">{t('views.ledger.table.month')}</th>
                        <th className="px-3 py-2.5">{t('views.ledger.table.dueDate')}</th>
                        <th className="px-3 py-2.5 text-right">{t('views.ledger.table.amount')}</th>
                        <th className="px-3 py-2.5">{t('views.ledger.table.status')}</th>
                        <th className="px-3 py-2.5 text-right">{t('views.ledger.table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {schedulePayments.map((payment) => {
                        const due = toDateInputValue(payment.dueDate);
                        const dueDate = due ? parseISO(due) : null;
                        const monthLabel =
                          dueDate && !Number.isNaN(dueDate.getTime())
                            ? format(dueDate, 'MMMM yyyy')
                            : due || '—';
                        const dueLabel =
                          dueDate && !Number.isNaN(dueDate.getTime())
                            ? format(dueDate, 'MMM dd, yyyy')
                            : due || '—';
                        const highlighted = highlightPaymentId === payment.id;
                        const busy = scheduleBusyId === payment.id;
                        return (
                          <tr
                            key={payment.id}
                            className={cn(
                              'bg-white dark:bg-slate-950',
                              highlighted && 'bg-indigo-50/80 dark:bg-indigo-500/10',
                            )}
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                              {monthLabel}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">
                              {dueLabel}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                              ₱{Number(payment.amount || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge tone={paymentStatusVariant(payment.status)}>
                                {payment.status === 'Paid'
                                  ? t('views.ledger.table.paid')
                                  : payment.status === 'Overdue'
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
                              ) : canUpdate && payment.status !== 'Paid' && isDueOrPast(due) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 rounded-lg bg-indigo-600 px-2.5 text-xs text-white hover:bg-indigo-700"
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
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('views.ledger.schedulePickContract')}
              </p>
              {schedulePickerCards.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
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
                      className="rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-indigo-500/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {card.unitLabel}
                            {card.building ? (
                              <span className="font-normal text-slate-500"> · {card.building}</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{card.tenantName}</p>
                        </div>
                        {card.status ? (
                          <StatusBadge tone={card.status === 'Active' ? 'success' : 'neutral'}>
                            {card.status}
                          </StatusBadge>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          ₱{card.monthlyRent.toLocaleString()}
                          <span className="font-normal text-slate-400"> / mo</span>
                        </span>
                        <span>
                          {t('views.ledger.scheduleCardUnpaid', {
                            unpaid: card.unpaid,
                            total: card.total,
                          })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.ledger.expectedCollection')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₱{expectedCollection.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.ledger.actualCollected')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₱{actualCollected.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.ledger.outstandingBalance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">₱{outstandingBalance.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder={t('views.ledger.searchPlaceholder')}
            className="h-10 rounded-xl pl-10 pr-4 border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-100 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm',
                  ledgerFilterActive && 'border-indigo-300 bg-indigo-50/60 text-indigo-900 dark:border-indigo-500/50 dark:bg-indigo-950/40 dark:text-indigo-100',
                )}
              >
                <Filter className="w-4 h-4 mr-2" />
                {t('views.ledger.filter')}
                {ledgerFilterActive ? (
                  <span
                    className="ml-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600"
                    title={t('views.ledger.filterActiveHint')}
                  />
                ) : null}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-80 gap-3 p-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('views.ledger.filterStatus')}
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {LEDGER_STATUS_FILTERS.map((status) => (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/80"
                  >
                    <Checkbox
                      checked={ledgerFilterStatuses.has(status)}
                      onCheckedChange={() => toggleLedgerFilterStatus(status)}
                    />
                    <span>
                      {status === 'Paid'
                        ? t('views.ledger.table.paid')
                        : status === 'Overdue'
                          ? t('views.ledger.table.overdue')
                          : t('views.ledger.table.pending')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('views.ledger.filterUnit')}
              </p>
              <Select2
                options={unitFilterOptions}
                value={ledgerFilterUnitId ?? ''}
                onChange={(v) => setLedgerFilterUnitId(v ? String(v) : null)}
                placeholder={t('views.ledger.filterAllUnits')}
              />
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-700">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-600 dark:text-slate-300"
                disabled={!ledgerFilterActive}
                onClick={clearLedgerFilters}
              >
                {t('views.ledger.filterClear')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
          <SkeletonTable rows={8} columns={8} />
        </div>
      ) : (
        <>
          <Card className="gap-0 overflow-hidden border-none py-0 shadow-md">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle>{t('views.ledger.upcomingTitle')}</CardTitle>
              <CardDescription>{t('views.ledger.upcomingDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                data={filteredUpcoming}
                columns={upcomingColumns}
                keyExtractor={(p) => `up-${p.id}`}
                embedded
                highlightFirstColumn={false}
                onRowClick={canUpdate ? (p) => openEditModal(p) : undefined}
              />
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden border-none py-0 shadow-md">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle>{t('views.ledger.collectionTitle')}</CardTitle>
              <CardDescription>{t('views.ledger.collectionDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                data={filteredPayments}
                columns={collectionColumns}
                keyExtractor={(p) => p.id}
                embedded
                highlightFirstColumn={false}
                onRowClick={canUpdate ? (p) => openEditModal(p) : undefined}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
