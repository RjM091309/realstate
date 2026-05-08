import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  FileText,
  History,
  MoreVertical,
  RefreshCw,
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
import { fetchPayments } from '@/lib/paymentsApi';
import { createContractInvoice } from '@/lib/invoicesApi';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';
import type {
  Contract,
  ContractCollaborationRow,
  ContractTenantRow,
  Tenant,
  Unit,
  DocumentTemplateRow,
  RepositoryDocumentRow,
  InventorySnapshotItemRow,
  InventorySnapshotRow,
  Payment,
  TransactionType,
} from '@/types';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import {
  ContractDetailsCollaborationModal,
  type ActivityItem,
  type Collaborator,
} from '@/components/contracts/ContractDetailsCollaborationModal';
import { RenewLeaseModal } from '@/components/contracts/RenewLeaseModal';
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

async function loadItemsMapForSnapshots(
  snapRows: InventorySnapshotRow[],
): Promise<Record<string, InventorySnapshotItemRow[]>> {
  const itemPairs = await Promise.all(
    snapRows.map(async (s) => [s.id, await fetchSnapshotItems(s.id)] as const),
  );
  const map: Record<string, InventorySnapshotItemRow[]> = {};
  for (const [sid, items] of itemPairs) map[sid] = items;
  return map;
}

type StaffUserOption = { value: string; label: string };

function normalizeAgentIdForWrite(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^a(\d+)$/i);
  if (m) return m[1];
  if (/^\d+$/.test(s)) return s;
  return s.replace(/\D/g, '');
}

