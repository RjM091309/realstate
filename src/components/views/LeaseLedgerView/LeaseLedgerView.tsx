import React, { useEffect, useMemo, useState } from 'react';
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
import { SkeletonTable } from '@/components/skeleton';
import {
  payments as seedPayments,
  units as seedUnits,
  contracts as seedContracts,
  tenants as seedTenants,
} from '@/lib/mockData';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { createPayment, deletePayment, fetchPayments, updatePayment } from '@/lib/paymentsApi';
import { addDays, endOfMonth, format, isAfter, isBefore, isWithinInterval, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import type { Contract, Payment, Tenant, Unit } from '@/types';

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
  const hay = [p.id, unit?.unitNumber, unit?.buildingName, tenant?.name, String(p.amount), p.status]
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

  useEffect(() => {
    void (async () => {
      try {
        const [paymentsData, unitsData, contractsData, tenantsData] = await Promise.all([
          fetchPayments(),
          fetchUnits(),
          fetchContracts(),
          fetchTenants(),
        ]);
        setPayments(paymentsData);
        setUnits(unitsData);
        setContracts(contractsData);
        setTenants(tenantsData);
      } catch {
        setPayments(seedPayments);
        setUnits(seedUnits);
        setContracts(seedContracts);
        setTenants(seedTenants);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    () => upcomingPayments.filter((p) => paymentMatchesQuery(p, searchTerm, units, contracts, tenants)),
    [upcomingPayments, searchTerm, units, contracts, tenants],
  );

  const filteredPayments = useMemo(
    () => payments.filter((p) => paymentMatchesQuery(p, searchTerm, units, contracts, tenants)),
    [payments, searchTerm, units, contracts, tenants],
  );

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

  const handlePreviewInvoice = (contractId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?view=preview&type=invoice&id=${contractId}`;
    window.open(url, '_blank');
  };

  const openCreateModal = () => {
    setFormMode('create');
    setEditingPaymentId(null);
    setForm(emptyForm());
    setIsPaymentModalOpen(true);
  };

  const openEditModal = (payment: Payment) => {
    setFormMode('edit');
    setEditingPaymentId(payment.id);
    setForm(toForm(payment));
    setIsPaymentModalOpen(true);
  };

  const closeModal = () => {
    setIsPaymentModalOpen(false);
    setFormMode('create');
    setEditingPaymentId(null);
    setForm(emptyForm());
  };

  const savePayment = async () => {
    if (!form.contractId || !form.unitId || !form.dueDate) {
      toast.error('Please select contract and due date.');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter a valid amount.');
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
        toast.success('Payment updated.');
      } else {
        const created = await createPayment(payload);
        setPayments((prev) => [created, ...prev]);
        toast.success('Payment recorded.');
      }
      closeModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save payment');
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!window.confirm(`Delete payment ${payment.id}?`)) return;
    try {
      await deletePayment(payment.id);
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      toast.success('Payment deleted.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete payment');
    }
  };

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
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {t('views.ledger.table.paid')}
              </Badge>
            ) : payment.status === 'Overdue' ? (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                {t('views.ledger.table.overdue')}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <Clock className="w-3 h-3 mr-1" />
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
                  {canUpdate && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(payment);
                      }}
                    >
                      Edit payment
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      className="text-rose-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeletePayment(payment);
                      }}
                    >
                      Delete payment
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ),
      },
    ],
    [t, units, contracts, tenants, canUpdate, canDelete],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.ledger.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.ledger.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
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
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button className="bg-indigo-600" onClick={() => void savePayment()}>
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

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('views.ledger.searchPlaceholder')}
            className="h-9 rounded-full pl-10 pr-3 border border-[var(--border)] hover:border-slate-300 focus:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300 transition-all"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--control-bg) 70%, transparent)',
              borderColor: 'color-mix(in oklab, var(--border) 88%, #cbd5e1)',
            }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto shrink-0">
          <Filter className="w-4 h-4 mr-2" />
          {t('views.ledger.filter')}
        </Button>
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
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
