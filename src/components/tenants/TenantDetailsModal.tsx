import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isValid, parseISO } from 'date-fns';
import {
  Download,
  Eye,
  FileImage,
  FileText,
  Home,
  Mail,
  Phone,
  ScrollText,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Modal } from '@/components/modal';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { contractStatusVariant } from '@/lib/statusBadge';
import { formatLandlordDateTime } from '@/lib/landlordUtils';
import { cn } from '@/lib/utils';

export type TenantDetailsDocument = {
  id: string;
  name: string;
  fileType: string;
  sizeLabel?: string;
  href?: string;
  onDownload?: () => void;
  onPreview?: () => void;
  kind?: 'pdf' | 'image' | 'other';
};

export type TenantDetailsLease = {
  unitLabel?: string;
  leaseStart?: string;
  leaseEnd?: string;
  monthlyRent?: number;
  statusLabel?: string;
};

export type TenantDetailsTenant = {
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  /** @deprecated use kycVerified */
  verified?: boolean;
  /** @deprecated use isBlacklisted — active means not blacklisted */
  active?: boolean;
  kycVerified?: boolean;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  idType?: string;
  idNumber?: string;
  idExpiry?: string;
  createdAt?: string;
};

export type TenantDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenant: TenantDetailsTenant | null;
  lease?: TenantDetailsLease;
  documents?: TenantDetailsDocument[];
  onEditTenant?: () => void;
  editLabel?: string;
  closeLabel?: string;
  canUpdateStatus?: boolean;
  statusSaving?: boolean;
  onKycVerifiedChange?: (checked: boolean) => void;
  onBlacklistedChange?: (checked: boolean) => void;
  onBlacklistReasonSave?: (reason: string) => void;
};

type ProfileTab = 'overview' | 'documents';

const TAB_TRIGGER =
  'rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-2 text-xs font-semibold text-slate-500 shadow-none data-[active]:border-brand-blue data-[active]:bg-transparent data-[active]:text-brand-blue dark:text-slate-400 dark:data-[active]:text-sky-400';

const TENANT_BADGE = '!px-2 !py-0.5 !text-[10px] font-semibold normal-case';

function formatPhp(amount: number | undefined) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0';
  return `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function formatDateRange(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) return '—';
  const s = parseISO(startIso);
  const e = parseISO(endIso);
  if (!isValid(s) || !isValid(e)) return '—';
  return `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
}

function safeFormatDate(value?: string) {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  const d = parseISO(v);
  if (isValid(d)) return format(d, 'MMM d, yyyy');
  return v;
}