export function ContractsView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.contracts?.create ?? false;
  const canUpdate = session?.crud?.contracts?.update ?? false;
  const canDelete = session?.crud?.contracts?.delete ?? false;
  const canRenewLease = canCreate || canUpdate;
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractList, setContractList] = useState<Contract[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [contractFiltersOpen, setContractFiltersOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | Contract['status']>('all');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterBuilding, setFilterBuilding] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewContractOpen, setIsNewContractOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string>(() => (session?.user?.id != null ? String(session.user.id) : ''));
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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [renewTarget, setRenewTarget] = useState<Contract | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState(false);

  const [contractTenants, setContractTenants] = useState<ContractTenantRow[]>([]);
  const [contractCollaborations, setContractCollaborations] = useState<ContractCollaborationRow[]>([]);
  const [repoDocs, setRepoDocs] = useState<RepositoryDocumentRow[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateRow[]>([]);
  const [inventorySnapshots, setInventorySnapshots] = useState<InventorySnapshotRow[]>([]);
  const [inventoryItemsBySnapshot, setInventoryItemsBySnapshot] = useState<
    Record<string, InventorySnapshotItemRow[]>
  >({});
  const [staffOptions, setStaffOptions] = useState<StaffUserOption[]>([]);

  const resetNewContractForm = () => {
    setUnitId(null);
    setTenantId(null);
    setAgentId(session?.user?.id != null ? String(session.user.id) : '');
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
    setAgentId(normalizeAgentIdForWrite(contract.agentId));
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

  const reloadContracts = useCallback(
    async (override?: { archived?: boolean }) => {
      try {
        const archived = override?.archived ?? showArchived;
        const list = await fetchContracts({ archived });
        setContractList(list);
      } catch {
        setContractList([]);
        toast.warning(t('views.contracts.loadError'));
      }
    },
    [showArchived, t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setContractsLoading(true);
      try {
        const list = await fetchContracts({ archived: showArchived });
        if (!cancelled) setContractList(list);
      } catch {
        if (!cancelled) {
          setContractList([]);
          toast.warning(t('views.contracts.loadError'));
        }
      } finally {
        if (!cancelled) setContractsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showArchived, t]);

  useEffect(() => {
    void (async () => {
      try {
        setPayments(await fetchPayments());
      } catch {
        setPayments([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchTenants();
        setTenantList(list);
      } catch {
        setTenantList([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchUnits();
        setUnitList(list);
      } catch {
        setUnitList([]);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const currentUserId = session?.user?.id != null ? String(session.user.id) : '';
    const currentUserName =
      session?.user != null
        ? `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.username
        : '';

    // Always ensure a usable default agent id.
    setAgentId((prev) => (String(prev ?? '').trim() ? prev : currentUserId));

    void (async () => {
      // Try to load staff list for agent selection. If forbidden (non-admin),
      // keep a minimal list containing only the current user.
      try {
        const res = await apiFetch<{
          users: { id: number; firstName: string; lastName: string; username: string; active: boolean }[];
        }>('/api/auth/staff/users');
        if (cancelled) return;
        const opts: StaffUserOption[] = (Array.isArray(res.users) ? res.users : [])
          .filter((u) => u && u.active !== false)
          .map((u) => {
            const name = `${String(u.firstName ?? '').trim()} ${String(u.lastName ?? '').trim()}`.trim();
            return {
              value: String(u.id),
              label: name || String(u.username ?? `User ${u.id}`),
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label));
        setStaffOptions(opts);
      } catch {
        if (cancelled) return;
        setStaffOptions(currentUserId ? [{ value: currentUserId, label: currentUserName || `Agent ${currentUserId}` }] : []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.firstName, session?.user?.lastName, session?.user?.username]);

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
  const agentOptions = useMemo(() => {
    const currentUserId = session?.user?.id != null ? String(session.user.id) : '';
    const currentUserName =
      session?.user != null
        ? `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.username
        : '';
    const base = Array.isArray(staffOptions) ? staffOptions : [];
    if (!currentUserId) return base;
    if (base.some((o) => o.value === currentUserId)) return base;
    return [{ value: currentUserId, label: currentUserName || `Agent ${currentUserId}` }, ...base];
  }, [staffOptions, session?.user]);

  const contractBuildingNames = useMemo(() => {
    const names = [...new Set(unitList.map((u) => u.buildingName).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    return names;
  }, [unitList]);

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('views.contracts.filterAll') },
      { value: 'Pending Inspection', label: t('views.contracts.statuses.pendingInspection') },
      { value: 'Active', label: t('views.contracts.statuses.active') },
      { value: 'Expired', label: t('views.contracts.statuses.expired') },
      { value: 'Terminated', label: t('views.contracts.statuses.terminated') },
    ],
    [t],
  );

  const typeFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('views.contracts.filterAll') },
      { value: 'Monthly Rental', label: t('views.contracts.types.monthly') },
      { value: 'Sales', label: t('views.contracts.types.sales') },
      { value: 'Short-term Rental', label: t('views.contracts.types.shortTerm') },
    ],
    [t],
  );

  const buildingFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('views.contracts.filterAllBuildings') },
      ...contractBuildingNames.map((name) => ({ value: name, label: name })),
    ],
    [contractBuildingNames, t],
  );

  const activeContractFilterCount = useMemo(
    () => [filterStatus !== 'all', filterType !== 'all', filterBuilding !== 'all'].filter(Boolean).length,
    [filterStatus, filterType, filterBuilding],
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
    const url = `${window.location.origin}/preview?type=${type}&id=${contract.id}`;
    window.open(url, '_blank');
  };

  const resetDetailsPanelData = useCallback(() => {
    setContractTenants([]);
    setContractCollaborations([]);
    setRepoDocs([]);
    setTemplates([]);
    setInventorySnapshots([]);
    setInventoryItemsBySnapshot({});
  }, []);

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

  const handleActivateContract = async (contract: Contract) => {
    if (!window.confirm('Release / Activate this lease? Make sure inspection (inventory snapshot) is completed.')) return;
    try {
      const body: Parameters<typeof updateContract>[1] = {
        unitId: contract.unitId,
        tenantId: contract.tenantId,
        agentId: normalizeAgentIdForWrite(contract.agentId),
        startDate: String(contract.startDate).slice(0, 10),
        endDate: String(contract.endDate).slice(0, 10),
        monthlyRent: Number(contract.monthlyRent),
        securityDeposit: Number(contract.securityDeposit),
        advanceRent: Number(contract.advanceRent),
        type: contract.type,
        status: 'Active',
        remarks: contract.remarks ?? '',
      };
      const updated = await updateContract(contract.id, body);
      setContractList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (selectedContract?.id === updated.id) setSelectedContract(updated);
      toast.success('Lease activated.');
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : e?.error ? String(e.error) : 'Failed to activate lease');
    }
  };

  const openContractDetails = (contract: Contract) => {
    setSelectedContract(contract);
    setIsDetailsOpen(true);
    resetDetailsPanelData();

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
        setInventoryItemsBySnapshot(await loadItemsMapForSnapshots(snapRows));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load contract details');
      }
    })();
  };

  const reloadInventory = async (contractId: string) => {
    const snapRows = await fetchContractInventorySnapshots(contractId);
    setInventorySnapshots(snapRows);
    setInventoryItemsBySnapshot(await loadItemsMapForSnapshots(snapRows));
  };

  const closeContractDetails = () => {
    setIsDetailsOpen(false);
    setSelectedContract(null);
    resetDetailsPanelData();
  };

  const unpaidBalanceForContract = useCallback(
    (contractId: string) =>
      payments
        .filter((p) => String(p.contractId) === String(contractId) && p.status !== 'Paid')
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
    [payments],
  );

  const openRenewLease = (contract: Contract) => {
    setRenewTarget(contract);
    setIsRenewOpen(true);
    void (async () => {
      try {
        setPayments(await fetchPayments());
      } catch {
        /* keep existing payments */
      }
    })();
  };

  const closeRenewLease = () => {
    setIsRenewOpen(false);
    setRenewTarget(null);
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
          const label = (contract.agentName && contract.agentName.trim()) || '—';
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
                {canUpdate && !showArchived && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(contract);
                    }}
                  >
                    Edit Contract
                  </DropdownMenuItem>
                )}
                {canRenewLease && !showArchived && contract.status === 'Active' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenewLease(contract);
                    }}
                  >
                    Renew lease
                  </DropdownMenuItem>
                )}
                {canUpdate && !showArchived && contract.status === 'Pending Inspection' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleActivateContract(contract);
                    }}
                  >
                    Release / Activate
                  </DropdownMenuItem>
                )}
                {canDelete && !showArchived && (
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
    [t, tenantList, unitList, canUpdate, canDelete, canRenewLease, showArchived, selectedContract]
  );

  const handleGenerate = () => {
    const rent = Number(monthlyRent);
    const deposit = Number(securityDeposit);
    const agentDigits = normalizeAgentIdForWrite(agentId);
    if (!unitId || !tenantId || !agentDigits || !startDate || !endDate) {
      toast.error('Please select unit, tenant, agent, and lease dates.');
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

    const newContractPayload: Parameters<typeof createContract>[0] = {
      unitId,
      tenantId,
      agentId: agentDigits,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      monthlyRent: rent,
      securityDeposit: deposit,
      advanceRent: rent,
      type: 'Monthly Rental',
      status: 'Pending Inspection',
      remarks: '',
    };
    void (async () => {
      try {
        if (formMode === 'edit' && editingContractId) {
          await updateContract(editingContractId, newContractPayload);
          await reloadContracts();
          toast.success('Contract updated.');
        } else {
          await createContract(newContractPayload);
          if (showArchived) setShowArchived(false);
          else await reloadContracts({ archived: false });
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
    return contractList.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (filterBuilding !== 'all') {
        const unit = unitList.find((u) => u.id === c.unitId);
        if (!unit || unit.buildingName !== filterBuilding) return false;
      }
      if (!q) return true;
      const unit = unitList.find((u) => u.id === c.unitId);
      const tenant = tenantList.find((ten) => ten.id === c.tenantId);
      const agentLabel = (c.agentName && c.agentName.trim()) || '';
      const hay = [c.id, c.contractNo, unit?.unitNumber, unit?.buildingName, tenant?.name, agentLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [searchTerm, contractList, tenantList, unitList, filterStatus, filterType, filterBuilding]);

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
        <p className="text-sm text-brand-muted mb-2">{t('views.contracts.newLeaseDescription')}</p>
        <p className="text-xs text-slate-600 mb-4">{t('views.contracts.inspectionGateHint')}</p>
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
            <Label>{t('views.dashboard.agents.agentName')}</Label>
            <Select2
              options={agentOptions}
              value={agentId}
              onChange={(v) => setAgentId(String(v as string | null ?? ''))}
            />
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

      <RenewLeaseModal
        isOpen={isRenewOpen}
        onClose={closeRenewLease}
        unitNumber={
          renewTarget ? unitList.find((u) => u.id === renewTarget.unitId)?.unitNumber ?? renewTarget.unitId : ''
        }
        tenantName={
          renewTarget ? tenantList.find((ten) => ten.id === renewTarget.tenantId)?.name ?? '—' : ''
        }
        contract={renewTarget}
        unpaidBalance={renewTarget ? unpaidBalanceForContract(renewTarget.id) : 0}
        onRenewed={async () => {
          toast.success('Lease renewed.');
          await reloadContracts();
          try {
            setPayments(await fetchPayments());
          } catch {
            /* ignore */
          }
        }}
      />

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

            const created = await createContractInvoice(selectedContract.id, {
              billingPeriodStart: format(start, 'yyyy-MM-dd'),
              billingPeriodEnd: format(end, 'yyyy-MM-dd'),
              dueDate: format(end, 'yyyy-MM-dd'),
              baseAmount: Number(selectedContract.monthlyRent ?? 0),
              otherCharges: 0,
              discountAmount: 0,
              status: 'issued',
            });
            toast.success('Invoice generated.');
            const url = `${window.location.origin}/preview?type=invoice&id=${encodeURIComponent(created.id)}`;
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

      <div className="space-y-3">
        {showArchived ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {t('views.contracts.archiveBanner')}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder={t('views.contracts.searchPlaceholder')}
              className="h-10 rounded-xl pl-10 pr-4 border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-100 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant={contractFiltersOpen || activeContractFilterCount > 0 ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-10 rounded-xl border-slate-200 shadow-sm',
                contractFiltersOpen || activeContractFilterCount > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
              onClick={() => setContractFiltersOpen((o) => !o)}
            >
              <Filter className="w-4 h-4 mr-2" />
              {t('views.contracts.filter')}
              {activeContractFilterCount > 0 ? (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-[11px] font-bold tabular-nums">
                  {activeContractFilterCount}
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-10 rounded-xl border-slate-200 shadow-sm',
                showArchived
                  ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-900'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
              onClick={() => setShowArchived((v) => !v)}
            >
              <History className="w-4 h-4 mr-2" />
              {showArchived ? t('views.contracts.backToActive') : t('views.contracts.archive')}
            </Button>
          </div>
        </div>
        {contractFiltersOpen ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500">{t('views.contracts.filterStatus')}</Label>
              <Select2
                options={statusFilterOptions}
                value={filterStatus}
                onChange={(v) => setFilterStatus((v as Contract['status'] | 'all') ?? 'all')}
              />
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500">{t('views.contracts.filterType')}</Label>
              <Select2
                options={typeFilterOptions}
                value={filterType}
                onChange={(v) => setFilterType((v as TransactionType | 'all') ?? 'all')}
              />
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500">{t('views.contracts.filterBuilding')}</Label>
              <Select2
                options={buildingFilterOptions}
                value={filterBuilding}
                onChange={(v) => setFilterBuilding((v as string) ?? 'all')}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-lg"
              onClick={() => {
                setFilterStatus('all');
                setFilterType('all');
                setFilterBuilding('all');
              }}
            >
              {t('views.contracts.resetFilters')}
            </Button>
          </div>
        ) : null}
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
