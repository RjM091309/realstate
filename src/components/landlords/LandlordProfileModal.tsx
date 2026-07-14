import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Building2,
  FileText,
  Loader2,
  Receipt,
  ScrollText,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Select2 } from '@/components/select2';
import {
  fetchLandlordDetail,
  uploadLandlordDocument,
} from '@/lib/landlordsApi';
import { formatLandlordDate, formatLandlordDateTime, formatLandlordPhp, LANDLORD_ID_TYPES } from '@/lib/landlordUtils';
import type {
  Landlord,
  LandlordActivityRow,
  LandlordContractRow,
  LandlordDetailPayload,
  LandlordDocumentRow,
  LandlordPropertyRow,
  LandlordTransactionRow,
} from '@/types';

type ProfileTab = 'overview' | 'properties' | 'contracts' | 'documents' | 'transactions' | 'activity';

const TAB_TRIGGER =
  '!flex-none gap-1.5 whitespace-nowrap rounded-md border-0 px-2.5 py-1.5 text-xs font-medium text-slate-500 shadow-none data-[active]:bg-white data-[active]:font-semibold data-[active]:text-slate-900 data-[active]:shadow-sm dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white';

const PROFILE_VALUE =
  'flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100';

const PROFILE_INPUT =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const PROFILE_SELECT = '[&_.unit-form-select-control]:!min-h-9 [&_.unit-form-select-control]:!h-9';

const LANDLORD_BADGE = '!px-2 !py-0.5 !text-[10px]';

