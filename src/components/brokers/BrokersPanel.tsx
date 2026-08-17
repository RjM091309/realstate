import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Building2,
  Clock3,
  Eye,
  Pencil,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { SkeletonTable } from '@/components/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/select2';
import { BrokerFormModal } from '@/components/brokers/BrokerFormModal';
import { BrokerProfileModal } from '@/components/brokers/BrokerProfileModal';
import { deletePartnerAgency, fetchPartnerAgencies } from '@/lib/partnerAgenciesApi';
import {
  computeBrokerSummary,
  DEFAULT_BROKER_FILTERS,
  filterBrokers,
  formatBrokerDate,
  getPartnershipStatus,
  getVerificationStatus,
  partnershipTone,
  verificationTone,
  type BrokerFilters,
} from '@/lib/brokerUtils';
import type { BrokerAgency } from '@/types';

const TABLE_ACTION_BTN =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

const BROKER_BADGE = '!px-2 !py-0.5 !text-[10px]';

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

export type BrokersPanelProps = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function BrokersPanel({ canCreate, canUpdate, canDelete }: BrokersPanelProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState<BrokerAgency[]>([]);
  const [filters, setFilters] = useState<BrokerFilters>(DEFAULT_BROKER_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingAgency, setEditingAgency] = useState<BrokerAgency | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileAgency, setProfileAgency] = useState<BrokerAgency | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'activity'>('overview');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchPartnerAgencies();
      setAgencies(list);
    } catch {
      setAgencies([]);
      toast.warning(t('views.crm.brokers.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => filterBrokers(agencies, searchTerm, filters), [agencies, searchTerm, filters]);
  const summary = useMemo(() => computeBrokerSummary(agencies), [agencies]);

  const openCreate = () => {
    setFormMode('create');
    setEditingAgency(null);
    setFormOpen(true);
  };

  const openEdit = (agency: BrokerAgency) => {
    setFormMode('edit');
    setEditingAgency(agency);
    setFormOpen(true);
  };

  const openProfile = (agency: BrokerAgency, tab: typeof profileTab = 'overview') => {
    setProfileAgency(agency);
    setProfileTab(tab);
    setProfileOpen(true);
  };

  const handleArchive = async (agency: BrokerAgency) => {
    if (!window.confirm(t('views.crm.brokers.deleteConfirm', { name: agency.name }))) return;
    try {
      await deletePartnerAgency(agency.id);
      setAgencies((prev) => prev.filter((a) => a.id !== agency.id));
      toast.success(t('views.crm.brokers.deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.deleteError'));
    }
  };

  const columns: ColumnDef<BrokerAgency>[] = useMemo(
    () => [
      {
        id: 'name',
        header: t('views.crm.brokers.columns.agencyName'),
        sortable: true,
        sortValue: (a) => a.name,
        render: (a) => (
          <span className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">
            {a.name}
          </span>
        ),
      },
      {
        id: 'broker',
        header: t('views.crm.brokers.columns.brokerInCharge'),
        sortable: true,
        sortValue: (a) => a.contactPerson,
        render: (a) => (
          <span className="text-sm text-slate-700 dark:text-slate-200">{a.contactPerson || '—'}</span>
        ),
      },
      {
        id: 'contact',
        header: t('views.crm.brokers.columns.contact'),
        sortable: true,
        sortValue: (a) => a.email ?? a.phone,
        render: (a) => (
          <div className="flex min-w-[10rem] flex-col gap-0.5">
            <span className="text-sm text-slate-700 dark:text-slate-300">{a.email || '—'}</span>
            <span className="text-xs text-slate-500">{a.phone || '—'}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: t('views.crm.brokers.columns.status'),
        sortable: true,
        sortValue: (a) => `${getVerificationStatus(a)}-${getPartnershipStatus(a)}`,
        render: (a) => {
          const verification = getVerificationStatus(a);
          const pending = verification !== 'verified';
          return pending ? (
            <StatusBadge tone={verificationTone(verification)} className={BROKER_BADGE}>
              {t(`views.crm.brokers.verification.${verification}`)}
            </StatusBadge>
          ) : (
            <StatusBadge tone={partnershipTone(getPartnershipStatus(a))} className={BROKER_BADGE}>
              {t(`views.crm.brokers.partnership.${getPartnershipStatus(a)}`)}
            </StatusBadge>
          );
        },
      },
      {
        id: 'expiry',
        header: t('views.crm.brokers.columns.contractExpiry'),
        sortable: true,
        sortValue: (a) => a.expiryDate ?? '',
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (a) => (
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {a.expiryDate ? formatBrokerDate(a.expiryDate) : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('views.crm.table.actions'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (a) => (
          <div
            className="flex items-center justify-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={TABLE_ACTION_BTN}
              title={t('views.crm.brokers.actions.view')}
              onClick={() => openProfile(a)}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
            </button>
            {canUpdate ? (
              <button
                type="button"
                className={TABLE_ACTION_BTN}
                title={t('views.crm.brokers.edit')}
                onClick={() => openEdit(a)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className={TABLE_ACTION_BTN}
                title={t('views.crm.brokers.delete')}
                onClick={() => void handleArchive(a)}
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
          label={t('views.crm.brokers.summary.total')}
          value={summary.totalAgencies}
          icon={Building2}
          accent="bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/10 dark:text-brand-blue"
        />
        <SummaryCard
          label={t('views.crm.brokers.summary.pending')}
          value={summary.pendingVerification}
          icon={Clock3}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
        />
        <SummaryCard
          label={t('views.crm.brokers.summary.active')}
          value={summary.activeAgencies}
          icon={Users}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-[13rem] shrink-0 sm:w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('views.crm.brokers.searchPlaceholder')}
            className="h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-950/80"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select2
            borderless={false}
            className="w-full min-w-[9rem] sm:w-[10rem] [&_.unit-form-select-control]:!min-h-10"
            placeholder={t('views.crm.brokers.filters.verification')}
            value={filters.verification}
            onChange={(v) => setFilters((f) => ({ ...f, verification: (v as BrokerFilters['verification']) ?? 'all' }))}
            options={[
              { value: 'all', label: t('views.crm.brokers.filters.all') },
              { value: 'verified', label: t('views.crm.brokers.verification.verified') },
              { value: 'pending', label: t('views.crm.brokers.verification.pending') },
              { value: 'rejected', label: t('views.crm.brokers.verification.rejected') },
            ]}
          />
          {canCreate ? (
            <Button
              type="button"
              className="h-10 shrink-0 rounded-xl bg-brand-blue px-4 text-white shadow-sm hover:bg-[#3d7ab8]"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              {t('views.crm.brokers.addAgency')}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 md:p-8">
          <SkeletonTable rows={6} columns={6} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/10">
            <Building2 className="h-8 w-8" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('views.crm.brokers.empty')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('views.crm.brokers.emptyHint')}</p>
          {canCreate ? (
            <Button type="button" className="mt-4 rounded-xl bg-brand-blue text-white hover:bg-[#3d7ab8]" onClick={openCreate}>
              {t('views.crm.brokers.addAgency')}
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(a) => a.id}
          onRowClick={(a) => openProfile(a)}
          stickyHeader
          compact
          fitWidth
        />
      )}

      <BrokerFormModal
        isOpen={formOpen}
        mode={formMode}
        agency={editingAgency}
        onClose={() => {
          setFormOpen(false);
          setEditingAgency(null);
        }}
        onSaved={(saved) => {
          setAgencies((prev) => {
            const exists = prev.some((a) => a.id === saved.id);
            if (exists) return prev.map((a) => (a.id === saved.id ? saved : a));
            return [saved, ...prev];
          });
        }}
      />

      <BrokerProfileModal
        isOpen={profileOpen}
        agency={profileAgency}
        initialTab={profileTab}
        onClose={() => {
          setProfileOpen(false);
          setProfileAgency(null);
        }}
        onEdit={(a) => {
          setProfileOpen(false);
          openEdit(a);
        }}
      />
    </div>
  );
}
