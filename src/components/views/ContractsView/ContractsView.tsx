import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Eye,
  ClipboardList,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { Button, modalDismissButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import { contractStatusVariant } from '@/lib/statusBadge';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef, meritCellAccentClass, meritCellPrimaryClass, meritCellMetaClass } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { SkeletonTable } from '@/components/skeleton';
import { fetchTenants } from '@/lib/tenantsApi';
import { fetchUnits } from '@/lib/unitsApi';
import {
  activateContract,
  createContract,
  deleteContract,
  fetchContracts,
  updateContract,
} from '@/lib/contractsApi';
import { fetchPayments } from '@/lib/paymentsApi';
import { endOfDay, format, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import type { Contract, Tenant, Unit, Payment, UnitInspectionPayload } from '@/types';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import { UnitInspectionWorkflowModal } from '@/components/contracts/UnitInspectionWorkflowModal';
import {
  ContractSummaryModal,
  leaseTermLabel,
} from '@/components/contracts/ContractSummaryModal';
import { fetchContractInspection } from '@/lib/unitInspectionApi';
import { RenewLeaseModal } from '@/components/contracts/RenewLeaseModal';
import { formatPhp } from '@/lib/leaseRenewalUtils';

type StaffUserOption = { value: string; label: string };

const ACTION_ICON_BTN =
  'h-8 w-8 rounded-lg border-transparent bg-white text-slate-700 shadow-sm hover:border-transparent hover:bg-slate-50 dark:border-transparent dark:bg-slate-900 dark:text-slate-300 dark:hover:border-transparent dark:hover:bg-slate-800 [&_svg]:translate-y-0.5';

function isInspectionApprovedForActivation(payload: UnitInspectionPayload | null) {
  const status = payload?.inspection?.status;
  return (
    status === 'ready_for_occupancy' ||
    status === 'move_in_scheduled' ||
    status === 'occupied'
  );
}

function normalizeAgentIdForWrite(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^a(\d+)$/i);
  if (m) return m[1];
  if (/^\d+$/.test(s)) return s;
  return s.replace(/\D/g, '');
}

function contractStatusLabel(status: Contract['status'], t: (key: string) => string): string {
  if (status === 'Active') return t('views.contracts.statuses.active');
  if (status === 'Expired') return t('views.contracts.statuses.expired');
  if (status === 'Terminated') return t('views.contracts.statuses.terminated');
  if (status === 'Pending Inspection') return t('views.contracts.statuses.pendingInspection');
  return status;
}