export type LandlordProfileModalProps = {
  isOpen: boolean;
  landlord: Landlord | null;
  initialTab?: ProfileTab;
  onClose: () => void;
  onEdit?: (landlord: Landlord) => void;
  onViewProperties?: (landlord: Landlord) => void;
};

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
  span?: 1 | 2;
}) {
  return (
    <div className={cn('min-w-0 space-y-1', span === 2 && 'sm:col-span-2')}>
      <p className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className={PROFILE_VALUE}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <span className="truncate">{value}</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export function LandlordProfileModal({
  isOpen,
  landlord,
  initialTab = 'overview',
  onClose,
  onEdit,
  onViewProperties,
}: LandlordProfileModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LandlordDetailPayload | null>(null);
  const [docIdType, setDocIdType] = useState<string>(LANDLORD_ID_TYPES[0]);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab(initialTab);
      setDetail(null);
      return;
    }
    if (!landlord) return;
    let cancelled = false;
    setLoading(true);
    void fetchLandlordDetail(landlord.id)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch(() => {
        if (!cancelled) {
          setDetail({
            landlord,
            properties: [],
            contracts: [],
            documents: [],
            transactions: [],
            activityLogs: [],
          });
          toast.error(t('views.crm.landlords.profile.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, landlord?.id, initialTab, t]);

  const profile = detail?.landlord ?? landlord;

  const propertyColumns: ColumnDef<LandlordPropertyRow>[] = [
    { id: 'name', header: t('views.crm.landlords.profile.columns.propertyName'), sortable: true, sortValue: (r) => r.name, render: (r) => r.name },
    { id: 'type', header: t('views.crm.landlords.profile.columns.propertyType'), sortable: true, sortValue: (r) => r.propertyType, render: (r) => r.propertyType },
    { id: 'address', header: t('views.crm.landlords.profile.columns.address'), render: (r) => r.address },
    { id: 'units', header: t('views.crm.landlords.profile.columns.units'), sortable: true, sortValue: (r) => r.units, render: (r) => r.units },
    { id: 'occupied', header: t('views.crm.landlords.profile.columns.occupied'), render: (r) => r.occupied },
    { id: 'vacant', header: t('views.crm.landlords.profile.columns.vacant'), render: (r) => r.vacant },
    { id: 'income', header: t('views.crm.landlords.profile.columns.monthlyIncome'), render: (r) => formatLandlordPhp(r.monthlyIncome) },
    { id: 'status', header: t('views.crm.landlords.profile.columns.status'), render: (r) => <StatusBadge tone={r.status === 'Active' ? 'success' : 'neutral'} className={LANDLORD_BADGE}>{r.status}</StatusBadge> },
  ];

  const contractColumns: ColumnDef<LandlordContractRow>[] = [
    { id: 'contractNo', header: t('views.crm.landlords.profile.columns.contractNo'), sortable: true, sortValue: (r) => r.contractNo, render: (r) => <span className="font-mono text-xs">{r.contractNo}</span> },
    { id: 'property', header: t('views.crm.landlords.profile.columns.propertyName'), render: (r) => `${r.propertyName} · ${r.unitNo}` },
    { id: 'period', header: t('views.crm.landlords.profile.columns.leasePeriod'), render: (r) => `${formatLandlordDate(r.startDate)} – ${formatLandlordDate(r.endDate)}` },
    { id: 'rent', header: t('views.crm.landlords.profile.columns.monthlyRent'), render: (r) => formatLandlordPhp(r.monthlyRent) },
    { id: 'status', header: t('views.crm.landlords.profile.columns.status'), render: (r) => <StatusBadge tone={r.status === 'Active' ? 'success' : 'neutral'} className={LANDLORD_BADGE}>{r.status}</StatusBadge> },
  ];

  const transactionColumns: ColumnDef<LandlordTransactionRow>[] = [
    { id: 'date', header: t('views.crm.landlords.profile.columns.paymentDate'), sortable: true, sortValue: (r) => r.paymentDate, render: (r) => formatLandlordDate(r.paymentDate) },
    { id: 'amount', header: t('views.crm.landlords.profile.columns.amount'), render: (r) => formatLandlordPhp(r.amountPaid) },
    { id: 'method', header: t('views.crm.landlords.profile.columns.method'), render: (r) => r.paymentMethod },
    { id: 'contract', header: t('views.crm.landlords.profile.columns.contractNo'), render: (r) => r.contractNo },
    { id: 'property', header: t('views.crm.landlords.profile.columns.propertyName'), render: (r) => `${r.propertyName} · ${r.unitNo}` },
  ];

  const activityColumns: ColumnDef<LandlordActivityRow>[] = [
    { id: 'action', header: t('views.crm.landlords.profile.columns.action'), sortable: true, sortValue: (r) => r.action, render: (r) => r.changeSummary || r.action },
    { id: 'user', header: t('views.crm.landlords.profile.columns.user'), render: (r) => r.actorUserId || '—' },
    { id: 'when', header: t('views.crm.landlords.profile.columns.dateTime'), sortable: true, sortValue: (r) => r.createdAt, render: (r) => formatLandlordDateTime(r.createdAt) },
  ];

  const handleUploadDocument = async () => {
    if (!profile || !docFile) {
      toast.error(t('views.crm.landlords.profile.documentRequired'));
      return;
    }
    setUploading(true);
    try {
      const documents = await uploadLandlordDocument(profile.id, {
        file: docFile,
        documentType: 'government_id',
        title: docTitle.trim() || `${docIdType} — ${docFile.name}`,
      });
      setDetail((prev) => (prev ? { ...prev, documents } : prev));
      setDocFile(null);
      setDocTitle('');
      toast.success(t('views.crm.landlords.profile.documentUploaded'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.landlords.profile.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen && !!profile}
      onClose={onClose}
      title={profile ? t('views.crm.landlords.profile.title', { name: profile.fullName }) : ''}
      subtitle={profile?.createdAt ? t('views.crm.landlords.profile.registered', { date: formatLandlordDateTime(profile.createdAt) }) : undefined}
      maxWidth="5xl"
      variant="glass"
      compact
      shellClassName="crm-form-modal-shell"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" className={modalOutlineButtonClass} onClick={onClose}>
            {t('views.crm.blacklist.close')}
          </Button>
          {profile && onViewProperties ? (
            <Button type="button" className={modalOutlineButtonClass} onClick={() => onViewProperties(profile)}>
              {t('views.crm.landlords.actions.viewProperties')}
            </Button>
          ) : null}
          {profile && onEdit ? (
            <Button type="button" className={modalPrimaryButtonClass} onClick={() => onEdit(profile)}>
              {t('views.crm.landlords.actions.edit')}
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
        <div className="landlord-profile-modal max-h-[min(68vh,36rem)] space-y-3 overflow-y-auto pr-1">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="gap-0">
            <TabsList className="mb-3 h-auto w-max max-w-full self-start gap-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
              <TabsTrigger value="overview" className={TAB_TRIGGER}><ScrollText className="h-3.5 w-3.5" aria-hidden />{t('views.crm.landlords.profile.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="properties" className={TAB_TRIGGER}><Building2 className="h-3.5 w-3.5" aria-hidden />{t('views.crm.landlords.profile.tabs.properties')}</TabsTrigger>
              <TabsTrigger value="contracts" className={TAB_TRIGGER}><FileText className="h-3.5 w-3.5" aria-hidden />{t('views.crm.landlords.profile.tabs.contracts')}</TabsTrigger>
              <TabsTrigger value="documents" className={TAB_TRIGGER}><Upload className="h-3.5 w-3.5" aria-hidden />{t('views.crm.landlords.profile.tabs.documents')}</TabsTrigger>
              <TabsTrigger value="transactions" className={TAB_TRIGGER}><Receipt className="h-3.5 w-3.5" aria-hidden />{t('views.crm.landlords.profile.tabs.transactions')}</TabsTrigger>
              <TabsTrigger value="activity" className={TAB_TRIGGER}><Activity className="h-3.5 w-3.5" aria-hidden />{t('views.crm.landlords.profile.tabs.activity')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-3">
              <ProfileSection title={t('views.crm.landlords.form.sections.basic')} icon={User}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailField label={t('views.crm.landlords.profile.fullName')} value={profile.fullName} span={2} />
                  <DetailField label={t('views.crm.landlords.form.email')} value={profile.email || '—'} />
                  <DetailField label={t('views.crm.landlords.form.contactNumber')} value={profile.mobileNo || '—'} />
                  <DetailField
                    label={t('views.crm.landlords.form.address')}
                    value={[profile.address, profile.city, profile.province].filter(Boolean).join(', ') || '—'}
                    span={2}
                  />
                </div>
              </ProfileSection>

              <ProfileSection title={t('views.crm.landlords.form.sections.kyc')} icon={ShieldCheck}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailField
                    label={t('views.crm.landlords.filters.kycStatus')}
                    value={
                      <StatusBadge tone={kycTone(profile.kycStatus)} className={LANDLORD_BADGE}>
                        {t(`views.crm.landlords.kyc.${profile.kycStatus ?? 'pending'}`)}
                      </StatusBadge>
                    }
                  />
                  <DetailField
                    label={t('views.crm.landlords.filters.status')}
                    value={
                      <StatusBadge tone={accountTone(profile.accountStatus)} className={LANDLORD_BADGE}>
                        {t(`views.crm.landlords.status.${profile.accountStatus ?? 'active'}`)}
                      </StatusBadge>
                    }
                  />
                  <DetailField label={t('views.crm.landlords.profile.assignedAgent')} value={profile.assignedAgentName || '—'} />
                  <DetailField label={t('views.crm.landlords.profile.dateCreated')} value={formatLandlordDateTime(profile.createdAt)} />
                </div>
              </ProfileSection>

              <ProfileSection title={t('views.crm.landlords.profile.tabs.properties')} icon={Building2}>
                <div className="grid gap-2 sm:grid-cols-3">
                  <DetailField label={t('views.crm.landlords.profile.propertyCount')} value={profile.propertyCount ?? 0} />
                  <DetailField label={t('views.crm.landlords.profile.totalUnits')} value={profile.totalUnits ?? 0} />
                  <DetailField label={t('views.crm.landlords.profile.monthlyIncome')} value={formatLandlordPhp(profile.monthlyRentalIncome)} />
                </div>
              </ProfileSection>
            </TabsContent>

            <TabsContent value="properties" className="mt-0">
              {(detail?.properties.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.landlords.profile.emptyProperties')}</p>
              ) : (
                <DataTable data={detail?.properties ?? []} columns={propertyColumns} keyExtractor={(r) => r.id} highlightFirstColumn={false} embedded stickyHeader compact fitWidth />
              )}
            </TabsContent>

            <TabsContent value="contracts" className="mt-0">
              {(detail?.contracts.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.landlords.profile.emptyContracts')}</p>
              ) : (
                <DataTable data={detail?.contracts ?? []} columns={contractColumns} keyExtractor={(r) => r.id} highlightFirstColumn={false} embedded stickyHeader compact fitWidth />
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-3">
              <ProfileSection title={t('views.crm.landlords.profile.tabs.documents')} icon={Upload}>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="min-w-0 space-y-1">
                    <p className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('views.crm.landlords.form.idType')}
                    </p>
                    <Select2
                      borderless={false}
                      className={PROFILE_SELECT}
                      value={docIdType}
                      onChange={(v) => setDocIdType(String(v ?? LANDLORD_ID_TYPES[0]))}
                      options={LANDLORD_ID_TYPES.map((type) => ({ value: type, label: type }))}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('views.crm.landlords.profile.documentTitle')}
                    </p>
                    <Input
                      className={PROFILE_INPUT}
                      placeholder={t('views.crm.landlords.profile.documentTitle')}
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('views.crm.landlords.profile.chooseFile')}
                    </p>
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="flex h-9 w-full items-center justify-between rounded-lg border border-dashed border-slate-200 bg-white px-3 text-left text-sm text-slate-500 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-400"
                    >
                      <span className="truncate">{docFile?.name || t('views.crm.landlords.profile.chooseFile')}</span>
                      <Upload className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                    </button>
                    <input
                      ref={docInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" className={modalPrimaryButtonClass} disabled={uploading || !docFile} onClick={() => void handleUploadDocument()}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                    {t('views.crm.landlords.profile.uploadDocument')}
                  </Button>
                </div>
              </ProfileSection>

              <div className="space-y-2">
                {(detail?.documents ?? []).map((doc: LandlordDocumentRow) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-950/80">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{doc.title}</p>
                      <p className="text-xs text-slate-500">
                        {t(`views.crm.landlords.docTypes.${doc.documentType}`)} · {formatLandlordDateTime(doc.createdAt)}
                      </p>
                    </div>
                    {doc.filePath ? (
                      <a href={doc.filePath} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-indigo-600 hover:underline">
                        {t('views.crm.landlords.profile.viewFile')}
                      </a>
                    ) : null}
                  </div>
                ))}
                {(detail?.documents.length ?? 0) === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">{t('views.crm.landlords.profile.emptyDocuments')}</p>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="mt-0">
              {(detail?.transactions.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.landlords.profile.emptyTransactions')}</p>
              ) : (
                <DataTable data={detail?.transactions ?? []} columns={transactionColumns} keyExtractor={(r) => r.id} highlightFirstColumn={false} embedded stickyHeader compact fitWidth />
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              {(detail?.activityLogs.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('views.crm.landlords.profile.emptyActivity')}</p>
              ) : (
                <DataTable data={detail?.activityLogs ?? []} columns={activityColumns} keyExtractor={(r) => r.id} highlightFirstColumn={false} embedded stickyHeader compact fitWidth />
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </Modal>
  );
}
