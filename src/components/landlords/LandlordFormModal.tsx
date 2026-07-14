import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark, Loader2, ShieldCheck, StickyNote, Upload, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Select2 } from '@/components/select2';
import {
  composeLandlordFullName,
  emptyLandlordForm,
  landlordToForm,
  LANDLORD_ID_TYPES,
} from '@/lib/landlordUtils';
import {
  createLandlord,
  fetchLandlordById,
  updateLandlord,
  uploadLandlordKycFile,
  type LandlordWriteBody,
} from '@/lib/landlordsApi';
import type { Landlord } from '@/types';

type FormState = ReturnType<typeof emptyLandlordForm>;

type PendingFiles = {
  idFront?: File;
  idBack?: File;
  proofOfAddress?: File;
};

export type LandlordFormModalProps = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  landlord: Landlord | null;
  onClose: () => void;
  onSaved: (landlord: Landlord) => void;
};

const FIELD_INPUT =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const FIELD_TEXTAREA =
  'min-h-[80px] resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

function FormField({
  label,
  children,
  className,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  span?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-1',
        span === 2 && 'sm:col-span-2',
        span === 3 && 'sm:col-span-3',
        className,
      )}
    >
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function FileUploadField({
  label,
  fileName,
  onPick,
}: {
  label: string;
  fileName?: string;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <FormField label={label}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-dashed border-slate-200 bg-white px-3 text-left text-sm text-slate-500 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-400"
      >
        <span className="truncate">{fileName || 'Choose file…'}</span>
        <Upload className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
      </button>
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

function FormSection({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-indigo-100/70 bg-white p-3 dark:border-indigo-500/20 dark:bg-slate-950/80',
        className,
      )}
    >
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

const FIELD_SELECT = '[&_.unit-form-select-control]:!min-h-9 [&_.unit-form-select-control]:!h-9';

export function LandlordFormModal({ isOpen, mode, landlord, onClose, onSaved }: LandlordFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(emptyLandlordForm());
  const [pendingFiles, setPendingFiles] = useState<PendingFiles>({});
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setForm(landlord ? landlordToForm(landlord) : emptyLandlordForm());
    setPendingFiles({});
  }, [isOpen, landlord]);

  const buildPayload = (): LandlordWriteBody => ({
    firstName: form.firstName,
    middleName: form.middleName,
    lastName: form.lastName,
    fullName: composeLandlordFullName(form),
    companyName: form.companyName,
    mobileNo: form.mobileNo,
    email: form.email,
    birthDate: form.birthDate || undefined,
    address: form.address,
    city: form.city,
    province: form.province,
    postalCode: form.postalCode,
    idType: form.idType,
    idNumber: form.idNumber,
    govIdNo: form.idNumber,
    tin: form.tin,
    bankName: form.bankName,
    accountName: form.accountName,
    accountNumber: form.accountNumber,
    gcash: form.gcash,
    maya: form.maya,
    internalNotes: form.internalNotes,
    kycStatus: form.kycStatus,
    accountStatus: form.accountStatus,
    assignedAgentId: form.assignedAgentId || undefined,
  });

  const uploadPending = async (landlordId: string) => {
    const tasks: Promise<unknown>[] = [];
    if (pendingFiles.idFront) tasks.push(uploadLandlordKycFile(landlordId, 'id_front', pendingFiles.idFront));
    if (pendingFiles.idBack) tasks.push(uploadLandlordKycFile(landlordId, 'id_back', pendingFiles.idBack));
    if (pendingFiles.proofOfAddress) {
      tasks.push(uploadLandlordKycFile(landlordId, 'proof_of_address', pendingFiles.proofOfAddress));
    }
    if (tasks.length) await Promise.all(tasks);
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload.fullName?.trim()) {
      toast.error(t('views.crm.landlords.form.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      let saved: Landlord;
      if (mode === 'edit' && landlord) {
        saved = await updateLandlord(landlord.id, payload);
        await uploadPending(landlord.id);
        saved = await fetchLandlordById(landlord.id);
      } else {
        saved = await createLandlord(payload);
        await uploadPending(saved.id);
        saved = await fetchLandlordById(saved.id);
      }
      toast.success(
        mode === 'edit' ? t('views.crm.landlords.form.updated') : t('views.crm.landlords.form.created'),
      );
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.landlords.form.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? t('views.crm.landlords.form.editTitle') : t('views.crm.landlords.form.addTitle')}
      subtitle={t('views.crm.landlords.form.subtitle')}
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
            {t('views.crm.landlords.form.save')}
          </Button>
        </div>
      }
    >
      <div className="landlord-form-modal unit-form-fields max-h-[min(68vh,36rem)] space-y-3 overflow-y-auto pr-1">
        <FormSection title={t('views.crm.landlords.form.sections.basic')} icon={User}>
          <div className="grid gap-2 sm:grid-cols-3">
            <FormField label={t('views.crm.landlords.form.firstName')}>
              <Input className={FIELD_INPUT} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.middleName')}>
              <Input className={FIELD_INPUT} value={form.middleName} onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.lastName')}>
              <Input className={FIELD_INPUT} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.companyName')} span={3}>
              <Input className={FIELD_INPUT} value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.contactNumber')}>
              <Input className={FIELD_INPUT} value={form.mobileNo} onChange={(e) => setForm((f) => ({ ...f, mobileNo: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.email')}>
              <Input className={FIELD_INPUT} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.birthDate')}>
              <Input className={FIELD_INPUT} type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.address')} span={2}>
              <Input className={FIELD_INPUT} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.city')}>
              <Input className={FIELD_INPUT} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.province')}>
              <Input className={FIELD_INPUT} value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.postalCode')}>
              <Input className={FIELD_INPUT} value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('views.crm.landlords.form.sections.kyc')} icon={ShieldCheck}>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label={t('views.crm.landlords.form.idType')}>
              <Select2
                borderless={false}
                className={FIELD_SELECT}
                placeholder={t('views.crm.landlords.form.idType')}
                value={form.idType}
                onChange={(v) => setForm((f) => ({ ...f, idType: String(v ?? '') }))}
                options={LANDLORD_ID_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </FormField>
            <FormField label={t('views.crm.landlords.form.idNumber')}>
              <Input className={FIELD_INPUT} value={form.idNumber} onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))} />
            </FormField>
            <FileUploadField label={t('views.crm.landlords.form.idFront')} fileName={pendingFiles.idFront?.name} onPick={(file) => setPendingFiles((p) => ({ ...p, idFront: file }))} />
            <FileUploadField label={t('views.crm.landlords.form.idBack')} fileName={pendingFiles.idBack?.name} onPick={(file) => setPendingFiles((p) => ({ ...p, idBack: file }))} />
            <FormField label={t('views.crm.landlords.form.tin')}>
              <Input className={FIELD_INPUT} value={form.tin} onChange={(e) => setForm((f) => ({ ...f, tin: e.target.value }))} />
            </FormField>
            <FileUploadField label={t('views.crm.landlords.form.proofOfAddress')} fileName={pendingFiles.proofOfAddress?.name} onPick={(file) => setPendingFiles((p) => ({ ...p, proofOfAddress: file }))} />
            <FormField label={t('views.crm.landlords.filters.kycStatus')}>
              <Select2
                borderless={false}
                className={FIELD_SELECT}
                value={form.kycStatus}
                onChange={(v) => setForm((f) => ({ ...f, kycStatus: (v as FormState['kycStatus']) ?? 'pending' }))}
                options={[
                  { value: 'pending', label: t('views.crm.landlords.kyc.pending') },
                  { value: 'verified', label: t('views.crm.landlords.kyc.verified') },
                  { value: 'rejected', label: t('views.crm.landlords.kyc.rejected') },
                ]}
              />
            </FormField>
            <FormField label={t('views.crm.landlords.filters.status')}>
              <Select2
                borderless={false}
                className={FIELD_SELECT}
                value={form.accountStatus}
                onChange={(v) => setForm((f) => ({ ...f, accountStatus: (v as FormState['accountStatus']) ?? 'active' }))}
                options={[
                  { value: 'active', label: t('views.crm.landlords.status.active') },
                  { value: 'inactive', label: t('views.crm.landlords.status.inactive') },
                  { value: 'suspended', label: t('views.crm.landlords.status.suspended') },
                ]}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('views.crm.landlords.form.sections.banking')} icon={Landmark}>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label={t('views.crm.landlords.form.bankName')}>
              <Input className={FIELD_INPUT} value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.accountName')}>
              <Input className={FIELD_INPUT} value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} />
            </FormField>
            <FormField label={t('views.crm.landlords.form.accountNumber')}>
              <Input className={FIELD_INPUT} value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />
            </FormField>
            <FormField label="GCash">
              <Input className={FIELD_INPUT} value={form.gcash} onChange={(e) => setForm((f) => ({ ...f, gcash: e.target.value }))} />
            </FormField>
            <FormField label="Maya">
              <Input className={FIELD_INPUT} value={form.maya} onChange={(e) => setForm((f) => ({ ...f, maya: e.target.value }))} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('views.crm.landlords.form.sections.notes')} icon={StickyNote}>
          <FormField label={t('views.crm.landlords.form.internalNotes')}>
            <Textarea
              className={FIELD_TEXTAREA}
              placeholder={t('views.crm.landlords.form.internalNotesPlaceholder')}
              value={form.internalNotes}
              onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
            />
          </FormField>
        </FormSection>
      </div>
    </Modal>
  );
}
