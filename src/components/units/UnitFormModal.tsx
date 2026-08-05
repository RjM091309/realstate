import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bath, BedDouble, Building2, ChevronDown, Plus, Ruler, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { Button, modalDismissButtonClass, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toWebpDataUrl } from '@/lib/imageWebp';
import { stripLocationOrdinalPrefix } from '@/lib/locationNames';
import { cn } from '@/lib/utils';
import {
  UNIT_FORM_FURNISHING,
  UNIT_FORM_STATUSES,
  UNIT_FORM_TYPES,
  defaultUnitForm,
  detectFloorAndTowerFromText,
  ordinalFloor,
  resolveUnitPhotos,
  unitDisplayMetrics,
  unitFormToWriteBody,
  type UnitFormState,
} from '@/lib/unitFormUtils';
import type { UnitWriteBody } from '@/lib/unitsApi';
import type { UnitStatus, UnitType } from '@/types';

const FIELD =
  'h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80';

const MAX_PHOTOS = 5;

async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Not an image');
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

/** Unit code from stored unit number — supports "101 Brgy City" or "Brgy City 101". */
function extractUnitCode(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const lead = s.match(/^(\d+[A-Za-z]?)\b/i);
  if (lead) return lead[1];
  const trail = s.match(/\b(\d+[A-Za-z]?)$/i);
  return trail ? trail[1] : '';
}

/** Clean city/brgy label for display & save (drop "1." / "2." list prefixes). */
function cleanLocationName(name: string): string {
  return stripLocationOrdinalPrefix(String(name ?? '').trim());
}

