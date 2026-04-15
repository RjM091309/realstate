import React, { useMemo } from 'react';
import { 
  User, 
  FileText, 
  CreditCard, 
  Bell, 
  Settings, 
  Download, 
  Upload, 
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tenants, units, contracts, payments } from '@/lib/mockData';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Payment } from '@/types';

export function TenantPortalView() {
  const { t } = useTranslation();
  // Mocking the logged in tenant (e.g., John Doe)
  const tenant = tenants[0];
  const contract = contracts.find(c => c.tenantId === tenant.id);
  const unit = units.find(u => u.id === contract?.unitId);
  const tenantPayments = payments.filter(p => p.contractId === contract?.id);

  const paymentColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        header: t('views.portal.table.date'),
        render: (p) => <span>{format(new Date(p.paidDate || p.dueDate), 'MMM dd, yyyy')}</span>,
      },
      {
        header: t('views.portal.table.reference'),
        render: (p) => <span className="font-mono text-xs uppercase">{p.id}</span>,
      },
      {
        header: t('views.portal.table.amount'),
        render: (p) => <span className="font-bold">₱{p.amount.toLocaleString()}</span>,
      },
      {
        header: t('views.portal.table.status'),
        render: () => (
          <Badge variant="default" className="bg-emerald-500">
            {t('views.portal.table.paid')}
          </Badge>
        ),
      },
      {
        header: t('views.portal.table.action'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: () => (
          <Button variant="ghost" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        ),
      },
    ],
    [t]
  );

  const handlePreviewContract = () => {
    if (contract) {
      const url = `${window.location.origin}${window.location.pathname}?view=preview&type=contract&id=${contract.id}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in duration-500">
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{t('views.portal.welcome', { name: tenant.name })}</h1>
              <p className="text-indigo-100">{t('views.portal.unitInfo', { unitNumber: unit?.unitNumber, buildingName: unit?.buildingName })}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button className="bg-white text-indigo-600 hover:bg-indigo-50">
              <MessageSquare className="w-4 h-4 mr-2" />
              {t('views.portal.contactManagement')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Stats & Actions */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t('views.portal.currentStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-900">{t('views.portal.paidActive')}</div>
                <p className="text-xs text-emerald-600 mt-1">{t('views.portal.nextPaymentDue')}</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-indigo-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-indigo-600 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  {t('views.portal.contractPeriod')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-900">
                  {format(new Date(contract?.endDate || ''), 'MMM yyyy')}
                </div>
                <p className="text-xs text-indigo-600 mt-1">{t('views.portal.leaseExpires')}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>{t('views.portal.recentPayments')}</CardTitle>
              <CardDescription>{t('views.portal.recentPaymentsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden">
              <DataTable data={tenantPayments} columns={paymentColumns} keyExtractor={(p) => p.id} />
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>{t('views.portal.unitInventory')}</CardTitle>
              <CardDescription>{t('views.portal.unitInventoryDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { item: 'Air Conditioning Unit', status: 'Good' },
                  { item: 'Refrigerator (Samsung)', status: 'Good' },
                  { item: 'Microwave Oven', status: 'Good' },
                  { item: 'Queen Size Bed Frame', status: 'Good' },
                  { item: 'Water Heater', status: 'Maintenance Needed' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium">{item.item}</span>
                    </div>
                    <Badge variant={item.status === 'Good' ? 'outline' : 'destructive'} className="text-[10px]">
                      {item.status === 'Good' ? t('views.portal.inventoryStatus.good') : t('views.portal.inventoryStatus.maintenanceNeeded')}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: KYC & Documents */}
        <div className="space-y-8">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                {t('views.portal.kycTitle')}
              </CardTitle>
              <CardDescription>{t('views.portal.kycDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
                <h4 className="text-sm font-bold">{t('views.portal.passportCard')}</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">{t('views.portal.passportHint')}</p>
                <Button size="sm" className="bg-indigo-600 w-full">{t('views.portal.updateDocument')}</Button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t('views.portal.verificationProgress')}</span>
                  <span className="font-bold text-indigo-600">85%</span>
                </div>
                <Progress value={85} className="h-2" />
                <p className="text-[10px] text-slate-400">{t('views.portal.lastUpdated')}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>{t('views.portal.myDocuments')}</CardTitle>
              <CardDescription>{t('views.portal.myDocumentsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div 
                className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer"
                onClick={handlePreviewContract}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Lease_Contract_2025.pdf</span>
                    <span className="text-[10px] text-slate-400">2.4 MB</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
              </div>
              {[
                { name: 'House_Rules_Handbook.pdf', size: '1.1 MB' },
                { name: 'Move_In_Clearance.pdf', size: '0.5 MB' },
              ].map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{doc.name}</span>
                      <span className="text-[10px] text-slate-400">{doc.size}</span>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-amber-50 border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {t('views.portal.maintenanceTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-700 mb-4">{t('views.portal.maintenanceHint')}</p>
              <Button size="sm" variant="outline" className="w-full border-amber-200 text-amber-900 hover:bg-amber-100">
                {t('views.portal.submitRequest')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
