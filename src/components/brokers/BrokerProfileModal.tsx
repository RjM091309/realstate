import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, ModalDetailField } from '@/components/modal';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/lib/brokerUtils';
import type { BrokerAgency } from '@/types';

type ProfileTab = 'overview' | 'activity';

const TAB_TRIGGER =
  'rounded-none border-0 bg-transparent px-0 pb-2 text-sm font-medium text-slate-400 shadow-none hover:text-slate-700 data-active:bg-transparent data-active:text-slate-900 data-active:shadow-none dark:text-slate-500 dark:hover:text-slate-300 dark:data-active:text-slate-50';

const BROKER_BADGE = '!px-2 !py-0.5 !text-[10px]';

export type BrokerProfileModalProps = {
  isOpen: boolean;
  agency: BrokerAgency | null;
  initialTab?: ProfileTab;
  onClose: () => void;
  onEdit?: (agency: BrokerAgency) => void;
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
  }, [isOpen, agency?.id, initialTab, agency, t]);

  const profile = agency;
  const verification = profile ? getVerificationStatus(profile) : 'pending';
  const partnership = profile ? getPartnershipStatus(profile) : 'active';
  const activityRows = profile ? buildBrokerActivityLogs(profile, collaborations) : [];

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

  const metaBits = profile
    ? [
        profile.contactPerson,
        profile.phone,
        profile.email,
        t(`views.crm.brokers.verification.${verification}`),
        t(`views.crm.brokers.partnership.${partnership}`),
      ].filter(Boolean)
    : [];

  return (
    <Modal
      isOpen={isOpen && !!profile}
      onClose={onClose}
      title={profile ? t('views.crm.brokers.profile.title', { name: profile.name }) : ''}
      subtitle={
        profile?.lastCollaborationAt
          ? t('views.crm.brokers.profile.lastActivity', {
              date: formatBrokerDateTime(profile.lastCollaborationAt),
            })
          : undefined
      }
      maxWidth="2xl"
      variant="glass"
      compact
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
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : profile ? (
        <div className="broker-profile-modal max-h-[min(68vh,34rem)] space-y-5 overflow-y-auto pr-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">{metaBits.join(' · ')}</p>

          <dl className="grid gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:grid-cols-3 dark:border-slate-700 dark:bg-slate-900/60">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('views.crm.brokers.profile.verificationStatus')}
              </dt>
              <dd className="mt-1">
                <StatusBadge tone={verificationTone(verification)} className={BROKER_BADGE}>
                  {t(`views.crm.brokers.verification.${verification}`)}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('views.crm.brokers.profile.contractExpiry')}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {profile.expiryDate ? formatBrokerDate(profile.expiryDate) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('views.crm.brokers.totalLabel')}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {profile.collaborationCount ?? collaborations.length}
              </dd>
            </div>
          </dl>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="gap-0">
            <TabsList
              variant="line"
              className="mb-4 h-auto w-full justify-start gap-6 rounded-none border-0 bg-transparent p-0"
            >
              <TabsTrigger value="overview" className={TAB_TRIGGER}>
                {t('views.crm.brokers.profile.tabs.overview')}
              </TabsTrigger>
              <TabsTrigger value="activity" className={TAB_TRIGGER}>
                {t('views.crm.brokers.profile.tabs.activity')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-5">
              <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <ModalDetailField label={t('views.crm.brokers.agencyName')} value={profile.name} span={2} />
                  <ModalDetailField
                    label={t('views.crm.brokers.contactPersonLabel')}
                    value={profile.contactPerson || '—'}
                  />
                  <ModalDetailField label={t('views.crm.brokers.phoneLabel')} value={profile.phone || '—'} />
                  <ModalDetailField label={t('views.crm.brokers.emailLabel')} value={profile.email || '—'} />
                  <ModalDetailField
                    label={t('views.crm.brokers.profile.partnershipStatus')}
                    value={
                      <StatusBadge tone={partnershipTone(partnership)} className={BROKER_BADGE}>
                        {t(`views.crm.brokers.partnership.${partnership}`)}
                      </StatusBadge>
                    }
                  />
                  <ModalDetailField
                    label={t('views.crm.brokers.lastCollaboration')}
                    value={formatBrokerDateTime(profile.lastCollaborationAt)}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t('views.crm.brokers.profile.tabs.contracts')}
                </h3>
                {collaborations.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('views.crm.brokers.logsEmpty')}</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/60">
                    {collaborations.map((log) => (
                      <li
                        key={log.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {log.contractNo || log.contractId}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatBrokerDate(log.contractStart)} – {formatBrokerDate(log.contractEnd)}
                            {log.commissionTerms ? ` · ${log.commissionTerms}` : ''}
                          </p>
                        </div>
                        <StatusBadge
                          tone={log.contractStatus === 'Active' ? 'success' : 'neutral'}
                          className={BROKER_BADGE}
                        >
                          {log.contractStatus}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-6">
              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t('views.crm.brokers.profile.tabs.activity')}
                </h3>
                {activityRows.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('views.crm.brokers.profile.emptyActivity')}</p>
                ) : (
                  <ul className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                    {activityRows.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{row.action}</p>
                          {row.user ? <p className="text-xs text-slate-500">{row.user}</p> : null}
                        </div>
                        <p className="shrink-0 text-xs text-slate-400">
                          {formatBrokerDateTime(row.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t('views.crm.brokers.profile.tabs.documents')}
                </h3>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-dashed border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-sm hover:border-brand-blue/30 dark:border-slate-600 dark:bg-slate-950/80"
                  >
                    <span className="truncate">{docFile?.name || t('views.crm.brokers.profile.chooseFile')}</span>
                    <Upload className="h-3.5 w-3.5 shrink-0 text-brand-blue" aria-hidden />
                  </button>
                  <input
                    ref={docInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      className={modalPrimaryButtonClass}
                      disabled={uploading || !docFile}
                      onClick={() => void handleUpload()}
                    >
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                      {t('views.crm.brokers.profile.upload')}
                    </Button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 dark:divide-slate-800 dark:border-slate-700">
                  {BROKER_DOCUMENT_TYPES.map((docType) => {
                    const isUploaded =
                      profile.documentType === docType || (docType === 'Government ID' && profile.filePath);
                    const showFile =
                      docType === profile.documentType || (docType === 'PRC License' && profile.filePath);
                    return (
                      <div
                        key={docType}
                        className="flex items-center justify-between gap-3 bg-white px-4 py-3 text-sm dark:bg-slate-900/60"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{docType}</p>
                          <p className="text-xs text-slate-500">
                            {isUploaded ? formatBrokerDate(profile.expiryDate) : t('views.crm.brokers.profile.notUploaded')}
                          </p>
                        </div>
                        {showFile && profile.filePath ? (
                          <a
                            href={resolveUploadUrl(profile.filePath)}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-xs font-medium text-brand-blue hover:underline"
                          >
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
              </section>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </Modal>
  );
}
