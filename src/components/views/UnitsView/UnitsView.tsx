import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import {
  Search,
  Plus,
  MoreVertical,
  Building2,
  MapPin,
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
  Ruler,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button, modalActionButtonClass, modalDismissButtonClass, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type ColumnDef, meritCellAccentClass, meritCellPrimaryClass, meritCellMetaClass, meritStatusPillClass } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { SkeletonTable } from '@/components/skeleton';
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { createUnit, deleteUnit, fetchUnits, updateUnit, type UnitWriteBody } from '@/lib/unitsApi';
import { toWebpDataUrl } from '@/lib/imageWebp';
import { UNIT_FORM_TYPES, resolveUnitFloorTower } from '@/lib/unitFormUtils';
import { cn } from '@/lib/utils';
import type { Contract, InventoryItem, Tenant, Unit, UnitStatus, UnitType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

const UNIT_STATUSES: UnitStatus[] = ['Available', 'Occupied', 'Maintenance', 'Reserved'];

type AddUnitForm = {
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
};

function defaultAddForm(): AddUnitForm {
  const metrics = unitDisplayMetrics('Condominium');
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
  };
}

function ordinalFloor(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function normalizeFloorForForm(rawFloor: string): string {
  const floor = String(rawFloor ?? '').trim();
  if (!floor || floor === '—') return '';
  if (/^\d+$/.test(floor)) {
    const n = Number(floor);
    if (Number.isFinite(n) && n >= 1 && n <= 12) return `${ordinalFloor(n)} floor`;
  }
  return floor;
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
  return normalizeAreaForForm(rawArea) || '—';
}

function isPlaceholderField(value: string | undefined | null): boolean {
  const v = String(value ?? '').trim();
  return !v || v === '—' || v === '-';
}

function resolveUnitAddressBase(unit: Pick<Unit, 'legalAddress' | 'commonAddress' | 'buildingName'>): string {
  for (const candidate of [unit.legalAddress, unit.commonAddress, unit.buildingName]) {
    const value = String(candidate ?? '').trim();
    if (!isPlaceholderField(value)) return value;
  }
  return '';
}

function deriveBuildingName(addressOrBuilding: string, fallbackBuilding = ''): string {
  const raw = String(addressOrBuilding ?? '').trim();
  const fallback = String(fallbackBuilding ?? '').trim();
  if (!raw) return fallback;

  // Prefer the first segment as the "building name" (keeps title/subtitle concise).
  // Handles: "Building, Street, City" | "Building · Wing" | "Building - Wing"
  const first = raw
    .split(/[,\u00B7-]/)
    .map((s) => s.trim())
    .filter(Boolean)[0];

  return first || fallback || raw;
}

function formToWriteBody(
  form: AddUnitForm,
  inventory: Unit['inventory'],
  photoDataUrl: string | null,
): UnitWriteBody {
  const rate = Number(String(form.monthlyRate).replace(/,/g, ''));
  const legalAddress = form.legalAddress.trim();
  const commonAddress = legalAddress || form.buildingName.trim();
  const buildingName = deriveBuildingName(commonAddress, form.buildingName) || '—';
  return {
    unitNumber: form.unitNumber.trim(),
    floor: form.floor.trim() || '—',
    tower: form.tower.trim() || '—',
    buildingName: buildingName.trim() || '—',
    commonAddress: commonAddress || buildingName || '—',
    legalAddress: legalAddress || commonAddress || buildingName || '—',
    type: form.type,
    status: form.status,
    area: form.area.trim() || '—',
    areaSqm: parseMetricInput(form.areaSqm),
    bedrooms: parseMetricInput(form.bedrooms),
    bathrooms: parseMetricInput(form.bathrooms),
    monthlyRate: rate,
    photoDataUrl,
    moreDetails: form.moreDetails.trim() || undefined,
    specialRemarks: form.specialRemarks.trim() || undefined,
    inventory,
  };
}

function parseMetricInput(raw: string): number | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
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

function unitToForm(u: Unit): AddUnitForm {
  const metrics = unitDisplayMetrics(u.type);
  return {
    unitNumber: u.unitNumber,
    floor: normalizeFloorForForm(u.floor),
    tower: u.tower === '—' ? '' : u.tower,
    buildingName: u.buildingName,
    legalAddress: resolveUnitAddressBase(u),
    type: u.type,
    status: u.status,
    area: normalizeAreaForForm(u.area),
    areaSqm: String(u.areaSqm ?? metrics.sqm),
    bedrooms: String(u.bedrooms ?? metrics.beds),
    bathrooms: String(u.bathrooms ?? metrics.baths),
    monthlyRate: String(u.monthlyRate),
    moreDetails: u.moreDetails ?? '',
    specialRemarks: u.specialRemarks ?? '',
  };
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

/** Typical layout metrics by unit type (listing cards — not stored on `Unit`). */
function unitDisplayMetrics(type: UnitType): { sqm: number; beds: number; baths: number } {
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
    monthlyRate: u.monthlyRate,
    photoDataUrl: u.photoDataUrl ?? null,
    inventory,
  };
}

function formToUnit(
  id: string,
  form: AddUnitForm,
  inventory: Unit['inventory'],
  photoDataUrl: string | null,
): Unit {
  const rate = Number(String(form.monthlyRate).replace(/,/g, ''));
  const legalAddress = form.legalAddress.trim();
  const commonAddress = legalAddress || form.buildingName.trim();
  const buildingName = deriveBuildingName(commonAddress, form.buildingName) || '—';
  const areaSqm = parseMetricInput(form.areaSqm);
  const bedrooms = parseMetricInput(form.bedrooms);
  const bathrooms = parseMetricInput(form.bathrooms);
  return {
    id,
    unitNumber: form.unitNumber.trim(),
    floor: form.floor.trim() || '—',
    tower: form.tower.trim() || '—',
    buildingName: buildingName.trim() || '—',
    commonAddress: commonAddress || buildingName || '—',
    legalAddress: legalAddress || commonAddress || buildingName || '—',
    type: form.type,
    status: form.status,
    area: form.area.trim() || '—',
    areaSqm: areaSqm ?? undefined,
    bedrooms: bedrooms ?? undefined,
    bathrooms: bathrooms ?? undefined,
    monthlyRate: Number.isFinite(rate) ? rate : 0,
    photoDataUrl,
    moreDetails: form.moreDetails.trim() || undefined,
    specialRemarks: form.specialRemarks.trim() || undefined,
    inventory,
  };
}

export function UnitsView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.units?.create ?? false;
  const canUpdate = session?.crud?.units?.update ?? false;
  const canDelete = session?.crud?.units?.delete ?? false;

  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isManageInventoryOpen, setIsManageInventoryOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddUnitForm>(defaultAddForm);
  const addUnitPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [addUnitPhotoPreview, setAddUnitPhotoPreview] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoPreviewTitle, setPhotoPreviewTitle] = useState('');
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
      const units = await fetchUnits();
      setUnitList(units);
      setUnitsBackedByApi(true);
    } catch {
      setUnitList([]);
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

  const unitRemarksDisplay = selectedUnit?.specialRemarks?.trim() || null;

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

  const processedUnits = useMemo(() => {
    const rows = unitList.filter((u) => {
      const haystack = unitSearchHaystack(u, branchContracts, tenantsList, statusLabel);
      return matchesUniversalSearch(haystack, searchTerm);
    });

    return [...rows].sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );
  }, [unitList, searchTerm, branchContracts, tenantsList, statusLabel]);

  const totalMonthlyRate = useMemo(
    () => processedUnits.reduce((sum, u) => sum + (Number(u.monthlyRate) || 0), 0),
    [processedUnits],
  );

  const openAddUnitModal = useCallback(() => {
    setIsDetailsOpen(false);
    setIsManageInventoryOpen(false);
    setFormMode('create');
    setEditingId(null);
    setAddUnitPhotoPreview('');
    if (addUnitPhotoInputRef.current) addUnitPhotoInputRef.current.value = '';
    setAddForm(defaultAddForm());
    setShowMoreDetails(false);
    setIsAddUnitOpen(true);
  }, []);

  const openEditUnitModal = useCallback((unit: Unit) => {
    setIsDetailsOpen(false);
    setIsManageInventoryOpen(false);
    setFormMode('edit');
    setEditingId(unit.id);
    setAddForm(unitToForm(unit));
    setAddUnitPhotoPreview(unit.photoDataUrl ?? '');
    if (addUnitPhotoInputRef.current) addUnitPhotoInputRef.current.value = '';
    setShowMoreDetails(false);
    setIsAddUnitOpen(true);
  }, []);

  const closeAddUnitModal = useCallback(() => {
    setIsAddUnitOpen(false);
    setFormMode('create');
    setEditingId(null);
    setAddForm(defaultAddForm());
    setAddUnitPhotoPreview('');
    setShowMoreDetails(false);
    if (addUnitPhotoInputRef.current) addUnitPhotoInputRef.current.value = '';
  }, []);

  const openAddUnitPhotoPicker = useCallback(() => {
    addUnitPhotoInputRef.current?.click();
  }, []);

  const handleAddUnitPhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await toWebpDataUrl(file);
        setAddUnitPhotoPreview(dataUrl);
      } catch {
        toast.error(t('views.units.addModal.validationPhotoWebp'));
      }
      e.target.value = '';
    },
    [t],
  );

  const openPhotoPreview = useCallback(
    (photoUrl: string | null | undefined, title?: string) => {
      const url = String(photoUrl ?? '').trim();
      if (!url) return;
      setPhotoPreviewTitle(title ?? t('views.units.addModal.photo'));
      setPhotoPreviewUrl(url);
    },
    [t],
  );

  const closePhotoPreview = useCallback(() => {
    setPhotoPreviewUrl('');
    setPhotoPreviewTitle('');
  }, []);

  const handleSaveUnit = useCallback(async () => {
    const rate = Number(String(addForm.monthlyRate).replace(/,/g, ''));
    if (!addForm.unitNumber.trim()) {
      toast.error(t('views.units.addModal.validationRequired'));
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error(t('views.units.addModal.validationRate'));
      return;
    }
    const existingInventory =
      formMode === 'edit' && editingId
        ? (unitList.find((u) => u.id === editingId)?.inventory ?? [])
        : [];

    const photoDataUrl = addUnitPhotoPreview || null;

    if (!unitsBackedByApi) {
      try {
        if (formMode === 'edit' && editingId) {
          const updated = formToUnit(editingId, addForm, existingInventory, photoDataUrl);
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
          const created = formToUnit(newId, addForm, [], photoDataUrl);
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
      }
      return;
    }

    const body = formToWriteBody(addForm, existingInventory, photoDataUrl);
    try {
      if (formMode === 'edit' && editingId) {
        const updated = await updateUnit(editingId, body);
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
        const created = await createUnit(body);
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
    }
  }, [
    addForm,
    addUnitPhotoPreview,
    closeAddUnitModal,
    editingId,
    formMode,
    t,
    unitList,
    unitsBackedByApi,
  ]);

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

  const addTypeOptions = useMemo(
    () => UNIT_FORM_TYPES.map((ut) => ({ value: ut, label: ut })),
    [],
  );

  const addStatusOptions = useMemo(
    () => UNIT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
    [statusLabel],
  );

  const addFloorOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const floor = `${ordinalFloor(i + 1)} Floor`;
        return { value: floor, label: floor };
      }),
    [],
  );

  const columns: ColumnDef<Unit>[] = useMemo(
    () => [
      {
        header: t('views.units.table.unit'),
        render: (unit) => <span className={meritCellAccentClass}>{unit.unitNumber}</span>,
      },
      {
        header: t('views.units.table.building'),
        render: (unit) => (
          <div className="flex flex-col">
            <span className={meritCellPrimaryClass}>{unit.buildingName}</span>
            <span className={meritCellMetaClass}>
              {unit.tower},{' '}
              {/\bfloor\b/i.test(String(unit.floor ?? ''))
                ? unit.floor
                : `${t('views.units.table.floor')} ${unit.floor}`}
            </span>
          </div>
        ),
      },
      {
        header: t('views.units.table.area'),
        render: (unit) => (
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-tight text-slate-600">
            <MapPin className="w-3 h-3" />
            {areaDisplayLabel(unit.area)}
          </div>
        ),
      },
      {
        header: t('views.units.table.type'),
        render: (unit) => <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">{unit.type}</Badge>,
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
                'border-brand-blue/20 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/10',
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
        render: (unit) => <span className="text-sm font-black tabular-nums text-slate-800">₱{unit.monthlyRate.toLocaleString()}</span>,
      },
      {
        header: t('views.units.table.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (unit) => (
          <div
            className="inline-flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('views.units.table.moreOptions')}
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(unit);
                  }}
                >
                  {t('views.units.table.viewDetails')}
                </DropdownMenuItem>
                {canUpdate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditUnitModal(unit);
                    }}
                  >
                    {t('views.units.table.editUnit')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManageInventory(unit);
                  }}
                >
                  {t('views.units.table.manageInventory')}
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    className="text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteUnit(unit);
                    }}
                  >
                    {t('views.units.table.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
            {canCreate && (
              <Button
                type="button"
                className="h-10 shrink-0 rounded-xl bg-brand-blue shadow-sm hover:bg-[#3d7ab8]"
                onClick={openAddUnitModal}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('views.units.addUnit')}
              </Button>
            )}
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

      {unitsLoading ? (
        viewMode === 'list' ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <SkeletonTable rows={8} columns={7} />
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
                className="px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                {t('views.units.table.totalAmount')}
              </td>
              <td className="px-6 py-3.5 text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
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
            const towerLine =
              unit.tower && unit.tower !== '—' ? `${unit.buildingName} · ${unit.tower}` : unit.buildingName;
            const floorPart = floorLabelForCard(unit.floor, t('views.units.table.floor'));
            const locationSubtitle = floorPart === '—' ? towerLine : `${towerLine} · ${floorPart}`;
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
                        className="mt-0.5 line-clamp-2 text-sm leading-snug text-slate-600 dark:text-slate-300"
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



      <Modal
        isOpen={isDetailsOpen && !isAddUnitOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={
          selectedUnit
            ? t('views.units.unitLabel', { unitNumber: selectedUnit.unitNumber })
            : t('views.units.table.viewDetails')
        }
        maxWidth="lg"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <Button
              type="button"
              className={modalDismissButtonClass}
              onClick={() => setIsDetailsOpen(false)}
            >
              {t('views.units.details.close')}
            </Button>
            {canUpdate && selectedUnit ? (
              <Button
                type="button"
                className={modalActionButtonClass}
                onClick={() => openEditUnitModal(selectedUnit)}
              >
                {t('views.units.details.editUnitInfo')}
              </Button>
            ) : null}
          </div>
        }
        variant="default"
      >
        {selectedUnit ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 aspect-[16/9] dark:border-slate-700 dark:bg-slate-900/40">
              {selectedUnit.photoDataUrl ? (
                <img
                  src={selectedUnit.photoDataUrl}
                  alt={selectedUnit.unitNumber}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <Building2 className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  selectedUnit.status === 'Available' && 'bg-emerald-500 text-white',
                  selectedUnit.status === 'Occupied' && 'bg-brand-blue text-white',
                  selectedUnit.status === 'Maintenance' && 'bg-rose-500 text-white',
                  selectedUnit.status === 'Reserved' && 'bg-amber-500 text-amber-950',
                )}
              >
                {statusLabel(selectedUnit.status)}
              </Badge>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {selectedUnit.type}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
              {(() => {
                const villageName =
                  [selectedUnit.legalAddress, selectedUnit.commonAddress]
                    .map((v) => String(v ?? '').trim())
                    .find((v) => v && v !== '—' && v !== '-') || '';
                const floorTower = resolveUnitFloorTower(selectedUnit);
                const detailField = (label: string, value: React.ReactNode, fullWidth?: boolean) => (
                  <div className={fullWidth ? 'sm:col-span-2' : undefined}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </p>
                    <div className="mt-1 whitespace-normal break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {value}
                    </div>
                  </div>
                );
                const metrics = resolveUnitMetrics(selectedUnit);
                return (
                  <>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                      {detailField(
                        t('views.units.addModal.unitNumber'),
                        villageName || '—',
                        true,
                      )}
                      {detailField(
                        t('views.units.addModal.unitName'),
                        selectedUnit.unitNumber || '—',
                      )}
                      {detailField(
                        t('views.units.addModal.categoryType'),
                        selectedUnit.type || '—',
                      )}
                      {detailField(
                        t('views.addUnitByLocation.panels.location'),
                        <span className="uppercase">{areaDisplayLabel(selectedUnit.area)}</span>,
                      )}
                      {detailField(
                        t('views.addUnitByLocation.panels.building'),
                        <span className="uppercase">{selectedUnit.buildingName || '—'}</span>,
                      )}
                      {detailField(
                        t('views.units.addModal.floor'),
                        floorTower.floor || '—',
                      )}
                      {detailField(
                        t('views.units.addModal.tower'),
                        floorTower.tower || '—',
                      )}
                      {detailField(
                        t('views.units.table.monthlyRate'),
                        <span className="font-bold tabular-nums">
                          ₱{Number(selectedUnit.monthlyRate).toLocaleString()}
                        </span>,
                      )}
                      {detailField(t('views.units.addModal.status'), statusLabel(selectedUnit.status))}
                      <div className="sm:col-span-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {t('views.units.addModal.layoutMetrics')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          <span className="inline-flex items-center gap-1.5" title={t('views.units.card.sqm')}>
                            <Ruler className="h-4 w-4 text-slate-500" aria-hidden />
                            <span className="tabular-nums">{metrics.sqm}</span>
                            <span className="text-[11px] font-medium text-slate-400">
                              {t('views.units.addModal.sqm')}
                            </span>
                          </span>
                          <span
                            className="inline-flex items-center gap-1.5"
                            title={t('views.units.addModal.bedrooms')}
                          >
                            <BedDouble className="h-4 w-4 text-slate-500" aria-hidden />
                            <span className="tabular-nums">{metrics.beds}</span>
                            <span className="text-[11px] font-medium text-slate-400">
                              {t('views.units.addModal.bedrooms')}
                            </span>
                          </span>
                          <span
                            className="inline-flex items-center gap-1.5"
                            title={t('views.units.addModal.bathrooms')}
                          >
                            <Bath className="h-4 w-4 text-slate-500" aria-hidden />
                            <span className="tabular-nums">{metrics.baths}</span>
                            <span className="text-[11px] font-medium text-slate-400">
                              {t('views.units.addModal.bathrooms')}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {t('views.units.addModal.specialRemarks')}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                        {unitRemarksDisplay || t('views.units.details.noRemarks')}
                      </p>
                    </div>

                    {selectedUnit.moreDetails?.trim() ? (
                      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {t('views.units.addModal.moreDetails')}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                          {selectedUnit.moreDetails}
                        </p>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}
      </Modal>

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

      <Modal
        isOpen={isAddUnitOpen}
        onClose={closeAddUnitModal}
        title={formMode === 'edit' ? t('views.units.editModal.title') : t('views.units.addModal.title')}
        maxWidth="3xl"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              type="button"
              className={modalDismissButtonClass}
              onClick={closeAddUnitModal}
            >
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className={modalPrimaryButtonClass}
              onClick={() => void handleSaveUnit()}
            >
              {formMode === 'edit' ? t('views.units.editModal.save') : t('views.units.addModal.save')}
            </Button>
          </div>
        }
      >
        <input
          ref={addUnitPhotoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAddUnitPhotoChange}
        />
        <div className="unit-form-fields grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.units.addModal.photo')}</Label>
            <div className="flex flex-col gap-3">
              <div className="unit-form-bordered relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 aspect-[4/3] max-h-[min(20rem,50vh)] sm:max-h-[22rem] dark:bg-slate-900/40">
                {addUnitPhotoPreview ? (
                  <button
                    type="button"
                    className="flex h-full w-full cursor-zoom-in items-center justify-center"
                    onClick={() =>
                      openPhotoPreview(
                        addUnitPhotoPreview,
                        `${addForm.unitNumber ? t('views.units.unitLabel', { unitNumber: addForm.unitNumber }) : t('views.units.addModal.title')} ${t('views.units.addModal.photo')}`,
                      )
                    }
                  >
                    <img
                      src={addUnitPhotoPreview}
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
                  onClick={openAddUnitPhotoPicker}
                >
                  {t('views.units.addModal.photoUpload')}
                </Button>
                {addUnitPhotoPreview ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-[7.5rem] px-4 rounded-xl border border-rose-200 bg-white font-medium text-rose-600 shadow-none hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    onClick={() => setAddUnitPhotoPreview('')}
                  >
                    {t('views.units.table.delete')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-unit-number">{t('views.units.addModal.unitNumber')}</Label>
            <Input
              id="add-unit-number"
              value={addForm.unitNumber}
              onChange={(e) => setAddForm((f) => ({ ...f, unitNumber: e.target.value }))}
              placeholder="e.g. 1201"
              className="h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
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
                    options={addFloorOptions}
                    value={addForm.floor || null}
                    onChange={(v) => setAddForm((f) => ({ ...f, floor: String(v ?? '') }))}
                    placeholder="Select floor"
                    borderless={false}
                    className="[&_.unit-form-select-control]:!min-h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-tower">{t('views.units.addModal.tower')}</Label>
                  <Input
                    id="add-tower"
                    value={addForm.tower}
                    onChange={(e) => setAddForm((f) => ({ ...f, tower: e.target.value }))}
                    className="h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('views.units.addModal.categoryType')}</Label>
                  <Select2
                    options={addTypeOptions}
                    value={addForm.type}
                    onChange={(v) => {
                      const nextType = (v ?? 'Condominium') as UnitType;
                      const m = unitDisplayMetrics(nextType);
                      setAddForm((f) => ({
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
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.status')}</Label>
            <Select2
              options={addStatusOptions}
              value={addForm.status}
              onChange={(v) =>
                setAddForm((f) => ({ ...f, status: (v ?? 'Available') as UnitStatus }))
              }
              borderless={false}
              className="[&_.unit-form-select-control]:!min-h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-rate">{t('views.units.addModal.monthlyRate')}</Label>
            <Input
              id="add-rate"
              type="text"
              inputMode="decimal"
              value={addForm.monthlyRate}
              onChange={(e) => setAddForm((f) => ({ ...f, monthlyRate: e.target.value }))}
              placeholder="35000"
              className="h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.units.addModal.layoutMetrics')}</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="relative">
                <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="add-sqm"
                  type="text"
                  inputMode="decimal"
                  value={addForm.areaSqm}
                  onChange={(e) => setAddForm((f) => ({ ...f, areaSqm: e.target.value }))}
                  placeholder={t('views.units.addModal.sqm')}
                  aria-label={t('views.units.addModal.sqm')}
                  className="h-12 rounded-xl border border-slate-200 bg-white pl-9 shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
                />
              </div>
              <div className="relative">
                <BedDouble className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="add-bedrooms"
                  type="text"
                  inputMode="numeric"
                  value={addForm.bedrooms}
                  onChange={(e) => setAddForm((f) => ({ ...f, bedrooms: e.target.value }))}
                  placeholder={t('views.units.addModal.bedrooms')}
                  aria-label={t('views.units.addModal.bedrooms')}
                  className="h-12 rounded-xl border border-slate-200 bg-white pl-9 shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
                />
              </div>
              <div className="relative">
                <Bath className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="add-bathrooms"
                  type="text"
                  inputMode="numeric"
                  value={addForm.bathrooms}
                  onChange={(e) => setAddForm((f) => ({ ...f, bathrooms: e.target.value }))}
                  placeholder={t('views.units.addModal.bathrooms')}
                  aria-label={t('views.units.addModal.bathrooms')}
                  className="h-12 rounded-xl border border-slate-200 bg-white pl-9 shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-special-remarks">{t('views.units.addModal.specialRemarks')}</Label>
            <Textarea
              id="add-special-remarks"
              value={addForm.specialRemarks}
              onChange={(e) => setAddForm((f) => ({ ...f, specialRemarks: e.target.value }))}
              placeholder={t('views.units.addModal.specialRemarksPlaceholder')}
              rows={3}
              className="rounded-xl border border-slate-200 bg-white shadow-sm resize-y min-h-[88px] focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(photoPreviewUrl)}
        onClose={closePhotoPreview}
        title={photoPreviewTitle || t('views.units.addModal.photo')}
        maxWidth="3xl"
        variant="default"
        footer={
          <div className="flex justify-end w-full">
            <Button type="button" className={modalDismissButtonClass} onClick={closePhotoPreview}>
              {t('views.units.details.close')}
            </Button>
          </div>
        }
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          {photoPreviewUrl ? (
            <img src={photoPreviewUrl} alt="Photo preview" className="w-full max-h-[70vh] object-contain" />
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
