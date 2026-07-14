import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Archive,
  Building2,
  Eye,
  FileUp,
  Pencil,
  Plus,
  Search,
  Users,
  CheckCircle2,
  Clock3,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { SkeletonTable } from '@/components/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/select2';
import { LandlordFormModal } from '@/components/landlords/LandlordFormModal';
import { LandlordProfileModal } from '@/components/landlords/LandlordProfileModal';
import { deleteLandlord, fetchLandlords } from '@/lib/landlordsApi';
import {
  computeLandlordSummary,
  DEFAULT_LANDLORD_FILTERS,
  filterLandlords,
  formatLandlordDateTime,
  type LandlordFilters,
} from '@/lib/landlordUtils';
import type { Landlord } from '@/types';

const TABLE_ACTION_BTN =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

const LANDLORD_BADGE = '!px-2 !py-0.5 !text-[10px]';

const LANDLORD_COL = {
  date: 'w-[10%]',
  name: 'w-[13%]',
  contact: 'w-[9%]',
  email: 'w-[15%]',
  properties: 'w-[7%]',
  units: 'w-[7%]',
  kyc: 'w-[8%]',
  status: 'w-[7%]',
  activity: 'w-[10%]',
  actions: 'w-[14%]',
} as const;

const LANDLORD_CELL = 'max-w-0 align-middle';

function TruncatedText({
  value,
  className,
  title,
}: {
  value: string;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn('block truncate text-sm', className)} title={title ?? value}>
      {value}
    </span>
  );
}

function renderDateAdded(value?: string) {
  const dt = parseDateTime(value);
  return dt ? (
    <span className="block truncate text-xs text-slate-600 dark:text-slate-300" title={format(dt, 'MMM dd, yyyy · h:mm a')}>
      {format(dt, 'MMM d, yy · h:mm a')}
    </span>
  ) : (
    <span className="text-sm text-slate-400">—</span>
  );
}

