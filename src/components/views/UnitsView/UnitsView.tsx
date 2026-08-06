import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import {
  Search,
  Plus,
  Building2,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  BedDouble,
  Bath,
  Maximize2,
  User,
  Calendar,
  CircleDollarSign,
  Home,
  Check,
  Package,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Car,
  Armchair,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button, modalDismissButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTable, type ColumnDef, meritCellAccentClass, meritCellPrimaryClass, meritCellMetaClass, meritStatusPillClass } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { SkeletonTable } from '@/components/skeleton';
import { UnitFormModal } from '@/components/units/UnitFormModal';
import { UnitDetailsModal } from '@/components/units/UnitDetailsModal';
import { locBoard } from '@/components/location-board/LocationBoard';
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { createUnit, deleteUnit, fetchUnits, updateUnit, type UnitWriteBody } from '@/lib/unitsApi';
import { fetchBrgys, fetchCities, type LocationBrgy, type LocationCity } from '@/lib/locationsApi';
import { normalizeLocationAliasLabel, stripLocationOrdinalPrefix } from '@/lib/locationNames';
import {
  formatUnitNumberDisplay,
  resolveUnitFloorTower,
  resolveUnitPhotos,
  unitDisplayMetrics,
  unitToFormState,
  type UnitFormState,
} from '@/lib/unitFormUtils';
import { cn } from '@/lib/utils';
import type { Contract, InventoryItem, Tenant, Unit } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

/** Same as Add Unit by Location: city = `area`, barangay = `buildingName`. */
function locationKey(unit: Pick<Unit, 'area'>): string {
  return String(unit.area ?? '').trim() || '—';
}

function buildingKey(unit: Pick<Unit, 'buildingName'>): string {
  return String(unit.buildingName ?? '').trim() || '—';
}

function sameLocation(a: string, b: string): boolean {
  return normalizeLocationAliasLabel(a).toLowerCase() === normalizeLocationAliasLabel(b).toLowerCase();
}

function normalizeAreaForForm(rawArea: string): string {
  const area = String(rawArea ?? '').trim();
  if (!area) return '';
  if (area === 'Makati') return 'Makati City';
  if (area === 'Pasig') return 'Pasig City';
  if (area === 'BGC') return 'Taguig City';
  return area;
}

function areaDisplayLabel(rawArea: string): string {
  return stripLocationOrdinalPrefix(normalizeAreaForForm(rawArea)) || '—';
}

async function notifyUnitSaveSuccess(title: string, detail: string) {
  await Swal.fire({
    icon: 'success',
    title,
    text: detail,
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
  });
}

async function notifyUnitSaveError(title: string, message: string, confirmLabel: string) {
  await Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: confirmLabel,
    confirmButtonColor: '#4B89CD',
    buttonsStyling: true,
  });
}

function newInventoryItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeInventoryDraft(items: InventoryItem[] | undefined | null): InventoryItem[] {
  return (items ?? []).map((it) => ({
    id: String(it.id ?? '').trim() || newInventoryItemId(),
    name: String(it.name ?? ''),
    quantity: Number.isFinite(Number(it.quantity)) && Number(it.quantity) >= 1 ? Math.floor(Number(it.quantity)) : 1,
    condition: (['New', 'Good', 'Fair', 'Poor'].includes(it.condition) ? it.condition : 'Good') as InventoryItem['condition'],
  }));
}

/** Resolve a unit's layout metrics: prefer stored values, fall back to type defaults. */
function resolveUnitMetrics(u: Unit): { sqm: number; beds: number; baths: number } {
  const fallback = unitDisplayMetrics(u.type);
  return {
    sqm: u.areaSqm ?? fallback.sqm,
    beds: u.bedrooms ?? fallback.beds,
    baths: u.bathrooms ?? fallback.baths,
  };
}

function floorLabelForCard(floor: string, floorWord: string): string {
  const f = String(floor ?? '').trim();
  if (!f || f === '—') return '—';
  if (/\bfloor\b/i.test(f)) return f;
  // "3" / "3rd" → "3rd Floor"
  if (/^\d+(st|nd|rd|th)?$/i.test(f)) {
    const n = f.replace(/(st|nd|rd|th)$/i, '');
    const ord =
      n.endsWith('1') && !n.endsWith('11')
        ? 'st'
        : n.endsWith('2') && !n.endsWith('12')
          ? 'nd'
          : n.endsWith('3') && !n.endsWith('13')
            ? 'rd'
            : 'th';
    const withOrd = /^\d+$/.test(f) ? `${f}${ord}` : f;
    return `${withOrd} ${floorWord}`;
  }
  return `${floorWord} ${f}`;
}

function cleanField(value: string | null | undefined): string {
  const v = stripLocationOrdinalPrefix(String(value ?? '').trim());
  if (!v || v === '—' || v === '-') return '';
  return v;
}

