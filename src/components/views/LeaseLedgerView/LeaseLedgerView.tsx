import React, { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { payments, units, contracts, tenants } from '@/lib/mockData';
import { addDays, format, isAfter, isBefore } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Payment } from '@/types';

function paymentMatchesQuery(p: Payment, q: string): boolean {
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
  const [searchTerm, setSearchTerm] = useState('');
  const upcomingPayments = useMemo(
    () =>
      payments
        .filter((payment) => {
          const due = new Date(payment.dueDate);
          return payment.status !== 'Paid' && isAfter(due, new Date()) && isBefore(due, addDays(new Date(), 8));
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    []
  );

  const filteredUpcoming = useMemo(
    () => upcomingPayments.filter((p) => paymentMatchesQuery(p, searchTerm)),
    [upcomingPayments, searchTerm]
  );
  const filteredPayments = useMemo(
    () => payments.filter((p) => paymentMatchesQuery(p, searchTerm)),
    [searchTerm]
  );

  const handlePreviewInvoice = (contractId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?view=preview&type=invoice&id=${contractId}`;
    window.open(url, '_blank');
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
    [t]
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
          <div className="flex justify-end gap-2">
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
          </div>
        ),
      },
    ],
    [t]
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
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            {t('views.ledger.recordPayment')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.ledger.expectedCollection')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₱425,000</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.ledger.actualCollected')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₱380,000</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.ledger.outstandingBalance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">₱45,000</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('views.ledger.searchPlaceholder')}
            className="pl-10 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto shrink-0">
          <Filter className="w-4 h-4 mr-2" />
          {t('views.ledger.filter')}
        </Button>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader>
          <CardTitle>{t('views.ledger.upcomingTitle')}</CardTitle>
          <CardDescription>{t('views.ledger.upcomingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable data={filteredUpcoming} columns={upcomingColumns} keyExtractor={(p) => `up-${p.id}`} />
        </CardContent>
      </Card>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader>
          <CardTitle>{t('views.ledger.collectionTitle')}</CardTitle>
          <CardDescription>{t('views.ledger.collectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable data={filteredPayments} columns={collectionColumns} keyExtractor={(p) => p.id} />
        </CardContent>
      </Card>
    </div>
  );
}
