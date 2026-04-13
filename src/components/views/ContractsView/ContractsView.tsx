import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Printer, 
  Download, 
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  History
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
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { contracts, units, tenants, agents } from '@/lib/mockData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function ContractsView() {
  const { t } = useTranslation();
  const [isNewContractOpen, setIsNewContractOpen] = useState(false);

  const handlePreview = (contract: any, type: 'contract' | 'invoice') => {
    const url = `${window.location.origin}${window.location.pathname}?view=preview&type=${type}&id=${contract.id}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.contracts.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.contracts.subtitle')}</p>
        </div>
        <Dialog open={isNewContractOpen} onOpenChange={setIsNewContractOpen}>
          <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700" />}>
            <Plus className="w-4 h-4 mr-2" />
            {t('views.contracts.newLeaseWorkflow')}
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('views.contracts.newLeaseAgreement')}</DialogTitle>
              <DialogDescription>
                {t('views.contracts.newLeaseDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>{t('views.contracts.selectUnit')}</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('views.contracts.chooseUnit')} />
                  </SelectTrigger>
                  <SelectContent>
                    {units.filter(u => u.status === 'Available').map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.unitNumber} - {u.buildingName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('views.contracts.selectTenant')}</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('views.contracts.chooseTenant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('views.contracts.startDate')}</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>{t('views.contracts.endDate')}</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>{t('views.contracts.monthlyRent')}</Label>
                <Input type="number" placeholder="35000" />
              </div>
              <div className="space-y-2">
                <Label>{t('views.contracts.securityDeposit')}</Label>
                <Input type="number" placeholder="70000" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewContractOpen(false)}>{t('views.contracts.cancel')}</Button>
              <Button className="bg-indigo-600" onClick={() => setIsNewContractOpen(false)}>
                {t('views.contracts.generateActivate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder={t('views.contracts.searchPlaceholder')}
            className="pl-10 border-slate-200"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            {t('views.contracts.filter')}
          </Button>
          <Button variant="outline">
            <History className="w-4 h-4 mr-2" />
            {t('views.contracts.archive')}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>{t('views.contracts.table.contractId')}</TableHead>
                <TableHead>{t('views.contracts.table.unitTenant')}</TableHead>
                <TableHead>{t('views.contracts.table.period')}</TableHead>
                <TableHead>{t('views.contracts.table.agent')}</TableHead>
                <TableHead>{t('views.contracts.table.status')}</TableHead>
                <TableHead className="text-right">{t('views.contracts.table.documents')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => {
                const unit = units.find(u => u.id === contract.unitId);
                const tenant = tenants.find(t => t.id === contract.tenantId);
                const agent = agents.find(a => a.id === contract.agentId);

                return (
                  <TableRow key={contract.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-mono text-xs text-slate-500 uppercase">{contract.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{t('views.units.unitLabel', { unitNumber: unit?.unitNumber })}</span>
                        <span className="text-xs text-slate-500">{tenant?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="text-slate-700">{format(new Date(contract.startDate), 'MMM dd, yyyy')}</span>
                        <span className="text-slate-400">{t('views.contracts.table.to')} {format(new Date(contract.endDate), 'MMM dd, yyyy')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{agent?.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={contract.status === 'Active' ? 'default' : 'outline'}
                        className={cn(
                          contract.status === 'Active' ? "bg-emerald-500" : "text-slate-500"
                        )}
                      >
                        {contract.status === 'Active' ? t('views.contracts.statuses.active') : contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-indigo-600"
                          onClick={() => handlePreview(contract, 'contract')}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          {t('views.contracts.table.contract')}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-slate-600"
                          onClick={() => handlePreview(contract, 'invoice')}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          {t('views.contracts.table.invoice')}
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
