import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  Building2,
  Handshake,
  Loader2,
  ShieldCheck,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Select2 } from '@/components/select2';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';
import {
  BROKER_BUSINESS_TYPES,
  BROKER_DOCUMENT_TYPES,
  BROKER_GOV_DOC_TYPES,
  brokerFormToApiPayload,
  brokerToForm,
  emptyBrokerForm,
  type BrokerFormState,
} from '@/lib/brokerUtils';
import {
  createPartnerAgency,
  updatePartnerAgency,
  uploadPartnerAgencyKycDocument,
} from '@/lib/partnerAgenciesApi';
import type { BrokerAgency } from '@/types';

const FIELD_INPUT =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const FIELD_TEXTAREA =
  'min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const FIELD_SELECT = '[&_.unit-form-select-control]:!min-h-9 [&_.unit-form-select-control]:!h-9';

const NATIONALITIES = [
  { code: 'PHL', label: 'Philippines' },
  { code: 'KOR', label: 'Korea' },
  { code: 'USA', label: 'United States' },
  { code: 'JPN', label: 'Japan' },
  { code: 'CHN', label: 'China' },
  { code: 'SGP', label: 'Singapore' },
] as const;

export type BrokerFormModalProps = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  agency: BrokerAgency | null;
  onClose: () => void;
  onSaved: (agency: BrokerAgency) => void;
};

