import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
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
  Printer,
  Share2,
  Expand,
  CheckCircle2,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { stripLocationOrdinalPrefix } from '@/lib/locationNames';
import {
  formatUnitNumberDisplay,
  resolveUnitFloorTower,
  resolveUnitPhotos,
  unitDisplayMetrics,
} from '@/lib/unitFormUtils';
import type { Contract, Tenant, Unit, UnitStatus } from '@/types';

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
    Reserved: 'bg-amber-50 text-amber-700 border-amber-200/80',
    Maintenance: 'bg-rose-50 text-rose-700 border-rose-200/80',
  };
  const dots: Record<UnitStatus, string> = {
    Occupied: 'bg-rose-500 animate-pulse',
    Available: 'bg-emerald-500',
    Reserved: 'bg-amber-500',
    Maintenance: 'bg-rose-500',
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
}: UnitDetailsModalProps) {
  const { t } = useTranslation();
  const [isZoomedImage, setIsZoomedImage] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const photos = useMemo(() => resolveUnitPhotos(unit), [unit]);

  useEffect(() => {
    if (!isOpen) {
      setIsZoomedImage(false);
      setShareToast(false);
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
  const towerDisplay = displayOrDash(floorTower.tower);

  const handleShareLink = () => {
    void navigator.clipboard?.writeText?.(window.location.href);
    setShareToast(true);
    window.setTimeout(() => setShareToast(false), 2000);
  };

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
      <AnimatePresence>
        {shareToast ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-5 right-5 z-[100] flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {t('views.units.details.linkCopied')}
          </motion.div>
        ) : null}
      </AnimatePresence>

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
                onClick={handleShareLink}
                className="cursor-pointer rounded-xl p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-brand-blue dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                title={t('views.units.details.share')}
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="hidden cursor-pointer rounded-xl p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-brand-blue dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300 sm:block"
                title={t('views.units.details.print')}
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ml-1 cursor-pointer rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/60">
                  <span className="mb-1 block text-xs font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                    {t('views.units.details.monthlyRentalRate')}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-brand-blue">
                      ₱{Number(unit.monthlyRate).toLocaleString()}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('views.units.details.perMonth')}
                    </span>
                  </div>
                </div>

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

            {/* Contract & Tenant */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-brand-blue" />
                  <h3 className="text-base font-bold text-slate-900">
                    {t('views.units.details.contractTenantInfo')}
                  </h3>
                </div>
                {activeContract && currentTenant ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {t('views.units.details.activeLease')}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {t('views.units.details.noActiveLease')}
                  </span>
                )}
              </div>

              {activeContract && currentTenant ? (
                <div className="space-y-4">
                  <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-blue/10 text-sm font-bold text-brand-blue shadow-sm">
                        {currentTenant.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase() ?? '')
                          .join('') || 'T'}
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                          {t('views.units.details.currentTenant')}
                        </span>
                        <h4 className="text-base font-bold text-slate-900">{currentTenant.name}</h4>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
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

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                      <span className="block text-xs font-medium text-slate-400">
                        {t('views.units.details.leaseStart')}
                      </span>
                      <strong className="mt-0.5 block text-xs font-bold text-slate-900 sm:text-sm">
                        {formatLeaseDate(activeContract.startDate)}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                      <span className="block text-xs font-medium text-slate-400">
                        {t('views.units.details.leaseEnd')}
                      </span>
                      <strong className="mt-0.5 block text-xs font-bold text-slate-900 sm:text-sm">
                        {formatLeaseDate(activeContract.endDate)}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                      <span className="block text-xs font-medium text-slate-400">
                        {t('views.units.addModal.status')}
                      </span>
                      <strong className="mt-0.5 block text-xs font-bold text-slate-900 sm:text-sm">
                        {activeContract.status}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                      <span className="block text-xs font-medium text-brand-blue">
                        {t('views.units.details.remainingDays')}
                      </span>
                      <strong className="mt-0.5 block text-xs font-bold text-brand-blue sm:text-sm">
                        {remainingDays == null
                          ? '—'
                          : t('views.units.details.daysCount', { count: remainingDays })}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <User className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    {t('views.units.details.vacantProperty')}
                  </h4>
                  <p className="mx-auto max-w-md text-xs text-slate-500">
                    {t('views.units.details.vacantPropertyHint')}
                  </p>
                </div>
              )}
            </div>
              </>
            ) : null}

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