function formatDisplayName(value?: string) {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  if (v === v.toUpperCase() && /[A-Z]/.test(v)) {
    return v
      .toLowerCase()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return v;
}

function formatDisplayText(value?: string, kind: 'default' | 'email' | 'phone' = 'default') {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  if (kind === 'email') return v.toLowerCase();
  if (kind === 'phone') return v;
  if (v === v.toUpperCase() && /[A-Z]/.test(v) && !v.includes('@')) {
    return v
      .toLowerCase()
      .split(/\s+/)
      .map((part) => (part.length <= 3 && part === part.toUpperCase() ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(' ');
  }
  return v;
}

function docIcon(kind?: TenantDetailsDocument['kind']) {
  if (kind === 'image') return FileImage;
  return FileText;
}

function ProfileSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue dark:bg-sky-500/15 dark:text-sky-400">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function ProfileField({
  label,
  value,
  span = 1,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2 | 3;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0',
        span === 2 && 'sm:col-span-2',
        span === 3 && 'sm:col-span-3',
      )}
    >
      <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-sm font-medium normal-case text-slate-900 dark:text-slate-100',
          mono && 'font-mono text-[13px] tracking-tight',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function TenantDetailsModal({
  isOpen,
  onClose,
  tenant,
  lease,
  documents = [],
  onEditTenant,
  editLabel,
  closeLabel,
  canUpdateStatus = false,
  statusSaving = false,
  onKycVerifiedChange,
  onBlacklistedChange,
  onBlacklistReasonSave,
}: TenantDetailsModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [blacklistReasonDraft, setBlacklistReasonDraft] = useState('');

  useEffect(() => {
    if (!isOpen) setActiveTab('overview');
  }, [isOpen]);

  useEffect(() => {
    setBlacklistReasonDraft(tenant?.blacklistReason ?? '');
  }, [tenant?.id, tenant?.blacklistReason, isOpen]);

  const leaseStatusTone = (status?: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (!status) return 'neutral';
    return contractStatusVariant(status);
  };

  const kycVerified = tenant?.kycVerified ?? tenant?.verified ?? false;
  const isBlacklisted = tenant?.isBlacklisted ?? tenant?.active === false;
  const statusControlsDisabled = !canUpdateStatus || statusSaving;

  const tenantStatusBadge = tenant ? (
    isBlacklisted ? (
      <StatusBadge tone="danger" className={TENANT_BADGE}>
        {t('views.crm.table.blacklisted')}
      </StatusBadge>
    ) : (
      <StatusBadge tone="success" className={TENANT_BADGE}>
        {t('views.crm.landlords.status.active')}
      </StatusBadge>
    )
  ) : null;

  const showSummaryBar =
    Boolean(tenant) &&
    (Boolean(lease?.unitLabel) ||
      Number.isFinite(Number(lease?.monthlyRent)) ||
      tenant.isBlacklisted !== undefined ||
      tenant.active !== undefined);

  return (
    <Modal
      isOpen={isOpen && !!tenant}
      onClose={onClose}
      title={
        tenant
          ? t('views.crm.details.titleWithName', { name: formatDisplayName(tenant.name) })
          : ''
      }
      subtitle={
        tenant?.createdAt
          ? t('views.crm.details.registered', { date: formatLandlordDateTime(tenant.createdAt) })
          : undefined
      }
      maxWidth="5xl"
      variant="glass"
      compact
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" className={modalOutlineButtonClass} onClick={onClose}>
            {closeLabel ?? t('views.crm.details.close')}
          </Button>
          {onEditTenant ? (
            <Button type="button" className={modalPrimaryButtonClass} onClick={onEditTenant}>
              {editLabel ?? t('views.crm.details.editTenant')}
            </Button>
          ) : null}
        </div>
      }
    >
      {tenant ? (
        <div className="tenant-details-modal max-h-[min(68vh,36rem)] space-y-4 overflow-y-auto pr-1">
          {showSummaryBar ? (
            <div className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-950/80">
              <dl className="grid gap-4 sm:grid-cols-3">
                {lease?.unitLabel ? (
                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {t('views.crm.details.leaseUnit')}
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold normal-case text-slate-900 dark:text-slate-50">
                      <Home className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
                      <span className="truncate">{formatDisplayText(lease.unitLabel)}</span>
                    </dd>
                  </div>
                ) : null}
                {Number.isFinite(Number(lease?.monthlyRent)) ? (
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {t('views.crm.details.leaseMonthlyRent')}
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {formatPhp(lease?.monthlyRent)}
                      <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                        {t('views.crm.details.perMonth')}
                      </span>
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t('views.crm.landlords.filters.kycStatus')}
                  </dt>
                  <dd className="mt-1.5">{tenantStatusBadge}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="gap-0">
            <TabsList className="mb-4 h-auto w-full justify-start gap-6 rounded-none border-0 border-b border-slate-200 bg-transparent p-0 dark:border-slate-700">
              <TabsTrigger value="overview" className={TAB_TRIGGER}>
                <ScrollText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t('views.crm.landlords.profile.tabs.overview')}
              </TabsTrigger>
              <TabsTrigger value="documents" className={TAB_TRIGGER}>
                <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t('views.crm.details.documents')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-4">
              <ProfileSection title={t('views.crm.details.tenantInfo')} icon={User}>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <ProfileField
                    label={t('views.crm.tenantModal.name')}
                    value={formatDisplayName(tenant.name)}
                    span={2}
                  />
                  <ProfileField
                    label={t('views.crm.tenantModal.email')}
                    value={
                      tenant.email ? (
                        <a
                          href={`mailto:${tenant.email}`}
                          className="inline-flex items-center gap-1.5 text-brand-blue hover:underline dark:text-sky-400"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                          {formatDisplayText(tenant.email, 'email')}
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <ProfileField
                    label={t('views.crm.tenantModal.phone')}
                    value={
                      tenant.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                          {formatDisplayText(tenant.phone, 'phone')}
                        </span>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <ProfileField
                    label={t('views.crm.details.nationality')}
                    value={formatDisplayText(tenant.nationality)}
                  />
                </dl>

                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="mb-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t('views.crm.landlords.filters.kycStatus')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label
                      htmlFor="tenant-profile-kyc"
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
                        kycVerified
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
                        statusControlsDisabled && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        id="tenant-profile-kyc"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-brand-blue"
                        checked={kycVerified}
                        disabled={statusControlsDisabled}
                        onChange={(e) => onKycVerifiedChange?.(e.target.checked)}
                      />
                      {t('views.crm.tenantModal.kycVerified')}
                    </label>
                    <label
                      htmlFor="tenant-profile-blacklist"
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
                        isBlacklisted
                          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
                        statusControlsDisabled && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        id="tenant-profile-blacklist"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-brand-blue"
                        checked={isBlacklisted}
                        disabled={statusControlsDisabled}
                        onChange={(e) => onBlacklistedChange?.(e.target.checked)}
                      />
                      {t('views.crm.tenantModal.blacklisted')}
                    </label>
                  </div>
                  {isBlacklisted ? (
                    canUpdateStatus && onBlacklistReasonSave ? (
                      <input
                        type="text"
                        className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm normal-case text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100"
                        placeholder={t('views.crm.tenantModal.blacklistReason')}
                        value={blacklistReasonDraft}
                        disabled={statusControlsDisabled}
                        onChange={(e) => setBlacklistReasonDraft(e.target.value)}
                        onBlur={() => onBlacklistReasonSave(blacklistReasonDraft)}
                      />
                    ) : tenant.blacklistReason ? (
                      <p className="mt-2 text-sm normal-case text-slate-600 dark:text-slate-300">
                        {tenant.blacklistReason}
                      </p>
                    ) : null
                  ) : null}
                </div>
              </ProfileSection>

              <ProfileSection title={t('views.crm.details.leaseInfo')} icon={Home}>
                {lease ? (
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <ProfileField
                      label={t('views.crm.details.leaseUnit')}
                      value={formatDisplayText(lease.unitLabel)}
                      span={2}
                    />
                    <ProfileField
                      label={t('views.crm.details.leasePeriod')}
                      value={formatDateRange(lease.leaseStart, lease.leaseEnd)}
                      span={2}
                    />
                    <ProfileField label={t('views.crm.details.leaseMonthlyRent')} value={formatPhp(lease.monthlyRent)} />
                    <ProfileField
                      label={t('views.crm.details.leaseContractStatus')}
                      value={
                        lease.statusLabel ? (
                          <StatusBadge tone={leaseStatusTone(lease.statusLabel)} className={TENANT_BADGE}>
                            {lease.statusLabel}
                          </StatusBadge>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('views.crm.details.leaseNoContract')}</p>
                )}
              </ProfileSection>

              <ProfileSection title={t('views.crm.details.identification')} icon={ShieldCheck}>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                  <ProfileField label={t('views.crm.tenantModal.idType')} value={formatDisplayText(tenant.idType)} />
                  <ProfileField
                    label={t('views.crm.tenantModal.idNumber')}
                    value={formatDisplayText(tenant.idNumber)}
                    mono
                  />
                  <ProfileField label={t('views.crm.tenantModal.idExpiry')} value={safeFormatDate(tenant.idExpiry)} />
                </dl>
              </ProfileSection>
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('views.crm.details.documentsHint')}</p>
              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.details.emptyDocuments')}</p>
              ) : (
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-600">
                  {documents.map((doc) => {
                    const Icon = docIcon(doc.kind);
                    const canDownload = Boolean(doc.onDownload || doc.href);
                    const canPreview = Boolean(doc.onPreview || doc.href);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 bg-white px-4 py-3 text-sm dark:bg-slate-950/80"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-brand-blue dark:text-brand-blue" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate font-medium normal-case text-slate-900 dark:text-slate-100">
                              {doc.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {doc.fileType}
                              {doc.sizeLabel && doc.sizeLabel !== '—' ? ` · ${doc.sizeLabel}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {canDownload ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 dark:text-brand-blue dark:hover:bg-brand-blue/10"
                              onClick={() => {
                                if (doc.onDownload) doc.onDownload();
                                else if (doc.href) window.open(doc.href, '_blank', 'noopener,noreferrer');
                              }}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden />
                              {t('views.crm.details.download')}
                            </button>
                          ) : null}
                          {canPreview ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-brand-blue dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-blue"
                              title={t('views.crm.details.preview')}
                              onClick={() => {
                                if (doc.onPreview) doc.onPreview();
                                else if (doc.href) window.open(doc.href, '_blank', 'noopener,noreferrer');
                              }}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </Modal>
  );
}
