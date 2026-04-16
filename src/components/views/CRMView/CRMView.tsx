import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  ShieldCheck,
  History,
  MoreVertical,
  ExternalLink,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SkeletonTable } from '@/components/skeleton';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { tenants as seedTenants, brokerAgencies, contracts as seedContracts, units } from '@/lib/mockData';
import {
  createTenant,
  deleteTenant,
  fetchTenants,
  updateTenant,
  type TenantWriteBody,
} from '@/lib/tenantsApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchUnits } from '@/lib/unitsApi';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Contract, Tenant, Unit } from '@/types';
import { format, parseISO } from 'date-fns';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';

type BlacklistRow = {
  id: string;
  name: string;
  type: 'Tenant' | 'Landlord';
  reason: string;
  date: string;
};

const blacklistRows: BlacklistRow[] = [
  {
    id: 'bl1',
    name: 'Robert Wilson',
    type: 'Tenant',
    reason: 'Unpaid rent for 3 months & property damage',
    date: '2025-11-12',
  },
  {
    id: 'bl2',
    name: 'Sarah Jenkins',
    type: 'Landlord',
    reason: 'Multiple security deposit refund violations',
    date: '2026-01-05',
  },
  {
    id: 'bl3',
    name: 'Kevin Lee',
    type: 'Tenant',
    reason: 'Illegal subletting and noise complaints',
    date: '2025-08-20',
  },
];

const ID_TYPES = ['Passport', 'UMID', "Driver's License", 'Other'] as const;

type TenantForm = {
  name: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  idExpiry: string;
  kycVerified: boolean;
  isBlacklisted: boolean;
  blacklistReason: string;
};

function emptyForm(): TenantForm {
  return {
    name: '',
    email: '',
    phone: '',
    idType: 'Passport',
    idNumber: '',
    idExpiry: '',
    kycVerified: true,
    isBlacklisted: false,
    blacklistReason: '',
  };
}

function tenantToForm(t: Tenant): TenantForm {
  return {
    name: t.name,
    email: t.email,
    phone: t.phone,
    idType: t.idType,
    idNumber: t.idNumber,
    idExpiry: t.idExpiry || '',
    kycVerified: t.kycVerified !== false,
    isBlacklisted: t.isBlacklisted,
    blacklistReason: t.blacklistReason ?? '',
  };
}

function formToBody(f: TenantForm): TenantWriteBody {
  return {
    name: f.name.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
    idType: f.idType,
    idNumber: f.idNumber.trim(),
    idExpiry: f.idExpiry.trim(),
    kycVerified: f.kycVerified,
    isBlacklisted: f.isBlacklisted,
    blacklistReason: f.blacklistReason.trim() || undefined,
  };
}

