import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Building2,
  Eye,
  Pencil,
  Plus,
  Search,
  Users,
  Clock3,
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
  type LandlordFilters,
} from '@/lib/landlordUtils';
import type { Landlord } from '@/types';

const TABLE_ACTION_BTN =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

const LANDLORD_BADGE = '!px-2 !py-0.5 !text-[10px]';

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
  const [profileTab, setProfileTab] = useState<'overview' | 'activity'>('overview');

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
        id: 'name',
        header: t('views.crm.landlords.columns.name'),
        sortable: true,
        sortValue: (l) => l.fullName,
        render: (l) => (
          <span className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">
            {l.fullName}
          </span>
        ),
      },
      {
        id: 'contact',
        header: t('views.crm.landlords.columns.contact'),
        sortable: true,
        sortValue: (l) => l.email,
        render: (l) => (
          <div className="flex min-w-[10rem] flex-col gap-0.5">
            <span className="text-sm text-slate-700 dark:text-slate-300">{l.email || '—'}</span>
            <span className="text-xs text-slate-500">{l.mobileNo || '—'}</span>
          </div>
        ),
      },
      {
        id: 'portfolio',
        header: t('views.crm.landlords.columns.portfolio'),
        sortable: true,
        sortValue: (l) => (l.propertyCount ?? 0) * 1000 + (l.totalUnits ?? 0),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (l) => (
          <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
            {t('views.crm.landlords.portfolioSummary', {
              properties: l.propertyCount ?? 0,
              units: l.totalUnits ?? 0,
            })}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('views.crm.landlords.columns.status'),
        sortable: true,
        sortValue: (l) => `${l.kycStatus ?? 'pending'}-${l.accountStatus ?? 'active'}`,
        render: (l) => {
          const kycPending = (l.kycStatus ?? 'pending') !== 'verified';
          return kycPending ? (
            <StatusBadge tone={kycTone(l.kycStatus)} className={LANDLORD_BADGE}>
              {t(`views.crm.landlords.kyc.${l.kycStatus ?? 'pending'}`)}
            </StatusBadge>
          ) : (
            <StatusBadge tone={accountTone(l.accountStatus)} className={LANDLORD_BADGE}>
              {t(`views.crm.landlords.status.${l.accountStatus ?? 'active'}`)}
            </StatusBadge>
          );
        },
      },
      {
        id: 'actions',
        header: t('views.crm.table.actions'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (l) => (
          <div
            className="flex items-center justify-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={TABLE_ACTION_BTN}
              title={t('views.crm.landlords.actions.view')}
              onClick={() => openProfile(l)}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
            </button>
            {canUpdate ? (
              <button
                type="button"
                className={TABLE_ACTION_BTN}
                title={t('views.crm.landlords.actions.edit')}
                onClick={() => openEdit(l)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className={TABLE_ACTION_BTN}
                title={t('views.crm.landlords.actions.archive')}
                onClick={() => void handleArchive(l)}
              >
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
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label={t('views.crm.landlords.summary.total')}
          value={summary.totalLandlords}
          icon={Users}
          accent="bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/10 dark:text-brand-blue"
        />
        <SummaryCard
          label={t('views.crm.landlords.summary.pendingKyc')}
          value={summary.pendingKyc}
          icon={Clock3}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
        />
        <SummaryCard
          label={t('views.crm.landlords.summary.units')}
          value={summary.totalUnits}
          icon={Building2}
          accent="bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/10 dark:text-brand-blue"
        />
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
              className="h-10 shrink-0 rounded-xl bg-brand-blue px-4 text-white shadow-sm hover:bg-[#3d7ab8]"
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
          <SkeletonTable rows={6} columns={5} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm dark:bg-slate-900">
          <p className="text-sm text-slate-500">{t('views.crm.landlords.empty')}</p>
          {canCreate ? (
            <Button type="button" className="mt-4 rounded-xl bg-brand-blue text-white hover:bg-[#3d7ab8]" onClick={openCreate}>
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
        landlord={profileLandlord}
        initialTab={profileTab}
        onClose={() => {
          setProfileOpen(false);
          setProfileLandlord(null);
        }}
        onEdit={(l) => {
          setProfileOpen(false);
          openEdit(l);
        }}
      />
    </div>
  );
}
