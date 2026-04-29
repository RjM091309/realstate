import { useEffect, useMemo, useState } from 'react';
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
import { units as seedUnits, tenants as seedTenants, agents } from '@/lib/mockData';
import { fetchTenants } from '@/lib/tenantsApi';
import { fetchUnits } from '@/lib/unitsApi';
import {
  createContract,
  deleteContract,
  fetchContractCollaborations,
  fetchContractTenants,
  fetchContracts,
  inviteContractCollaborator,
  updateContract,
  updateContractCollaborator,
} from '@/lib/contractsApi';
import { createContractInvoice } from '@/lib/invoicesApi';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Contract, ContractCollaborationRow, ContractTenantRow, Tenant, Unit, DocumentTemplateRow, RepositoryDocumentRow, InventorySnapshotItemRow, InventorySnapshotRow } from '@/types';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import {
  ContractDetailsCollaborationModal,
  type ActivityItem,
  type Collaborator,
} from '@/components/contracts/ContractDetailsCollaborationModal';
import {
  fetchContractRepositoryDocuments,
  fetchDocumentTemplates,
  uploadContractRepositoryDocument,
  uploadDocumentTemplate,
} from '@/lib/documentsApi';
import {
  createInventorySnapshot,
  createInventorySnapshotItem,
  deleteInventorySnapshot,
  deleteInventorySnapshotItem,
  fetchContractInventorySnapshots,
  fetchSnapshotItems,
  patchInventorySnapshot,
  patchInventorySnapshotItem,
} from '@/lib/inventoryApi';

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
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [contractTenants, setContractTenants] = useState<ContractTenantRow[]>([]);
  const [contractCollaborations, setContractCollaborations] = useState<ContractCollaborationRow[]>([]);
  const [repoDocs, setRepoDocs] = useState<RepositoryDocumentRow[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateRow[]>([]);
  const [inventorySnapshots, setInventorySnapshots] = useState<InventorySnapshotRow[]>([]);
  const [inventoryItemsBySnapshot, setInventoryItemsBySnapshot] = useState<
    Record<string, InventorySnapshotItemRow[]>
  >({});

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
        setContractList([]);
        toast.warning(t('views.contracts.loadError'));
      } finally {
        setContractsLoading(false);
      }
    })();
  }, [t]);

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

  const applyUnitDefaults = (pickedUnitId: string | null) => {
    if (!pickedUnitId) return;
    const unit = unitList.find((u) => u.id === pickedUnitId);
    if (!unit) return;

    const rent = Number(unit.monthlyRate);
    if (!Number.isFinite(rent) || rent <= 0) return;

    // Auto-fill defaults (new contract workflow).
    // Keep user-entered values if they already typed something.
    setMonthlyRent((prev) => (String(prev ?? '').trim() ? prev : String(rent)));
    setSecurityDeposit((prev) => (String(prev ?? '').trim() ? prev : String(rent * 2)));
  };

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

  const openContractDetails = (contract: Contract) => {
    setSelectedContract(contract);
    setIsDetailsOpen(true);
    setContractTenants([]);
    setContractCollaborations([]);
    setRepoDocs([]);
    setTemplates([]);
    setInventorySnapshots([]);
    setInventoryItemsBySnapshot({});

    void (async () => {
      try {
        const [tenantsRows, collabRows, docsRows, templateRows, snapRows] = await Promise.all([
          fetchContractTenants(contract.id),
          fetchContractCollaborations(contract.id),
          fetchContractRepositoryDocuments(contract.id),
          fetchDocumentTemplates(),
          fetchContractInventorySnapshots(contract.id),
        ]);
        setContractTenants(tenantsRows);
        setContractCollaborations(collabRows);
        setRepoDocs(docsRows);
        setTemplates(templateRows);
        setInventorySnapshots(snapRows);

        const itemPairs = await Promise.all(
          snapRows.map(async (s) => [s.id, await fetchSnapshotItems(s.id)] as const),
        );
        const map: Record<string, InventorySnapshotItemRow[]> = {};
        for (const [sid, items] of itemPairs) map[sid] = items;
        setInventoryItemsBySnapshot(map);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load contract details');
      }
    })();
  };

  const reloadInventory = async (contractId: string) => {
    const snapRows = await fetchContractInventorySnapshots(contractId);
    setInventorySnapshots(snapRows);
    const itemPairs = await Promise.all(
      snapRows.map(async (s) => [s.id, await fetchSnapshotItems(s.id)] as const),
    );
    const map: Record<string, InventorySnapshotItemRow[]> = {};
    for (const [sid, items] of itemPairs) map[sid] = items;
    setInventoryItemsBySnapshot(map);
  };

  const closeContractDetails = () => {
    setIsDetailsOpen(false);
    setSelectedContract(null);
    setContractTenants([]);
    setContractCollaborations([]);
    setRepoDocs([]);
    setTemplates([]);
    setInventorySnapshots([]);
    setInventoryItemsBySnapshot({});
  };

  const buildCollaborators = (tenantsRows: ContractTenantRow[], collabRows: ContractCollaborationRow[]): Collaborator[] => {
    const fromTenants = (tenantsRows ?? []).map<Collaborator>((r) => ({
      id: `tenant-${r.tenantId}`,
      name: r.name || '—',
      email: r.email || '',
      role: r.isPrimary ? 'Owner' : 'Viewer',
      dateAdded: r.createdAt || '',
      remarks: r.remarks || '',
    }));
    const fromCollab = (collabRows ?? []).map<Collaborator>((c) => ({
      id: `agency-${c.id}`,
      name: c.partnerAgencyName || 'Agency',
      email: c.email || '',
      role: 'Viewer',
      dateAdded: c.createdAt || '',
      remarks: c.remarks || '',
      commissionTerms: c.commissionTerms || '',
    }));
    return [...fromTenants, ...fromCollab];
  };


  const columns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        header: t('views.contracts.table.contractId'),
        render: (contract) => (
          <span className="font-mono text-xs text-slate-500 uppercase">{contract.contractNo ?? contract.id}</span>
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
                {unit?.unitNumber ?? contract.unitId}
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
          const fallback = agents.find((a) => a.id === contract.agentId)?.name;
          const label = (contract.agentName && contract.agentName.trim()) || fallback || '—';
          return <span className="text-sm font-medium">{label}</span>;
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
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (contract) => (
          <div className="flex w-full justify-center items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(contract, 'contract');
              }}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              {t('views.contracts.table.contract')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-slate-600 bg-slate-100 hover:bg-slate-200 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(contract, 'invoice');
              }}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
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
      const agentFallback = agents.find((a) => a.id === c.agentId)?.name;
      const agentLabel = (c.agentName && c.agentName.trim()) || agentFallback || '';
      const hay = [c.id, unit?.unitNumber, unit?.buildingName, tenant?.name, agentLabel]
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
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              className="h-11 min-w-[120px] rounded-xl"
              onClick={closeContractModal}
            >
              {t('views.contracts.cancel')}
            </Button>
            <Button
              className="h-11 min-w-[120px] rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleGenerate}
            >
              {formMode === 'edit' ? 'Save Changes' : t('views.contracts.generateActivate')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-brand-muted mb-4">{t('views.contracts.newLeaseDescription')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('views.contracts.selectUnit')}</Label>
            <Select2
              options={unitOptions}
              value={unitId}
              onChange={(v) => {
                const picked = v as string | null;
                setUnitId(picked);
                if (formMode === 'create') applyUnitDefaults(picked);
              }}
            />
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
              inputClassName="h-12 rounded-xl text-sm"
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
              inputClassName="h-12 rounded-xl text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.monthlyRent')}</Label>
            <Input
              type="number"
              placeholder="35000"
              className="h-12 rounded-xl border-slate-200"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.securityDeposit')}</Label>
            <Input
              type="number"
              placeholder="70000"
              className="h-12 rounded-xl border-slate-200"
              value={securityDeposit}
              onChange={(e) => setSecurityDeposit(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ContractDetailsCollaborationModal
        isOpen={isDetailsOpen}
        onClose={closeContractDetails}
        summary={{
          title: selectedContract ? `Contract ${selectedContract.contractNo ?? selectedContract.id}` : 'Contract',
          unitLabel: selectedContract
            ? (() => {
                const u = unitList.find((x) => x.id === selectedContract.unitId);
                return u ? `${u.unitNumber} · ${u.buildingName}` : selectedContract.unitId;
              })()
            : '—',
          primaryTenantLabel: selectedContract
            ? tenantList.find((x) => x.id === selectedContract.tenantId)?.name ?? selectedContract.tenantId
            : '—',
          periodLabel: selectedContract
            ? `${format(new Date(selectedContract.startDate), 'MMM d, yyyy')} — ${format(
                new Date(selectedContract.endDate),
                'MMM d, yyyy',
              )}`
            : '—',
          statusLabel: selectedContract ? selectedContract.status : '—',
        }}
        initialCollaborators={buildCollaborators(contractTenants, contractCollaborations)}
        initialActivity={(() => {
          const items: ActivityItem[] = [];
          for (const r of contractTenants ?? []) {
            if (!r.createdAt) continue;
            items.push({
              id: `tenant-${r.tenantId}-${r.isPrimary ? 'p' : 'c'}`,
              at: r.createdAt,
              text: `${r.isPrimary ? 'Primary tenant' : 'Co-tenant'} linked: ${r.name || r.tenantId}`,
            });
          }
          for (const c of contractCollaborations ?? []) {
            if (!c.createdAt) continue;
            items.push({
              id: `collab-${c.id}`,
              at: c.createdAt,
              text: `Collaboration added: ${c.partnerAgencyName || 'Agency'}${
                c.commissionTerms ? ` (${c.commissionTerms})` : ''
              }`,
            });
          }
          return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
        })()}
        onSendInvite={async ({ name, email, commissionTerms, remarks }) => {
          if (!selectedContract) return;
          try {
            const next = await inviteContractCollaborator(selectedContract.id, {
              name,
              email,
              commissionTerms,
              remarks,
            });
            setContractCollaborations(next);
            toast.success('Invite sent.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to send invite');
            throw e;
          }
        }}
        onEditCollaborator={async (collabId, payload) => {
          if (!selectedContract) return;
          try {
            const { collaborations, tenants } = await updateContractCollaborator(selectedContract.id, collabId, payload);
            setContractCollaborations(collaborations);
            setContractTenants(tenants);
            toast.success('Collaborator updated.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update collaborator');
            throw e;
          }
        }}
        documents={repoDocs.map((d) => ({
          id: d.id,
          docType: d.docType,
          title: d.title,
          filePath: d.filePath,
          createdAt: d.createdAt,
          portalVisible: d.portalVisible,
          contractId: d.contractId,
        }))}
        templates={templates.map((t1) => ({
          id: t1.id,
          templateKey: t1.templateKey,
          title: t1.title,
          filePath: t1.filePath,
          versionNo: t1.versionNo,
          createdAt: t1.createdAt,
        }))}
        onUploadRepositoryDocument={async (payload) => {
          if (!selectedContract) return;
          try {
            const next = await uploadContractRepositoryDocument(selectedContract.id, {
              file: payload.file,
              docType: payload.docType,
              title: payload.title,
              portalVisible: payload.portalVisible,
            });
            setRepoDocs(next);
            toast.success('Document uploaded.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to upload document');
            throw e;
          }
        }}
        onUploadTemplate={async (payload) => {
          try {
            const next = await uploadDocumentTemplate({
              file: payload.file,
              templateKey: payload.templateKey,
              title: payload.title,
              isActive: payload.isActive,
            });
            setTemplates(next);
            toast.success('Template uploaded.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to upload template');
            throw e;
          }
        }}
        onGenerateInvoice={async () => {
          if (!selectedContract) return;
          try {
            // Default: current month billing, due at month end; base = monthly rent.
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const toYmd = (d: Date) =>
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            const created = await createContractInvoice(selectedContract.id, {
              billingPeriodStart: toYmd(start),
              billingPeriodEnd: toYmd(end),
              dueDate: toYmd(end),
              baseAmount: Number(selectedContract.monthlyRent ?? 0),
              otherCharges: 0,
              discountAmount: 0,
              status: 'issued',
            });
            toast.success('Invoice generated.');
            const url = `${window.location.origin}${window.location.pathname}?view=preview&type=invoice&id=${encodeURIComponent(created.id)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to generate invoice');
            throw e;
          }
        }}
        inventory={inventorySnapshots.map((s) => ({
          id: s.id,
          snapshotType: s.snapshotType,
          inspectionDate: s.inspectionDate,
          remarks: s.remarks,
          items: (inventoryItemsBySnapshot[s.id] ?? []).map((it) => ({
            id: it.id,
            itemName: it.itemName,
            category: it.category,
            quantity: it.quantity,
            conditionState: it.conditionState,
            notes: it.notes,
          })),
        }))}
        onAddSnapshot={async (payload) => {
          if (!selectedContract) return;
          try {
            await createInventorySnapshot({
              contractId: selectedContract.id,
              snapshotType: payload.snapshotType,
              inspectionDate: payload.inspectionDate,
              remarks: payload.remarks,
            });
            await reloadInventory(selectedContract.id);
            toast.success('Snapshot added.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to add snapshot');
          }
        }}
        onAddItem={async (payload) => {
          if (!selectedContract) return;
          try {
            await createInventorySnapshotItem({
              snapshotId: payload.snapshotId,
              itemName: payload.itemName,
              category: payload.category,
              quantity: payload.quantity,
              conditionState: payload.conditionState,
              notes: payload.notes,
            });
            await reloadInventory(selectedContract.id);
            toast.success('Item added.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to add item');
          }
        }}
        onEditSnapshot={async (snapshotId, payload) => {
          if (!selectedContract) return;
          try {
            await patchInventorySnapshot(snapshotId, {
              snapshotType: payload.snapshotType,
              inspectionDate: payload.inspectionDate,
              remarks: payload.remarks,
            });
            await reloadInventory(selectedContract.id);
            toast.success('Snapshot updated.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update snapshot');
          }
        }}
        onDeleteSnapshot={async (snapshotId) => {
          if (!selectedContract) return;
          try {
            await deleteInventorySnapshot(snapshotId);
            await reloadInventory(selectedContract.id);
            toast.success('Snapshot deleted.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete snapshot');
          }
        }}
        onEditItem={async (itemId, payload) => {
          if (!selectedContract) return;
          try {
            await patchInventorySnapshotItem(itemId, {
              itemName: payload.itemName,
              category: payload.category,
              quantity: payload.quantity,
              conditionState: payload.conditionState,
              notes: payload.notes,
            });
            await reloadInventory(selectedContract.id);
            toast.success('Item updated.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update item');
          }
        }}
        onDeleteItem={async (itemId) => {
          if (!selectedContract) return;
          try {
            await deleteInventorySnapshotItem(itemId);
            await reloadInventory(selectedContract.id);
            toast.success('Item deleted.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete item');
          }
        }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder={t('views.contracts.searchPlaceholder')}
            className="h-10 rounded-xl pl-10 pr-4 border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-100 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm">
            <Filter className="w-4 h-4 mr-2" />
            {t('views.contracts.filter')}
          </Button>
          <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm">
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
        <DataTable
          data={filteredContracts}
          columns={columns}
          keyExtractor={(c) => c.id}
          onRowClick={(c) => openContractDetails(c)}
        />
      )}
    </div>
  );
}
