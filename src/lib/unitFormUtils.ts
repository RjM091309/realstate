import type { InventoryItem, Unit, UnitStatus, UnitType } from '@/types';
import type { UnitWriteBody } from '@/lib/unitsApi';

export const UNIT_FORM_TYPES: UnitType[] = [
  'House and Lot',
  'Condominium',
  'Apartment',
  'Commercial Building',
  'Warehouse',
  'Hotel',
  'Office Space',
  'Studio',
  '1BR',
  '2BR',
  '3BR',
  'Loft',
  'Penthouse',
];

export const UNIT_FORM_STATUSES: UnitStatus[] = ['Available', 'Occupied', 'Maintenance', 'Reserved'];

export const UNIT_FORM_FURNISHING = [
  'Unfurnished',
  'Semi-furnished',
  'Fully furnished',
] as const;

/** Luzon city options used by the Units “Add New Unit” modal (Area field). */
export const UNIT_FORM_AREA_CITIES: string[] = [
  'Manila',
  'Caloocan City',
  'Las Pinas City',
  'Makati City',
  'Malabon City',
  'Mandaluyong City',
  'Marikina City',
  'Muntinlupa City',
  'Navotas City',
  'Paranaque City',
  'Pasay City',
  'Pasig City',
  'Quezon City',
  'San Juan City',
  'Taguig City',
  'Valenzuela City',
  'Pateros',
  'Baguio City',
  'Tabuk City',
  'Alaminos City',
  'Candon City',
  'Dagupan City',
  'Laoag City',
  'San Carlos City (Pangasinan)',
  'Urdaneta City',
  'Vigan City',
  'Tuguegarao City',
  'Cauayan City',
  'Ilagan City',
  'Santiago City',
  'Angeles City',
  'Balanga City',
  'Cabanatuan City',
  'Gapan City',
  'Malolos City',
  'Meycauayan City',
  'Munoz City',
  'Olongapo City',
  'Palayan City',
  'San Fernando City (Pampanga)',
  'Mabalacat City',
  'Clark',
  'Apalit',
  'Arayat',
  'Bacolor',
  'Candaba',
  'Floridablanca',
  'Guagua',
  'Lubao',
  'Macabebe',
  'Magalang',
  'Masantol',
  'Mexico',
  'Minalin',
  'Porac',
  'San Luis',
  'San Simon',
  'Santa Ana',
  'Santa Rita',
  'Santo Tomas',
  'Sasmuan',
  'San Jose del Monte City',
  'Tarlac City',
  'Antipolo City',
  'Bacoor City',
  'Batangas City',
  'Binan City',
  'Cabuyao City',
  'Calamba City',
  'Cavite City',
  'Dasmarinas City',
  'General Trias City',
  'Imus City',
  'Lipa City',
  'Lucena City',
  'San Pablo City',
  'San Pedro City',
  'Santa Rosa City',
  'Santo Tomas City',
  'Tagaytay City',
  'Tanauan City',
  'Trece Martires City',
  'Calapan City',
  'Puerto Princesa City',
  'Iriga City',
  'Legazpi City',
  'Ligao City',
  'Masbate City',
  'Naga City',
  'Sorsogon City',
  'Tabaco City',
];

export type UnitFormState = {
  unitNumber: string;
  floor: string;
  tower: string;
  buildingName: string;
  legalAddress: string;
  type: UnitType;
  status: UnitStatus;
  area: string;
  areaSqm: string;
  bedrooms: string;
  bathrooms: string;
  monthlyRate: string;
  moreDetails: string;
  specialRemarks: string;
  parkingSlot: string;
  furnishing: string;
};

export function unitDisplayMetrics(type: UnitType): { sqm: number; beds: number; baths: number } {
  const map: Record<UnitType, { sqm: number; beds: number; baths: number }> = {
    'House and Lot': { sqm: 120, beds: 3, baths: 2 },
    Condominium: { sqm: 45, beds: 1, baths: 1 },
    Apartment: { sqm: 45, beds: 1, baths: 1 },
    'Commercial Building': { sqm: 200, beds: 0, baths: 2 },
    Warehouse: { sqm: 500, beds: 0, baths: 1 },
    Hotel: { sqm: 30, beds: 1, baths: 1 },
    'Office Space': { sqm: 120, beds: 0, baths: 2 },
    Studio: { sqm: 32, beds: 1, baths: 1 },
    '1BR': { sqm: 45, beds: 1, baths: 1 },
    '2BR': { sqm: 72, beds: 2, baths: 2 },
    '3BR': { sqm: 105, beds: 3, baths: 2 },
    Loft: { sqm: 58, beds: 1, baths: 1 },
    Penthouse: { sqm: 165, beds: 3, baths: 3 },
  };
  return map[type];
}

