import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  X,
  MapPin,
  Building,
  Building2,
  Bed,
  Bath,
  Maximize2,
  Layers,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  Edit,
  Expand,
  Package,
  ChevronLeft,
  ChevronRight,
  Car,
  Armchair,
  DollarSign,
  Tag,
  Sparkles,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { stripLocationOrdinalPrefix } from '@/lib/locationNames';
import { computeContractLedgerMetrics } from '@/lib/ledgerUtils';
import {
  formatUnitNumberDisplay,
  resolveUnitFloorTower,
  resolveUnitPhotos,
  unitDisplayMetrics,
} from '@/lib/unitFormUtils';
import type { Contract, Payment, Tenant, Unit, UnitStatus } from '@/types';

/** Temporarily hidden — set to true to show Property Info / Specs / Contract sections again. */
const SHOW_EXTENDED_DETAIL_SECTIONS = false;

export type UnitDetailsModalProps = {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (unit: Unit) => void;
  canEdit?: boolean;
  /** Optional city/area override (e.g. selected location board city). */
  cityLabel?: string;
  /** Optional barangay/building override. */
  buildingLabel?: string;
  activeContract?: Contract | null;
  currentTenant?: Tenant | null;
  payments?: Payment[];
};

function normalizeAreaLabel(rawArea: string): string {
  const area = String(rawArea ?? '').trim();
  if (!area) return '';
  if (area === 'Makati') return 'Makati City';
  if (area === 'Pasig') return 'Pasig City';
  if (area === 'BGC') return 'Taguig City';
  return area;
}

function resolveMetrics(unit: Unit): { sqm: string; beds: string; baths: string } {
  const fallback = unitDisplayMetrics(unit.type);
  const sqm = unit.areaSqm != null && Number.isFinite(unit.areaSqm) ? unit.areaSqm : fallback.sqm;
  const beds =
    unit.bedrooms != null && Number.isFinite(unit.bedrooms) ? unit.bedrooms : fallback.beds;
  const baths =
    unit.bathrooms != null && Number.isFinite(unit.bathrooms) ? unit.bathrooms : fallback.baths;
  return {
    sqm: `${sqm} sqm`,
    beds: `${beds} Bed${beds === 1 ? '' : 's'}`,
    baths: `${baths} Bath${baths === 1 ? '' : 's'}`,
  };
}

function displayOrDash(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  if (!v || v === '—' || v === '-') return '—';
  return v;
}