function parseDateTime(value?: string) {
  if (!value?.trim()) return null;
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function kycTone(status?: string): 'success' | 'warning' | 'danger' {
  if (status === 'verified') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function accountTone(status?: string): 'success' | 'neutral' | 'danger' {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'danger';
  return 'neutral';
}

type SummaryCardProps = {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

function SummaryCard({ label, value, icon: Icon, accent }: SummaryCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
        </div>
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', accent)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export type LandlordsPanelProps = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function LandlordsPanel({ canCreate, canUpdate, canDelete }: LandlordsPanelProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [filters, setFilters] = useState<LandlordFilters>(DEFAULT_LANDLORD_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingLandlord, setEditingLandlord] = useState<Landlord | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLandlord, setProfileLandlord] = useState<Landlord | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'properties' | 'documents'>('overview');
  const [docUploadLandlord, setDocUploadLandlord] = useState<Landlord | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchLandlords();
      setLandlords(list);
    } catch {
      setLandlords([]);
      toast.warning(t('views.crm.landlords.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () => filterLandlords(landlords, searchTerm, filters),
    [landlords, searchTerm, filters],
  );

  const summary = useMemo(() => computeLandlordSummary(landlords), [landlords]);

  const openCreate = () => {
    setFormMode('create');
    setEditingLandlord(null);
    setFormOpen(true);
  };

  const openEdit = (landlord: Landlord) => {
    setFormMode('edit');
    setEditingLandlord(landlord);
    setFormOpen(true);
  };

  const openProfile = (landlord: Landlord, tab: typeof profileTab = 'overview') => {
    setProfileLandlord(landlord);
    setProfileTab(tab);
    setProfileOpen(true);
  };

  const handleArchive = async (landlord: Landlord) => {
    if (!window.confirm(t('views.crm.landlords.archiveConfirm', { name: landlord.fullName }))) return;
    try {
      await deleteLandlord(landlord.id);
      setLandlords((prev) => prev.filter((l) => l.id !== landlord.id));
      toast.success(t('views.crm.landlords.archived'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.landlords.archiveError'));
    }
  };

  const columns: ColumnDef<Landlord>[] = useMemo(
    () => [
      {
        id: 'createdAt',
        header: t('views.crm.landlords.columns.dateAdded'),
        sortable: true,
        sortValue: (l) => l.createdAt ?? '',
        className: LANDLORD_COL.date,
        cellClassName: LANDLORD_CELL,
        render: (l) => renderDateAdded(l.createdAt),
      },
      {
        id: 'name',
        header: t('views.crm.landlords.columns.name'),
        sortable: true,
        sortValue: (l) => l.fullName,
        className: LANDLORD_COL.name,
        cellClassName: LANDLORD_CELL,
        render: (l) => (
          <TruncatedText value={l.fullName} className="font-medium text-slate-800 dark:text-slate-100" />
        ),
      },
      {
        id: 'mobile',
        header: t('views.crm.landlords.columns.contact'),
        sortable: true,
        sortValue: (l) => l.mobileNo,
        className: LANDLORD_COL.contact,
        cellClassName: LANDLORD_CELL,
        render: (l) => (
          <TruncatedText value={l.mobileNo || '—'} className="text-slate-600 dark:text-slate-300" />
        ),
      },
      {
        id: 'email',
        header: t('views.crm.landlords.columns.email'),
        sortable: true,
        sortValue: (l) => l.email,
        className: LANDLORD_COL.email,
        cellClassName: LANDLORD_CELL,
        render: (l) => (
          <TruncatedText value={l.email || '—'} className="text-slate-600 dark:text-slate-300" />
        ),
      },
      {
        id: 'properties',
        header: t('views.crm.landlords.columns.propertyCount'),
        sortable: true,
        sortValue: (l) => l.propertyCount ?? 0,
        className: cn(LANDLORD_COL.properties, 'text-center'),
        headerClassName: 'text-center',
        cellClassName: cn(LANDLORD_CELL, 'text-center'),
        render: (l) => <span className="tabular-nums text-sm">{l.propertyCount ?? 0}</span>,
      },
      {
        id: 'units',
        header: t('views.crm.landlords.columns.totalUnits'),
        sortable: true,
        sortValue: (l) => l.totalUnits ?? 0,
        className: cn(LANDLORD_COL.units, 'text-center'),
        headerClassName: 'text-center',
        cellClassName: cn(LANDLORD_CELL, 'text-center'),
        render: (l) => <span className="tabular-nums text-sm">{l.totalUnits ?? 0}</span>,
      },
      {
        id: 'kyc',
        header: t('views.crm.landlords.columns.kycStatus'),
        sortable: true,
        sortValue: (l) => l.kycStatus ?? 'pending',
        className: LANDLORD_COL.kyc,
        cellClassName: LANDLORD_CELL,
        render: (l) => (
          <StatusBadge tone={kycTone(l.kycStatus)} className={LANDLORD_BADGE}>
            {t(`views.crm.landlords.kyc.${l.kycStatus ?? 'pending'}`)}
          </StatusBadge>
        ),
      },
      {
        id: 'status',
        header: t('views.crm.landlords.columns.status'),
        sortable: true,
        sortValue: (l) => l.accountStatus ?? 'active',
        className: LANDLORD_COL.status,
        cellClassName: LANDLORD_CELL,
        render: (l) => (
          <StatusBadge tone={accountTone(l.accountStatus)} className={LANDLORD_BADGE}>
            {t(`views.crm.landlords.status.${l.accountStatus ?? 'active'}`)}
          </StatusBadge>
        ),
      },
      {
        id: 'activity',
        header: t('views.crm.landlords.columns.lastActivity'),
        sortable: true,
        sortValue: (l) => l.lastActivity ?? l.createdAt ?? '',
        className: LANDLORD_COL.activity,
        cellClassName: LANDLORD_CELL,
        render: (l) => {
          const label = formatLandlordDateTime(l.lastActivity || l.createdAt);
          const dt = parseDateTime(l.lastActivity || l.createdAt);
          const short = dt ? format(dt, 'MMM d, yy · h:mm a') : label;
          return (
            <span className="block truncate text-xs text-slate-500" title={label}>
              {short}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('views.crm.table.actions'),
        className: cn(LANDLORD_COL.actions, 'text-center'),
        headerClassName: 'text-center',
        cellClassName: cn(LANDLORD_CELL, 'text-center'),
        render: (l) => (
          <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.landlords.actions.view')} onClick={() => openProfile(l)}>
              <Eye className="h-3.5 w-3.5" aria-hidden />
            </button>
            {canUpdate ? (
              <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.landlords.actions.edit')} onClick={() => openEdit(l)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.landlords.actions.viewProperties')} onClick={() => openProfile(l, 'properties')}>
              <Building2 className="h-3.5 w-3.5" aria-hidden />
            </button>
            {canUpdate ? (
              <button
                type="button"
                className={TABLE_ACTION_BTN}
                title={t('views.crm.landlords.actions.uploadDocuments')}
                onClick={() => {
                  setDocUploadLandlord(l);
                  openProfile(l, 'documents');
                }}
              >
                <FileUp className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.landlords.actions.archive')} onClick={() => void handleArchive(l)}>
                <Archive className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, canUpdate, canDelete],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label={t('views.crm.landlords.summary.total')} value={summary.totalLandlords} icon={Users} accent="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300" />
        <SummaryCard label={t('views.crm.landlords.summary.verified')} value={summary.verifiedLandlords} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" />
        <SummaryCard label={t('views.crm.landlords.summary.pendingKyc')} value={summary.pendingKyc} icon={Clock3} accent="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300" />
        <SummaryCard label={t('views.crm.landlords.summary.properties')} value={summary.totalProperties} icon={Home} accent="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300" />
        <SummaryCard label={t('views.crm.landlords.summary.units')} value={summary.totalUnits} icon={Building2} accent="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-[13rem] shrink-0 sm:w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder={t('views.crm.searchPlaceholderLandlords')}
            className="h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select2
            borderless={false}
            className="w-full min-w-[9rem] sm:w-[10rem] [&_.unit-form-select-control]:!min-h-10"
            placeholder={t('views.crm.landlords.filters.status')}
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: (v as LandlordFilters['status']) ?? 'all' }))}
            options={[
              { value: 'all', label: t('views.crm.landlords.filters.all') },
              { value: 'active', label: t('views.crm.landlords.status.active') },
              { value: 'inactive', label: t('views.crm.landlords.status.inactive') },
              { value: 'suspended', label: t('views.crm.landlords.status.suspended') },
            ]}
          />
          {canCreate ? (
            <Button
              type="button"
              className="h-10 shrink-0 rounded-xl bg-indigo-600 px-4 text-white shadow-sm hover:bg-indigo-700"
              onClick={openCreate}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('views.crm.landlords.addLandlord')}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 md:p-8">
          <SkeletonTable rows={6} columns={10} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm dark:bg-slate-900">
          <p className="text-sm text-slate-500">{t('views.crm.landlords.empty')}</p>
          {canCreate ? (
            <Button type="button" className="mt-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={openCreate}>
              {t('views.crm.landlords.addLandlord')}
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(l) => l.id}
          onRowClick={(l) => openProfile(l)}
          highlightFirstColumn={false}
          stickyHeader
          compact
          fitWidth
        />
      )}

      <LandlordFormModal
        isOpen={formOpen}
        mode={formMode}
        landlord={editingLandlord}
        onClose={() => {
          setFormOpen(false);
          setEditingLandlord(null);
        }}
        onSaved={(saved) => {
          setLandlords((prev) => {
            const exists = prev.some((l) => l.id === saved.id);
            if (exists) return prev.map((l) => (l.id === saved.id ? saved : l));
            return [saved, ...prev];
          });
        }}
      />

      <LandlordProfileModal
        isOpen={profileOpen}
        landlord={profileLandlord ?? docUploadLandlord}
        initialTab={profileTab}
        onClose={() => {
          setProfileOpen(false);
          setProfileLandlord(null);
          setDocUploadLandlord(null);
        }}
        onEdit={(l) => {
          setProfileOpen(false);
          openEdit(l);
        }}
        onViewProperties={(l) => openProfile(l, 'properties')}
      />
    </div>
  );
}