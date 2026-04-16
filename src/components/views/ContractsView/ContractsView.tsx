import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  FileText,
  History,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { SkeletonTable } from '@/components/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { contracts as seedContracts, units as seedUnits, tenants as seedTenants, agents } from '@/lib/mockData';
import { fetchTenants } from '@/lib/tenantsApi';
import { fetchUnits } from '@/lib/unitsApi';
import { createContract, deleteContract, fetchContracts, updateContract } from '@/lib/contractsApi';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Contract, Tenant, Unit } from '@/types';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';

export function ContractsView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.contracts?.create ?? false;
  const canUpdate = session?.crud?.contracts?.update ?? false;
  const canDelete = session?.crud?.contracts?.delete ?? false;
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractList, setContractList] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewContractOpen, setIsNewContractOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  });
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);

  const resetNewContractForm = () => {
    setUnitId(null);
    setTenantId(null);
    setMonthlyRent('');
    setSecurityDeposit('');
    setStartDate(new Date());
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    setEndDate(d);
  };

  const openCreateModal = () => {
    setFormMode('create');
    setEditingContractId(null);
    resetNewContractForm();
    setIsNewContractOpen(true);
  };

  const openEditModal = (contract: Contract) => {
    setFormMode('edit');
    setEditingContractId(contract.id);
    setUnitId(contract.unitId);
    setTenantId(contract.tenantId);
    setMonthlyRent(String(contract.monthlyRent));
    setSecurityDeposit(String(contract.securityDeposit));
    setStartDate(new Date(contract.startDate));
    setEndDate(new Date(contract.endDate));
    setIsNewContractOpen(true);
  };

  const closeContractModal = () => {
    setIsNewContractOpen(false);
    setFormMode('create');
    setEditingContractId(null);
    resetNewContractForm();
  };

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchContracts();
        setContractList(list);
      } catch {
        setContractList(seedContracts);
      } finally {
        setContractsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchTenants();
        setTenantList(list);
      } catch {
        setTenantList(seedTenants);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchUnits();
        setUnitList(list);
      } catch {
        setUnitList(seedUnits);
      }
    })();
  }, []);

  const unitOptions = useMemo(
    () =>
      unitList
        .filter((u) => u.status === 'Available')
        .map((u) => ({ value: u.id, label: `${u.unitNumber} - ${u.buildingName}` })),
    [unitList],
  );
  const tenantOptions = useMemo(
    () => tenantList.map((ten) => ({ value: ten.id, label: ten.name })),
    [tenantList],
  );

  const handlePreview = (contract: Contract, type: 'contract' | 'invoice') => {
    const url = `${window.location.origin}${window.location.pathname}?view=preview&type=${type}&id=${contract.id}`;
    window.open(url, '_blank');
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (!window.confirm(`Delete contract ${contract.id}?`)) return;
    try {
      await deleteContract(contract.id);
      setContractList((prev) => prev.filter((c) => c.id !== contract.id));
      toast.success('Contract deleted.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete contract');
    }
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
          const unit = unitList.find((u) => u.id === contract.unitId);
          const tenant = tenantList.find((ten) => ten.id === contract.tenantId);
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
            variant="outline"
            className={cn(
              'font-medium border-0',
              contract.status === 'Active'
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
            )}
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
          <div className="flex justify-end items-center gap-1">
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
      {
        header: 'Action',
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (contract) => (
          <div
            className="inline-flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
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
                      openEditModal(contract);
                    }}
                  >
                    Edit Contract
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteContract(contract);
                    }}
                  >
                    Delete Contract
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, tenantList, unitList, canUpdate, canDelete]
  );

  const handleGenerate = () => {
    const rent = Number(monthlyRent);
    const deposit = Number(securityDeposit);
    if (!unitId || !tenantId || !startDate || !endDate) {
      toast.error('Please select unit, tenant, and lease dates.');
      return;
    }
    if (!Number.isFinite(rent) || rent <= 0 || !Number.isFinite(deposit) || deposit < 0) {
      toast.error('Please enter valid rent and security deposit values.');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date must be after start date.');
      return;
    }

    const agentId = session?.user?.id ? `a${session.user.id}` : agents[0]?.id ?? 'a1';
    const newContractPayload: Parameters<typeof createContract>[0] = {
      unitId,
      tenantId,
      agentId,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      monthlyRent: rent,
      securityDeposit: deposit,
      advanceRent: rent,
      type: 'Monthly Rental',
      status: 'Active',
      remarks: '',
    };
    void (async () => {
      try {
        if (formMode === 'edit' && editingContractId) {
          const updated = await updateContract(editingContractId, newContractPayload);
          setContractList((prev) => prev.map((c) => (c.id === editingContractId ? updated : c)));
          toast.success('Contract updated.');
        } else {
          const created = await createContract(newContractPayload);
          setContractList((prev) => [created, ...prev]);
          toast.success(t('views.contracts.generateActivate'));
        }
        closeContractModal();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save contract');
      }
    })();
  };

  const filteredContracts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return contractList;
    return contractList.filter((c) => {
      const unit = unitList.find((u) => u.id === c.unitId);
      const tenant = tenantList.find((ten) => ten.id === c.tenantId);
      const agent = agents.find((a) => a.id === c.agentId);
      const hay = [c.id, unit?.unitNumber, unit?.buildingName, tenant?.name, agent?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [searchTerm, contractList, tenantList, unitList]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.contracts.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.contracts.subtitle')}</p>
        </div>
        {canCreate && (
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('views.contracts.newLeaseWorkflow')}
          </Button>
        )}
      </div>

      <Modal
        isOpen={isNewContractOpen}
        onClose={closeContractModal}
        title={formMode === 'edit' ? 'Edit Lease Agreement' : t('views.contracts.newLeaseAgreement')}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={closeContractModal}>
              {t('views.contracts.cancel')}
            </Button>
            <Button className="bg-indigo-600" onClick={handleGenerate}>
              {formMode === 'edit' ? 'Save Changes' : t('views.contracts.generateActivate')}
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
            <AppDatePicker
              mode="single"
              value={startDate}
              onChange={(d) => setStartDate((d as Date | null) ?? null)}
              placeholder="Start date"
              fullWidth
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.endDate')}</Label>
            <AppDatePicker
              mode="single"
              value={endDate}
              onChange={(d) => setEndDate((d as Date | null) ?? null)}
              placeholder="End date"
              fullWidth
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.monthlyRent')}</Label>
            <Input
              type="number"
              placeholder="35000"
              className="rounded-xl"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.securityDeposit')}</Label>
            <Input
              type="number"
              placeholder="70000"
              className="rounded-xl"
              value={securityDeposit}
              onChange={(e) => setSecurityDeposit(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('views.contracts.searchPlaceholder')}
            className="h-9 rounded-full pl-10 pr-3 border border-[var(--border)] hover:border-slate-300 focus:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300 transition-all"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--control-bg) 70%, transparent)',
              borderColor: 'color-mix(in oklab, var(--border) 88%, #cbd5e1)',
            }}
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

      {contractsLoading ? (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
          <SkeletonTable rows={8} columns={6} />
        </div>
      ) : (
        <DataTable data={filteredContracts} columns={columns} keyExtractor={(c) => c.id} />
      )}
    </div>
  );
}
