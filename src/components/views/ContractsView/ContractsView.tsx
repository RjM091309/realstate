import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  FileText,
  History,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Select2 } from '@/components/ui/select2';
import { contracts, units, tenants, agents } from '@/lib/mockData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { Contract } from '@/types';

export function ContractsView() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewContractOpen, setIsNewContractOpen] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  });

  const unitOptions = useMemo(
    () =>
      units
        .filter((u) => u.status === 'Available')
        .map((u) => ({ value: u.id, label: `${u.unitNumber} - ${u.buildingName}` })),
    []
  );
  const tenantOptions = useMemo(
    () => tenants.map((ten) => ({ value: ten.id, label: ten.name })),
    []
  );

  const handlePreview = (contract: Contract, type: 'contract' | 'invoice') => {
    const url = `${window.location.origin}${window.location.pathname}?view=preview&type=${type}&id=${contract.id}`;
    window.open(url, '_blank');
  };

  const columns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        header: t('views.contracts.table.contractId'),
        render: (contract) => (
          <span className="font-mono text-xs text-slate-500 uppercase">{contract.id}</span>
        ),
      },
      {
        header: t('views.contracts.table.unitTenant'),
        render: (contract) => {
          const unit = units.find((u) => u.id === contract.unitId);
          const tenant = tenants.find((ten) => ten.id === contract.tenantId);
          return (
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">
                {t('views.units.unitLabel', { unitNumber: unit?.unitNumber })}
              </span>
              <span className="text-xs text-slate-500">{tenant?.name}</span>
            </div>
          );
        },
      },
      {
        header: t('views.contracts.table.period'),
        render: (contract) => (
          <div className="flex flex-col text-xs">
            <span className="text-slate-700">{format(new Date(contract.startDate), 'MMM dd, yyyy')}</span>
            <span className="text-slate-400">
              {t('views.contracts.table.to')} {format(new Date(contract.endDate), 'MMM dd, yyyy')}
            </span>
          </div>
        ),
      },
      {
        header: t('views.contracts.table.agent'),
        render: (contract) => {
          const agent = agents.find((a) => a.id === contract.agentId);
          return <span className="text-sm font-medium">{agent?.name}</span>;
        },
      },
      {
        header: t('views.contracts.table.status'),
        render: (contract) => (
          <Badge
            variant={contract.status === 'Active' ? 'default' : 'outline'}
            className={cn(contract.status === 'Active' ? 'bg-emerald-500' : 'text-slate-500')}
          >
            {contract.status === 'Active' ? t('views.contracts.statuses.active') : contract.status}
          </Badge>
        ),
      },
      {
        header: t('views.contracts.table.documents'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (contract) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-indigo-600"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(contract, 'contract');
              }}
            >
              <FileText className="w-4 h-4 mr-1" />
              {t('views.contracts.table.contract')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(contract, 'invoice');
              }}
            >
              <FileText className="w-4 h-4 mr-1" />
              {t('views.contracts.table.invoice')}
            </Button>
          </div>
        ),
      },
    ],
    [t]
  );

  const handleGenerate = () => {
    toast.success(t('views.contracts.generateActivate'));
    setIsNewContractOpen(false);
  };

  const filteredContracts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return contracts;
    return contracts.filter((c) => {
      const unit = units.find((u) => u.id === c.unitId);
      const tenant = tenants.find((ten) => ten.id === c.tenantId);
      const agent = agents.find((a) => a.id === c.agentId);
      const hay = [c.id, unit?.unitNumber, unit?.buildingName, tenant?.name, agent?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.contracts.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.contracts.subtitle')}</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsNewContractOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('views.contracts.newLeaseWorkflow')}
        </Button>
      </div>

      <Modal
        isOpen={isNewContractOpen}
        onClose={() => setIsNewContractOpen(false)}
        title={t('views.contracts.newLeaseAgreement')}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsNewContractOpen(false)}>
              {t('views.contracts.cancel')}
            </Button>
            <Button className="bg-indigo-600" onClick={handleGenerate}>
              {t('views.contracts.generateActivate')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-brand-muted mb-4">{t('views.contracts.newLeaseDescription')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('views.contracts.selectUnit')}</Label>
            <Select2 options={unitOptions} value={unitId} onChange={(v) => setUnitId(v as string | null)} />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.selectTenant')}</Label>
            <Select2 options={tenantOptions} value={tenantId} onChange={(v) => setTenantId(v as string | null)} />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.startDate')}</Label>
            <DatePicker
              selected={startDate}
              onChange={(d) => setStartDate(d)}
              dateFormat="yyyy-MM-dd"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-brand-text"
              calendarClassName="react-datepicker-material"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.endDate')}</Label>
            <DatePicker
              selected={endDate}
              onChange={(d) => setEndDate(d)}
              dateFormat="yyyy-MM-dd"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-brand-text"
              calendarClassName="react-datepicker-material"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.monthlyRent')}</Label>
            <Input type="number" placeholder="35000" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.securityDeposit')}</Label>
            <Input type="number" placeholder="70000" className="rounded-xl" />
          </div>
        </div>
      </Modal>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('views.contracts.searchPlaceholder')}
            className="pl-10 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
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

      <DataTable data={filteredContracts} columns={columns} keyExtractor={(c) => c.id} />
    </div>
  );
}
