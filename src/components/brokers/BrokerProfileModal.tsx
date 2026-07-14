import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Building2,
  FileText,
  Loader2,
  ScrollText,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type ColumnDef } from '@/components/data-table';
import {
  fetchPartnerAgencyCollaborations,
  uploadPartnerAgencyKycDocument,
  type PartnerAgencyCollaborationLog,
} from '@/lib/partnerAgenciesApi';
import {
  BROKER_DOCUMENT_TYPES,
  buildBrokerActivityLogs,
  formatBrokerDate,
  formatBrokerDateTime,
  getPartnershipStatus,
  getVerificationStatus,
  partnershipTone,
  resolveUploadUrl,
  verificationTone,
  type BrokerActivityRow,
} from '@/lib/brokerUtils';
import type { BrokerAgency } from '@/types';

type ProfileTab = 'overview' | 'contacts' | 'documents' | 'contracts' | 'activity';

const TAB_TRIGGER =
  '!flex-none gap-1.5 whitespace-nowrap rounded-md border-0 px-2.5 py-1.5 text-xs font-medium text-slate-500 shadow-none data-[active]:bg-white data-[active]:font-semibold data-[active]:text-slate-900 data-[active]:shadow-sm dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white';

const PROFILE_VALUE =
  'flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100';

const BROKER_BADGE = '!px-2 !py-0.5 !text-[10px]';

export type BrokerProfileModalProps = {
  isOpen: boolean;
  agency: BrokerAgency | null;
  initialTab?: ProfileTab;
  onClose: () => void;
  onEdit?: (agency: BrokerAgency) => void;
};

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
    <section className="rounded-xl border border-indigo-100/70 bg-white p-3 dark:border-indigo-500/20 dark:bg-slate-950/80">
      <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
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
  return (
    <div className={cn('min-w-0 space-y-1', span === 2 && 'sm:col-span-2', span === 3 && 'sm:col-span-3')}>
      <p className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <div className={PROFILE_VALUE}>
        {typeof value === 'string' || typeof value === 'number' ? <span className="truncate">{value}</span> : value}
      </div>
    </div>
  );
}

type ContactRow = {
  id: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  primary: boolean;
};

