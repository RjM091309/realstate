import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, modalFieldLabelClass } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select2 } from '@/components/select2';
import { fetchLandlordDetail, uploadLandlordDocument } from '@/lib/landlordsApi';
import {
  formatLandlordDateTime,
  formatLandlordPhp,
  LANDLORD_ID_TYPES,
} from '@/lib/landlordUtils';
import { cn } from '@/lib/utils';
import type { Landlord, LandlordDetailPayload, LandlordDocumentRow } from '@/types';

type ProfileTab = 'overview' | 'activity';

const TAB_TRIGGER =
  'rounded-none border-0 bg-transparent px-0 pb-2 text-sm font-medium text-slate-400 shadow-none hover:text-slate-700 data-active:bg-transparent data-active:text-slate-900 data-active:shadow-none dark:text-slate-500 dark:hover:text-slate-300 dark:data-active:text-slate-50';

const PROFILE_SELECT = '[&_.unit-form-select-control]:!min-h-9 [&_.unit-form-select-control]:!h-9';

function formatPersonName(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  if (raw !== raw.toUpperCase() || raw.length < 3) return raw;
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatEmail(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw.toLowerCase();
}

function DetailField({
  label,
  value,
  span = 1,
  className,
}: {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', span === 2 && 'sm:col-span-2', className)}>
      <div className={modalFieldLabelClass}>{label}</div>
      <div className="mt-0.5 text-sm font-medium normal-case leading-snug text-slate-900 dark:text-slate-100">
        {value ?? '—'}
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

export type LandlordProfileModalProps = {
  isOpen: boolean;
  landlord: Landlord | null;
  initialTab?: ProfileTab;
  onClose: () => void;
  onEdit?: (landlord: Landlord) => void;
};

export function LandlordProfileModal({
  isOpen,
  landlord,
  initialTab = 'overview',
  onClose,
  onEdit,
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
  }, [isOpen, landlord?.id, initialTab, landlord, t]);

  const profile = detail?.landlord ?? landlord;

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

  const addressLine = profile
    ? [profile.address, profile.city, profile.province].filter(Boolean).join(', ')
    : '';

  return (
    <Modal
      isOpen={isOpen && !!profile}
      onClose={onClose}
      title={
        profile
          ? t('views.crm.landlords.profile.title', { name: formatPersonName(profile.fullName) })
          : ''
      }
      subtitle={
        profile?.createdAt
          ? t('views.crm.landlords.profile.registered', { date: formatLandlordDateTime(profile.createdAt) })
          : undefined
      }
      maxWidth="2xl"
      variant="glass"
      compact
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" className={modalOutlineButtonClass} onClick={onClose}>
            {t('views.crm.blacklist.close')}
          </Button>
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
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : profile ? (
        <div className="landlord-profile-modal max-h-[min(68vh,34rem)] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={kycTone(profile.kycStatus)}>
              {t(`views.crm.landlords.kyc.${profile.kycStatus ?? 'pending'}`)}
            </StatusBadge>
            <StatusBadge tone={accountTone(profile.accountStatus)}>
              {t(`views.crm.landlords.status.${profile.accountStatus ?? 'active'}`)}
            </StatusBadge>
          </div>

          <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800/40">
            <div>
              <p className={modalFieldLabelClass}>{t('views.crm.landlords.profile.propertyCount')}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {profile.propertyCount ?? 0}
              </p>
            </div>
            <div>
              <p className={modalFieldLabelClass}>{t('views.crm.landlords.profile.totalUnits')}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {profile.totalUnits ?? 0}
              </p>
            </div>
            <div>
              <p className={modalFieldLabelClass}>{t('views.crm.landlords.profile.monthlyIncome')}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-brand-blue dark:text-blue-300">
                {formatLandlordPhp(profile.monthlyRentalIncome)}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="gap-0">
            <TabsList
              variant="line"
              className="mb-3 h-auto w-full justify-start gap-6 rounded-none border-0 bg-transparent p-0"
            >
              <TabsTrigger value="overview" className={TAB_TRIGGER}>
                {t('views.crm.landlords.profile.tabs.overview')}
              </TabsTrigger>
              <TabsTrigger value="activity" className={TAB_TRIGGER}>
                {t('views.crm.landlords.profile.tabs.activity')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label={t('views.crm.landlords.form.email')} value={formatEmail(profile.email)} />
                <DetailField
                  label={t('views.crm.landlords.form.contactNumber')}
                  value={profile.mobileNo || '—'}
                />
                {addressLine ? (
                  <DetailField label={t('views.crm.landlords.form.address')} value={addressLine} span={2} />
                ) : null}
                {profile.assignedAgentName ? (
                  <DetailField
                    label={t('views.crm.landlords.profile.assignedAgent')}
                    value={formatPersonName(profile.assignedAgentName)}
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <p className={modalFieldLabelClass}>{t('views.crm.landlords.profile.tabs.properties')}</p>
                {(detail?.properties.length ?? 0) === 0 ? (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Building2 className="h-4 w-4" aria-hidden />
                    </div>
                    <p className="text-sm text-slate-500">{t('views.crm.landlords.profile.emptyProperties')}</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                    {detail?.properties.map((property) => (
                      <li
                        key={property.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium normal-case text-slate-900 dark:text-slate-100">
                            {property.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {property.propertyType}
                            {property.address ? ` · ${property.address}` : ''}
                            {' · '}
                            {property.units} {t('views.crm.landlords.profile.columns.units').toLowerCase()}
                          </p>
                        </div>
                        <StatusBadge tone={property.status === 'Active' ? 'success' : 'neutral'}>
                          {property.status}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-5">
              <div className="space-y-2">
                <p className={modalFieldLabelClass}>{t('views.crm.landlords.profile.tabs.activity')}</p>
                {(detail?.activityLogs.length ?? 0) === 0 ? (
                  <p className="text-sm text-slate-500">{t('views.crm.landlords.profile.emptyActivity')}</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                    {detail?.activityLogs.map((log) => (
                      <li
                        key={log.id}
                        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
                      >
                        <p className="font-medium normal-case text-slate-900 dark:text-slate-100">
                          {log.changeSummary || log.action}
                        </p>
                        <p className="shrink-0 text-xs text-slate-400">
                          {formatLandlordDateTime(log.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <p className={modalFieldLabelClass}>{t('views.crm.landlords.profile.tabs.documents')}</p>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className={modalFieldLabelClass}>{t('views.crm.landlords.form.idType')}</p>
                      <Select2
                        borderless={false}
                        className={PROFILE_SELECT}
                        value={docIdType}
                        onChange={(v) => setDocIdType(String(v ?? LANDLORD_ID_TYPES[0]))}
                        options={LANDLORD_ID_TYPES.map((type) => ({ value: type, label: type }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className={modalFieldLabelClass}>{t('views.crm.landlords.profile.documentTitle')}</p>
                      <Input
                        className="h-9 normal-case"
                        placeholder={t('views.crm.landlords.profile.documentTitle')}
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="flex min-h-9 flex-1 items-center justify-between rounded-lg border border-dashed border-slate-200 bg-white px-3 text-left text-sm normal-case text-slate-500 transition hover:border-brand-blue/40 dark:border-slate-600 dark:bg-slate-950/80"
                    >
                      <span className="truncate">{docFile?.name || t('views.crm.landlords.profile.chooseFile')}</span>
                      <Upload className="h-3.5 w-3.5 shrink-0 text-brand-blue" aria-hidden />
                    </button>
                    <input
                      ref={docInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      className={modalPrimaryButtonClass}
                      disabled={uploading || !docFile}
                      onClick={() => void handleUploadDocument()}
                    >
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                      {t('views.crm.landlords.profile.uploadDocument')}
                    </Button>
                  </div>
                </div>

                {(detail?.documents.length ?? 0) === 0 ? (
                  <p className="text-sm text-slate-500">{t('views.crm.landlords.profile.emptyDocuments')}</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                    {(detail?.documents ?? []).map((doc: LandlordDocumentRow) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium normal-case text-slate-900 dark:text-slate-100">
                            {doc.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t(`views.crm.landlords.docTypes.${doc.documentType}`)} ·{' '}
                            {formatLandlordDateTime(doc.createdAt)}
                          </p>
                        </div>
                        {doc.filePath ? (
                          <a
                            href={doc.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-xs font-medium text-brand-blue hover:underline"
                          >
                            {t('views.crm.landlords.profile.viewFile')}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </Modal>
  );
}