function FormField({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2 | 3;
}) {
  return (
    <div className={cn('min-w-0 space-y-1', span === 2 && 'sm:col-span-2', span === 3 && 'sm:col-span-3')}>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function FormSection({
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

const BUSINESS_DOC_UPLOAD_KEYS = BROKER_DOCUMENT_TYPES.slice(0, 4);
const PRIMARY_DOC_KEY = 'KYC';

function DocUploadField({
  label,
  fileName,
  chooseLabel,
  span = 1,
  onPick,
  onClear,
}: {
  label: string;
  fileName?: string;
  chooseLabel: string;
  span?: 1 | 2;
  onPick: (file: File) => void;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFile = Boolean(fileName);
  return (
    <FormField label={label} span={span}>
      <div
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border bg-white px-3 shadow-sm dark:bg-slate-950/80',
          hasFile
            ? 'border-indigo-200 dark:border-indigo-500/40'
            : 'border-dashed border-slate-200 dark:border-slate-600',
        )}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm transition"
        >
          <span
            className={cn(
              'truncate',
              hasFile ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {fileName || chooseLabel}
          </span>
          <Upload className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
        </button>
        {hasFile && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[11px] font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
            aria-label="Clear file"
          >
            Clear
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </FormField>
  );
}

export function BrokerFormModal({ isOpen, mode, agency, onClose, onSaved }: BrokerFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<BrokerFormState>(emptyBrokerForm());
  const [pendingDocs, setPendingDocs] = useState<Partial<Record<string, File>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(agency ? brokerToForm(agency) : emptyBrokerForm());
    setPendingDocs({});
  }, [isOpen, agency]);

  const resolveUploadFile = (): File | null => {
    if (pendingDocs[PRIMARY_DOC_KEY]) return pendingDocs[PRIMARY_DOC_KEY] ?? null;
    for (const key of BUSINESS_DOC_UPLOAD_KEYS) {
      if (pendingDocs[key]) return pendingDocs[key] ?? null;
    }
    return null;
  };

  const setDocFile = (key: string, file: File | undefined) => {
    setPendingDocs((prev) => {
      const next = { ...prev };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.agencyName.trim()) {
      toast.error(t('views.crm.brokers.validationName'));
      return;
    }
    setSaving(true);
    try {
      const payload = brokerFormToApiPayload(form);
      const fileToUpload = resolveUploadFile();
      let saved: BrokerAgency;
      if (mode === 'edit' && agency) {
        saved = await updatePartnerAgency(agency.id, payload);
        if (fileToUpload) saved = await uploadPartnerAgencyKycDocument(agency.id, fileToUpload);
      } else {
        saved = await createPartnerAgency(payload);
        if (fileToUpload) saved = await uploadPartnerAgencyKycDocument(saved.id, fileToUpload);
      }
      toast.success(mode === 'edit' ? t('views.crm.brokers.updated') : t('views.crm.brokers.created'));
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const dateField = (key: keyof BrokerFormState, label: string) => (
    <FormField label={label}>
      <AppDatePicker
        mode="single"
        placeholder="MM/DD/YYYY"
        fullWidth
        inputClassName={FIELD_INPUT}
        value={form[key] ? parseISO(String(form[key])) : null}
        onChange={(picked) =>
          setForm((f) => ({
            ...f,
            [key]: picked instanceof Date ? format(picked, 'yyyy-MM-dd') : '',
          }))
        }
      />
    </FormField>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? t('views.crm.brokers.form.editTitle') : t('views.crm.brokers.form.addTitle')}
      subtitle={t('views.crm.brokers.form.subtitle')}
      maxWidth="4xl"
      variant="glass"
      compact
      shellClassName="crm-form-modal-shell"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={onClose} disabled={saving}>
            {t('views.crm.blacklist.close')}
          </Button>
          <Button type="button" className={modalPrimaryButtonClass} onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t('views.crm.brokers.form.save')}
          </Button>
        </div>
      }
    >
      <div className="broker-form-modal max-h-[min(68vh,36rem)] space-y-3 overflow-y-auto pr-1">
        <FormSection title={t('views.crm.brokers.form.sections.agency')} icon={Building2}>
          <div className="grid gap-2 sm:grid-cols-3">
            <FormField label={t('views.crm.brokers.form.agencyName')} span={2}>
              <Input className={FIELD_INPUT} value={form.agencyName} onChange={(e) => setForm((f) => ({ ...f, agencyName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.businessType')}>
              <Select2
                borderless={false}
                className={FIELD_SELECT}
                value={form.businessType}
                onChange={(v) => setForm((f) => ({ ...f, businessType: String(v ?? '') }))}
                options={BROKER_BUSINESS_TYPES.map((x) => ({ value: x, label: x }))}
                placeholder="Select type"
              />
            </FormField>
            <FormField label={t('views.crm.brokers.form.businessRegName')} span={2}>
              <Input className={FIELD_INPUT} value={form.businessRegistrationName} onChange={(e) => setForm((f) => ({ ...f, businessRegistrationName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.website')}>
              <Input className={FIELD_INPUT} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.officeAddress')} span={3}>
              <Input className={FIELD_INPUT} value={form.officeAddress} onChange={(e) => setForm((f) => ({ ...f, officeAddress: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.city')}>
              <Input className={FIELD_INPUT} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.province')}>
              <Input className={FIELD_INPUT} value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.postalCode')}>
              <Input className={FIELD_INPUT} value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('views.crm.brokers.form.sections.broker')} icon={User}>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label={t('views.crm.brokers.form.brokerFullName')} span={2}>
              <Input className={FIELD_INPUT} value={form.brokerFullName} onChange={(e) => setForm((f) => ({ ...f, brokerFullName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.prcLicense')}>
              <Input className={FIELD_INPUT} value={form.prcLicenseNo} onChange={(e) => setForm((f) => ({ ...f, prcLicenseNo: e.target.value }))} />
            </FormField>
            {dateField('prcLicenseExpiry', t('views.crm.brokers.form.prcExpiry'))}
            <FormField label={t('views.crm.brokers.form.brokerMobile')}>
              <Input className={FIELD_INPUT} value={form.brokerMobile} onChange={(e) => setForm((f) => ({ ...f, brokerMobile: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.brokerEmail')}>
              <Input className={FIELD_INPUT} type="email" value={form.brokerEmail} onChange={(e) => setForm((f) => ({ ...f, brokerEmail: e.target.value }))} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('views.crm.brokers.form.sections.contact')} icon={Users}>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label={t('views.crm.brokers.form.telephone')}>
              <Input className={FIELD_INPUT} value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.phoneLabel')}>
              <Input className={FIELD_INPUT} value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.emailLabel')}>
              <Input className={FIELD_INPUT} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.website')}>
              <Input className={FIELD_INPUT} value={form.contactWebsite} onChange={(e) => setForm((f) => ({ ...f, contactWebsite: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.facebook')} span={2}>
              <Input className={FIELD_INPUT} value={form.facebookPage} onChange={(e) => setForm((f) => ({ ...f, facebookPage: e.target.value }))} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('views.crm.brokers.form.sections.partnership')} icon={Handshake}>
          <div className="grid gap-2 sm:grid-cols-3">
            {dateField('partnershipDate', t('views.crm.brokers.form.partnershipDate'))}
            {dateField('contractStart', t('views.crm.brokers.form.contractStart'))}
            {dateField('contractEnd', t('views.crm.brokers.form.contractEnd'))}
            <FormField label={t('views.crm.brokers.form.accountManager')} span={2}>
              <Input className={FIELD_INPUT} value={form.assignedAccountManager} onChange={(e) => setForm((f) => ({ ...f, assignedAccountManager: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.brokers.form.nationality')}>
              <Select2
                borderless={false}
                className={FIELD_SELECT}
                value={form.nationality}
                onChange={(v) => setForm((f) => ({ ...f, nationality: String(v ?? '') }))}
                options={NATIONALITIES.map((x) => ({ value: x.code, label: `${x.label} (${x.code})` }))}
                placeholder="Select"
              />
            </FormField>
            <FormField label={t('views.crm.brokers.form.internalNotes')} span={3}>
              <Textarea className={FIELD_TEXTAREA} value={form.internalNotes} onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('views.crm.brokers.form.sections.documents')} icon={ShieldCheck}>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label={t('views.crm.brokers.form.documentType')}>
              <Select2
                borderless={false}
                className={FIELD_SELECT}
                value={form.documentType}
                onChange={(v) => setForm((f) => ({ ...f, documentType: String(v ?? '') }))}
                options={BROKER_GOV_DOC_TYPES.map((x) => ({ value: x, label: x }))}
                placeholder={t('views.crm.brokers.form.documentType')}
              />
            </FormField>
            <FormField label={t('views.crm.brokers.form.documentNo')}>
              <Input className={FIELD_INPUT} value={form.documentNo} onChange={(e) => setForm((f) => ({ ...f, documentNo: e.target.value }))} />
            </FormField>
            {BUSINESS_DOC_UPLOAD_KEYS.map((docType) => (
              <DocUploadField
                key={docType}
                label={docType}
                chooseLabel={t('views.crm.brokers.profile.chooseFile')}
                fileName={pendingDocs[docType]?.name}
                onPick={(file) => setDocFile(docType, file)}
                onClear={() => setDocFile(docType, undefined)}
              />
            ))}
            <DocUploadField
              label={t('views.crm.brokers.form.primaryKyc')}
              chooseLabel={t('views.crm.brokers.profile.chooseFile')}
              span={2}
              fileName={
                pendingDocs[PRIMARY_DOC_KEY]?.name ||
                (form.filePath && !Object.keys(pendingDocs).length ? t('views.crm.brokers.profile.onFile') : undefined)
              }
              onPick={(file) => setDocFile(PRIMARY_DOC_KEY, file)}
              onClear={() => setDocFile(PRIMARY_DOC_KEY, undefined)}
            />
          </div>
        </FormSection>
      </div>
    </Modal>
  );
}
