import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bath, BedDouble, Building2, ChevronDown, Ruler } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { Button, modalDismissButtonClass, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toWebpDataUrl } from '@/lib/imageWebp';
import { cn } from '@/lib/utils';
import {
  UNIT_FORM_STATUSES,
  defaultUnitForm,
  detectFloorAndTowerFromText,
  unitFormToWriteBody,
  type UnitFormState,
} from '@/lib/unitFormUtils';
import type { UnitWriteBody } from '@/lib/unitsApi';
import type { UnitStatus } from '@/types';

const FIELD =
  'h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80';

export type UnitFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  /** Prefill when opening (city / barangay from drill-down, or full unit for edit). */
  initialValues?: Partial<UnitFormState>;
  /** Existing photo when editing. */
  initialPhoto?: string | null;
  /** Live City panel selection — always synced into save payload. */
  contextArea?: string | null;
  /** Live Brgy panel selection — always synced into save payload + form. */
  contextBuilding?: string | null;
  /** @deprecated Area field is hidden; kept for call-site compatibility. */
  extraAreaOptions?: string[];
  saving?: boolean;
  onSubmit: (body: UnitWriteBody) => Promise<void> | void;
};

/** Add / Edit Unit modal for Area/Unit drill-down. */
export function UnitFormModal({
  isOpen,
  onClose,
  mode = 'create',
  initialValues,
  initialPhoto = null,
  contextArea = null,
  contextBuilding = null,
  saving = false,
  onSubmit,
}: UnitFormModalProps) {
  const { t } = useTranslation();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<UnitFormState>(() => defaultUnitForm(initialValues));
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const blank = (v?: string | null) => {
    const s = String(v ?? '').trim();
    return !s || s === '—' || s === '-';
  };

  useEffect(() => {
    if (!isOpen) return;
    const area = !blank(initialValues?.area)
      ? String(initialValues?.area)
      : !blank(contextArea)
        ? String(contextArea)
        : '';
    const building = !blank(initialValues?.buildingName)
      ? String(initialValues?.buildingName)
      : !blank(contextBuilding)
        ? String(contextBuilding)
        : '';
    setForm(
      defaultUnitForm({
        ...initialValues,
        area: area || initialValues?.area,
        buildingName: building || initialValues?.buildingName,
        legalAddress: building || initialValues?.legalAddress,
      }),
    );
    setPhotoPreview(String(initialPhoto ?? '').trim());
    setPhotoPreviewOpen(false);
    setShowMoreDetails(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
    // Reset when modal opens or panel context changes while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isOpen, contextArea, contextBuilding]);

  // Keep City / Brgy synced from panels while the modal is open (hidden fields).
  useEffect(() => {
    if (!isOpen) return;
    setForm((f) => {
      const nextArea = !blank(contextArea) ? String(contextArea).trim() : f.area;
      const nextBuilding = !blank(contextBuilding) ? String(contextBuilding).trim() : f.buildingName;
      if (nextArea === f.area && nextBuilding === f.buildingName) return f;
      return {
        ...f,
        area: nextArea,
        buildingName: nextBuilding,
        legalAddress: nextBuilding || f.legalAddress,
      };
    });
  }, [isOpen, contextArea, contextBuilding]);

  const statusOptions = useMemo(
    () =>
      UNIT_FORM_STATUSES.map((s) => ({
        value: s,
        label:
          s === 'Available'
            ? t('views.units.statuses.available')
            : s === 'Occupied'
              ? t('views.units.statuses.occupied')
              : s === 'Maintenance'
                ? t('views.units.statuses.maintenance')
                : t('views.units.statuses.reserved'),
      })),
    [t],
  );
  const handlePhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await toWebpDataUrl(file);
        setPhotoPreview(dataUrl);
      } catch {
        toast.error(t('views.units.addModal.validationPhotoWebp'));
      }
      e.target.value = '';
    },
    [t],
  );

  const handleSave = useCallback(async () => {
    const rate = Number(String(form.monthlyRate).replace(/,/g, ''));
    if (!form.unitNumber.trim()) {
      toast.error(t('views.units.addModal.validationUnitNumber'));
      return;
    }
    // City / Brgy come from location panels (hidden fields) — sync before save.
    const synced: UnitFormState = {
      ...form,
      area: !blank(contextArea) ? String(contextArea).trim() : form.area,
      buildingName: !blank(contextBuilding) ? String(contextBuilding).trim() : form.buildingName,
      legalAddress: !blank(contextBuilding)
        ? String(contextBuilding).trim()
        : form.legalAddress,
    };
    // If brgy is still blank, recover from free-text in unit number
    // e.g. "301 3rd Floor The Sharp Clark Hills" → building "The Sharp Clark Hills"
    if (blank(synced.buildingName)) {
      const detected = detectFloorAndTowerFromText(synced.unitNumber);
      const leftover = (detected.cleaned || synced.unitNumber)
        .replace(/^\d+[a-zA-Z]?\s*/i, '')
        .trim();
      if (leftover) {
        synced.buildingName = leftover;
        synced.legalAddress = leftover;
      }
      if (blank(synced.floor) && detected.floor) synced.floor = detected.floor;
      if (blank(synced.tower) && detected.tower) synced.tower = detected.tower;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error(t('views.units.addModal.validationRate'));
      return;
    }
    await onSubmit(unitFormToWriteBody(synced, photoPreview || null));
  }, [contextArea, contextBuilding, form, onSubmit, photoPreview, t]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!saving) onClose();
        }}
        title={
          mode === 'edit' ? t('views.units.editModal.title') : t('views.units.addModal.title')
        }
        maxWidth="3xl"
        variant="default"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button
              type="button"
              className={modalDismissButtonClass}
              disabled={saving}
              onClick={onClose}
            >
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className={modalPrimaryButtonClass}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving
                ? t('views.addUnitByLocation.saving')
                : mode === 'edit'
                  ? t('views.units.editModal.save')
                  : t('views.units.addModal.save')}
            </Button>
          </div>
        }
      >
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handlePhotoChange(e)}
        />
        <div className="unit-form-fields grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.units.addModal.photo')}</Label>
            <div className="flex flex-col gap-3">
              <div className="unit-form-bordered relative aspect-[4/3] max-h-[min(20rem,50vh)] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:max-h-[22rem] dark:bg-slate-900/40">
                {photoPreview ? (
                  <button
                    type="button"
                    className="flex h-full w-full cursor-zoom-in items-center justify-center"
                    onClick={() => setPhotoPreviewOpen(true)}
                  >
                    <img
                      src={photoPreview}
                      alt="Unit photo preview"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <Building2 className="h-14 w-14 sm:h-16 sm:w-16" />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={modalOutlineButtonClass}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {t('views.units.addModal.photoUpload')}
                </Button>
                {photoPreview ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-[7.5rem] rounded-xl border border-rose-200 bg-white px-4 font-medium text-rose-600 shadow-none hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    onClick={() => setPhotoPreview('')}
                  >
                    {t('views.units.table.delete')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="loc-add-unit-number">{t('views.units.addModal.unitNumber')}</Label>
            <Input
              id="loc-add-unit-number"
              value={form.unitNumber}
              onChange={(e) => {
                const unitNumber = e.target.value;
                const detected = detectFloorAndTowerFromText(unitNumber);
                setForm((f) => ({
                  ...f,
                  unitNumber,
                  // Auto-fill empty floor/tower from unit text (e.g. "301 3rd Floor Tower wings")
                  floor: f.floor.trim() ? f.floor : detected.floor,
                  tower: f.tower.trim() ? f.tower : detected.tower,
                }));
              }}
              placeholder="e.g. 1201"
              className={FIELD}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/50 dark:hover:bg-slate-900"
              onClick={() => setShowMoreDetails((v) => !v)}
              aria-expanded={showMoreDetails}
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('views.units.addModal.moreDetails')}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200',
                  showMoreDetails && 'rotate-180',
                )}
              />
            </button>
            {showMoreDetails ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-950/40">
                <Textarea
                  id="loc-add-more-details"
                  value={form.moreDetails}
                  onChange={(e) => setForm((f) => ({ ...f, moreDetails: e.target.value }))}
                  placeholder={t('views.units.addModal.moreDetailsPlaceholder')}
                  rows={3}
                  className="min-h-[88px] resize-y rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t('views.units.addModal.status')}</Label>
            <Select2
              options={statusOptions}
              value={form.status}
              onChange={(v) =>
                setForm((f) => ({ ...f, status: (v ?? 'Available') as UnitStatus }))
              }
              borderless={false}
              className="[&_.unit-form-select-control]:!min-h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-add-rate">{t('views.units.addModal.monthlyRate')}</Label>
            <Input
              id="loc-add-rate"
              type="text"
              inputMode="decimal"
              value={form.monthlyRate}
              onChange={(e) => setForm((f) => ({ ...f, monthlyRate: e.target.value }))}
              placeholder="35000"
              className={FIELD}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.units.addModal.layoutMetrics')}</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="relative">
                <Ruler
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.areaSqm}
                  onChange={(e) => setForm((f) => ({ ...f, areaSqm: e.target.value }))}
                  placeholder={t('views.units.addModal.sqm')}
                  aria-label={t('views.units.addModal.sqm')}
                  className={`${FIELD} pl-9`}
                />
              </div>
              <div className="relative">
                <BedDouble
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.bedrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                  placeholder={t('views.units.addModal.bedrooms')}
                  aria-label={t('views.units.addModal.bedrooms')}
                  className={`${FIELD} pl-9`}
                />
              </div>
              <div className="relative">
                <Bath
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.bathrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                  placeholder={t('views.units.addModal.bathrooms')}
                  aria-label={t('views.units.addModal.bathrooms')}
                  className={`${FIELD} pl-9`}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="loc-add-special-remarks">{t('views.units.addModal.specialRemarks')}</Label>
            <Textarea
              id="loc-add-special-remarks"
              value={form.specialRemarks}
              onChange={(e) => setForm((f) => ({ ...f, specialRemarks: e.target.value }))}
              placeholder={t('views.units.addModal.specialRemarksPlaceholder')}
              rows={3}
              className="min-h-[88px] resize-y rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={photoPreviewOpen}
        onClose={() => setPhotoPreviewOpen(false)}
        title={t('views.units.addModal.photo')}
        maxWidth="3xl"
        footer={
          <div className="flex w-full justify-end">
            <Button
              type="button"
              className={modalDismissButtonClass}
              onClick={() => setPhotoPreviewOpen(false)}
            >
              {t('views.units.details.close')}
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {photoPreview ? (
            <img src={photoPreview} alt="Photo preview" className="max-h-[70vh] w-full object-contain" />
          ) : null}
        </div>
      </Modal>
    </>
  );
}