export function CRMView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.crm?.create ?? false;
  const canUpdate = session?.crud?.crm?.update ?? false;
  const canDelete = session?.crud?.crm?.delete ?? false;

  const [crmLoading, setCrmLoading] = useState(true);
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [contractList, setContractList] = useState<Contract[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);

  const reloadTenants = useCallback(async () => {
    try {
      const list = await fetchTenants();
      setTenantList(list);
    } catch {
      setTenantList([...seedTenants]);
      toast.warning(t('views.crm.tenantModal.loadError'));
    } finally {
      setCrmLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reloadTenants();
  }, [reloadTenants]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchContracts();
        setContractList(list);
      } catch {
        setContractList(seedContracts);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchUnits();
        setUnitList(list);
      } catch {
        setUnitList(units);
      }
    })();
  }, []);

  const filteredTenants = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return tenantList;
    return tenantList.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(q) ||
        tenant.email.toLowerCase().includes(q) ||
        tenant.phone.includes(q)
    );
  }, [searchTerm, tenantList]);

  const filteredBlacklist = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return blacklistRows;
    return blacklistRows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const idTypeOptions = useMemo(
    () => ID_TYPES.map((x) => ({ value: x, label: x })),
    [],
  );

  const openViewDetails = useCallback((tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsDetailsOpen(true);
  }, []);

  const openRegister = () => {
    setIsDetailsOpen(false);
    setFormMode('create');
    setEditingId(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = useCallback((tenant: Tenant) => {
    setIsDetailsOpen(false);
    setFormMode('edit');
    setEditingId(tenant.id);
    setForm(tenantToForm(tenant));
    setIsFormOpen(true);
  }, []);

  const closeForm = () => {
    setIsFormOpen(false);
    setFormMode('create');
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSaveTenant = async () => {
    const body = formToBody(form);
    if (!body.name || !body.email || !body.phone || !body.idType || !body.idNumber) {
      toast.error(t('views.crm.tenantModal.validationRequired'));
      return;
    }
    try {
      if (formMode === 'edit' && editingId) {
        const updated = await updateTenant(editingId, body);
        setTenantList((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
        setSelectedTenant((s) => (s?.id === editingId ? updated : s));
        toast.success(t('views.crm.tenantModal.updated'));
      } else {
        const created = await createTenant(body);
        setTenantList((prev) => [created, ...prev]);
        toast.success(t('views.crm.tenantModal.created'));
      }
      closeForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleDeleteTenant = useCallback(
    async (tenant: Tenant) => {
      if (!window.confirm(t('views.crm.tenantModal.deleteConfirm', { name: tenant.name }))) return;
      try {
        await deleteTenant(tenant.id);
        setTenantList((prev) => prev.filter((x) => x.id !== tenant.id));
        setSelectedTenant((s) => {
          if (s?.id === tenant.id) {
            setIsDetailsOpen(false);
            return null;
          }
          return s;
        });
        toast.success(t('views.crm.tenantModal.deleted'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    },
    [t],
  );

  const tenantColumns: ColumnDef<Tenant>[] = useMemo(
    () => [
      {
        header: t('views.crm.table.tenant'),
        render: (tenant) => (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{tenant.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">{tenant.name}</span>
              <span className="text-xs text-slate-500">{t('views.crm.table.idLabel', { id: tenant.idNumber })}</span>
            </div>
          </div>
        ),
      },
      {
        header: t('views.crm.table.contactInfo'),
        render: (tenant) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Mail className="w-3 h-3" />
              {tenant.email}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone className="w-3 h-3" />
              {tenant.phone}
            </div>
          </div>
        ),
      },
      {
        header: t('views.crm.table.kycStatus'),
        render: (tenant) =>
          tenant.kycVerified !== false ? (
            <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {t('views.crm.table.verified')}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800 hover:bg-amber-100">
              <ShieldQuestion className="w-3 h-3 mr-1" />
              {t('views.crm.table.kycPending')}
            </Badge>
          ),
      },
      {
        header: t('views.crm.table.currentUnit'),
        render: (tenant) => {
          const activeContract = contractList.find((c) => c.tenantId === tenant.id && c.status === 'Active');
          const unit = activeContract ? unitList.find((u) => u.id === activeContract.unitId) : null;
          return unit ? (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-700">{t('views.crm.table.unitLabel', { unitNumber: unit.unitNumber })}</span>
              <span className="text-xs text-slate-500">{unit.buildingName}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">{t('views.crm.table.noActiveLease')}</span>
          );
        },
      },
      {
        header: t('views.crm.table.status'),
        render: (tenant) =>
          tenant.isBlacklisted ? (
            <Badge variant="outline" className="border-0 bg-rose-100 text-rose-700 hover:bg-rose-100">
              {t('views.crm.table.blacklisted')}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-0 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
              {t('views.crm.table.active')}
            </Badge>
          ),
      },
      {
        header: t('views.crm.table.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (tenant) => (
          <div
            className="inline-flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} />
                }
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openViewDetails(tenant);
                  }}
                >
                  {t('views.crm.table.viewDetails')}
                </DropdownMenuItem>
                {canUpdate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(tenant);
                    }}
                  >
                    {t('views.crm.table.editTenant')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}${window.location.pathname}?view=portal`;
                    window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('views.crm.table.viewPortal')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <History className="w-4 h-4 mr-2" />
                  {t('views.crm.table.history')}
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    className="text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteTenant(tenant);
                    }}
                  >
                    {t('views.crm.table.deleteTenant')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, canUpdate, canDelete, openViewDetails, openEdit, handleDeleteTenant, contractList, unitList],
  );

  const blacklistColumns: ColumnDef<BlacklistRow>[] = useMemo(
    () => [
      {
        header: t('views.crm.blacklist.name'),
        render: (item) => <span className="font-medium text-slate-900">{item.name}</span>,
      },
      {
        header: t('views.crm.blacklist.type'),
        render: (item) => (
          <Badge variant="outline" className="border-0 bg-slate-100 text-slate-700 font-medium">
            {item.type === 'Tenant' ? t('views.crm.blacklist.tenant') : t('views.crm.blacklist.landlord')}
          </Badge>
        ),
      },
      {
        header: t('views.crm.blacklist.reason'),
        render: (item) => <span className="text-sm text-slate-600">{item.reason}</span>,
      },
      {
        header: t('views.crm.blacklist.dateAdded'),
        render: (item) => (
          <span className="text-xs text-slate-400">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
        ),
      },
      {
        header: t('views.crm.blacklist.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: () => (
          <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50">
            {t('views.crm.blacklist.details')}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.crm.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.crm.subtitle')}</p>
        </div>
        {canCreate && (
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openRegister}>
            <Plus className="w-4 h-4 mr-2" />
            {t('views.crm.registerTenant')}
          </Button>
        )}
      </div>

      <Modal
        isOpen={isDetailsOpen && !isFormOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedTenant ? selectedTenant.name : ''}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {t('views.crm.details.close')}
            </Button>
            {canUpdate && selectedTenant && (
              <Button className="bg-indigo-600" onClick={() => openEdit(selectedTenant)}>
                {t('views.crm.details.editTenant')}
              </Button>
            )}
          </div>
        }
      >
        {selectedTenant && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              {selectedTenant.kycVerified !== false ? (
                <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700">
                  {t('views.crm.table.verified')}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800">
                  {t('views.crm.table.kycPending')}
                </Badge>
              )}
              {selectedTenant.isBlacklisted ? (
                <Badge variant="outline" className="border-0 bg-rose-100 text-rose-700">
                  {t('views.crm.table.blacklisted')}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-0 bg-indigo-100 text-indigo-700">
                  {t('views.crm.table.active')}
                </Badge>
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">{t('views.crm.details.contact')}</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {selectedTenant.email}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {selectedTenant.phone}
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">{t('views.crm.details.identification')}</h4>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
                <p>
                  <span className="text-slate-500">{t('views.crm.tenantModal.idType')}: </span>
                  {selectedTenant.idType}
                </p>
                <p>
                  <span className="text-slate-500">{t('views.crm.tenantModal.idNumber')}: </span>
                  {selectedTenant.idNumber}
                </p>
                <p>
                  <span className="text-slate-500">{t('views.crm.tenantModal.idExpiry')}: </span>
                  {selectedTenant.idExpiry || '—'}
                </p>
              </div>
            </div>
            {selectedTenant.blacklistReason ? (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">{t('views.crm.details.notes')}</h4>
                <p className="text-sm text-slate-600">{selectedTenant.blacklistReason}</p>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={formMode === 'edit' ? t('views.crm.tenantModal.editTitle') : t('views.crm.tenantModal.createTitle')}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeForm}>
              {t('views.crm.tenantModal.cancel')}
            </Button>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void handleSaveTenant()}>
              {t('views.crm.tenantModal.save')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500 mb-6">{t('views.crm.tenantModal.description')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-name">{t('views.crm.tenantModal.name')}</Label>
            <Input
              id="crm-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-email">{t('views.crm.tenantModal.email')}</Label>
            <Input
              id="crm-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-phone">{t('views.crm.tenantModal.phone')}</Label>
            <Input
              id="crm-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.crm.tenantModal.idType')}</Label>
            <Select2
              options={idTypeOptions}
              value={form.idType}
              onChange={(v) => setForm((f) => ({ ...f, idType: (v ?? 'Passport') as string }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-id-number">{t('views.crm.tenantModal.idNumber')}</Label>
            <Input
              id="crm-id-number"
              value={form.idNumber}
              onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-id-expiry">{t('views.crm.tenantModal.idExpiry')}</Label>
            <AppDatePicker
              mode="single"
              placeholder="MM/DD/YYYY"
              fullWidth
              value={form.idExpiry ? parseISO(form.idExpiry) : null}
              onChange={(picked) =>
                setForm((f) => ({
                  ...f,
                  idExpiry: picked instanceof Date ? format(picked, 'yyyy-MM-dd') : '',
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <input
              id="crm-kyc"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.kycVerified}
              onChange={(e) => setForm((f) => ({ ...f, kycVerified: e.target.checked }))}
            />
            <Label htmlFor="crm-kyc" className="font-normal cursor-pointer">
              {t('views.crm.tenantModal.kycVerified')}
            </Label>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <input
              id="crm-bl"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isBlacklisted}
              onChange={(e) => setForm((f) => ({ ...f, isBlacklisted: e.target.checked }))}
            />
            <Label htmlFor="crm-bl" className="font-normal cursor-pointer">
              {t('views.crm.tenantModal.blacklisted')}
            </Label>
          </div>
          {form.isBlacklisted ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="crm-bl-reason">{t('views.crm.tenantModal.blacklistReason')}</Label>
              <Input
                id="crm-bl-reason"
                value={form.blacklistReason}
                onChange={(e) => setForm((f) => ({ ...f, blacklistReason: e.target.value }))}
                className="rounded-xl border-slate-200"
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('views.crm.searchPlaceholder')}
            className="h-9 rounded-full pl-10 pr-3 border border-[var(--border)] hover:border-slate-300 focus:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300 transition-all"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--control-bg) 70%, transparent)',
              borderColor: 'color-mix(in oklab, var(--border) 88%, #cbd5e1)',
            }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
          <TabsTrigger value="tenants">{t('views.crm.tabs.tenants')}</TabsTrigger>
          <TabsTrigger value="brokers">{t('views.crm.tabs.brokers')}</TabsTrigger>
          <TabsTrigger value="blacklist">{t('views.crm.tabs.blacklist')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-6">
          {crmLoading ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
              <SkeletonTable rows={6} columns={6} />
            </div>
          ) : (
            <DataTable
              data={filteredTenants}
              columns={tenantColumns}
              keyExtractor={(tenant) => tenant.id}
              onRowClick={(tenant) => openViewDetails(tenant)}
            />
          )}
        </TabsContent>

        <TabsContent value="brokers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brokerAgencies.map((agency) => (
              <Card key={agency.id} className="border-none shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                      <Users className="w-6 h-6" />
                    </div>
                    <Badge variant="outline">{t('views.crm.brokers.partner')}</Badge>
                  </div>
                  <CardTitle className="mt-4">{agency.name}</CardTitle>
                  <CardDescription>{t('views.crm.brokers.officialPartner')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{t('views.crm.brokers.contactPerson')}</span>
                      <span className="font-medium">{agency.contactPerson}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{t('views.crm.brokers.phone')}</span>
                      <span className="font-medium">{agency.phone}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">
                    {t('views.crm.brokers.viewLogs')}
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed border-2 flex flex-col items-center justify-center p-6 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all cursor-pointer">
              <Plus className="w-8 h-8 mb-2" />
              <p className="font-medium">{t('views.crm.brokers.addAgency')}</p>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="blacklist" className="space-y-6">
          <Card className="gap-0 overflow-hidden rounded-xl border border-rose-100/80 py-0 shadow-sm">
            <CardHeader className="bg-rose-50/50 border-b border-rose-100 px-6 py-4">
              <CardTitle className="text-rose-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                {t('views.crm.blacklist.title')}
              </CardTitle>
              <CardDescription className="text-rose-700/70">{t('views.crm.blacklist.description')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {crmLoading ? (
                <div className="p-6">
                  <SkeletonTable rows={5} columns={5} showToolbar={false} />
                </div>
              ) : (
                <DataTable
                  data={filteredBlacklist}
                  columns={blacklistColumns}
                  keyExtractor={(row) => row.id}
                  highlightFirstColumn={false}
                  embedded
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