export function defaultUnitForm(partial?: Partial<UnitFormState>): UnitFormState {
  const metrics = unitDisplayMetrics((partial?.type as UnitType) || 'Condominium');
  return {
    unitNumber: '',
    floor: '',
    tower: '',
    buildingName: '',
    legalAddress: '',
    type: 'Condominium',
    status: 'Available',
    area: '',
    areaSqm: String(metrics.sqm),
    bedrooms: String(metrics.beds),
    bathrooms: String(metrics.baths),
    monthlyRate: '',
    moreDetails: '',
    specialRemarks: '',
    parkingSlot: '',
    furnishing: '',
    ...partial,
  };
}

export function ordinalFloor(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function isPlaceholderField(value: string | undefined | null): boolean {
  const v = String(value ?? '').trim();
  return !v || v === '—' || v === '-';
}

/**
 * Detect floor / tower phrases from free text (unit number, address, remarks).
 * Examples: "301 3rd Floor Tower wings" → floor "3rd Floor", tower "Tower wings", unit "301"
 */
export function detectFloorAndTowerFromText(text: string): {
  floor: string;
  tower: string;
  cleaned: string;
} {
  let remaining = String(text ?? '').trim();
  let floor = '';
  let tower = '';
  if (!remaining) return { floor, tower, cleaned: '' };

  const floorMatch = remaining.match(
    /\b(?:(\d+)(?:st|nd|rd|th)?\s*floor|floor\s*(\d+))\b/i,
  );
  if (floorMatch) {
    const n = Number(floorMatch[1] || floorMatch[2]);
    floor = Number.isFinite(n) && n > 0 ? `${ordinalFloor(n)} Floor` : floorMatch[0].trim();
    remaining = remaining.replace(floorMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }

  const towerMatch =
    remaining.match(/\btower\s+[\w-]+/i) ||
    remaining.match(/\b[\w-]+\s+wings?\b/i);
  if (towerMatch) {
    tower = towerMatch[0].replace(/\s+/g, ' ').trim();
    remaining = remaining.replace(towerMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }

  return { floor, tower, cleaned: remaining };
}

/** Prefer stored floor/tower; fall back to phrases detected in unit number. */
export function resolveUnitFloorTower(unit: Pick<Unit, 'unitNumber' | 'floor' | 'tower'>): {
  floor: string;
  tower: string;
} {
  const detected = detectFloorAndTowerFromText(unit.unitNumber);
  const floor = !isPlaceholderField(unit.floor) ? String(unit.floor).trim() : detected.floor;
  const tower = !isPlaceholderField(unit.tower) ? String(unit.tower).trim() : detected.tower;
  return { floor, tower };
}

export function formatUnitFloorTowerMeta(unit: Pick<Unit, 'unitNumber' | 'floor' | 'tower'>): string {
  const { floor, tower } = resolveUnitFloorTower(unit);
  return [floor, tower].filter(Boolean).join(' · ');
}

/**
 * Unit label for tables: strip floor/tower text when it already shows under Barangay.
 * "301 3rd Floor Tower wings" → "301"
 */
export function formatUnitNumberDisplay(unit: Pick<Unit, 'unitNumber' | 'floor' | 'tower'>): string {
  const raw = String(unit.unitNumber ?? '').trim();
  if (!raw) return '—';
  const meta = formatUnitFloorTowerMeta(unit);
  if (!meta) return raw;
  const { cleaned } = detectFloorAndTowerFromText(raw);
  return cleaned || raw;
}

export function deriveBuildingName(addressOrBuilding: string, fallbackBuilding = ''): string {
  const raw = String(addressOrBuilding ?? '').trim();
  const fallback = String(fallbackBuilding ?? '').trim();
  if (!raw) return fallback;
  const first = raw
    .split(/[,\u00B7-]/)
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || fallback || raw;
}

export function parseMetricInput(raw: string): number | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function unitFormToWriteBody(
  form: UnitFormState,
  photoDataUrl: string | null,
  inventory: InventoryItem[] = [],
  photos: string[] = [],
): UnitWriteBody {
  const rate = Number(String(form.monthlyRate).replace(/,/g, ''));
  const legalAddress = isPlaceholderField(form.legalAddress) ? '' : form.legalAddress.trim();
  const explicitBuilding = isPlaceholderField(form.buildingName) ? '' : form.buildingName.trim();
  const commonAddress = legalAddress || explicitBuilding;
  const buildingName =
    explicitBuilding || deriveBuildingName(commonAddress, '') || '';
  const detectedFromUnit = detectFloorAndTowerFromText(form.unitNumber);
  const detectedExtra = detectFloorAndTowerFromText(
    [form.legalAddress, form.moreDetails, form.specialRemarks].filter(Boolean).join(' '),
  );
  const floor = form.floor.trim() || detectedFromUnit.floor || detectedExtra.floor || '—';
  const tower = form.tower.trim() || detectedFromUnit.tower || detectedExtra.tower || '—';
  // Keep unit number clean when floor/tower live under Barangay
  const unitNumber =
    (detectedFromUnit.floor || detectedFromUnit.tower) && detectedFromUnit.cleaned
      ? detectedFromUnit.cleaned
      : form.unitNumber.trim();
  const area = isPlaceholderField(form.area) ? '' : form.area.trim();
  const normalizedPhotos = (photos.length > 0 ? photos : photoDataUrl ? [photoDataUrl] : [])
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .slice(0, 5);
  const cover = normalizedPhotos[0] ?? null;
  return {
    unitNumber,
    floor,
    tower,
    buildingName: buildingName.trim(),
    commonAddress: commonAddress || buildingName.trim() || '',
    legalAddress: legalAddress || commonAddress || buildingName.trim() || '',
    type: form.type,
    status: form.status,
    area,
    areaSqm: parseMetricInput(form.areaSqm),
    bedrooms: parseMetricInput(form.bedrooms),
    bathrooms: parseMetricInput(form.bathrooms),
    monthlyRate: rate,
    photoDataUrl: cover,
    photos: normalizedPhotos,
    moreDetails: form.moreDetails.trim() || undefined,
    specialRemarks: form.specialRemarks.trim() || undefined,
    parkingSlot: form.parkingSlot.trim() || undefined,
    furnishing: (form.furnishing.trim() || undefined) as UnitWriteBody['furnishing'],
    inventory,
  };
}

/** Resolve gallery photos from a unit (supports legacy single photo). */
export function resolveUnitPhotos(unit: Pick<Unit, 'photoDataUrl' | 'photos'> | null | undefined): string[] {
  if (!unit) return [];
  const fromList = (unit.photos ?? [])
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .slice(0, 5);
  if (fromList.length > 0) return fromList;
  const cover = String(unit.photoDataUrl ?? '').trim();
  return cover ? [cover] : [];
}

export function unitToFormState(unit: Unit): UnitFormState {
  return {
    unitNumber: unit.unitNumber,
    floor: unit.floor === '—' ? '' : unit.floor,
    tower: unit.tower === '—' ? '' : unit.tower,
    buildingName: unit.buildingName,
    legalAddress: unit.legalAddress || unit.commonAddress || unit.buildingName,
    type: unit.type,
    status: unit.status,
    area: unit.area,
    areaSqm: unit.areaSqm != null ? String(unit.areaSqm) : String(unitDisplayMetrics(unit.type).sqm),
    bedrooms: unit.bedrooms != null ? String(unit.bedrooms) : String(unitDisplayMetrics(unit.type).beds),
    bathrooms:
      unit.bathrooms != null ? String(unit.bathrooms) : String(unitDisplayMetrics(unit.type).baths),
    monthlyRate: String(unit.monthlyRate ?? ''),
    moreDetails: unit.moreDetails ?? '',
    specialRemarks: unit.specialRemarks ?? '',
    parkingSlot: unit.parkingSlot ?? '',
    furnishing: unit.furnishing ?? '',
  };
}
