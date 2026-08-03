import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isValid, parseISO } from 'date-fns';
import {
  Download,
  Eye,
  FileImage,
  FileText,
  Home,
  ScrollText,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Modal, ModalDetailField, modalSectionTitleClass } from '@/components/modal';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { contractStatusVariant } from '@/lib/statusBadge';
import { formatLandlordDateTime } from '@/lib/landlordUtils';

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
  verified?: boolean;
  active?: boolean;
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
};

type ProfileTab = 'overview' | 'documents';

const TAB_TRIGGER =
  '!flex-none gap-1.5 whitespace-nowrap rounded-md border-0 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-none data-[active]:bg-white data-[active]:font-black data-[active]:text-slate-900 data-[active]:shadow-sm dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white';

const TENANT_BADGE = '!px-2 !py-0.5 !text-[10px] font-black uppercase tracking-wider';

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
    <section className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/80">
      <h3 className={modalSectionTitleClass}>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-blue text-white shadow-md">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailField({
  label,
  value,
  span = 1,
}: {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2 | 3;
}) {
  return <ModalDetailField label={label} value={value} span={span} />;
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
}: TenantDetailsModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  useEffect(() => {
    if (!isOpen) setActiveTab('overview');
  }, [isOpen]);

  const leaseStatusTone = (status?: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (!status) return 'neutral';
    return contractStatusVariant(status);
  };

  const tenantStatusBadge = tenant ? (
    tenant.active === false ? (
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
      tenant.active !== undefined);

  return (
    <Modal
      isOpen={isOpen && !!tenant}
      onClose={onClose}
      title={tenant ? t('views.crm.details.titleWithName', { name: tenant.name }) : ''}
      subtitle={
        tenant?.createdAt
          ? t('views.crm.details.registered', { date: formatLandlordDateTime(tenant.createdAt) })
          : undefined
      }
      maxWidth="5xl"
      variant="glass"
      compact
      shellClassName="crm-form-modal-shell"
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
        <div className="tenant-details-modal max-h-[min(68vh,36rem)] space-y-3 overflow-y-auto pr-1">
          {showSummaryBar ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950/80">
              {lease?.unitLabel ? (
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Home className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  <span className="font-medium">{lease.unitLabel}</span>
                </span>
              ) : null}
              {Number.isFinite(Number(lease?.monthlyRent)) ? (
                <span className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{formatPhp(lease?.monthlyRent)}</span>
                  <span className="text-slate-500 dark:text-slate-400"> {t('views.crm.details.perMonth')}</span>
                </span>
              ) : null}
              {tenantStatusBadge}
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="gap-0">
            <TabsList className="mb-3 h-auto w-max max-w-full self-start gap-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
              <TabsTrigger value="overview" className={TAB_TRIGGER}>
                <ScrollText className="h-3.5 w-3.5" aria-hidden />
                {t('views.crm.landlords.profile.tabs.overview')}
              </TabsTrigger>
              <TabsTrigger value="documents" className={TAB_TRIGGER}>
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {t('views.crm.details.documents')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-3">
              <ProfileSection title={t('views.crm.details.tenantInfo')} icon={User}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailField label={t('views.crm.tenantModal.name')} value={tenant.name} span={2} />
                  <DetailField label={t('views.crm.tenantModal.email')} value={tenant.email || '—'} />
                  <DetailField label={t('views.crm.tenantModal.phone')} value={tenant.phone || '—'} />
                  <DetailField label={t('views.crm.details.nationality')} value={tenant.nationality || '—'} />
                  <DetailField
                    label={t('views.crm.landlords.filters.kycStatus')}
                    value={
                      <StatusBadge tone={tenant.verified ? 'success' : 'warning'} className={TENANT_BADGE}>
                        {tenant.verified
                          ? t('views.crm.landlords.kyc.verified')
                          : t('views.crm.landlords.kyc.pending')}
                      </StatusBadge>
                    }
                  />
                </div>
              </ProfileSection>

              <ProfileSection title={t('views.crm.details.leaseInfo')} icon={Home}>
                {lease ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <DetailField label={t('views.crm.details.leaseUnit')} value={lease.unitLabel || '—'} span={2} />
                    <DetailField
                      label={t('views.crm.details.leasePeriod')}
                      value={formatDateRange(lease.leaseStart, lease.leaseEnd)}
                      span={2}
                    />
                    <DetailField label={t('views.crm.details.leaseMonthlyRent')} value={formatPhp(lease.monthlyRent)} />
                    <DetailField
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
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('views.crm.details.leaseNoContract')}</p>
                )}
              </ProfileSection>

              <ProfileSection title={t('views.crm.details.identification')} icon={ShieldCheck}>
                <div className="grid gap-2 sm:grid-cols-3">
                  <DetailField label={t('views.crm.tenantModal.idType')} value={tenant.idType || '—'} />
                  <DetailField label={t('views.crm.tenantModal.idNumber')} value={tenant.idNumber || '—'} />
                  <DetailField label={t('views.crm.tenantModal.idExpiry')} value={safeFormatDate(tenant.idExpiry)} />
                </div>
              </ProfileSection>
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('views.crm.details.documentsHint')}</p>
              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.details.emptyDocuments')}</p>
              ) : (
                <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-600">
                  {documents.map((doc) => {
                    const Icon = docIcon(doc.kind);
                    const canDownload = Boolean(doc.onDownload || doc.href);
                    const canPreview = Boolean(doc.onPreview || doc.href);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 bg-white px-3 py-2.5 text-sm dark:bg-slate-950/80"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-brand-blue dark:text-brand-blue" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-slate-100">{doc.name}</p>
                            <p className="text-xs text-slate-500">
                              {doc.fileType.toUpperCase()}
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
