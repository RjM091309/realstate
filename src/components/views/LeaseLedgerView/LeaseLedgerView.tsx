import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Plus,
  MoreVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { createPayment, deletePayment, fetchPayments, updatePayment } from '@/lib/paymentsApi';
import { addDays, endOfMonth, format, isAfter, isBefore, isWithinInterval, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import type { Contract, Payment, PaymentStatus, Tenant, Unit } from '@/types';

const LEDGER_STATUS_FILTERS: PaymentStatus[] = ['Paid', 'Pending', 'Overdue'];

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

type PaymentForm = {
  contractId: string | null;
  unitId: string;
  amount: string;
  dueDate: string;
  status: Payment['status'];
  paidDate: string;
};

function emptyForm(): PaymentForm {
  return {
    contractId: null,
    unitId: '',
    amount: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'Pending',
    paidDate: '',
  };
}

function toForm(payment: Payment): PaymentForm {
  return {
    contractId: payment.contractId,
    unitId: payment.unitId,
    amount: String(payment.amount),
    dueDate: payment.dueDate,
    status: payment.status,
    paidDate: payment.paidDate ?? '',
  };
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
  const canCreate = session?.crud?.ledger?.create ?? false;
  const canUpdate = session?.crud?.ledger?.update ?? false;
  const canDelete = session?.crud?.ledger?.delete ?? false;

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [refLoading, setRefLoading] = useState(false);
  const [ledgerFilterStatuses, setLedgerFilterStatuses] = useState<Set<PaymentStatus>>(defaultLedgerStatusFilters);
  const [ledgerFilterUnitId, setLedgerFilterUnitId] = useState<string | null>(null);

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
      contracts.map((c) => {
        const unit = units.find((u) => u.id === c.unitId);
        const tenant = tenants.find((tnt) => tnt.id === c.tenantId);
        return {
          value: c.id,
          label: `${unit?.unitNumber ?? c.unitId} - ${tenant?.name ?? c.tenantId}`,
        };
      }),
    [contracts, units, tenants],
  );

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

  const openCreateModal = useCallback(() => {
    setFormMode('create');
    setEditingPaymentId(null);
    setForm(emptyForm());
    setIsPaymentModalOpen(true);
    void ensureReferenceDataLoaded();
  }, [ensureReferenceDataLoaded]);

  const openEditModal = useCallback((payment: Payment) => {
    setFormMode('edit');
    setEditingPaymentId(payment.id);
    setForm(toForm(payment));
    setIsPaymentModalOpen(true);
    void ensureReferenceDataLoaded();
  }, [ensureReferenceDataLoaded]);

  const closeModal = useCallback(() => {
    setIsPaymentModalOpen(false);
    setFormMode('create');
    setEditingPaymentId(null);
    setForm(emptyForm());
  }, []);

  const savePayment = useCallback(async () => {
    if (!form.contractId || !form.unitId || !form.dueDate) {
      toast.error(t('views.ledger.validationRequired'));
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t('views.ledger.validationAmount'));
      return;
    }
    const payload = {
      contractId: form.contractId,
      unitId: form.unitId,
      amount,
      dueDate: form.dueDate,
      paidDate: form.paidDate || undefined,
      status: form.status,
    };
    try {
      if (formMode === 'edit' && editingPaymentId) {
        const updated = await updatePayment(editingPaymentId, payload);
        setPayments((prev) => prev.map((p) => (p.id === editingPaymentId ? updated : p)));
        toast.success(t('views.ledger.updated'));
      } else {
        const created = await createPayment(payload);
        setPayments((prev) => [created, ...prev]);
        toast.success(t('views.ledger.recorded'));
      }
      closeModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.ledger.saveError'));
    }
  }, [closeModal, editingPaymentId, form, formMode, t]);

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
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: payment.dueDate,
          paidDate: today,
          status: 'Paid',
        });
        setPayments((prev) => prev.map((p) => (p.id === payment.id ? updated : p)));
        toast.success(t('views.ledger.markedPaid'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.updateStatusError'));
      }
    },
    [t],
  );

  const handleQuickMarkPending = useCallback(
    async (payment: Payment) => {
      try {
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: payment.dueDate,
          status: 'Pending',
        });
        setPayments((prev) => prev.map((p) => (p.id === payment.id ? updated : p)));
        toast.success(t('views.ledger.markedPending'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.updateStatusError'));
      }
    },
    [t],
  );

  const handleQuickMarkOverdue = useCallback(
    async (payment: Payment) => {
      try {
        const updated = await updatePayment(payment.id, {
          contractId: payment.contractId,
          unitId: payment.unitId,
          amount: payment.amount,
          dueDate: payment.dueDate,
          status: 'Overdue',
        });
        setPayments((prev) => prev.map((p) => (p.id === payment.id ? updated : p)));
        toast.success(t('views.ledger.markedOverdue'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.ledger.updateStatusError'));
      }
    },
    [t],
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
        render: (payment) => <span>{format(new Date(payment.dueDate), 'MMM dd, yyyy')}</span>,
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
        render: (payment) => <span>{format(new Date(payment.dueDate), 'MMM dd, yyyy')}</span>,
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
              <Badge className="h-auto rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/40 hover:bg-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {t('views.ledger.table.paid')}
              </Badge>
            ) : payment.status === 'Overdue' ? (
              <Badge className="h-auto rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide bg-rose-100 text-rose-800 border border-rose-300/80 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/45 hover:bg-rose-100">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                {t('views.ledger.table.overdue')}
              </Badge>
            ) : (
              <Badge className="h-auto rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide bg-amber-100 text-amber-800 border border-amber-300/80 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/45 hover:bg-amber-100">
                <Clock className="w-3.5 h-3.5 mr-1" />
                {t('views.ledger.table.pending')}
              </Badge>
            )}
          </div>
        ),
      },
      {
        header: t('views.ledger.table.paidDate'),
        render: (payment) => <span>{payment.paidDate ? format(new Date(payment.paidDate), 'MMM dd, yyyy') : '-'}</span>,
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
            {(canUpdate || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} />}
                >
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canUpdate && payment.status !== 'Paid' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickMarkPaid(payment);
                      }}
                    >
                      {t('views.ledger.markPaid')}
                    </DropdownMenuItem>
                  )}
                  {canUpdate && payment.status !== 'Overdue' && payment.status !== 'Paid' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickMarkOverdue(payment);
                      }}
                    >
                      {t('views.ledger.markOverdue')}
                    </DropdownMenuItem>
                  )}
                  {canUpdate && payment.status === 'Paid' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickMarkPending(payment);
                      }}
                    >
                      {t('views.ledger.markPending')}
                    </DropdownMenuItem>
                  )}
                  {canUpdate && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(payment);
                      }}
                    >
                      {t('views.ledger.editPayment')}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      variant="destructive"
                      className="text-rose-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeletePayment(payment);
                      }}
                    >
                      {t('views.ledger.deletePayment')}
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
          {canCreate && (
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              {t('views.ledger.recordPayment')}
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={closeModal}
        title={formMode === 'edit' ? 'Edit Payment' : t('views.ledger.recordPayment')}
        maxWidth="2xl"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={() => void savePayment()}>
              {formMode === 'edit' ? 'Save Changes' : t('views.ledger.recordPayment')}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Contract</Label>
            <Select2
              options={contractOptions}
              value={form.contractId}
              onChange={(v) => {
                const cid = (v ?? null) as string | null;
                const c = contracts.find((x) => x.id === cid);
                setForm((prev) => ({
                  ...prev,
                  contractId: cid,
                  unitId: c?.unitId ?? prev.unitId,
                  amount: c ? String(c.monthlyRent) : prev.amount,
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select2
              options={[
                { value: 'Pending', label: t('views.ledger.table.pending') },
                { value: 'Overdue', label: t('views.ledger.table.overdue') },
                { value: 'Paid', label: t('views.ledger.table.paid') },
              ]}
              value={form.status}
              onChange={(v) => setForm((prev) => ({ ...prev, status: (v ?? 'Pending') as Payment['status'] }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.ledger.table.dueDate')}</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.ledger.table.paidDate')}</Label>
            <Input
              type="date"
              value={form.paidDate}
              onChange={(e) => setForm((prev) => ({ ...prev, paidDate: e.target.value }))}
            />
          </div>
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