/** Normalize address text so "A · B" and "A, B" compare equal. */
function addressKey(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[·•|,/_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameAddressText(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ka = addressKey(a);
  const kb = addressKey(b);
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

/** Card detail lines: building, city/area, floor • tower. */
function unitCardDetailLines(
  unit: Unit,
  floorWord: string,
): { building: string; location: string; floorTower: string } {
  const village = cleanField(unit.legalAddress) || cleanField(unit.commonAddress);
  const barangay = cleanField(unit.buildingName);
  const city = cleanField(areaDisplayLabel(unit.area));

  // Prefer condo/village name; fall back to barangay/building label
  const building = village || barangay;

  // Location parts that aren't already covered by building
  const locationParts: string[] = [];
  for (const part of [barangay, city]) {
    if (!part) continue;
    if (sameAddressText(part, building)) continue;
    if (locationParts.some((p) => sameAddressText(p, part))) continue;
    locationParts.push(part);
  }
  let location = locationParts.join(', ');
  // Drop whole location line if it duplicates building (e.g. "The Village · Clark" vs "The Village, Clark")
  if (sameAddressText(location, building)) location = '';

  const floorTower = resolveUnitFloorTower(unit);
  const floorPart = floorLabelForCard(floorTower.floor || unit.floor, floorWord);
  const towerRaw = cleanField(floorTower.tower) || cleanField(unit.tower);
  const towerPart = towerRaw
    ? /\btower\b/i.test(towerRaw)
      ? towerRaw
      : `Tower ${towerRaw}`
    : '';
  const floorTowerLine = [floorPart !== '—' ? floorPart : '', towerPart].filter(Boolean).join(' • ');

  return {
    building: building || '',
    location,
    floorTower: floorTowerLine,
  };
}

function activeContractForUnit(unitId: string, contracts: Contract[]): Contract | null {
  const actives = contracts.filter((c) => c.unitId === unitId && c.status === 'Active');
  if (actives.length === 0) return null;
  return actives[0];
}

function unitSearchHaystack(
  unit: Unit,
  contracts: Contract[],
  tenants: Tenant[],
  statusLabel: (status: string) => string,
): string {
  const active = activeContractForUnit(unit.id, contracts);
  const tenant = active ? tenants.find((x) => x.id === active.tenantId) : null;
  const tenantName = tenant?.name ?? '';
  const tenantEmail = tenant?.email ?? '';
  const tenantPhone = tenant?.phone ?? '';
  const rent = unit.monthlyRate;
  const rentFormatted = rent ? `₱${rent.toLocaleString()} ${rent}` : '';

  return [
    unit.unitNumber,
    unit.buildingName,
    unit.tower,
    unit.floor,
    unit.area,
    areaDisplayLabel(unit.area),
    unit.type,
    unit.status,
    statusLabel(unit.status),
    unit.commonAddress,
    unit.legalAddress,
    unit.specialRemarks,
    tenantName,
    tenantEmail,
    tenantPhone,
    rentFormatted,
    active?.contractNo,
    active?.status,
    active?.remarks,
    ...(unit.inventory ?? []).map((i) => `${i.name} ${i.condition}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesUniversalSearch(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

function leaseEndInsight(endIso: string | undefined): { daysToEnd: number | null; endLabel: string | null } {
  if (!endIso) return { daysToEnd: null, endLabel: null };
  try {
    const end = startOfDay(parseISO(endIso));
    const today = startOfDay(new Date());
    const daysToEnd = differenceInCalendarDays(end, today);
    const endLabel = format(end, 'MMM d, yyyy');
    return { daysToEnd, endLabel };
  } catch {
    return { daysToEnd: null, endLabel: null };
  }
}

function conditionLabel(condition: string, t: (k: string) => string): string {
  if (condition === 'New') return t('views.units.details.conditionNew');
  if (condition === 'Good') return t('views.units.details.conditionGood');
  if (condition === 'Fair') return t('views.units.details.conditionFair');
  return t('views.units.details.conditionPoor');
}

function unitToWriteBody(u: Unit, inventory: InventoryItem[]): UnitWriteBody {
  return {
    unitNumber: u.unitNumber,
    floor: u.floor,
    tower: u.tower,
    buildingName: u.buildingName,
    commonAddress: u.commonAddress,
    legalAddress: u.legalAddress,
    type: u.type,
    status: u.status,
    area: u.area,
    areaSqm: u.areaSqm ?? null,
    bedrooms: u.bedrooms ?? null,
    bathrooms: u.bathrooms ?? null,
    monthlyRate: u.monthlyRate,
    photoDataUrl: u.photoDataUrl ?? null,
    photos: u.photos ?? (u.photoDataUrl ? [u.photoDataUrl] : []),
    moreDetails: u.moreDetails,
    specialRemarks: u.specialRemarks,
    parkingSlot: u.parkingSlot,
    furnishing: u.furnishing,
    inventory,
  };
}

function writeBodyToUnit(id: string, body: UnitWriteBody, inventory: Unit['inventory']): Unit {
  return {
    id,
    unitNumber: body.unitNumber,
    floor: body.floor || '—',
    tower: body.tower || '—',
    buildingName: body.buildingName || '—',
    commonAddress: body.commonAddress || body.buildingName || '—',
    legalAddress: body.legalAddress || body.commonAddress || body.buildingName || '—',
    type: body.type,
    status: body.status,
    area: body.area || '—',
    areaSqm: body.areaSqm ?? undefined,
    bedrooms: body.bedrooms ?? undefined,
    bathrooms: body.bathrooms ?? undefined,
    monthlyRate: Number(body.monthlyRate) || 0,
    photoDataUrl: body.photoDataUrl ?? null,
    photos: body.photos ?? (body.photoDataUrl ? [body.photoDataUrl] : []),
    moreDetails: body.moreDetails,
    specialRemarks: body.specialRemarks,
    parkingSlot: body.parkingSlot,
    furnishing: body.furnishing,
    inventory,
  };
}

export function UnitsView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef(false);
  const canUpdate = session?.crud?.units?.update ?? false;
  const canDelete = session?.crud?.units?.delete ?? false;

  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  /** Level 1 / Level 2 filters — same city/brgy masters as Add Unit by Location. */
  const [managedCities, setManagedCities] = useState<LocationCity[]>([]);
  const [managedBrgys, setManagedBrgys] = useState<LocationBrgy[]>([]);
  const [filterCityId, setFilterCityId] = useState('');
  const [filterBrgyId, setFilterBrgyId] = useState('');
  const [statusFilter, setStatusFilter] = useState<Unit['status'] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isManageInventoryOpen, setIsManageInventoryOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addInitial, setAddInitial] = useState<Partial<UnitFormState> | undefined>();
  const [addInitialPhoto, setAddInitialPhoto] = useState<string | null>(null);
  const [addInitialPhotos, setAddInitialPhotos] = useState<string[]>([]);
  const [unitSaving, setUnitSaving] = useState(false);
  /** When false, the list is mock/offline data — persist edits only in memory (API IDs are not in the database). */
  const [unitsBackedByApi, setUnitsBackedByApi] = useState(true);
  const [branchContracts, setBranchContracts] = useState<Contract[]>([]);
  const [tenantsList, setTenantsList] = useState<Tenant[]>([]);
  const [detailInventoryDraft, setDetailInventoryDraft] = useState<InventoryItem[]>([]);
  const [inventorySaving, setInventorySaving] = useState(false);
  const [inventoryAddOpen, setInventoryAddOpen] = useState(false);
  const [inventoryEditOpen, setInventoryEditOpen] = useState(false);
  const [inventoryEditId, setInventoryEditId] = useState<string | null>(null);
  const [inventoryAddName, setInventoryAddName] = useState('');
  const [inventoryAddQty, setInventoryAddQty] = useState(1);
  const [inventoryAddCondition, setInventoryAddCondition] = useState<InventoryItem['condition']>('Good');
  const [expandedCardDetails, setExpandedCardDetails] = useState<Record<string, boolean>>({});
  const [cardPhotoIndex, setCardPhotoIndex] = useState<Record<string, number>>({});

  const reloadUnits = useCallback(async () => {
    setUnitsLoading(true);
    try {
      const [units, cities, brgys] = await Promise.all([
        fetchUnits(),
        fetchCities(),
        fetchBrgys(),
      ]);
      setUnitList(units);
      setManagedCities(cities);
      setManagedBrgys(brgys);
      setUnitsBackedByApi(true);
    } catch {
      setUnitList([]);
      setManagedCities([]);
      setManagedBrgys([]);
      setUnitsBackedByApi(false);
      toast.warning(t('views.units.loadError'));
    } finally {
      setUnitsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reloadUnits();
  }, [reloadUnits]);

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const statusParam = searchParams.get('status');
    if (!statusParam) return;
    const allowed: Unit['status'][] = ['Available', 'Occupied', 'Maintenance', 'Reserved'];
    if (!allowed.includes(statusParam as Unit['status'])) return;
    deepLinkHandledRef.current = true;
    setStatusFilter(statusParam as Unit['status']);
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [contracts, tenants] = await Promise.all([fetchContracts(), fetchTenants()]);
        if (!cancelled) {
          setBranchContracts(contracts);
          setTenantsList(tenants);
        }
      } catch {
        if (!cancelled) {
          setBranchContracts([]);
          setTenantsList([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedActiveContract = useMemo(
    () => (selectedUnit ? activeContractForUnit(selectedUnit.id, branchContracts) : null),
    [selectedUnit, branchContracts],
  );
  const selectedCurrentTenant = useMemo(() => {
    if (!selectedActiveContract) return null;
    return tenantsList.find((x) => x.id === selectedActiveContract.tenantId) ?? null;
  }, [selectedActiveContract, tenantsList]);

  useEffect(() => {
    if ((!isDetailsOpen && !isManageInventoryOpen) || !selectedUnit) return;
    setDetailInventoryDraft(normalizeInventoryDraft(selectedUnit.inventory));
  }, [isDetailsOpen, isManageInventoryOpen, selectedUnit]);

  useEffect(() => {
    if (!isDetailsOpen && !isManageInventoryOpen) {
      setInventoryAddOpen(false);
      setInventoryEditOpen(false);
      setInventoryEditId(null);
      setInventoryAddName('');
      setInventoryAddQty(1);
      setInventoryAddCondition('Good');
    }
  }, [isDetailsOpen, isManageInventoryOpen]);

  const inventoryConditionOptions = useMemo(
    () =>
      (['New', 'Good', 'Fair', 'Poor'] as const).map((v) => ({
        value: v,
        label:
          v === 'New'
            ? t('views.units.details.conditionNew')
            : v === 'Good'
              ? t('views.units.details.conditionGood')
              : v === 'Fair'
                ? t('views.units.details.conditionFair')
                : t('views.units.details.conditionPoor'),
      })),
    [t],
  );

  const handleSaveDetailInventory = useCallback(
    async (draftSource?: InventoryItem[]): Promise<boolean> => {
      if (!selectedUnit) return false;
      const source = draftSource ?? detailInventoryDraft;
      const cleaned = source
        .map((it) => ({
          id: String(it.id || '').trim() || newInventoryItemId(),
          name: String(it.name ?? '').trim(),
          quantity: Math.max(1, Math.floor(Number(it.quantity)) || 1),
          condition: (['New', 'Good', 'Fair', 'Poor'].includes(it.condition) ? it.condition : 'Good') as InventoryItem['condition'],
        }))
        .filter((r) => r.name.length > 0);

      if (!unitsBackedByApi) {
        const nextUnit = { ...selectedUnit, inventory: cleaned };
        setUnitList((prev) => prev.map((u) => (u.id === selectedUnit.id ? nextUnit : u)));
        setSelectedUnit(nextUnit);
        setDetailInventoryDraft(normalizeInventoryDraft(cleaned));
        toast.success(t('views.units.details.inventorySaved'));
        return true;
      }

      setInventorySaving(true);
      try {
        const body = unitToWriteBody(selectedUnit, cleaned);
        const updated = await updateUnit(selectedUnit.id, body);
        setUnitList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setSelectedUnit(updated);
        setDetailInventoryDraft(normalizeInventoryDraft(updated.inventory));
        toast.success(t('views.units.details.inventorySaved'));
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
        return false;
      } finally {
        setInventorySaving(false);
      }
    },
    [detailInventoryDraft, selectedUnit, t, unitsBackedByApi],
  );

  const openInventoryAddModal = useCallback(() => {
    setInventoryEditOpen(false);
    setInventoryEditId(null);
    setInventoryAddName('');
    setInventoryAddQty(1);
    setInventoryAddCondition('Good');
    setInventoryAddOpen(true);
  }, []);

  const resetInventoryForm = useCallback(() => {
    setInventoryAddOpen(false);
    setInventoryEditOpen(false);
    setInventoryEditId(null);
    setInventoryAddName('');
    setInventoryAddQty(1);
    setInventoryAddCondition('Good');
  }, []);

  const openInventoryEditModal = useCallback((inv: InventoryItem) => {
    setInventoryAddOpen(false);
    setInventoryEditId(inv.id);
    setInventoryAddName(String(inv.name ?? ''));
    setInventoryAddQty(Math.max(1, Math.floor(Number(inv.quantity)) || 1));
    setInventoryAddCondition(
      (['New', 'Good', 'Fair', 'Poor'].includes(inv.condition) ? inv.condition : 'Good') as InventoryItem['condition'],
    );
    setInventoryEditOpen(true);
  }, []);

  const handleAddInventoryItemSubmit = useCallback(async () => {
    const name = inventoryAddName.trim();
    if (!name) {
      toast.error(t('views.units.details.inventoryItemNameRequired'));
      return;
    }
    if (!selectedUnit) return;

    const next = [
      ...detailInventoryDraft,
      {
        id: newInventoryItemId(),
        name,
        quantity: Math.max(1, Math.floor(Number(inventoryAddQty)) || 1),
        condition: (['New', 'Good', 'Fair', 'Poor'].includes(inventoryAddCondition) ? inventoryAddCondition : 'Good') as InventoryItem['condition'],
      },
    ];

    const ok = await handleSaveDetailInventory(next);
    if (ok) resetInventoryForm();
  }, [
    resetInventoryForm,
    detailInventoryDraft,
    handleSaveDetailInventory,
    inventoryAddCondition,
    inventoryAddName,
    inventoryAddQty,
    selectedUnit,
    t,
  ]);

  const handleEditInventoryItemSubmit = useCallback(async () => {
    const name = inventoryAddName.trim();
    if (!name) {
      toast.error(t('views.units.details.inventoryItemNameRequired'));
      return;
    }
    if (!selectedUnit || !inventoryEditId) return;

    const edited: InventoryItem = {
      id: inventoryEditId,
      name,
      quantity: Math.max(1, Math.floor(Number(inventoryAddQty)) || 1),
      condition: (['New', 'Good', 'Fair', 'Poor'].includes(inventoryAddCondition) ? inventoryAddCondition : 'Good') as InventoryItem['condition'],
    };

    const next = detailInventoryDraft.map((x) => (x.id === inventoryEditId ? edited : x));

    const ok = await handleSaveDetailInventory(next);
    if (ok) resetInventoryForm();
  }, [
    resetInventoryForm,
    detailInventoryDraft,
    handleSaveDetailInventory,
    inventoryAddCondition,
    inventoryAddName,
    inventoryAddQty,
    inventoryEditId,
    selectedUnit,
    t,
  ]);

  const handleViewDetails = useCallback((unit: Unit) => {
    setSelectedUnit(unit);
    setIsManageInventoryOpen(false);
    setIsDetailsOpen(true);
  }, []);

  const handleManageInventory = useCallback((unit: Unit) => {
    setSelectedUnit(unit);
    setIsDetailsOpen(false);
    setIsManageInventoryOpen(true);
  }, []);

  const statusLabel = useCallback(
    (status: string) => {
      if (status === 'Available') return t('views.units.statuses.available');
      if (status === 'Occupied') return t('views.units.statuses.occupied');
      if (status === 'Maintenance') return t('views.units.statuses.maintenance');
      if (status === 'Reserved') return t('views.units.statuses.reserved');
      return t('views.units.statuses.maintenance');
    },
    [t],
  );

  const selectedCity = useMemo(
    () => managedCities.find((c) => String(c.cityId) === String(filterCityId)) ?? null,
    [managedCities, filterCityId],
  );

  const selectedBrgy = useMemo(
    () => managedBrgys.find((b) => String(b.brgyId) === String(filterBrgyId)) ?? null,
    [managedBrgys, filterBrgyId],
  );

  /** Level 1 — DB `city` rows (same source as Add Unit by Location CITY panel). */
  const cityOptions = useMemo(
    () =>
      [...managedCities]
        .map((c) => ({ cityId: String(c.cityId), name: String(c.name ?? '').trim() }))
        .filter((c) => c.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [managedCities],
  );

  /** Level 2 — DB `brgy` rows for the selected city (all brgys if no city). */
  const brgyOptions = useMemo(() => {
    const rows = filterCityId
      ? managedBrgys.filter((b) => String(b.cityId) === String(filterCityId))
      : managedBrgys;
    const map = new Map<string, { brgyId: string; cityId: string; name: string }>();
    for (const row of rows) {
      const name = String(row.name ?? '').trim();
      if (!name) continue;
      map.set(String(row.brgyId), {
        brgyId: String(row.brgyId),
        cityId: String(row.cityId),
        name,
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [managedBrgys, filterCityId]);

  const citySelectOptions = useMemo(
    () => cityOptions.map((c) => ({ value: c.cityId, label: c.name })),
    [cityOptions],
  );

  const brgySelectOptions = useMemo(
    () => brgyOptions.map((b) => ({ value: b.brgyId, label: b.name })),
    [brgyOptions],
  );

  const processedUnits = useMemo(() => {
    const rows = unitList.filter((u) => {
      if (statusFilter && u.status !== statusFilter) return false;
      if (selectedCity) {
        const unitCity = locationKey(u);
        if (
          !sameLocation(unitCity, selectedCity.name) &&
          unitCity.trim().toLowerCase() !== selectedCity.name.trim().toLowerCase()
        ) {
          return false;
        }
      }
      if (selectedBrgy) {
        const unitBrgy = buildingKey(u);
        if (unitBrgy.trim().toLowerCase() !== selectedBrgy.name.trim().toLowerCase()) {
          return false;
        }
      }
      const haystack = unitSearchHaystack(u, branchContracts, tenantsList, statusLabel);
      return matchesUniversalSearch(haystack, searchTerm);
    });

    return [...rows].sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );
  }, [
    unitList,
    searchTerm,
    selectedCity,
    selectedBrgy,
    branchContracts,
    tenantsList,
    statusLabel,
    statusFilter,
  ]);

  const totalMonthlyRate = useMemo(
    () => processedUnits.reduce((sum, u) => sum + (Number(u.monthlyRate) || 0), 0),
    [processedUnits],
  );

  const openEditUnitModal = useCallback((unit: Unit) => {
    setIsDetailsOpen(false);
    setIsManageInventoryOpen(false);
    setFormMode('edit');
    setEditingId(unit.id);
    setAddInitial(unitToFormState(unit));
    setAddInitialPhoto(unit.photoDataUrl ?? null);
    setAddInitialPhotos(resolveUnitPhotos(unit));
    setIsAddUnitOpen(true);
  }, []);

  const closeAddUnitModal = useCallback(() => {
    setIsAddUnitOpen(false);
    setFormMode('create');
    setEditingId(null);
    setAddInitial(undefined);
    setAddInitialPhoto(null);
    setAddInitialPhotos([]);
  }, []);

  const handleSaveUnit = useCallback(
    async (body: UnitWriteBody) => {
      const existingInventory =
        formMode === 'edit' && editingId
          ? (unitList.find((u) => u.id === editingId)?.inventory ?? [])
          : [];
      const patched: UnitWriteBody = { ...body, inventory: existingInventory };

      setUnitSaving(true);
      try {
        if (!unitsBackedByApi) {
          if (formMode === 'edit' && editingId) {
            const updated = writeBodyToUnit(editingId, patched, existingInventory);
            setUnitList((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
            setSelectedUnit(updated);
            closeAddUnitModal();
            await notifyUnitSaveSuccess(
              t('views.units.updated'),
              t('views.units.saveSuccessEditDetail'),
            );
            setIsDetailsOpen(true);
            setIsManageInventoryOpen(false);
          } else {
            const newId = `local-${Date.now()}`;
            const created = writeBodyToUnit(newId, patched, []);
            setUnitList((prev) => [created, ...prev]);
            closeAddUnitModal();
            await notifyUnitSaveSuccess(
              t('views.units.addModal.saved'),
              t('views.units.saveSuccessAddDetail'),
            );
          }
          return;
        }

        if (formMode === 'edit' && editingId) {
          const updated = await updateUnit(editingId, patched);
          setUnitList((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
          setSelectedUnit(updated);
          closeAddUnitModal();
          await notifyUnitSaveSuccess(
            t('views.units.updated'),
            t('views.units.saveSuccessEditDetail'),
          );
          setIsDetailsOpen(true);
          setIsManageInventoryOpen(false);
        } else {
          const created = await createUnit(patched);
          setUnitList((prev) => [created, ...prev]);
          closeAddUnitModal();
          await notifyUnitSaveSuccess(
            t('views.units.addModal.saved'),
            t('views.units.saveSuccessAddDetail'),
          );
        }
      } catch (e) {
        await notifyUnitSaveError(
          t('views.units.saveErrorTitle'),
          e instanceof Error ? e.message : 'Error',
          t('common.close'),
        );
      } finally {
        setUnitSaving(false);
      }
    },
    [closeAddUnitModal, editingId, formMode, t, unitList, unitsBackedByApi],
  );

  const handleDeleteUnit = useCallback(
    async (unit: Unit) => {
      if (!window.confirm(t('views.units.deleteConfirm', { unitNumber: unit.unitNumber }))) return;
      const wasViewingDetails = selectedUnit?.id === unit.id;
      if (!unitsBackedByApi) {
        setUnitList((prev) => prev.filter((u) => u.id !== unit.id));
        if (wasViewingDetails) {
          setSelectedUnit(null);
          setIsDetailsOpen(false);
          setIsManageInventoryOpen(false);
        }
        toast.success(t('views.units.deleted'));
        return;
      }
      try {
        await deleteUnit(unit.id);
        setUnitList((prev) => prev.filter((u) => u.id !== unit.id));
        if (wasViewingDetails) {
          setSelectedUnit(null);
          setIsDetailsOpen(false);
          setIsManageInventoryOpen(false);
        }
        toast.success(t('views.units.deleted'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    },
    [t, unitsBackedByApi, selectedUnit],
  );

  const columns: ColumnDef<Unit>[] = useMemo(
    () => [
      {
        header: t('views.units.table.unit'),
        render: (unit) => <span className={meritCellAccentClass}>{unit.unitNumber}</span>,
      },
      {
        header: t('views.units.table.area'),
        render: (unit) => {
          const villageName = stripLocationOrdinalPrefix(
            [unit.legalAddress, unit.commonAddress]
              .map((v) => String(v ?? '').trim())
              .find((v) => v && v !== '—' && v !== '-') || '',
          );
          const brgyLabel = stripLocationOrdinalPrefix(
            unit.buildingName && unit.buildingName !== '—' && unit.buildingName !== '-'
              ? unit.buildingName
              : '',
          );
          const cityLabel = areaDisplayLabel(unit.area);
          const floorTower = resolveUnitFloorTower(unit);
          const floorMeta = [floorTower.floor, floorTower.tower].filter(Boolean).join(' · ');
          const primary = villageName || brgyLabel || (cityLabel !== '—' ? cityLabel : '') || '—';
          const primaryLower = primary.toLowerCase();
          const includesPart = (part: string) =>
            Boolean(part) && part !== '—' && primaryLower.includes(part.toLowerCase());
          const secondary = [
            brgyLabel && villageName && !includesPart(brgyLabel) ? brgyLabel : null,
            cityLabel && cityLabel !== '—' && !includesPart(cityLabel) ? cityLabel : null,
            floorMeta || null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div className="min-w-0 max-w-[16rem] space-y-0.5">
              <p className={cn(meritCellPrimaryClass, 'whitespace-normal break-words leading-snug')}>
                {primary}
              </p>
              {secondary ? (
                <p className={cn(meritCellMetaClass, 'whitespace-normal break-words leading-snug')}>
                  {secondary}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        header: t('views.units.table.type'),
        render: (unit) => (
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">
            {unit.type}
          </Badge>
        ),
      },
      {
        header: t('views.units.table.sqm'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (unit) => {
          const metrics = resolveUnitMetrics(unit);
          return <span className="text-sm font-semibold tabular-nums text-slate-700">{metrics.sqm}</span>;
        },
      },
      {
        header: t('views.units.table.bedrooms'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (unit) => {
          const metrics = resolveUnitMetrics(unit);
          return <span className="text-sm font-semibold tabular-nums text-slate-700">{metrics.beds}</span>;
        },
      },
      {
        header: t('views.units.table.status'),
        render: (unit) => (
          <Badge
            variant="outline"
            className={cn(
              meritStatusPillClass,
              'border shadow-none',
              unit.status === 'Available' &&
                'border-brand-green/20 bg-brand-green/10 text-brand-green hover:bg-brand-green/10',
              unit.status === 'Occupied' &&
                'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50',
              unit.status === 'Maintenance' &&
                'border-brand-orange/20 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/10',
              unit.status === 'Reserved' &&
                'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100',
            )}
          >
            {statusLabel(unit.status)}
          </Badge>
        ),
      },
      {
        header: t('views.units.table.monthlyRate'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (unit) => (
          <span className="text-sm font-black tabular-nums text-slate-800">
            ₱{unit.monthlyRate.toLocaleString()}
          </span>
        ),
      },
      {
        header: t('views.units.table.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (unit) => (
          <div
            className="inline-flex items-center justify-end gap-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <button
              type="button"
              className={locBoard.editBtn}
              title={t('views.units.table.viewDetails')}
              onClick={() => handleViewDetails(unit)}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            {canUpdate ? (
              <button
                type="button"
                className={locBoard.editBtn}
                title={t('views.units.table.editUnit')}
                onClick={() => openEditUnitModal(unit)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              className={locBoard.editBtn}
              title={t('views.units.table.manageInventory')}
              onClick={() => handleManageInventory(unit)}
            >
              <Package className="h-3.5 w-3.5" />
            </button>
            {canDelete ? (
              <button
                type="button"
                className={locBoard.deleteBtn}
                title={t('views.units.table.delete')}
                onClick={() => void handleDeleteUnit(unit)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, canUpdate, canDelete, statusLabel, handleViewDetails, openEditUnitModal, handleManageInventory, handleDeleteUnit]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('views.units.title')}</h1>
          <p className="text-slate-500 mt-1 dark:text-slate-400">{t('views.units.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Select2
            borderless={false}
            className="w-full min-w-[12rem] sm:w-[15rem] [&_.unit-form-select-control]:!min-h-10 [&_.unit-form-select-control]:!text-sm [&_div]:!text-slate-900 dark:[&_div]:!text-slate-50"
            placeholder={t('views.units.filters.level1')}
            value={filterCityId || null}
            onChange={(v) => {
              setFilterCityId(v == null ? '' : String(v));
              setFilterBrgyId('');
            }}
            options={citySelectOptions}
          />
          <Select2
            borderless={false}
            className="w-full min-w-[12rem] sm:w-[15rem] [&_.unit-form-select-control]:!min-h-10 [&_.unit-form-select-control]:!text-sm [&_div]:!text-slate-900 dark:[&_div]:!text-slate-50"
            placeholder={t('views.units.filters.level2')}
            value={filterBrgyId || null}
            onChange={(v) => {
              const next = v == null ? '' : String(v);
              setFilterBrgyId(next);
              if (next) {
                const parent = managedBrgys.find((b) => String(b.brgyId) === next);
                if (parent?.cityId) setFilterCityId(String(parent.cityId));
              }
            }}
            options={brgySelectOptions}
          />
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
              <Input
                placeholder={t('views.units.searchPlaceholder')}
                className="h-10 rounded-xl border-transparent bg-white pl-9 pr-3 text-sm shadow-sm dark:border-transparent dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex rounded-xl bg-white p-0.5 shadow-sm dark:bg-slate-900/90 dark:shadow-none">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-10 rounded-lg px-3 gap-1.5 dark:text-slate-200',
                viewMode === 'grid' && 'bg-slate-100 shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:shadow-none',
              )}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">{t('views.units.viewGrid')}</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-10 rounded-lg px-3 gap-1.5 dark:text-slate-200',
                viewMode === 'list' && 'bg-slate-100 shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:shadow-none',
              )}
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('views.units.viewList')}</span>
            </Button>
          </div>
        </div>
      </div>

      {statusFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-orange/30 bg-orange-50 px-4 py-2.5 text-sm text-slate-700 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-slate-200">
          <p>
            {t('views.units.statusFilterBanner', {
              status: statusLabel(statusFilter),
              count: processedUnits.length,
            })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-brand-orange"
            onClick={() => setStatusFilter(null)}
          >
            {t('views.units.clearStatusFilter')}
          </Button>
        </div>
      ) : null}

      {unitsLoading ? (
        viewMode === 'list' ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <SkeletonTable rows={8} columns={8} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl bg-white shadow-md dark:bg-slate-900"
              >
                <div className="aspect-[4/3] animate-pulse bg-slate-100 dark:bg-slate-800" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-16 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                  <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : viewMode === 'list' ? (
        <DataTable
          data={processedUnits}
          columns={columns}
          keyExtractor={(u) => u.id}
          onRowClick={(unit) => handleViewDetails(unit)}
          footerRow={
            <>
              <td
                colSpan={Math.max(1, columns.length - 2)}
                className="px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                {t('views.units.table.totalAmount')}
              </td>
              <td className="px-6 py-3.5 text-center text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                ₱{totalMonthlyRate.toLocaleString()}
              </td>
              <td className="px-6 py-3.5" />
            </>
          }
        />
      ) : processedUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50/50 py-16 text-center dark:bg-slate-900/40">
          <Building2 className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('views.units.card.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {processedUnits.map((unit) => {
            const metrics = resolveUnitMetrics(unit);
            const floorWord = t('views.units.table.floor');
            const detailLines = unitCardDetailLines(unit, floorWord);
            const parkingLabel = (() => {
              const raw = String(unit.parkingSlot ?? '').trim();
              if (!raw || raw === '—' || raw === '-') return '';
              return raw;
            })();
            const furnishingLabel = (() => {
              if (unit.furnishing === 'Unfurnished') {
                return t('views.units.addModal.furnishingOptions.unfurnished');
              }
              if (unit.furnishing === 'Semi-furnished') {
                return t('views.units.addModal.furnishingOptions.semi');
              }
              if (unit.furnishing === 'Fully furnished') {
                return t('views.units.addModal.furnishingOptions.fully');
              }
              return '';
            })();
            const specChips: {
              key: string;
              icon: React.ReactNode;
              value: string;
              title: string;
              iconClass: string;
              chipClass: string;
            }[] = [
              {
                key: 'beds',
                icon: <BedDouble className="h-3.5 w-3.5" aria-hidden />,
                value: t('views.units.card.specBedroom', { count: metrics.beds }),
                title: t('views.units.addModal.bedrooms'),
                iconClass: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
                chipClass: 'border-sky-100/80 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/10',
              },
              {
                key: 'sqm',
                icon: <Maximize2 className="h-3.5 w-3.5" aria-hidden />,
                value: `${metrics.sqm} ${t('views.units.card.sqm')}`,
                title: t('views.units.card.sqm'),
                iconClass: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
                chipClass: 'border-violet-100/80 bg-violet-50/70 dark:border-violet-500/20 dark:bg-violet-500/10',
              },
              {
                key: 'baths',
                icon: <Bath className="h-3.5 w-3.5" aria-hidden />,
                value: t('views.units.card.specBathroom', { count: metrics.baths }),
                title: t('views.units.addModal.bathrooms'),
                iconClass: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300',
                chipClass: 'border-cyan-100/80 bg-cyan-50/70 dark:border-cyan-500/20 dark:bg-cyan-500/10',
              },
            ];
            if (parkingLabel) {
              const parkingDisplay = /parking/i.test(parkingLabel)
                ? parkingLabel
                : t('views.units.card.specParking', { slot: parkingLabel });
              specChips.push({
                key: 'parking',
                icon: <Car className="h-3.5 w-3.5" aria-hidden />,
                value: parkingDisplay,
                title: t('views.units.addModal.parkingSlot'),
                iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
                chipClass: 'border-amber-100/80 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10',
              });
            }
            if (furnishingLabel) {
              specChips.push({
                key: 'furnishing',
                icon: <Armchair className="h-3.5 w-3.5" aria-hidden />,
                value: furnishingLabel,
                title: t('views.units.addModal.furnishing'),
                iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
                chipClass: 'border-emerald-100/80 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10',
              });
            }
            const active = activeContractForUnit(unit.id, branchContracts);
            const tenantName = active
              ? tenantsList.find((x) => x.id === active.tenantId)?.name.trim() || '—'
              : '—';
            const { daysToEnd, endLabel } = active ? leaseEndInsight(active.endDate) : { daysToEnd: null, endLabel: null };

            const secondaryPill = (() => {
              // Status badge already covers Available/Occupied — only show urgent lease alerts
              if (!active) return null;
              if (daysToEnd === null) return null;
              if (daysToEnd < 0) {
                return {
                  cls:
                    'bg-amber-500 text-amber-950 shadow-md ring-1 ring-black/10 dark:bg-amber-500 dark:text-amber-950',
                  label: t('views.units.card.badgeOverdue', { count: Math.abs(daysToEnd) }),
                } as const;
              }
              if (daysToEnd <= 30) {
                return {
                  cls:
                    'bg-amber-400 text-amber-950 shadow-md ring-1 ring-black/10 dark:bg-amber-400 dark:text-amber-950',
                  label: t('views.units.card.badgeEndingSoon'),
                } as const;
              }
              return null;
            })();

            const leaseEndsNode = (() => {
              if (!active || !endLabel) {
                return <span className="font-medium text-slate-500 dark:text-slate-400">—</span>;
              }
              if (daysToEnd !== null && daysToEnd < 0) {
                return (
                  <span className="font-semibold text-rose-500 dark:text-rose-400">
                    {endLabel}{' '}
                    <span className="whitespace-nowrap">
                      ({t('views.units.card.overdueDays', { count: Math.abs(daysToEnd) })})
                    </span>
                  </span>
                );
              }
              if (daysToEnd !== null && daysToEnd <= 30) {
                return (
                  <span className="font-semibold text-amber-500 dark:text-amber-400">
                    {endLabel}{' '}
                    <span className="whitespace-nowrap">({t('views.units.card.daysLeft', { count: daysToEnd })})</span>
                  </span>
                );
              }
              return (
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {endLabel}
                  {daysToEnd !== null ? (
                    <span className="whitespace-nowrap font-medium text-slate-600 dark:text-slate-400">
                      {' '}
                      ({t('views.units.card.daysLeft', { count: daysToEnd })})
                    </span>
                  ) : null}
                </span>
              );
            })();

            const rentStatusNode = (() => {
              if (!active) {
                return <span className="font-medium text-slate-500 dark:text-slate-400">—</span>;
              }
              if (daysToEnd !== null && daysToEnd < 0) {
                return (
                  <span className="font-semibold text-rose-500 dark:text-rose-400">
                    {t('views.units.card.rentOverdue')}
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                  {t('views.units.card.rentCurrent')}
                </span>
              );
            })();

            const unitPhotos = resolveUnitPhotos(unit);
            const photoIdx = Math.min(
              cardPhotoIndex[unit.id] ?? 0,
              Math.max(unitPhotos.length - 1, 0),
            );
            const photoUrl = unitPhotos[photoIdx] ?? null;

            return (
              <Card
                key={unit.id}
                className={cn(
                  'group relative flex flex-col gap-0 overflow-hidden rounded-xl bg-white py-0 shadow-lg transition-all duration-300',
                  'hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50',
                  'dark:bg-slate-900 dark:shadow-black/40 dark:hover:shadow-xl dark:hover:shadow-black/60',
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Building2 className="h-14 w-14 text-slate-200 dark:text-slate-600" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                  {unitPhotos.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardPhotoIndex((prev) => ({
                            ...prev,
                            [unit.id]: (photoIdx - 1 + unitPhotos.length) % unitPhotos.length,
                          }));
                        }}
                        className="absolute top-1/2 left-2 z-[2] -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/50 group-hover:opacity-100"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardPhotoIndex((prev) => ({
                            ...prev,
                            [unit.id]: (photoIdx + 1) % unitPhotos.length,
                          }));
                        }}
                        className="absolute top-1/2 right-2 z-[2] -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/50 group-hover:opacity-100"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                      <div className="absolute inset-x-0 bottom-2 z-[2] flex items-center justify-center gap-1.5">
                        {unitPhotos.map((_, idx) => (
                          <button
                            key={`${unit.id}-dot-${idx}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardPhotoIndex((prev) => ({ ...prev, [unit.id]: idx }));
                            }}
                            className={cn(
                              'h-1.5 rounded-full shadow-sm transition-all',
                              idx === photoIdx
                                ? 'w-4 bg-white'
                                : 'w-1.5 bg-white/55 hover:bg-white/80',
                            )}
                            aria-label={`Photo ${idx + 1} of ${unitPhotos.length}`}
                            aria-current={idx === photoIdx}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}

                  <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start gap-2">
                    <span
                      className={cn(
                        'group/badge relative inline-flex max-w-full items-center gap-1 overflow-hidden truncate rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide',
                        'ring-1 ring-white/35 backdrop-blur-md transition-transform duration-300',
                        'shadow-[0_1px_0_rgba(255,255,255,0.45)_inset,0_6px_14px_-5px_rgba(0,0,0,0.55),0_1px_3px_rgba(0,0,0,0.25)]',
                        'before:pointer-events-none before:absolute before:inset-x-1 before:top-0 before:h-1/2 before:rounded-full',
                        'before:bg-gradient-to-b before:from-white/45 before:to-transparent',
                        unit.status === 'Available' &&
                          'bg-gradient-to-b from-emerald-400 to-emerald-700 text-white',
                        unit.status === 'Occupied' &&
                          'bg-gradient-to-b from-rose-400 to-rose-700 text-white',
                        unit.status === 'Maintenance' &&
                          'bg-gradient-to-b from-amber-300 to-amber-600 text-amber-950',
                        unit.status === 'Reserved' &&
                          'bg-gradient-to-b from-slate-100 to-slate-300 text-slate-900 dark:from-white dark:to-slate-200',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'relative z-[1] h-1.5 w-1.5 shrink-0 rounded-full bg-white/95 shadow-[0_0_5px_rgba(255,255,255,0.75)]',
                          unit.status === 'Available' && 'animate-pulse',
                          unit.status === 'Occupied' && 'bg-white',
                          unit.status === 'Maintenance' && 'bg-amber-950/80',
                          unit.status === 'Reserved' && 'bg-slate-700',
                        )}
                      />
                      <span className="relative z-[1] truncate">{statusLabel(unit.status)}</span>
                    </span>
                    {secondaryPill ? (
                      <span
                        className={cn(
                          'relative inline-flex max-w-full items-center truncate overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide',
                          'ring-1 ring-white/30 backdrop-blur-md',
                          'shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_6px_14px_-5px_rgba(0,0,0,0.5)]',
                          'before:pointer-events-none before:absolute before:inset-x-1 before:top-0 before:h-1/2 before:rounded-full',
                          'before:bg-gradient-to-b before:from-white/40 before:to-transparent',
                          secondaryPill.cls,
                        )}
                      >
                        <span className="relative z-[1] truncate">{secondaryPill.label}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Unit + building overlay — bottom-left on photo */}
                  <div
                    className={cn(
                      'absolute inset-x-0 bottom-0 z-[1] p-3 pt-8',
                      unitPhotos.length > 1 && 'pb-7',
                    )}
                  >
                    <h3 className="truncate text-base font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
                      {t('views.units.unitLabel', { unitNumber: formatUnitNumberDisplay(unit) })}
                    </h3>
                    <p
                      className="mt-0.5 max-w-[75%] truncate text-[11px] font-medium leading-snug text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
                      title={detailLines.building || unit.type}
                    >
                      {detailLines.building || unit.type}
                    </p>
                  </div>
                </div>
                <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-2 dark:bg-slate-900">
                  <div className="flex min-h-[2.5rem] min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-1.5">
                      <MapPin
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-blue"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        {(() => {
                          const addressParts = [
                            detailLines.building,
                            detailLines.location,
                            detailLines.floorTower,
                          ].filter(Boolean);
                          const addressText = addressParts.join(' · ') || unit.type;
                          return (
                            <p
                              className="line-clamp-2 text-[13px] leading-snug text-slate-600 dark:text-slate-300"
                              title={addressText}
                            >
                              {addressText}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="shrink-0 space-y-0.5 text-right">
                      <p className="text-base font-bold tabular-nums leading-tight text-brand-blue">
                        ₱{unit.monthlyRate.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-medium text-brand-blue/70 dark:text-sky-300/80">
                        {t('views.units.card.perMonth')}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-[4.75rem] flex-wrap content-start gap-1.5">
                    {specChips.map((chip) => (
                      <div
                        key={chip.key}
                        title={chip.title}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1.5',
                          chip.chipClass,
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                            chip.iconClass,
                          )}
                        >
                          {chip.icon}
                        </span>
                        <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {chip.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCardDetails((prev) => {
                            const willOpen = !prev[unit.id];
                            return willOpen ? { [unit.id]: true } : {};
                          });
                        }}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5',
                          'text-[11px] font-medium tracking-wide text-slate-500',
                          'transition-colors hover:bg-slate-50 hover:text-brand-blue',
                          'dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-sky-300',
                          expandedCardDetails[unit.id] && 'text-brand-blue dark:text-sky-300',
                        )}
                        aria-expanded={Boolean(expandedCardDetails[unit.id])}
                      >
                        {expandedCardDetails[unit.id]
                          ? t('views.units.card.hideDetails')
                          : t('views.units.card.showDetails')}
                        <ChevronDown
                          className={cn(
                            'h-3 w-3 transition-transform duration-200',
                            expandedCardDetails[unit.id] && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>
                      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                    </div>

                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-out',
                        expandedCardDetails[unit.id] ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div
                          className={cn(
                            'space-y-3 pt-2 text-sm leading-snug transition-opacity duration-300',
                            expandedCardDetails[unit.id] ? 'opacity-100' : 'opacity-0',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex shrink-0 items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                              <User className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                              {t('views.units.card.tenant')}
                            </span>
                            <span className="min-w-0 flex-1 text-right font-semibold text-slate-900 dark:text-slate-100">
                              {tenantName === '—' ? (
                                <span className="font-medium text-slate-500 dark:text-slate-400">—</span>
                              ) : (
                                <span className="break-words">{tenantName}</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex shrink-0 items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                              <Calendar className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                              {t('views.units.card.leaseEnds')}
                            </span>
                            <div className="min-w-0 flex-1 text-right text-sm leading-snug">{leaseEndsNode}</div>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex shrink-0 items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                              <CircleDollarSign className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                              {t('views.units.card.rentStatus')}
                            </span>
                            <div className="min-w-0 flex-1 text-right text-sm">{rentStatusNode}</div>
                          </div>
                          {unit.status === 'Available' ? (
                            <div className="flex items-start justify-between gap-3">
                              <span className="flex shrink-0 items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                                <Home className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                                {t('views.units.card.vacantSince')}
                              </span>
                              <span className="min-w-0 flex-1 text-right font-medium text-slate-500 dark:text-slate-400">—</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-stretch gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-0 flex-1 rounded-lg border-transparent bg-white px-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-transparent hover:bg-slate-50 dark:border-transparent dark:bg-slate-900 dark:text-slate-300 dark:hover:border-transparent dark:hover:bg-slate-800 [&_svg]:translate-y-0.5"
                      onClick={() => handleViewDetails(unit)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t('views.units.card.view')}</span>
                    </Button>
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 rounded-lg border-transparent bg-white px-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-transparent hover:bg-slate-50 dark:border-transparent dark:bg-slate-900 dark:text-slate-300 dark:hover:border-transparent dark:hover:bg-slate-800 [&_svg]:translate-y-0.5"
                        onClick={() => openEditUnitModal(unit)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t('views.units.card.edit')}</span>
                      </Button>
                    ) : null}
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 rounded-lg border-transparent bg-white px-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-transparent hover:bg-slate-50 dark:border-transparent dark:bg-slate-900 dark:text-slate-300 dark:hover:border-transparent dark:hover:bg-slate-800 [&_svg]:translate-y-0.5"
                        onClick={() => handleManageInventory(unit)}
                      >
                        <LayoutGrid className="mr-1 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t('views.units.card.inventory')}</span>
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 rounded-lg border-transparent bg-white px-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-transparent hover:bg-slate-50 dark:border-transparent dark:bg-slate-900 dark:text-slate-300 dark:hover:border-transparent dark:hover:bg-slate-800 [&_svg]:translate-y-0.5"
                        onClick={() => void handleDeleteUnit(unit)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t('views.units.card.delete')}</span>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}



      <UnitDetailsModal
        unit={selectedUnit}
        isOpen={isDetailsOpen && !isAddUnitOpen}
        onClose={() => setIsDetailsOpen(false)}
        canEdit={canUpdate}
        onEdit={openEditUnitModal}
        activeContract={selectedActiveContract}
        currentTenant={selectedCurrentTenant}
      />

      <Modal
        isOpen={Boolean(isManageInventoryOpen && !isAddUnitOpen && selectedUnit)}
        onClose={() => setIsManageInventoryOpen(false)}
        title={
          selectedUnit
            ? `${t('views.units.table.manageInventory')} • ${t('views.units.unitLabel', { unitNumber: selectedUnit.unitNumber })}`
            : t('views.units.table.manageInventory')
        }
        maxWidth="3xl"
        variant="default"
        footer={
          <div className="flex justify-end w-full">
            <Button type="button" className={modalDismissButtonClass} onClick={() => setIsManageInventoryOpen(false)}>
              {t('views.units.details.close')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {canUpdate ? (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="h-9 rounded-lg border-brand-blue/20 bg-brand-blue/10 px-4 font-medium text-brand-blue shadow-none hover:bg-brand-blue/10"
                onClick={openInventoryAddModal}
              >
                <Plus className="w-4 h-4 mr-1.5" aria-hidden />
                {t('views.units.details.addInventoryItem')}
              </Button>
            </div>
          ) : null}

          {canUpdate ? (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              {detailInventoryDraft.length === 0 ? (
                <p className="text-sm text-slate-500 px-4 py-8 text-center">{t('views.units.inventoryEmpty')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 bg-white hover:bg-white [&>th]:h-11">
                      <TableHead className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('views.units.details.inventoryItemName')}
                      </TableHead>
                      <TableHead className="w-24 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('views.units.details.inventoryQty')}
                      </TableHead>
                      <TableHead className="min-w-[10rem] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('views.units.details.inventoryCondition')}
                      </TableHead>
                      <TableHead className="w-28 border-l border-slate-200 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('views.units.table.actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailInventoryDraft.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="border-b border-slate-200 bg-white last:border-b-0 hover:bg-slate-50/60"
                      >
                        <TableCell className="px-4 py-2.5 text-[13px] font-medium uppercase tracking-wide text-slate-900">
                          {inv.name}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-800">
                          {inv.quantity}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 text-[13px] text-slate-800">
                            {conditionLabel(inv.condition, t)}
                          </span>
                        </TableCell>
                        <TableCell className="border-l border-slate-200 px-3 py-2.5 text-right align-middle">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              title={t('common.edit')}
                              disabled={inventorySaving}
                              onClick={() => openInventoryEditModal(inv)}
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              title={t('common.delete')}
                              disabled={inventorySaving}
                              onClick={() => {
                                const next = detailInventoryDraft.filter((x) => x.id !== inv.id);
                                void handleSaveDetailInventory(next);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              {!selectedUnit?.inventory?.length ? (
                <p className="text-sm text-slate-500 px-4 py-8 text-center">{t('views.units.inventoryEmpty')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 bg-white hover:bg-white [&>th]:h-11">
                      <TableHead className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('views.units.details.inventoryItemName')}
                      </TableHead>
                      <TableHead className="w-24 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('views.units.details.inventoryQty')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('views.units.details.inventoryCondition')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedUnit?.inventory ?? []).map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="border-b border-slate-200 bg-white last:border-b-0 hover:bg-slate-50/60"
                      >
                        <TableCell className="px-4 py-2.5 text-[13px] font-medium uppercase tracking-wide text-slate-900">
                          {inv.name}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-800">
                          {inv.quantity}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 text-[13px] text-slate-800">
                            {conditionLabel(inv.condition, t)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(inventoryAddOpen && isManageInventoryOpen && selectedUnit && canUpdate)}
        onClose={resetInventoryForm}
        title={t('views.units.details.addInventoryModalTitle')}
        maxWidth="md"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" className={modalDismissButtonClass} onClick={resetInventoryForm} disabled={inventorySaving}>
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className={modalPrimaryButtonClass}
              disabled={inventorySaving || !selectedUnit}
              onClick={() => void handleAddInventoryItemSubmit()}
            >
              {inventorySaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : null}
              {t('views.units.details.saveInventory')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inventory-add-name">{t('views.units.details.inventoryItemName')}</Label>
            <Input
              id="inventory-add-name"
              value={inventoryAddName}
              onChange={(e) => setInventoryAddName(e.target.value)}
              placeholder={t('views.units.details.inventoryItemName')}
              disabled={inventorySaving}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-add-qty">{t('views.units.details.inventoryQty')}</Label>
            <Input
              id="inventory-add-qty"
              type="number"
              min={1}
              value={inventoryAddQty}
              onChange={(e) => setInventoryAddQty(Math.max(1, Number(e.target.value) || 1))}
              disabled={inventorySaving}
              className="rounded-xl border-slate-200 max-w-[8rem]"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.details.inventoryCondition')}</Label>
            <Select2
              options={inventoryConditionOptions}
              value={inventoryAddCondition}
              onChange={(v) => setInventoryAddCondition((v ?? 'Good') as InventoryItem['condition'])}
              disabled={inventorySaving}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(inventoryEditOpen && isManageInventoryOpen && selectedUnit && canUpdate && inventoryEditId)}
        onClose={resetInventoryForm}
        title={t('common.edit')}
        maxWidth="md"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" className={modalDismissButtonClass} onClick={resetInventoryForm} disabled={inventorySaving}>
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className={modalPrimaryButtonClass}
              disabled={inventorySaving || !selectedUnit}
              onClick={() => void handleEditInventoryItemSubmit()}
            >
              {inventorySaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : null}
              {t('views.units.details.saveInventory')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inventory-edit-name">{t('views.units.details.inventoryItemName')}</Label>
            <Input
              id="inventory-edit-name"
              value={inventoryAddName}
              onChange={(e) => setInventoryAddName(e.target.value)}
              placeholder={t('views.units.details.inventoryItemName')}
              disabled={inventorySaving}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-edit-qty">{t('views.units.details.inventoryQty')}</Label>
            <Input
              id="inventory-edit-qty"
              type="number"
              min={1}
              value={inventoryAddQty}
              onChange={(e) => setInventoryAddQty(Math.max(1, Number(e.target.value) || 1))}
              disabled={inventorySaving}
              className="rounded-xl border-slate-200 max-w-[8rem]"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.details.inventoryCondition')}</Label>
            <Select2
              options={inventoryConditionOptions}
              value={inventoryAddCondition}
              onChange={(v) => setInventoryAddCondition((v ?? 'Good') as InventoryItem['condition'])}
              disabled={inventorySaving}
            />
          </div>
        </div>
      </Modal>

      <UnitFormModal
        isOpen={isAddUnitOpen}
        onClose={closeAddUnitModal}
        mode={formMode}
        initialValues={addInitial}
        initialPhoto={addInitialPhoto}
        initialPhotos={addInitialPhotos}
        contextArea={addInitial?.area ?? null}
        contextBuilding={addInitial?.buildingName ?? null}
        saving={unitSaving}
        onSubmit={handleSaveUnit}
      />
    </div>
  );
}