export function BrokerProfileModal({
  isOpen,
  agency,
  initialTab = 'overview',
  onClose,
  onEdit,
}: BrokerProfileModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [collaborations, setCollaborations] = useState<PartnerAgencyCollaborationLog[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab(initialTab);
      setCollaborations([]);
      return;
    }
    if (!agency) return;
    let cancelled = false;
    setLoading(true);
    void fetchPartnerAgencyCollaborations(agency.id)
      .then((logs) => {
        if (!cancelled) setCollaborations(logs);
      })
      .catch(() => {
        if (!cancelled) {
          setCollaborations([]);
          toast.error(t('views.crm.brokers.logsLoadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, agency?.id, initialTab, t]);

  const profile = agency;
  const verification = profile ? getVerificationStatus(profile) : 'pending';
  const partnership = profile ? getPartnershipStatus(profile) : 'active';

  const contacts: ContactRow[] = profile
    ? [
        {
          id: 'primary',
          name: profile.contactPerson || profile.name,
          position: t('views.crm.brokers.profile.brokerInCharge'),
          phone: profile.phone || '—',
          email: profile.email || '—',
          primary: true,
        },
      ]
    : [];

  const contactColumns: ColumnDef<ContactRow>[] = [
    { id: 'name', header: t('views.crm.brokers.profile.columns.contactName'), render: (r) => r.name },
    { id: 'position', header: t('views.crm.brokers.profile.columns.position'), render: (r) => r.position },
    { id: 'phone', header: t('views.crm.brokers.phoneLabel'), render: (r) => r.phone },
    { id: 'email', header: t('views.crm.brokers.emailLabel'), render: (r) => r.email },
    {
      id: 'primary',
      header: t('views.crm.brokers.profile.columns.primary'),
      render: (r) =>
        r.primary ? (
          <StatusBadge tone="success" className={BROKER_BADGE}>
            {t('views.crm.brokers.profile.primaryYes')}
          </StatusBadge>
        ) : (
          '—'
        ),
    },
  ];

  const contractColumns: ColumnDef<PartnerAgencyCollaborationLog>[] = [
    {
      id: 'contractNo',
      header: t('views.crm.brokers.profile.columns.contractNo'),
      render: (r) => <span className="font-mono text-xs">{r.contractNo || r.contractId}</span>,
    },
    {
      id: 'period',
      header: t('views.crm.brokers.profile.columns.period'),
      render: (r) => `${formatBrokerDate(r.contractStart)} – ${formatBrokerDate(r.contractEnd)}`,
    },
    {
      id: 'status',
      header: t('views.crm.brokers.profile.columns.status'),
      render: (r) => (
        <StatusBadge tone={r.contractStatus === 'Active' ? 'success' : 'neutral'} className={BROKER_BADGE}>
          {r.contractStatus}
        </StatusBadge>
      ),
    },
    { id: 'commission', header: t('views.crm.brokers.logsCommission'), render: (r) => r.commissionTerms || '—' },
    { id: 'remarks', header: t('views.crm.brokers.logsRemarks'), render: (r) => r.remarks || '—' },
  ];

  const activityRows: BrokerActivityRow[] = profile ? buildBrokerActivityLogs(profile, collaborations) : [];

  const activityColumns: ColumnDef<BrokerActivityRow>[] = [
    { id: 'action', header: t('views.crm.brokers.profile.columns.action'), render: (r) => r.action },
    { id: 'user', header: t('views.crm.brokers.profile.columns.user'), render: (r) => r.user },
    {
      id: 'when',
      header: t('views.crm.brokers.profile.columns.dateTime'),
      render: (r) => formatBrokerDateTime(r.createdAt),
    },
  ];

  const handleUpload = async () => {
    if (!profile || !docFile) {
      toast.error(t('views.crm.brokers.profile.documentRequired'));
      return;
    }
    setUploading(true);
    try {
      await uploadPartnerAgencyKycDocument(profile.id, docFile);
      toast.success(t('views.crm.brokers.profile.documentUploaded'));
      setDocFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.saveError'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen && !!profile}
      onClose={onClose}
      title={profile ? t('views.crm.brokers.profile.title', { name: profile.name }) : ''}
      subtitle={profile?.lastCollaborationAt ? t('views.crm.brokers.profile.lastActivity', { date: formatBrokerDateTime(profile.lastCollaborationAt) }) : undefined}
      maxWidth="5xl"
      variant="glass"
      compact
      shellClassName="crm-form-modal-shell"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={onClose}>
            {t('views.crm.blacklist.close')}
          </Button>
          {profile && onEdit ? (
            <Button type="button" className={modalPrimaryButtonClass} onClick={() => onEdit(profile)}>
              {t('views.crm.brokers.edit')}
            </Button>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden />
        </div>
      ) : profile ? (
        <div className="broker-profile-modal max-h-[min(68vh,36rem)] space-y-3 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950/80">
            <StatusBadge tone={verificationTone(verification)} className={BROKER_BADGE}>
              {t(`views.crm.brokers.verification.${verification}`)}
            </StatusBadge>
            <StatusBadge tone={partnershipTone(partnership)} className={BROKER_BADGE}>
              {t(`views.crm.brokers.partnership.${partnership}`)}
            </StatusBadge>
            {profile.collaborationCount != null ? (
              <span className="text-slate-600 dark:text-slate-300">
                {t('views.crm.brokers.totalLabel')}: <strong>{profile.collaborationCount}</strong>
              </span>
            ) : null}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="gap-0">
            <TabsList className="mb-3 h-auto w-max max-w-full self-start gap-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
              <TabsTrigger value="overview" className={TAB_TRIGGER}><ScrollText className="h-3.5 w-3.5" aria-hidden />{t('views.crm.brokers.profile.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="contacts" className={TAB_TRIGGER}><Users className="h-3.5 w-3.5" aria-hidden />{t('views.crm.brokers.profile.tabs.contacts')}</TabsTrigger>
              <TabsTrigger value="documents" className={TAB_TRIGGER}><Upload className="h-3.5 w-3.5" aria-hidden />{t('views.crm.brokers.profile.tabs.documents')}</TabsTrigger>
              <TabsTrigger value="contracts" className={TAB_TRIGGER}><FileText className="h-3.5 w-3.5" aria-hidden />{t('views.crm.brokers.profile.tabs.contracts')}</TabsTrigger>
              <TabsTrigger value="activity" className={TAB_TRIGGER}><Activity className="h-3.5 w-3.5" aria-hidden />{t('views.crm.brokers.profile.tabs.activity')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-3">
              <ProfileSection title={t('views.crm.brokers.profile.sections.agency')} icon={Building2}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailField label={t('views.crm.brokers.agencyName')} value={profile.name} span={2} />
                  <DetailField label={t('views.crm.brokers.form.businessType')} value={profile.documentType || '—'} />
                  <DetailField label={t('views.crm.brokers.contactPersonLabel')} value={profile.contactPerson || '—'} />
                  <DetailField label={t('views.crm.brokers.phoneLabel')} value={profile.phone || '—'} />
                  <DetailField label={t('views.crm.brokers.emailLabel')} value={profile.email || '—'} />
                  <DetailField
                    label={t('views.crm.brokers.profile.verificationStatus')}
                    value={
                      <StatusBadge tone={verificationTone(verification)} className={BROKER_BADGE}>
                        {t(`views.crm.brokers.verification.${verification}`)}
                      </StatusBadge>
                    }
                  />
                  <DetailField
                    label={t('views.crm.brokers.profile.partnershipStatus')}
                    value={
                      <StatusBadge tone={partnershipTone(partnership)} className={BROKER_BADGE}>
                        {t(`views.crm.brokers.partnership.${partnership}`)}
                      </StatusBadge>
                    }
                  />
                  <DetailField label={t('views.crm.brokers.profile.contractExpiry')} value={formatBrokerDate(profile.expiryDate)} />
                  <DetailField label={t('views.crm.brokers.lastCollaboration')} value={formatBrokerDateTime(profile.lastCollaborationAt)} />
                </div>
              </ProfileSection>
            </TabsContent>

            <TabsContent value="contacts" className="mt-0">
              <DataTable data={contacts} columns={contactColumns} keyExtractor={(r) => r.id} highlightFirstColumn={false} embedded stickyHeader compact fitWidth />
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-3">
              <ProfileSection title={t('views.crm.brokers.profile.tabs.documents')} icon={Upload}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1 sm:col-span-2">
                    <p className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('views.crm.brokers.profile.uploadDocument')}</p>
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="flex h-9 w-full items-center justify-between rounded-lg border border-dashed border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-sm hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-950/80"
                    >
                      <span className="truncate">{docFile?.name || t('views.crm.brokers.profile.chooseFile')}</span>
                      <Upload className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                    </button>
                    <input ref={docInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" className={modalPrimaryButtonClass} disabled={uploading || !docFile} onClick={() => void handleUpload()}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                    {t('views.crm.brokers.profile.upload')}
                  </Button>
                </div>
              </ProfileSection>
              <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-600">
                {BROKER_DOCUMENT_TYPES.map((docType) => {
                  const isUploaded = profile.documentType === docType || (docType === 'Government ID' && profile.filePath);
                  const showFile = docType === profile.documentType || (docType === 'PRC License' && profile.filePath);
                  return (
                    <div key={docType} className="flex items-center justify-between gap-3 bg-white px-3 py-2.5 text-sm dark:bg-slate-950/80">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{docType}</p>
                        <p className="text-xs text-slate-500">
                          {isUploaded ? formatBrokerDate(profile.expiryDate) : t('views.crm.brokers.profile.notUploaded')}
                        </p>
                      </div>
                      {showFile && profile.filePath ? (
                        <a href={resolveUploadUrl(profile.filePath)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-indigo-600 hover:underline">
                          {t('views.crm.brokers.profile.download')}
                        </a>
                      ) : (
                        <StatusBadge tone={isUploaded ? 'success' : 'neutral'} className={BROKER_BADGE}>
                          {isUploaded ? t('views.crm.brokers.profile.onFile') : t('views.crm.brokers.profile.missing')}
                        </StatusBadge>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="contracts" className="mt-0">
              {collaborations.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.brokers.logsEmpty')}</p>
              ) : (
                <DataTable data={collaborations} columns={contractColumns} keyExtractor={(r) => r.id} highlightFirstColumn={false} embedded stickyHeader compact fitWidth />
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              {activityRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.brokers.profile.emptyActivity')}</p>
              ) : (
                <DataTable data={activityRows} columns={activityColumns} keyExtractor={(r) => r.id} highlightFirstColumn={false} embedded stickyHeader compact fitWidth />
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </Modal>
  );
}