export function ContractsView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef(false);
  const canCreate = session?.crud?.contracts?.create ?? false;
  const canUpdate = session?.crud?.contracts?.update ?? false;
  const canDelete = session?.crud?.contracts?.delete ?? false;
  const canRenewLease = canCreate || canUpdate;
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractList, setContractList] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Contract['status'] | null>(null);
  const [newThisWeekOnly, setNewThisWeekOnly] = useState(false);
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
  const [summaryContract, setSummaryContract] = useState<Contract | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [renewTarget, setRenewTarget] = useState<Contract | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState(false);

  const [inspectionPayload, setInspectionPayload] = useState<UnitInspectionPayload | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
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
    setUnitId(String(contract.unitId));
    setTenantId(String(contract.tenantId));
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

  const reloadContracts = useCallback(async () => {
    try {
      const list = await fetchContracts({ archived: false });
      setContractList(list);
    } catch {
      setContractList([]);
      toast.warning(t('views.contracts.loadError'));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setContractsLoading(true);
      try {
        const list = await fetchContracts({ archived: false });
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
  }, [t]);

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const statusParam = searchParams.get('status');
    const newWeekParam = searchParams.get('newThisWeek');
    if (!statusParam && !newWeekParam) return;

    const allowed: Contract['status'][] = ['Pending Inspection', 'Active', 'Expired', 'Terminated'];
    deepLinkHandledRef.current = true;
    if (statusParam && allowed.includes(statusParam as Contract['status'])) {
      setStatusFilter(statusParam as Contract['status']);
    }
    if (newWeekParam === '1' || newWeekParam === 'true') {
      setNewThisWeekOnly(true);
      if (!statusParam) setStatusFilter('Active');
    }
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    next.delete('newThisWeek');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const unitOptions = useMemo(() => {
    const toOption = (u: Unit) => ({
      value: u.id,
      label: `${u.unitNumber} - ${u.buildingName}`,
    });

    const availableOptions = unitList.filter((u) => u.status === 'Available').map(toOption);

    // Occupied units are excluded from "Available" — still show the lease's unit when editing.
    if (formMode === 'edit' && unitId) {
      const currentUnit = unitList.find((u) => u.id === unitId);
      if (currentUnit && !availableOptions.some((o) => o.value === unitId)) {
        return [toOption(currentUnit), ...availableOptions];
      }
    }

    return availableOptions;
  }, [unitList, formMode, unitId]);
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

  const loadInspection = useCallback(async (contractId: string) => {
    setInspectionLoading(true);
    try {
      const data = await fetchContractInspection(contractId);
      setInspectionPayload(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load inspection');
      setInspectionPayload(null);
    } finally {
      setInspectionLoading(false);
    }
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

  const openContractSummary = (contract: Contract) => {
    setSummaryContract(contract);
    setIsSummaryOpen(true);
  };

  const closeContractSummary = () => {
    setIsSummaryOpen(false);
    setSummaryContract(null);
  };

  const openInspection = (contract: Contract, prefetch?: UnitInspectionPayload | null) => {
    setSelectedContract(contract);
    setIsInspectionOpen(true);
    if (prefetch) {
      setInspectionPayload(prefetch);
      setInspectionLoading(false);
    } else {
      setInspectionPayload(null);
      void loadInspection(contract.id);
    }
  };

  const handleInspectOrActivate = async (contract: Contract) => {
    try {
      const inspectionData = await fetchContractInspection(contract.id);
      if (isInspectionApprovedForActivation(inspectionData)) {
        const result = await Swal.fire({
          icon: 'question',
          title: t('views.contracts.activateConfirmTitle'),
          text: t('views.contracts.activateConfirm'),
          showCancelButton: true,
          confirmButtonText: t('views.contracts.table.activate'),
          cancelButtonText: t('views.contracts.cancel'),
          confirmButtonColor: '#4B89CD',
          reverseButtons: true,
        });
        if (!result.isConfirmed) return;
        const updated = await activateContract(contract.id);
        setContractList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast.success(t('views.contracts.leaseActivated'));
        return;
      }
      openInspection(contract, inspectionData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.contracts.activateError'));
      openInspection(contract);
    }
  };

  const closeInspection = () => {
    setIsInspectionOpen(false);
    setSelectedContract(null);
    setInspectionPayload(null);
  };

  const resolveAgentName = useCallback(
    (contract: Contract) =>
      (contract.agentName && contract.agentName.trim()) ||
      staffOptions.find((s) => s.value === contract.agentId)?.label ||
      contract.agentId ||
      '—',
    [staffOptions],
  );

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

  const columns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        id: 'contractId',
        header: t('views.contracts.table.contractId'),
        sortable: true,
        sortValue: (contract) => contract.contractNo ?? contract.id,
        render: (contract) => (
          <button
            type="button"
            className={cn(meritCellAccentClass, 'cursor-pointer text-left hover:underline')}
            onClick={(e) => {
              e.stopPropagation();
              openContractSummary(contract);
            }}
          >
            {contract.contractNo ?? contract.id}
          </button>
        ),
      },
      {
        id: 'tenant',
        header: t('views.contracts.table.tenant'),
        sortable: true,
        sortValue: (contract) => tenantList.find((ten) => ten.id === contract.tenantId)?.name ?? '',
        render: (contract) => {
          const tenant = tenantList.find((ten) => ten.id === contract.tenantId);
          return (
            <span className={cn(meritCellPrimaryClass, 'block min-w-[7rem]')}>
              {tenant?.name ?? '—'}
            </span>
          );
        },
      },
      {
        id: 'unit',
        header: t('views.contracts.table.unit'),
        sortable: true,
        sortValue: (contract) => unitList.find((u) => u.id === contract.unitId)?.unitNumber ?? contract.unitId,
        render: (contract) => {
          const unit = unitList.find((u) => u.id === contract.unitId);
          const building = unit?.buildingName?.trim() || unit?.area?.trim() || '';
          return (
            <div className="min-w-[5rem]">
              <span className={cn(meritCellPrimaryClass, 'block')}>
                {unit?.unitNumber ?? contract.unitId}
              </span>
              {building ? (
                <span className={cn(meritCellMetaClass, 'mt-0.5 block truncate text-slate-400')}>
                  {building}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'period',
        header: t('views.contracts.table.period'),
        sortable: true,
        sortValue: (contract) => contract.startDate,
        render: (contract) => (
          <div className="min-w-[9rem]">
            <span className="block whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {format(new Date(contract.startDate), 'MMM dd, yyyy')}
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">—</span>
              {format(new Date(contract.endDate), 'MMM dd, yyyy')}
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
              {leaseTermLabel(contract.startDate, contract.endDate, t)}
            </span>
          </div>
        ),
      },
      {
        id: 'rent',
        header: t('views.contracts.table.rent'),
        sortable: true,
        sortValue: (contract) => Number(contract.monthlyRent) || 0,
        render: (contract) => (
          <span className="whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100">
            {formatPhp(contract.monthlyRent)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('views.contracts.table.status'),
        sortable: true,
        sortValue: (contract) => contract.status,
        render: (contract) => (
          <StatusBadge tone={contract.status === 'Active' ? 'success' : contractStatusVariant(contract.status)}>
            {contractStatusLabel(contract.status, t)}
          </StatusBadge>
        ),
      },
      {
        id: 'actions',
        header: t('views.contracts.table.actions'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (contract) => (
          <div
            className="flex items-center justify-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={t('views.contracts.table.view')}
              className={ACTION_ICON_BTN}
              onClick={() => openContractSummary(contract)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={t('views.contracts.table.inspect')}
              className={ACTION_ICON_BTN}
              onClick={() => openInspection(contract)}
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </Button>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('views.contracts.table.edit')}
                className={ACTION_ICON_BTN}
                onClick={() => openEditModal(contract)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canRenewLease && contract.status === 'Active' ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('views.contracts.table.renew')}
                className={ACTION_ICON_BTN}
                onClick={() => openRenewLease(contract)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canUpdate && contract.status === 'Pending Inspection' ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('views.contracts.table.inspectOrActivate')}
                className={ACTION_ICON_BTN}
                onClick={() => void handleInspectOrActivate(contract)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('views.contracts.table.delete')}
                className={ACTION_ICON_BTN}
                onClick={() => void handleDeleteContract(contract)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, tenantList, unitList, canUpdate, canDelete, canRenewLease],
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
          await reloadContracts();
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
    const startWeek = startOfDay(subDays(new Date(), 7));
    const endToday = endOfDay(new Date());
    return contractList.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (newThisWeekOnly) {
        try {
          const sd = parseISO(c.startDate);
          if (isBefore(sd, startWeek) || isAfter(sd, endToday)) return false;
        } catch {
          return false;
        }
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
  }, [searchTerm, contractList, tenantList, unitList, statusFilter, newThisWeekOnly]);

  const highlightedContractIds = useMemo(() => {
    if (!newThisWeekOnly) return null;
    const startWeek = startOfDay(subDays(new Date(), 7));
    const endToday = endOfDay(new Date());
    return new Set(
      filteredContracts
        .filter((c) => {
          try {
            const sd = parseISO(c.startDate);
            return !isBefore(sd, startWeek) && !isAfter(sd, endToday);
          } catch {
            return false;
          }
        })
        .map((c) => c.id),
    );
  }, [filteredContracts, newThisWeekOnly]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 shrink-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{t('views.contracts.title')}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{t('views.contracts.subtitle')}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder={t('views.contracts.searchPlaceholder')}
              className="h-10 rounded-xl border-transparent bg-white pl-9 pr-3 text-sm shadow-sm dark:border-transparent dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canCreate ? (
            <Button
              type="button"
              className="h-10 shrink-0 rounded-xl bg-brand-blue text-white shadow-sm hover:bg-[#3d7ab8]"
              onClick={openCreateModal}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('views.contracts.newLeaseWorkflow')}
            </Button>
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={isNewContractOpen}
        onClose={closeContractModal}
        title={formMode === 'edit' ? 'Edit Lease Agreement' : t('views.contracts.newLeaseAgreement')}
        maxWidth="2xl"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button className={modalDismissButtonClass} onClick={closeContractModal}>
              {t('views.contracts.cancel')}
            </Button>
            <Button className={modalPrimaryButtonClass} onClick={handleGenerate}>
              {formMode === 'edit' ? 'Save Changes' : t('views.contracts.generateActivate')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-brand-muted mb-2">{t('views.contracts.newLeaseDescription')}</p>
        <p className="text-xs text-slate-600 mb-4">{t('views.contracts.inspectionGateHint')}</p>
        <div className="unit-form-fields grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('views.contracts.selectUnit')}</Label>
            <Select2
              options={unitOptions}
              value={unitId}
              borderless={false}
              className="[&_.unit-form-select-control]:!min-h-12"
              onChange={(v) => {
                const picked = v as string | null;
                setUnitId(picked);
                if (formMode === 'create') applyUnitDefaults(picked);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.selectTenant')}</Label>
            <Select2
              options={tenantOptions}
              value={tenantId}
              borderless={false}
              className="[&_.unit-form-select-control]:!min-h-12"
              onChange={(v) => setTenantId(v as string | null)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.dashboard.agents.agentName')}</Label>
            <Select2
              options={agentOptions}
              value={agentId}
              borderless={false}
              className="[&_.unit-form-select-control]:!min-h-12"
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
              inputClassName="unit-form-datepicker-input h-12 !rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
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
              inputClassName="unit-form-datepicker-input h-12 !rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.monthlyRent')}</Label>
            <Input
              type="number"
              placeholder="35000"
              className="h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.contracts.securityDeposit')}</Label>
            <Input
              type="number"
              placeholder="70000"
              className="h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
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
          toast.success(t('views.contracts.renewLease.renewed'));
          await reloadContracts();
          try {
            setPayments(await fetchPayments());
          } catch {
            /* ignore */
          }
        }}
      />

      <ContractSummaryModal
        isOpen={isSummaryOpen}
        onClose={closeContractSummary}
        contract={summaryContract}
        unit={summaryContract ? unitList.find((u) => u.id === summaryContract.unitId) ?? null : null}
        tenantName={
          summaryContract
            ? tenantList.find((ten) => ten.id === summaryContract.tenantId)?.name ?? summaryContract.tenantId
            : '—'
        }
        agentName={summaryContract ? resolveAgentName(summaryContract) : '—'}
        canEdit={canUpdate}
        onEdit={openEditModal}
        onOpenInspection={openInspection}
        onPreviewDocument={handlePreview}
      />

      <UnitInspectionWorkflowModal
        isOpen={isInspectionOpen}
        onClose={closeInspection}
        contract={selectedContract}
        unit={selectedContract ? unitList.find((u) => u.id === selectedContract.unitId) ?? null : null}
        tenantName={
          selectedContract
            ? tenantList.find((ten) => ten.id === selectedContract.tenantId)?.name ?? selectedContract.tenantId
            : '—'
        }
        agentName={selectedContract ? resolveAgentName(selectedContract) : '—'}
        payload={inspectionPayload}
        loading={inspectionLoading}
        canWrite={canUpdate}
        onRefresh={async () => {
          if (selectedContract) await loadInspection(selectedContract.id);
        }}
        onPayloadChange={setInspectionPayload}
      />

      {statusFilter || newThisWeekOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-green/30 bg-emerald-50 px-4 py-2.5 text-sm text-slate-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-slate-200">
          <p>
            {newThisWeekOnly
              ? t('views.contracts.newThisWeekBanner', { count: filteredContracts.length })
              : t('views.contracts.statusFilterBanner', {
                  status: contractStatusLabel(statusFilter!, t),
                  count: filteredContracts.length,
                })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-brand-green"
            onClick={() => {
              setStatusFilter(null);
              setNewThisWeekOnly(false);
            }}
          >
            {t('views.contracts.clearStatusFilter')}
          </Button>
        </div>
      ) : null}

      {contractsLoading ? (
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 md:p-8">
          <SkeletonTable rows={8} columns={7} />
        </div>
      ) : (
        <DataTable
          data={filteredContracts}
          columns={columns}
          keyExtractor={(c) => c.id}
          onRowClick={(c) => openContractSummary(c)}
          rowClassName={(c) =>
            highlightedContractIds?.has(c.id)
              ? '[&>td]:!bg-emerald-50 [&>td]:dark:!bg-emerald-950/50 ring-2 ring-inset ring-emerald-400/70'
              : statusFilter === 'Active' && c.status === 'Active'
                ? '[&>td]:!bg-emerald-50/60 [&>td]:dark:!bg-emerald-950/30'
                : undefined
          }
        />
      )}
    </div>
  );
}
