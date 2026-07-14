import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/modal';
import { Button, modalDismissButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/select2';
import { createBlacklistRecord } from '@/lib/blacklistApi';
import type { BlacklistFormState } from '@/lib/blacklistUtils';
import { emptyBlacklistForm } from '@/lib/blacklistUtils';

type BlacklistFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const FIELD_INPUT =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const FIELD_TEXTAREA =
  'min-h-[80px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100';

const FIELD_SELECT = '[&_.unit-form-select-control]:!min-h-9 [&_.unit-form-select-control]:!h-9';

export function BlacklistFormModal({ isOpen, onClose, onSaved }: BlacklistFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<BlacklistFormState>(emptyBlacklistForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyBlacklistForm());
      setError('');
      setSaving(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    const name = form.name.trim();
    const reason = form.reason.trim();
    if (!name || !reason) {
      setError(t('views.crm.blacklist.form.validation'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createBlacklistRecord({
        entityType: form.entityType,
        name,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        governmentId: form.governmentId.trim() || undefined,
        reason,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('views.crm.blacklist.form.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('views.crm.blacklist.form.title')}
      subtitle={t('views.crm.blacklist.form.subtitle')}
      maxWidth="lg"
      variant="glass"
      compact
      shellClassName="crm-form-modal-shell"
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button type="button" className={modalDismissButtonClass} onClick={onClose} disabled={saving}>
            {t('views.crm.blacklist.form.cancel')}
          </Button>
          <Button type="button" className={modalPrimaryButtonClass} onClick={() => void handleSave()} disabled={saving}>
            {t('views.crm.blacklist.form.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('views.crm.blacklist.form.entityType')}</Label>
            <Select2
              borderless={false}
              className={FIELD_SELECT}
              value={form.entityType}
              onChange={(v) => setForm((f) => ({ ...f, entityType: v as BlacklistFormState['entityType'] }))}
              options={[
                { value: 'tenant', label: t('views.crm.blacklist.tenant') },
                { value: 'broker', label: t('views.crm.blacklist.broker') },
              ]}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('views.crm.blacklist.name')}</Label>
            <Input
              className={FIELD_INPUT}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('views.crm.blacklist.form.namePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('views.crm.blacklist.form.email')}</Label>
            <Input
              type="email"
              className={FIELD_INPUT}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('views.crm.blacklist.form.phone')}</Label>
            <Input
              className={FIELD_INPUT}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('views.crm.blacklist.form.governmentId')}</Label>
            <Input
              className={FIELD_INPUT}
              value={form.governmentId}
              onChange={(e) => setForm((f) => ({ ...f, governmentId: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('views.crm.blacklist.reason')}</Label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              className={FIELD_TEXTAREA}
              placeholder={t('views.crm.blacklist.form.reasonPlaceholder')}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