export type UnitFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  /** Prefill when opening (city / barangay from drill-down, or full unit for edit). */
  initialValues?: Partial<UnitFormState>;
  /** Existing photo when editing (legacy single). */
  initialPhoto?: string | null;
  /** Existing gallery photos when editing (up to 5). */
  initialPhotos?: string[] | null;
  /** Live City panel selection — auto-synced into the form (hidden). */
  contextArea?: string | null;
  /** Live Brgy panel selection — auto-synced into the form (hidden). */
  contextBuilding?: string | null;
  /** @deprecated City/Brgy fields are hidden; kept for call-site compatibility. */
  extraAreaOptions?: string[];
  /** @deprecated City/Brgy fields are hidden; kept for call-site compatibility. */
  extraBuildingOptions?: string[];
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
  initialPhotos = null,
  contextArea = null,
  contextBuilding = null,
  saving = false,
  onSubmit,
}: UnitFormModalProps) {
  const { t } = useTranslation();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const lastAutoVillageRef = useRef('');
  const [form, setForm] = useState<UnitFormState>(() => defaultUnitForm(initialValues));
  const [unitCode, setUnitCode] = useState(() => extractUnitCode(initialValues?.unitNumber ?? ''));
  const [villageBuilding, setVillageBuilding] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photosRef = useRef<string[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const blank = (v?: string | null) => {
    const s = String(v ?? '').trim();
    return !s || s === '—' || s === '-';
  };

  const autoVillageLabel = useCallback((brgy: string, city: string) => {
    return [cleanLocationName(brgy), cleanLocationName(city)]
      .filter((v) => !blank(v))
      .join(' · ');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Prefer selected City / Brgy panels (category source of truth).
    const area = cleanLocationName(
      !blank(contextArea)
        ? String(contextArea)
        : !blank(initialValues?.area)
          ? String(initialValues?.area)
          : '',
    );
    const building = cleanLocationName(
      !blank(contextBuilding)
        ? String(contextBuilding)
        : !blank(initialValues?.buildingName)
          ? String(initialValues?.buildingName)
          : '',
    );
    const code = extractUnitCode(initialValues?.unitNumber ?? '');
    const autoVillage = autoVillageLabel(building, area);
    // Prefer full Village/Building Name from saved legal address (do not strip custom text).
    const candidate = !blank(initialValues?.legalAddress)
      ? String(initialValues?.legalAddress).trim()
      : !blank(initialValues?.buildingName)
        ? String(initialValues?.buildingName).trim()
        : '';
    const candidateIsOnlyLocation =
      !candidate ||
      cleanLocationName(candidate) === building ||
      cleanLocationName(candidate) === area ||
      candidate === autoVillage ||
      cleanLocationName(candidate) === autoVillage;
    const village = candidateIsOnlyLocation ? autoVillage : candidate;
    lastAutoVillageRef.current = autoVillage;
    setUnitCode(code);
    setVillageBuilding(village);
    setForm(
      defaultUnitForm({
        ...initialValues,
        area,
        buildingName: building,
        legalAddress: village || building || initialValues?.legalAddress,
        // Unit No stays separate — do not bake brgy/city into unitNumber.
        unitNumber: code || extractUnitCode(initialValues?.unitNumber ?? '') || '',
      }),
    );
    const initial = resolveUnitPhotos({
      photos: initialPhotos ?? undefined,
      photoDataUrl: initialPhoto,
    });
    photosRef.current = initial;
    setPhotos(initial);
    setActivePhotoIndex(0);
    setPhotoPreviewOpen(false);
    setShowMoreDetails(false);
    setPhotoUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
    // Reset only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isOpen]);

  // Soft-sync City / Brgy from panels; refresh Village/Building only if still auto value.
  useEffect(() => {
    if (!isOpen) return;
    const ctxArea = cleanLocationName(!blank(contextArea) ? String(contextArea) : '');
    const ctxBuilding = cleanLocationName(
      !blank(contextBuilding) ? String(contextBuilding) : '',
    );

    setForm((f) => {
      const nextArea = ctxArea || f.area;
      const nextBuilding = ctxBuilding || f.buildingName;
      if (nextArea === f.area && nextBuilding === f.buildingName) return f;
      return {
        ...f,
        area: nextArea,
        buildingName: nextBuilding,
      };
    });

    const autoVillage = autoVillageLabel(ctxBuilding, ctxArea);
    setVillageBuilding((current) => {
      const trimmed = current.trim();
      const stillAuto =
        blank(trimmed) ||
        trimmed === lastAutoVillageRef.current ||
        trimmed === ctxBuilding ||
        trimmed === ctxArea;
      lastAutoVillageRef.current = autoVillage;
      return stillAuto ? autoVillage : current;
    });
  }, [isOpen, contextArea, contextBuilding, autoVillageLabel]);

  const typeOptions = useMemo(() => UNIT_FORM_TYPES.map((ut) => ({ value: ut, label: ut })), []);
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
  const floorOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const floor = `${ordinalFloor(i + 1)} Floor`;
        return { value: floor, label: floor };
      }),
    [],
  );
  const furnishingOptions = useMemo(
    () =>
      UNIT_FORM_FURNISHING.map((value) => ({
        value,
        label:
          value === 'Unfurnished'
            ? t('views.units.addModal.furnishingOptions.unfurnished')
            : value === 'Semi-furnished'
              ? t('views.units.addModal.furnishingOptions.semi')
              : t('views.units.addModal.furnishingOptions.fully'),
      })),
    [t],
  );

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || photoUploading) return;

    const current = photosRef.current;
    const slotsLeft = MAX_PHOTOS - current.length;
    if (slotsLeft <= 0) {
      toast.error(t('views.units.addModal.photoMaxReached'));
      return;
    }

    const accepted = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      toast.error(t('views.units.addModal.photoMaxReached'));
    }

    setPhotoUploading(true);
    const toastId = toast.loading(
      t('views.units.addModal.photoUploading', { count: accepted.length }),
    );

    const next: string[] = [];
    for (const file of accepted) {
      try {
        next.push(await toWebpDataUrl(file));
      } catch {
        try {
          next.push(await fileToDataUrl(file));
        } catch {
          toast.error(t('views.units.addModal.validationPhotoWebp'));
        }
      }
    }

    toast.dismiss(toastId);
    setPhotoUploading(false);

    if (next.length === 0) return;

    const merged = [...photosRef.current, ...next].slice(0, MAX_PHOTOS);
    photosRef.current = merged;
    setPhotos(merged);
    setActivePhotoIndex(Math.max(0, merged.length - 1));
    toast.success(t('views.units.addModal.photoAdded', { count: next.length }));
  }, [photoUploading, t]);

  const removePhotoAt = useCallback((index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setActivePhotoIndex((cur) => {
        if (next.length === 0) return 0;
        if (cur >= next.length) return next.length - 1;
        if (cur > index) return cur - 1;
        return cur;
      });
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const rate = Number(String(form.monthlyRate).replace(/,/g, ''));
    const code = unitCode.trim() || extractUnitCode(form.unitNumber);
    if (!code && !form.unitNumber.trim()) {
      toast.error(t('views.units.addModal.validationUnitNumber'));
      return;
    }
    // City / Brgy from category panels; Village/Building Name is manually editable.
    const area = cleanLocationName(
      !blank(contextArea) ? String(contextArea) : form.area,
    );
    const brgy = cleanLocationName(
      !blank(contextBuilding) ? String(contextBuilding) : form.buildingName,
    );
    const village = villageBuilding.trim() || autoVillageLabel(brgy, area);
    const synced: UnitFormState = {
      ...form,
      area,
      buildingName: brgy,
      legalAddress: village,
      unitNumber: code || form.unitNumber.trim(),
    };
    if (blank(synced.buildingName)) {
      const detected = detectFloorAndTowerFromText(synced.unitNumber);
      const leftover = (detected.cleaned || synced.unitNumber)
        .replace(/^\d+[a-zA-Z]?\s*/i, '')
        .trim();
      if (leftover) {
        synced.buildingName = cleanLocationName(leftover);
        if (!synced.legalAddress) synced.legalAddress = synced.buildingName;
      }
      if (blank(synced.floor) && detected.floor) synced.floor = detected.floor;
      if (blank(synced.tower) && detected.tower) synced.tower = detected.tower;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error(t('views.units.addModal.validationRate'));
      return;
    }
    await onSubmit(unitFormToWriteBody(synced, photos[0] ?? null, [], photos));
  }, [
    autoVillageLabel,
    contextArea,
    contextBuilding,
    form,
    onSubmit,
    photos,
    t,
    unitCode,
    villageBuilding,
  ]);

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
          multiple
          className="hidden"
          onChange={(e) => void handlePhotoChange(e)}
        />
        <div className="unit-form-fields grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t('views.units.addModal.photo')}</Label>
              <span className="text-xs font-medium text-slate-400">
                {t('views.units.addModal.photosCount', { count: photos.length })}
              </span>
            </div>
            <p className="text-xs text-slate-500">{t('views.units.addModal.photoHint')}</p>
            <div className="flex flex-col gap-3">
              <div className="unit-form-bordered relative aspect-[4/3] max-h-[min(20rem,50vh)] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:max-h-[22rem] dark:bg-slate-900/40">
                {photos[activePhotoIndex] ? (
                  <button
                    type="button"
                    className="flex h-full w-full cursor-zoom-in items-center justify-center"
                    onClick={() => setPhotoPreviewOpen(true)}
                  >
                    <img
                      src={photos[activePhotoIndex]}
                      alt={`Unit photo ${activePhotoIndex + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <Building2 className="h-14 w-14 sm:h-16 sm:w-16" />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {photos.map((url, idx) => (
                  <div
                    key={`${idx}-${url.slice(0, 24)}`}
                    className={cn(
                      'group relative h-16 w-20 overflow-hidden rounded-xl border-2',
                      idx === activePhotoIndex
                        ? 'border-brand-blue ring-2 ring-brand-blue/20'
                        : 'border-slate-200',
                    )}
                  >
                    <button
                      type="button"
                      className="h-full w-full"
                      onClick={() => setActivePhotoIndex(idx)}
                    >
                      <img src={url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-slate-900/70 p-0.5 text-white opacity-90 hover:bg-rose-600"
                      title={t('views.units.addModal.photoRemove')}
                      onClick={() => removePhotoAt(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {idx === 0 ? (
                      <span className="absolute bottom-1 left-1 rounded bg-brand-blue/90 px-1 py-0.5 text-[9px] font-bold text-white">
                        {t('views.units.addModal.photoCover')}
                      </span>
                    ) : null}
                  </div>
                ))}

                {photos.length < MAX_PHOTOS ? (
                  <button
                    type="button"
                    disabled={photoUploading}
                    onClick={() => photoInputRef.current?.click()}
                    className="flex h-16 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-brand-blue hover:bg-blue-50 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">
                      {t('views.units.addModal.photoAdd')}
                    </span>
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={modalOutlineButtonClass}
                  disabled={photos.length >= MAX_PHOTOS || photoUploading}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoUploading
                    ? t('views.addUnitByLocation.saving')
                    : t('views.units.addModal.photoUpload')}
                </Button>
                {photos.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-[7.5rem] rounded-xl border border-rose-200 bg-white px-4 font-medium text-rose-600 shadow-none hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    onClick={() => {
                      setPhotos([]);
                      setActivePhotoIndex(0);
                    }}
                  >
                    {t('views.units.table.delete')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loc-add-village-building">{t('views.units.addModal.unitNumber')}</Label>
            <Input
              id="loc-add-village-building"
              value={villageBuilding}
              onChange={(e) => setVillageBuilding(e.target.value)}
              placeholder="e.g. Amsic · Angeles City"
              className={FIELD}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-add-unit-number">{t('views.units.addModal.unitName')}</Label>
            <Input
              id="loc-add-unit-number"
              value={unitCode}
              onChange={(e) => {
                const code = e.target.value;
                const detected = detectFloorAndTowerFromText(code);
                setUnitCode(code);
                setForm((f) => ({
                  ...f,
                  unitNumber: code.trim(),
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
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 dark:border-slate-600 dark:bg-slate-950/40">
                <div className="space-y-2">
                  <Label>{t('views.units.addModal.floor')}</Label>
                  <Select2
                    options={floorOptions}
                    value={form.floor || null}
                    onChange={(v) => setForm((f) => ({ ...f, floor: String(v ?? '') }))}
                    placeholder="Select floor"
                    borderless={false}
                    className="[&_.unit-form-select-control]:!min-h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('views.units.addModal.categoryType')}</Label>
                  <Select2
                    options={typeOptions}
                    value={form.type}
                    onChange={(v) => {
                      const nextType = (v ?? 'Condominium') as UnitType;
                      const m = unitDisplayMetrics(nextType);
                      setForm((f) => ({
                        ...f,
                        type: nextType,
                        areaSqm: String(m.sqm),
                        bedrooms: String(m.beds),
                        bathrooms: String(m.baths),
                      }));
                    }}
                    borderless={false}
                    className="[&_.unit-form-select-control]:!min-h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-add-parking">{t('views.units.addModal.parkingSlot')}</Label>
                  <Input
                    id="loc-add-parking"
                    value={form.parkingSlot}
                    onChange={(e) => setForm((f) => ({ ...f, parkingSlot: e.target.value }))}
                    placeholder={t('views.units.addModal.parkingSlotPlaceholder')}
                    className={cn(FIELD, '!h-12 !min-h-12')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('views.units.addModal.furnishing')}</Label>
                  <Select2
                    options={furnishingOptions}
                    value={form.furnishing || null}
                    onChange={(v) => setForm((f) => ({ ...f, furnishing: String(v ?? '') }))}
                    placeholder={t('views.units.addModal.furnishingPlaceholder')}
                    borderless={false}
                    className="[&_.unit-form-select-control]:!min-h-12"
                  />
                </div>
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
          {photos[activePhotoIndex] ? (
            <img
              src={photos[activePhotoIndex]}
              alt="Photo preview"
              className="max-h-[70vh] w-full object-contain"
            />
          ) : null}
        </div>
      </Modal>
    </>
  );
}
