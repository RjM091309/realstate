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
  return `${floorWord} ${f}`;
}

/** Full address line for unit cards: village, barangay, city, floor · tower. */
function unitCardAddressLine(unit: Unit, floorWord: string): string {
  const pushUnique = (parts: string[], value: string | null | undefined) => {
    const v = stripLocationOrdinalPrefix(String(value ?? '').trim());
    if (!v || v === '—' || v === '-') return;
    const lower = v.toLowerCase();
    if (parts.some((p) => p.toLowerCase() === lower || p.toLowerCase().includes(lower))) return;
    parts.push(v);
  };

  const village =
    [unit.legalAddress, unit.commonAddress]
      .map((v) => String(v ?? '').trim())
      .find((v) => v && v !== '—' && v !== '-') || '';
  const barangay =
    unit.buildingName && unit.buildingName !== '—' && unit.buildingName !== '-'
      ? unit.buildingName
      : '';
  const city = areaDisplayLabel(unit.area);
  const floorTower = resolveUnitFloorTower(unit);
  const floorPart = floorLabelForCard(floorTower.floor || unit.floor, floorWord);
  const towerPart =
    floorTower.tower && floorTower.tower !== '—' && floorTower.tower !== '-'
      ? floorTower.tower
      : unit.tower && unit.tower !== '—' && unit.tower !== '-'
        ? unit.tower
        : '';

  const parts: string[] = [];
  pushUnique(parts, village);
  pushUnique(parts, barangay);
  pushUnique(parts, city !== '—' ? city : '');
  const floorMeta = [floorPart !== '—' ? floorPart : '', towerPart].filter(Boolean).join(' · ');
  pushUnique(parts, floorMeta || null);

  return parts.join(', ') || '—';
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {processedUnits.map((unit) => {
            const metrics = resolveUnitMetrics(unit);
            const locationSubtitle = unitCardAddressLine(unit, t('views.units.table.floor'));
            const active = activeContractForUnit(unit.id, branchContracts);
            const tenantName = active
              ? tenantsList.find((x) => x.id === active.tenantId)?.name.trim() || '—'
              : '—';
            const { daysToEnd, endLabel } = active ? leaseEndInsight(active.endDate) : { daysToEnd: null, endLabel: null };

            const secondaryPill = (() => {
              if (unit.status === 'Available' && !active) {
                return {
                  cls: 'bg-blue-600 text-white shadow-md ring-1 ring-black/15 dark:bg-blue-600 dark:text-white',
                  label: t('views.units.card.badgeVacant'),
                } as const;
              }
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
              return {
                cls:
                  'bg-emerald-600 text-white shadow-md ring-1 ring-black/15 dark:bg-emerald-600 dark:text-white',
                label: t('views.units.card.badgePaid'),
              } as const;
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

            return (
              <Card
                key={unit.id}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300',
                  'hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50',
                  'dark:bg-slate-900 dark:shadow-black/40 dark:hover:shadow-xl dark:hover:shadow-black/60',
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
                  {unit.photoDataUrl ? (
                    <img
                      src={unit.photoDataUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Building2 className="h-14 w-14 text-slate-200 dark:text-slate-600" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end gap-2">
                    <span
                      className={cn(
                        'inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-xs font-semibold shadow-md backdrop-blur-md',
                        unit.status === 'Available' && 'bg-emerald-600 text-white',
                        unit.status === 'Occupied' && 'bg-red-600 text-white',
                        unit.status === 'Maintenance' && 'bg-amber-500 text-amber-950',
                        unit.status === 'Reserved' && 'bg-slate-100 text-slate-900 dark:bg-white/90 dark:text-slate-900',
                      )}
                    >
                      {statusLabel(unit.status)}
                    </span>
                    {secondaryPill ? (
                      <span
                        className={cn(
                          'inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-xs font-semibold shadow-md',
                          secondaryPill.cls,
                        )}
                      >
                        {secondaryPill.label}
                      </span>
                    ) : null}
                  </div>
                </div>
                <CardContent className="flex flex-1 flex-col p-4 pt-4 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                        {t('views.units.unitLabel', { unitNumber: unit.unitNumber })}
                      </h3>
                      <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {unit.type}
                      </p>
                      <p
                        className="mt-0.5 line-clamp-3 text-sm leading-snug text-slate-600 dark:text-slate-300"
                        title={locationSubtitle}
                      >
                        {locationSubtitle}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
                        ₱{unit.monthlyRate.toLocaleString()}
                      </p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t('views.units.card.perMonth')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <BedDouble className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                      {metrics.beds}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Maximize2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                      {metrics.sqm} {t('views.units.card.sqm')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Bath className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                      {metrics.baths}
                    </span>
                  </div>

                  <div className="my-4 h-px bg-slate-100/70 dark:bg-slate-800/60" />

                  <div className="space-y-3.5 text-sm leading-snug">
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

                  <div
                    className="mt-auto flex items-stretch gap-1.5 pt-4"
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
