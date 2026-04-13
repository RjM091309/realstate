import React from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Filter,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { payments, units, contracts, tenants } from '@/lib/mockData';
import { addDays, format, isAfter, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function LeaseLedgerView() {
  const { t } = useTranslation();
  const upcomingPayments = payments
    .filter((payment) => {
      const due = new Date(payment.dueDate);
      return payment.status !== 'Paid' && isAfter(due, new Date()) && isBefore(due, addDays(new Date(), 8));
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const handlePreviewInvoice = (contractId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?view=preview&type=invoice&id=${contractId}`;
    window.open(url, '_blank');
  };

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
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          {t('views.ledger.filter')}
        </Button>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>{t('views.ledger.upcomingTitle')}</CardTitle>
          <CardDescription>{t('views.ledger.upcomingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>{t('views.ledger.table.unit')}</TableHead>
                <TableHead>{t('views.ledger.table.tenant')}</TableHead>
                <TableHead>{t('views.ledger.table.dueDate')}</TableHead>
                <TableHead className="text-right">{t('views.ledger.table.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingPayments.length > 0 ? (
                upcomingPayments.map((payment) => {
                  const unit = units.find(u => u.id === payment.unitId);
                  const contract = contracts.find(c => c.id === payment.contractId);
                  const tenant = contract ? tenants.find(t => t.id === contract.tenantId) : null;
                  return (
                    <TableRow key={`upcoming-${payment.id}`}>
                      <TableCell className="font-bold text-slate-900">{unit?.unitNumber}</TableCell>
                      <TableCell>{tenant?.name}</TableCell>
                      <TableCell>{format(new Date(payment.dueDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-right font-semibold">₱{payment.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-6">
                    {t('views.ledger.table.emptyUpcoming')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>{t('views.ledger.collectionTitle')}</CardTitle>
          <CardDescription>{t('views.ledger.collectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>{t('views.ledger.table.unit')}</TableHead>
                <TableHead>{t('views.ledger.table.tenant')}</TableHead>
                <TableHead>{t('views.ledger.table.dueDate')}</TableHead>
                <TableHead>{t('views.ledger.table.amount')}</TableHead>
                <TableHead>{t('views.ledger.table.status')}</TableHead>
                <TableHead>{t('views.ledger.table.paidDate')}</TableHead>
                <TableHead className="text-right">{t('views.ledger.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const unit = units.find(u => u.id === payment.unitId);
                const contract = contracts.find(c => c.id === payment.contractId);
                const tenant = contract ? tenants.find(t => t.id === contract.tenantId) : null;

                return (
                  <TableRow key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-slate-900">{unit?.unitNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">{tenant?.name}</span>
                        <span className="text-xs text-slate-500">{unit?.buildingName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(payment.dueDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-semibold">₱{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {payment.paidDate ? format(new Date(payment.paidDate), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title={t('views.ledger.table.viewInvoice')}
                          onClick={() => handlePreviewInvoice(payment.contractId)}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Plus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