/** Animates a number from 0 → target (count-up). */
function useCountUp(target: number, active: boolean, durationMs = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const end = Number.isFinite(target) ? Math.max(0, target) : 0;
    if (end === 0) {
      setValue(0);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutExpo-ish
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(Math.round(end * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, durationMs]);

  return value;
}

function MonthlyRateCard({
  rate,
  label,
  perMonthLabel,
  active,
}: {
  rate: number;
  label: string;
  perMonthLabel: string;
  active: boolean;
}) {
  const counted = useCountUp(rate, active, 1200);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.12 }}
      whileHover={{
        y: -4,
        scale: 1.015,
        boxShadow: '0 18px 36px -16px rgba(75,137,205,0.4), 0 8px 16px -10px rgba(15,23,42,0.2)',
        transition: { type: 'spring', stiffness: 420, damping: 20 },
      }}
      className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_24px_-14px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-950/60 dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)]"
    >
      {/* Left accent rail */}
      <motion.div
        aria-hidden
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
        className="absolute inset-y-3 left-0 w-1 origin-top rounded-full bg-gradient-to-b from-brand-blue via-sky-400 to-brand-blue"
      />

      <div className="relative flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
            {label}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold tracking-tight text-brand-blue tabular-nums">
              ₱{counted.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {perMonthLabel}
            </span>
          </div>
        </div>

        <motion.div
          initial={{ scale: 0, rotate: -24 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 14, delay: 0.22 }}
          whileHover={{ scale: 1.1, y: -2 }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white shadow-lg ring-1 ring-white/25"
        >
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <DollarSign className="h-6 w-6" />
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function formatLeaseDate(raw: string | undefined | null): string {
  const value = String(raw ?? '').trim();
  if (!value) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

function remainingLeaseDays(endDate: string | undefined | null): number | null {
  const value = String(endDate ?? '').trim();
  if (!value) return null;
  try {
    return differenceInCalendarDays(startOfDay(parseISO(value)), startOfDay(new Date()));
  } catch {
    return null;
  }
}

function StatusBadge({ status, label }: { status: UnitStatus; label: string }) {
  const styles: Record<UnitStatus, string> = {
    Occupied: 'bg-rose-50 text-rose-700 border-rose-200/80',
    Available: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    Reserved: 'bg-blue-50 text-blue-700 border-blue-200/80',
    Maintenance: 'bg-amber-50 text-amber-700 border-amber-200/80',
  };
  const dots: Record<UnitStatus, string> = {
    Occupied: 'bg-rose-500 animate-pulse',
    Available: 'bg-emerald-500',
    Reserved: 'bg-blue-500',
    Maintenance: 'bg-amber-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold',
        styles[status],
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dots[status])} />
      {label}
    </span>
  );
}

export function UnitDetailsModal({
  unit,
  isOpen,
  onClose,
  onEdit,
  canEdit = false,
  cityLabel,
  buildingLabel,
  activeContract = null,
  currentTenant = null,
  payments = [],
}: UnitDetailsModalProps) {
  const { t } = useTranslation();
  const [isZoomedImage, setIsZoomedImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const photos = useMemo(() => resolveUnitPhotos(unit), [unit]);

  useEffect(() => {
    if (!isOpen) {
      setIsZoomedImage(false);
      setCurrentImageIndex(0);
      return;
    }
    setCurrentImageIndex(0);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, unit?.id]);

  const statusLabel = useMemo(() => {
    if (!unit) return '';
    if (unit.status === 'Available') return t('views.units.statuses.available');
    if (unit.status === 'Occupied') return t('views.units.statuses.occupied');
    if (unit.status === 'Maintenance') return t('views.units.statuses.maintenance');
    return t('views.units.statuses.reserved');
  }, [t, unit]);

  if (!isOpen || !unit) return null;

  const unitDisplay = formatUnitNumberDisplay(unit);
  const floorTower = resolveUnitFloorTower(unit);
  const metrics = resolveMetrics(unit);

  const villageBuilding =
    [unit.legalAddress, unit.commonAddress, unit.buildingName]
      .map((v) => String(v ?? '').trim())
      .find((v) => v && v !== '—' && v !== '-') || '—';

  const city =
    stripLocationOrdinalPrefix(
      normalizeAreaLabel(cityLabel && cityLabel !== '—' ? cityLabel : unit.area || ''),
    ) || '—';

  const barangay =
    stripLocationOrdinalPrefix(
      buildingLabel && buildingLabel !== '—'
        ? buildingLabel
        : unit.buildingName && unit.buildingName !== '—' && unit.buildingName !== '-'
          ? unit.buildingName
          : '',
    ) || '—';

  const pushUnique = (parts: string[], value: string | null | undefined) => {
    const v = String(value ?? '').trim();
    if (!v || v === '—' || v === '-') return;
    const lower = v.toLowerCase();
    if (parts.some((p) => p.toLowerCase() === lower)) return;
    // Skip if already present inside an earlier segment (e.g. "Airport Area" / "Clark"
    // when village is "Airport Area · Clark NAIA T3").
    if (
      parts.some((p) => {
        const existing = p.toLowerCase();
        if (existing.includes(lower)) return true;
        const segments = existing.split(/[·•,|/]+/).map((s) => s.trim()).filter(Boolean);
        return segments.some((seg) => seg === lower || (lower.length > 2 && seg.includes(lower)));
      })
    ) {
      return;
    }
    parts.push(v);
  };

  // Full address for the header title (village / barangay / city).
  const fullAddressParts: string[] = [];
  pushUnique(fullAddressParts, villageBuilding);
  pushUnique(fullAddressParts, barangay);
  pushUnique(fullAddressParts, city);
  const fullAddress = fullAddressParts.join(', ') || '—';

  // Pin line: floor + tower + full address details.
  const locationParts: string[] = [];
  pushUnique(locationParts, displayOrDash(floorTower.floor) !== '—' ? floorTower.floor : null);
  pushUnique(locationParts, displayOrDash(floorTower.tower) !== '—' ? floorTower.tower : null);
  pushUnique(locationParts, villageBuilding);
  pushUnique(locationParts, barangay);
  pushUnique(locationParts, city);
  const locationLine = locationParts.join(', ') || '—';

  const photoUrl = photos[currentImageIndex] ?? photos[0] ?? null;
  const remarks = unit.specialRemarks?.trim() || '';
  const inventoryCount = unit.inventory?.length ?? 0;
  const remainingDays = remainingLeaseDays(activeContract?.endDate);
  const ledgerMetrics = activeContract
    ? computeContractLedgerMetrics(activeContract.id, payments, activeContract)
    : null;
  const towerDisplay = displayOrDash(floorTower.tower);

  const handleNextImage = () => {
    if (photos.length <= 1) return;
    setCurrentImageIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevImage = () => {
    if (photos.length <= 1) return;
    setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-md sm:p-4 md:p-6"
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-5 sm:flex-row sm:items-start dark:border-slate-700 dark:bg-slate-900">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
                  {`Unit ${unitDisplay}`}
                </span>
                <span className="rounded-md border border-blue-200/80 bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-blue dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300">
                  {unit.type}
                </span>
              </div>
              <h1 className="text-base font-bold break-words text-slate-800 sm:text-lg dark:text-slate-100">
                {fullAddress}
              </h1>
              <p className="flex items-start gap-1.5 text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="break-words">{locationLine}</span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-end sm:self-start">
              <StatusBadge status={unit.status} label={statusLabel} />
              <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="custom-scrollbar light-scroll flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
            {/* Top: gallery + summary */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="flex flex-col space-y-3 lg:col-span-8">
                <div className="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-900 sm:aspect-[16/9]">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`${unitDisplay} photo ${currentImageIndex + 1}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <Building2 className="h-16 w-16" />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-4 text-white">
                    <span className="rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                      {photos.length > 0 ? `${currentImageIndex + 1} / ${photos.length}` : '0 / 0'}
                    </span>
                  </div>

                  {photos.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevImage}
                        className="absolute top-1/2 left-3 -translate-y-1/2 cursor-pointer rounded-full bg-white/90 p-2 text-slate-900 shadow-md opacity-90 transition-all hover:scale-105 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextImage}
                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-full bg-white/90 p-2 text-slate-900 shadow-md opacity-90 transition-all hover:scale-105 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  ) : null}

                  {photoUrl ? (
                    <button
                      type="button"
                      onClick={() => setIsZoomedImage(true)}
                      className="absolute top-3 right-3 cursor-pointer rounded-xl bg-slate-900/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-slate-900"
                      title={t('views.units.details.expandView')}
                    >
                      <Expand className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {photos.length > 1 ? (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
                    {photos.map((url, idx) => (
                      <button
                        key={`${idx}-${url.slice(0, 32)}`}
                        type="button"
                        onClick={() => setCurrentImageIndex(idx)}
                        className={cn(
                          'relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                          idx === currentImageIndex
                            ? 'scale-[1.02] border-brand-blue ring-2 ring-brand-blue/20'
                            : 'border-transparent opacity-65 hover:opacity-100',
                        )}
                      >
                        <img
                          src={url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col space-y-4 lg:col-span-4">
                <MonthlyRateCard
                  rate={Number(unit.monthlyRate) || 0}
                  label={t('views.units.details.monthlyRentalRate')}
                  perMonthLabel={t('views.units.details.perMonth')}
                  active={isOpen}
                />

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
                    <Maximize2 className="mx-auto h-4 w-4 text-brand-blue" />
                    <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {t('views.units.details.floorArea')}
                    </span>
                    <strong className="block break-words text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                      {metrics.sqm}
                    </strong>
                  </div>
                  <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
                    <Bed className="mx-auto h-4 w-4 text-brand-blue" />
                    <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {t('views.units.addModal.bedrooms')}
                    </span>
                    <strong className="block break-words text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                      {metrics.beds}
                    </strong>
                  </div>
                  <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
                    <Bath className="mx-auto h-4 w-4 text-brand-blue" />
                    <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {t('views.units.addModal.bathrooms')}
                    </span>
                    <strong className="block break-words text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                      {metrics.baths}
                    </strong>
                  </div>
                </div>

                {(() => {
                  const parking =
                    String(unit.parkingSlot ?? '').trim() &&
                    String(unit.parkingSlot).trim() !== '—'
                      ? String(unit.parkingSlot).trim()
                      : '';
                  const furnishingLabel =
                    unit.furnishing === 'Unfurnished'
                      ? t('views.units.addModal.furnishingOptions.unfurnished')
                      : unit.furnishing === 'Semi-furnished'
                        ? t('views.units.addModal.furnishingOptions.semi')
                        : unit.furnishing === 'Fully furnished'
                          ? t('views.units.addModal.furnishingOptions.fully')
                          : '';
                  if (!parking && !furnishingLabel) return null;
                  return (
                    <div
                      className={cn(
                        'grid gap-2.5',
                        parking && furnishingLabel ? 'grid-cols-2' : 'grid-cols-1',
                      )}
                    >
                      {parking ? (
                        <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
                          <Car className="mx-auto h-4 w-4 text-brand-blue" />
                          <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {t('views.units.addModal.parkingSlot')}
                          </span>
                          <strong className="block break-words text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                            {parking}
                          </strong>
                        </div>
                      ) : null}
                      {furnishingLabel ? (
                        <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
                          <Armchair className="mx-auto h-4 w-4 text-brand-blue" />
                          <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {t('views.units.addModal.furnishing')}
                          </span>
                          <strong className="block break-words text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                            {furnishingLabel}
                          </strong>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {(() => {
                  const listingType = unit.listingType ?? 'monthly_rental';
                  const listingTypeLabel = t(`views.units.addModal.listingTypeOptions.${listingType}`);
                  const showSalePrice =
                    (listingType === 'selling' || listingType === 'pre_selling') &&
                    unit.marketValue != null &&
                    unit.marketValue > 0;
                  const amenities = unit.amenities ?? [];
                  const features = unit.features ?? [];
                  const tags = [...amenities, ...features];
                  const hasWebsiteInfo =
                    showSalePrice ||
                    Boolean(unit.developer) ||
                    Boolean(unit.listingDescription) ||
                    tags.length > 0 ||
                    unit.featured ||
                    unit.isNewListing;
                  if (!hasWebsiteInfo) return null;
                  return (
                    <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue/10 px-2.5 py-1 font-semibold text-brand-blue">
                          <Tag className="h-3 w-3" />
                          {listingTypeLabel}
                        </span>
                        {unit.featured ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                            <Sparkles className="h-3 w-3" />
                            {t('views.units.addModal.featured')}
                          </span>
                        ) : null}
                        {unit.isNewListing ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                            {t('views.units.addModal.isNewListing')}
                          </span>
                        ) : null}
                      </div>
                      {showSalePrice ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <DollarSign className="h-3.5 w-3.5 text-brand-blue" />
                          {t('views.units.addModal.marketValue')}: ₱{Number(unit.marketValue).toLocaleString()}
                        </div>
                      ) : null}
                      {unit.developer ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <Building className="h-3.5 w-3.5 text-brand-blue" />
                          {unit.developer}
                        </div>
                      ) : null}
                      {unit.listingDescription ? (
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {unit.listingDescription}
                        </p>
                      ) : null}
                      {tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </div>

            {SHOW_EXTENDED_DETAIL_SECTIONS ? (
              <>
            {/* Property Information — location breakdown only (unit/type/status already in header) */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="h-5 w-5 text-brand-blue" />
                <h3 className="text-base font-bold text-slate-900">
                  {t('views.units.details.propertyInformation')}
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: t('views.units.details.city'), value: city },
                  { label: t('views.units.details.barangay'), value: barangay },
                  { label: t('views.units.addModal.categoryType'), value: unit.type },
                  ...(towerDisplay !== '—'
                    ? [{ label: t('views.units.addModal.tower'), value: towerDisplay }]
                    : []),
                ].map((item) => (
                  <div key={item.label} className="min-w-0 space-y-0.5">
                    <span className="block text-xs font-medium text-slate-400">{item.label}</span>
                    <span className="block whitespace-normal break-words text-sm font-bold text-slate-800">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unit Specifications */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-brand-blue" />
                  <h3 className="text-base font-bold text-slate-900">
                    {t('views.units.details.unitSpecifications')}
                  </h3>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {t('views.units.details.coreLayoutSpecs')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  {
                    label: t('views.units.details.floorArea'),
                    value: metrics.sqm,
                    icon: Maximize2,
                  },
                  {
                    label: t('views.units.addModal.bedrooms'),
                    value: metrics.beds,
                    icon: Bed,
                  },
                  {
                    label: t('views.units.addModal.bathrooms'),
                    value: metrics.baths,
                    icon: Bath,
                  },
                  {
                    label: t('views.units.addModal.floor'),
                    value: displayOrDash(floorTower.floor),
                    icon: Building,
                  },
                  {
                    label: t('views.units.details.inventoryAssets'),
                    value: String(inventoryCount),
                    icon: Package,
                  },
                  ...(towerDisplay !== '—'
                    ? [
                        {
                          label: t('views.units.addModal.tower'),
                          value: towerDisplay,
                          icon: Building2,
                        },
                      ]
                    : []),
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex flex-col justify-between space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition-all hover:border-blue-100 hover:bg-blue-50/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-xs font-semibold text-slate-500">
                          {item.label}
                        </span>
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                      </div>
                      <strong className="block whitespace-normal break-words text-sm font-extrabold text-slate-900">
                        {item.value}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>

              </>
            ) : null}

            {/* Contract & Tenant */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-950/60">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-brand-blue" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {t('views.units.details.contractTenantInfo')}
                  </h3>
                </div>
                {activeContract && currentTenant ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
                    {t('views.units.details.activeLease')}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {t('views.units.details.noActiveLease')}
                  </span>
                )}
              </div>

              {activeContract && currentTenant ? (
                <div className="space-y-4">
                  <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-blue/10 text-sm font-bold text-brand-blue shadow-sm dark:border-slate-900">
                        {currentTenant.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase() ?? '')
                          .join('') || 'T'}
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                          {t('views.units.details.currentTenant')}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 dark:text-slate-50">{currentTenant.name}</h4>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          {currentTenant.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              {currentTenant.email}
                            </span>
                          ) : null}
                          {currentTenant.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {currentTenant.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <span className="block text-xs font-medium text-slate-400 dark:text-slate-500">
                        {t('views.units.details.leaseStart')}
                      </span>
                      <strong className="mt-0.5 block text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                        {formatLeaseDate(activeContract.startDate)}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <span className="block text-xs font-medium text-slate-400 dark:text-slate-500">
                        {t('views.units.details.leaseEnd')}
                      </span>
                      <strong className="mt-0.5 block text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                        {formatLeaseDate(activeContract.endDate)}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <span className="block text-xs font-medium text-slate-400 dark:text-slate-500">
                        {t('views.units.addModal.status')}
                      </span>
                      <strong className="mt-0.5 block text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                        {activeContract.status}
                      </strong>
                    </div>
                    <div
                      className={cn(
                        'rounded-xl border p-3',
                        remainingDays != null && remainingDays < 0
                          ? 'border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/30'
                          : remainingDays != null && remainingDays <= 30
                            ? 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30'
                            : 'border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30',
                      )}
                    >
                      <span
                        className={cn(
                          'block text-xs font-medium',
                          remainingDays != null && remainingDays < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : remainingDays != null && remainingDays <= 30
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-brand-blue dark:text-sky-300',
                        )}
                      >
                        {t('views.units.details.remainingDays')}
                      </span>
                      <strong
                        className={cn(
                          'mt-0.5 block text-xs font-bold sm:text-sm',
                          remainingDays != null && remainingDays < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : remainingDays != null && remainingDays <= 30
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-brand-blue dark:text-sky-300',
                        )}
                      >
                        {remainingDays == null
                          ? '—'
                          : remainingDays < 0
                            ? t('views.units.card.overdueDays', { count: Math.abs(remainingDays) })
                            : t('views.units.details.daysCount', { count: remainingDays })}
                      </strong>
                    </div>
                    <div
                      className={cn(
                        'rounded-xl border p-3',
                        ledgerMetrics && ledgerMetrics.outstandingBalance > 0
                          ? 'border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/30'
                          : 'border-slate-100 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/70',
                      )}
                    >
                      <span className="block text-xs font-medium text-slate-400 dark:text-slate-500">
                        {t('views.units.card.outstandingBalance')}
                      </span>
                      <strong
                        className={cn(
                          'mt-0.5 block text-xs font-bold sm:text-sm',
                          ledgerMetrics && ledgerMetrics.outstandingBalance > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400',
                        )}
                      >
                        {ledgerMetrics && ledgerMetrics.outstandingBalance > 0
                          ? `₱${ledgerMetrics.outstandingBalance.toLocaleString()}`
                          : t('views.units.card.noBalanceDue')}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <span className="block text-xs font-medium text-slate-400 dark:text-slate-500">
                        {t('views.units.card.nextDueDate')}
                      </span>
                      <strong
                        className={cn(
                          'mt-0.5 block text-xs font-bold sm:text-sm',
                          ledgerMetrics && (ledgerMetrics.overdueDays ?? 0) > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-slate-100',
                        )}
                      >
                        {ledgerMetrics?.nextDueDate ? formatLeaseDate(ledgerMetrics.nextDueDate) : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <User className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {t('views.units.details.vacantProperty')}
                  </h4>
                  <p className="mx-auto max-w-md text-xs text-slate-500 dark:text-slate-400">
                    {t('views.units.details.vacantPropertyHint')}
                  </p>
                </div>
              )}
            </div>

            {/* Remarks */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-950/60">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
                <FileText className="h-5 w-5 text-brand-blue" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  {t('views.units.details.specialRequests')}
                </h3>
              </div>
              <div className="min-h-[80px] rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 font-mono text-xs leading-relaxed text-slate-700 sm:text-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                {remarks || t('views.units.details.noRemarks')}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col items-stretch justify-end gap-3 border-t border-slate-100 bg-slate-50/40 px-6 py-4 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {canEdit && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(unit)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#3d7ab8] sm:text-sm"
                >
                  <Edit className="h-4 w-4" />
                  {t('views.units.details.editUnitInfo')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('views.units.details.close')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {isZoomedImage && photoUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setIsZoomedImage(false)}
        >
          <button
            type="button"
            onClick={() => setIsZoomedImage(false)}
            className="absolute top-4 right-4 cursor-pointer rounded-full bg-white/10 p-3 text-white/80 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={photoUrl}
            alt={unitDisplay}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
