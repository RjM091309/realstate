import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Archive,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  FileUp,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { SkeletonTable } from '@/components/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Button, modalDangerButtonClass, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/select2';
import { BrokerFormModal } from '@/components/brokers/BrokerFormModal';
import { BrokerProfileModal } from '@/components/brokers/BrokerProfileModal';
import {
  deletePartnerAgency,
  fetchPartnerAgencies,
} from '@/lib/partnerAgenciesApi';
import {
  computeBrokerSummary,
  DEFAULT_BROKER_FILTERS,
  filterBrokers,
  formatBrokerDate,
  formatBrokerDateTime,
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

const BROKER_COL = {
  date: 'w-[9%]',
  name: 'w-[14%]',
  broker: 'w-[12%]',
  city: 'w-[8%]',
  phone: 'w-[9%]',
  email: 'w-[12%]',
  verification: 'w-[9%]',
  partnership: 'w-[9%]',
  expiry: 'w-[9%]',
  collaboration: 'w-[9%]',
  actions: 'w-[10%]',
} as const;

const BROKER_CELL = 'max-w-0 align-middle';

function TruncatedText({ value, className, title }: { value: string; className?: string; title?: string }) {
  return (
    <span className={cn('block truncate text-sm', className)} title={title ?? value}>
      {value}
    </span>
  );
}

function parseDateTime(value?: string) {
  if (!value?.trim()) return null;
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
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
  const [profileTab, setProfileTab] = useState<'overview' | 'contacts' | 'documents' | 'contracts' | 'activity'>('overview');
  const [deleteTarget, setDeleteTarget] = useState<BrokerAgency | null>(null);

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
    if (!window.confirm(t('views.crm.brokers.archiveConfirm', { name: agency.name }))) return;
    try {
      await deletePartnerAgency(agency.id);
      setAgencies((prev) => prev.filter((a) => a.id !== agency.id));
      toast.success(t('views.crm.brokers.deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.deleteError'));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePartnerAgency(deleteTarget.id);
      setAgencies((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success(t('views.crm.brokers.deleted'));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.deleteError'));
    }
  };

  const columns: ColumnDef<BrokerAgency>[] = useMemo(
    () => [
      {
        id: 'dateAdded',
        header: t('views.crm.brokers.columns.dateAdded'),
        sortable: true,
        sortValue: (a) => a.lastCollaborationAt ?? '',
        className: BROKER_COL.date,
        cellClassName: BROKER_CELL,
        render: (a) => renderDateAdded(a.lastCollaborationAt),
      },
      {
        id: 'name',
        header: t('views.crm.brokers.columns.agencyName'),
        sortable: true,
        sortValue: (a) => a.name,
        className: BROKER_COL.name,
        cellClassName: BROKER_CELL,
        render: (a) => <TruncatedText value={a.name} className="font-medium text-slate-800 dark:text-slate-100" />,
      },
      {
        id: 'broker',
        header: t('views.crm.brokers.columns.brokerInCharge'),
        sortable: true,
        sortValue: (a) => a.contactPerson,
        className: BROKER_COL.broker,
        cellClassName: BROKER_CELL,
        render: (a) => <TruncatedText value={a.contactPerson || '—'} className="text-slate-600 dark:text-slate-300" />,
      },
      {
        id: 'city',
        header: t('views.crm.brokers.columns.city'),
        className: BROKER_COL.city,
        cellClassName: BROKER_CELL,
        render: () => <span className="text-sm text-slate-400">—</span>,
      },
      {
        id: 'phone',
        header: t('views.crm.brokers.columns.contact'),
        sortable: true,
        sortValue: (a) => a.phone,
        className: BROKER_COL.phone,
        cellClassName: BROKER_CELL,
        render: (a) => <TruncatedText value={a.phone || '—'} className="text-slate-600 dark:text-slate-300" />,
      },
      {
        id: 'email',
        header: t('views.crm.brokers.columns.email'),
        sortable: true,
        sortValue: (a) => a.email ?? '',
        className: BROKER_COL.email,
        cellClassName: BROKER_CELL,
        render: (a) => <TruncatedText value={a.email || '—'} className="text-slate-600 dark:text-slate-300" />,
      },
      {
        id: 'verification',
        header: t('views.crm.brokers.columns.verification'),
        sortable: true,
        sortValue: (a) => getVerificationStatus(a),
        className: BROKER_COL.verification,
        cellClassName: BROKER_CELL,
        render: (a) => {
          const status = getVerificationStatus(a);
          return (
            <StatusBadge tone={verificationTone(status)} className={BROKER_BADGE}>
              {t(`views.crm.brokers.verification.${status}`)}
            </StatusBadge>
          );
        },
      },
      {
        id: 'partnership',
        header: t('views.crm.brokers.columns.partnership'),
        sortable: true,
        sortValue: (a) => getPartnershipStatus(a),
        className: BROKER_COL.partnership,
        cellClassName: BROKER_CELL,
        render: (a) => {
          const status = getPartnershipStatus(a);
          return (
            <StatusBadge tone={partnershipTone(status)} className={BROKER_BADGE}>
              {t(`views.crm.brokers.partnership.${status}`)}
            </StatusBadge>
          );
        },
      },
      {
        id: 'expiry',
        header: t('views.crm.brokers.columns.contractExpiry'),
        sortable: true,
        sortValue: (a) => a.expiryDate ?? '',
        className: BROKER_COL.expiry,
        cellClassName: BROKER_CELL,
        render: (a) => <span className="text-xs text-slate-600 dark:text-slate-300">{formatBrokerDate(a.expiryDate)}</span>,
      },
      {
        id: 'collaboration',
        header: t('views.crm.brokers.columns.lastCollaboration'),
        sortable: true,
        sortValue: (a) => a.lastCollaborationAt ?? '',
        className: BROKER_COL.collaboration,
        cellClassName: BROKER_CELL,
        render: (a) => {
          const label = formatBrokerDateTime(a.lastCollaborationAt);
          const dt = parseDateTime(a.lastCollaborationAt);
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
        className: cn(BROKER_COL.actions, 'text-center'),
        headerClassName: 'text-center',
        cellClassName: cn(BROKER_CELL, 'text-center'),
        render: (a) => (
          <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.brokers.actions.view')} onClick={() => openProfile(a)}>
              <Eye className="h-3.5 w-3.5" aria-hidden />
            </button>
            {canUpdate ? (
              <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.brokers.edit')} onClick={() => openEdit(a)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canUpdate ? (
              <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.brokers.actions.uploadDocuments')} onClick={() => openProfile(a, 'documents')}>
                <FileUp className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canUpdate ? (
              <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.brokers.actions.viewContract')} onClick={() => openProfile(a, 'contracts')}>
                <FileText className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.brokers.actions.archive')} onClick={() => void handleArchive(a)}>
                <Archive className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className={TABLE_ACTION_BTN} title={t('views.crm.brokers.delete')} onClick={() => setDeleteTarget(a)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
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
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t('views.crm.brokers.pageTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('views.crm.brokers.pageSubtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label={t('views.crm.brokers.summary.total')} value={summary.totalAgencies} icon={Building2} accent="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300" />
        <SummaryCard label={t('views.crm.brokers.summary.active')} value={summary.activeAgencies} icon={Users} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" />
        <SummaryCard label={t('views.crm.brokers.summary.pending')} value={summary.pendingVerification} icon={Clock3} accent="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300" />
        <SummaryCard label={t('views.crm.brokers.summary.expiring')} value={summary.expiringContracts} icon={ShieldAlert} accent="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" />
        <SummaryCard label={t('views.crm.brokers.summary.verified')} value={summary.verifiedAgencies} icon={CheckCircle2} accent="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300" />
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
          <Select2
            borderless={false}
            className="w-full min-w-[9rem] sm:w-[10rem] [&_.unit-form-select-control]:!min-h-10"
            placeholder={t('views.crm.brokers.filters.partnership')}
            value={filters.partnership}
            onChange={(v) => setFilters((f) => ({ ...f, partnership: (v as BrokerFilters['partnership']) ?? 'all' }))}
            options={[
              { value: 'all', label: t('views.crm.brokers.filters.all') },
              { value: 'active', label: t('views.crm.brokers.partnership.active') },
              { value: 'inactive', label: t('views.crm.brokers.partnership.inactive') },
              { value: 'suspended', label: t('views.crm.brokers.partnership.suspended') },
              { value: 'expired', label: t('views.crm.brokers.partnership.expired') },
            ]}
          />
          <Select2
            borderless={false}
            className="w-full min-w-[9rem] sm:w-[10rem] [&_.unit-form-select-control]:!min-h-10"
            placeholder={t('views.crm.brokers.filters.contractExpiry')}
            value={filters.contractExpiry}
            onChange={(v) => setFilters((f) => ({ ...f, contractExpiry: (v as BrokerFilters['contractExpiry']) ?? 'all' }))}
            options={[
              { value: 'all', label: t('views.crm.brokers.filters.all') },
              { value: 'expired', label: t('views.crm.brokers.filters.expired') },
              { value: 'expiring30', label: t('views.crm.brokers.filters.expiring30') },
              { value: 'expiring90', label: t('views.crm.brokers.filters.expiring90') },
              { value: 'valid', label: t('views.crm.brokers.filters.valid') },
            ]}
          />
          {canCreate ? (
            <Button type="button" className="h-10 shrink-0 rounded-xl bg-indigo-600 px-4 text-white shadow-sm hover:bg-indigo-700" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('views.crm.brokers.addAgency')}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 md:p-8">
          <SkeletonTable rows={6} columns={11} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10">
            <Building2 className="h-8 w-8" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('views.crm.brokers.empty')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('views.crm.brokers.emptyHint')}</p>
          {canCreate ? (
            <Button type="button" className="mt-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={openCreate}>
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
          highlightFirstColumn={false}
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

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('views.crm.brokers.delete')}
        maxWidth="lg"
        variant="glass"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" className={modalOutlineButtonClass} onClick={() => setDeleteTarget(null)}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button type="button" className={modalDangerButtonClass} onClick={() => void confirmDelete()}>
              {t('views.crm.brokers.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {deleteTarget ? t('views.crm.brokers.deleteConfirm', { name: deleteTarget.name }) : ''}
        </p>
      </Modal>
    </div>
  );
}
