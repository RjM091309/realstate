import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  MoreVertical,
  Building2,
  MapPin,
  LayoutGrid,
  List as ListIcon,
  History,
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Modal } from '@/components/modal';
import { Select2 } from '@/components/select2';
import { SkeletonTable } from '@/components/skeleton';
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import { createUnit, deleteUnit, fetchUnits, updateUnit, type UnitWriteBody } from '@/lib/unitsApi';
import { cn } from '@/lib/utils';
import type { Contract, InventoryItem, Tenant, Unit, UnitStatus, UnitType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

const UNIT_TYPES: UnitType[] = ['Studio', '1BR', '2BR', '3BR', 'Loft', 'Penthouse'];
const UNIT_STATUSES: UnitStatus[] = ['Available', 'Occupied', 'Maintenance', 'Reserved'];
const AREA_CITIES_LUZON: string[] = [
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
  // Pampanga — area field: city / municipality names only (no province suffix)
  'Mabalacat City',
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

type AddUnitForm = {
  unitNumber: string;
  floor: string;
  tower: string;
  buildingName: string;
  legalAddress: string;
  type: UnitType;
  status: UnitStatus;
  area: string;
  monthlyRate: string;
};

function defaultAddForm(): AddUnitForm {
  return {
    unitNumber: '',
    floor: '',
    tower: '',
    buildingName: '',
    legalAddress: '',
    type: '1BR',
    status: 'Available',
    area: '',
    monthlyRate: '',
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

async function toWebpDataUrl(file: File): Promise<string> {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Not an image');
  }

  // Convert any image type to WEBP using canvas.
  // We also downscale large images to keep payload size reasonable for API transport.
  const maxSide = 1600;
  const quality = 0.82;

  const bitmap = await createImageBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('WEBP conversion failed'));
        else resolve(b);
      },
      'image/webp',
      quality,
    );
  });

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read converted image'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });

  if (!dataUrl.startsWith('data:image/webp')) {
    throw new Error('Unexpected output format');
  }

  return dataUrl;
}

function formToWriteBody(
  form: AddUnitForm,
  inventory: Unit['inventory'],
  photoDataUrl: string | null,
): UnitWriteBody {
  const rate = Number(String(form.monthlyRate).replace(/,/g, ''));
  const legalAddress = form.legalAddress.trim();
  const commonAddress = legalAddress || form.buildingName.trim();
  return {
    unitNumber: form.unitNumber.trim(),
    floor: form.floor.trim() || '—',
    tower: form.tower.trim() || '—',
    buildingName: form.buildingName.trim(),
    commonAddress: commonAddress || '—',
    legalAddress: legalAddress || commonAddress || '—',
    type: form.type,
    status: form.status,
    area: form.area.trim(),
    monthlyRate: rate,
    photoDataUrl,
    inventory,
  };
}

function unitToForm(u: Unit): AddUnitForm {
  return {
    unitNumber: u.unitNumber,
    floor: normalizeFloorForForm(u.floor),
    tower: u.tower === '—' ? '' : u.tower,
    buildingName: u.buildingName,
    legalAddress: u.legalAddress,
    type: u.type,
    status: u.status,
    area: normalizeAreaForForm(u.area),
    monthlyRate: String(u.monthlyRate),
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
    Studio: { sqm: 32, beds: 1, baths: 1 },
    '1BR': { sqm: 45, beds: 1, baths: 1 },
    '2BR': { sqm: 72, beds: 2, baths: 2 },
    '3BR': { sqm: 105, beds: 3, baths: 2 },
    Loft: { sqm: 58, beds: 1, baths: 1 },
    Penthouse: { sqm: 165, beds: 3, baths: 3 },
  };
  return map[type];
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
  return {
    id,
    unitNumber: form.unitNumber.trim(),
    floor: form.floor.trim() || '—',
    tower: form.tower.trim() || '—',
    buildingName: form.buildingName.trim(),
    commonAddress: commonAddress || '—',
    legalAddress: legalAddress || commonAddress || '—',
    type: form.type,
    status: form.status,
    area: form.area.trim(),
    monthlyRate: Number.isFinite(rate) ? rate : 0,
    photoDataUrl,
    inventory,
  };
}

function formatContractPeriod(c: Contract): string {
  try {
    const a = parseISO(c.startDate);
    const b = parseISO(c.endDate);
    return `${format(a, 'MMM yyyy')} - ${format(b, 'MMM yyyy')}`;
  } catch {
    return `${c.startDate} – ${c.endDate}`;
  }
}

function contractStatusLabel(c: Contract, t: (k: string) => string): string {
  if (c.status === 'Active') return t('views.contracts.statuses.active');
  if (c.status === 'Expired') return t('views.contracts.statuses.expired');
  if (c.status === 'Terminated') return t('views.contracts.statuses.terminated');
  return c.status;
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
  const [filterBuilding, setFilterBuilding] = useState<string | null>(null);
  const [filterFloor, setFilterFloor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    'unit_asc' | 'unit_desc' | 'rate_asc' | 'rate_desc' | 'building_asc'
  >('unit_asc');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isManageInventoryOpen, setIsManageInventoryOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddUnitForm>(defaultAddForm);
  const addUnitPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [addUnitPhotoPreview, setAddUnitPhotoPreview] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoPreviewTitle, setPhotoPreviewTitle] = useState('');
  const [detailHeaderPhotoPeek, setDetailHeaderPhotoPeek] = useState(false);
  const detailPhotoPeekCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const clearDetailPhotoPeekCloseTimer = useCallback(() => {
    if (detailPhotoPeekCloseTimer.current) {
      clearTimeout(detailPhotoPeekCloseTimer.current);
      detailPhotoPeekCloseTimer.current = null;
    }
  }, []);

  const scheduleDetailPhotoPeekClose = useCallback(() => {
    clearDetailPhotoPeekCloseTimer();
    detailPhotoPeekCloseTimer.current = setTimeout(() => {
      setDetailHeaderPhotoPeek(false);
      detailPhotoPeekCloseTimer.current = null;
    }, 280);
  }, [clearDetailPhotoPeekCloseTimer]);

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

  const historicalContractsForSelectedUnit = useMemo(() => {
    if (!selectedUnit) return [];
    const rows = branchContracts.filter(
      (c) => c.unitId === selectedUnit.id && (c.status === 'Expired' || c.status === 'Terminated'),
    );
    return [...rows].sort((a, b) => {
      try {
        return parseISO(b.endDate).getTime() - parseISO(a.endDate).getTime();
      } catch {
        return 0;
      }
    });
  }, [selectedUnit, branchContracts]);

  const unitRemarksAggregated = useMemo(() => {
    if (!selectedUnit) return null;
    const forUnit = branchContracts.filter((c) => c.unitId === selectedUnit.id);
    const parts = forUnit
      .map((c) => c.remarks?.trim())
      .filter((r): r is string => Boolean(r));
    return [...new Set(parts)].join('\n\n') || null;
  }, [selectedUnit, branchContracts]);

  useEffect(() => {
    if ((!isDetailsOpen && !isManageInventoryOpen) || !selectedUnit) return;
    setDetailInventoryDraft(normalizeInventoryDraft(selectedUnit.inventory));
  }, [isDetailsOpen, isManageInventoryOpen, selectedUnit]);

  useEffect(() => {
    if (!isDetailsOpen) {
      clearDetailPhotoPeekCloseTimer();
      setDetailHeaderPhotoPeek(false);
    }
  }, [isDetailsOpen, clearDetailPhotoPeekCloseTimer]);

  useEffect(() => () => clearDetailPhotoPeekCloseTimer(), [clearDetailPhotoPeekCloseTimer]);

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

  const buildingFilterOptions = useMemo(() => {
    const names = [...new Set(unitList.map((u) => u.buildingName).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    return names.map((n) => ({ value: n, label: n }));
  }, [unitList]);

  const floorFilterOptions = useMemo(() => {
    const floors = [...new Set(unitList.map((u) => u.floor).filter((f) => f && f !== '—'))].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true }),
    );
    return floors.map((f) => ({ value: String(f), label: String(f) }));
  }, [unitList]);

  const typeFilterOptions = useMemo(
    () => UNIT_TYPES.map((ut) => ({ value: ut, label: ut })),
    [],
  );

  const statusFilterOptions = useMemo(
    () => UNIT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
    [statusLabel],
  );

  const sortSelectOptions = useMemo(
    () => [
      { value: 'unit_asc', label: t('views.units.sort.unitAsc') },
      { value: 'unit_desc', label: t('views.units.sort.unitDesc') },
      { value: 'building_asc', label: t('views.units.sort.buildingAsc') },
      { value: 'rate_asc', label: t('views.units.sort.rateAsc') },
      { value: 'rate_desc', label: t('views.units.sort.rateDesc') },
    ],
    [t],
  );

  const processedUnits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const rows = unitList.filter((u) => {
      if (q) {
        const hay = `${u.unitNumber} ${u.buildingName} ${u.area} ${u.type}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterBuilding && u.buildingName !== filterBuilding) return false;
      if (filterFloor && u.floor !== filterFloor) return false;
      if (filterType && u.type !== filterType) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'unit_desc':
          return b.unitNumber.localeCompare(a.unitNumber, undefined, { numeric: true });
        case 'rate_asc':
          return a.monthlyRate - b.monthlyRate;
        case 'rate_desc':
          return b.monthlyRate - a.monthlyRate;
        case 'building_asc': {
          const c = a.buildingName.localeCompare(b.buildingName);
          return c !== 0 ? c : a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
        }
        case 'unit_asc':
        default:
          return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
      }
    });
  }, [unitList, searchTerm, filterBuilding, filterFloor, filterType, filterStatus, sortBy]);

  const openAddUnitModal = useCallback(() => {
    setIsDetailsOpen(false);
    setIsManageInventoryOpen(false);
    setFormMode('create');
    setEditingId(null);
    setAddUnitPhotoPreview('');
    if (addUnitPhotoInputRef.current) addUnitPhotoInputRef.current.value = '';
    setAddForm(defaultAddForm());
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
    setIsAddUnitOpen(true);
  }, []);

  const closeAddUnitModal = useCallback(() => {
    setIsAddUnitOpen(false);
    setFormMode('create');
    setEditingId(null);
    setAddForm(defaultAddForm());
    setAddUnitPhotoPreview('');
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
    if (!addForm.unitNumber.trim() || !addForm.buildingName.trim()) {
      toast.error(t('views.units.addModal.validationRequired'));
      return;
    }
    if (!addForm.area.trim()) {
      toast.error('Select an area city.');
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
          setSelectedUnit((s) => (s?.id === editingId ? updated : s));
          toast.success(t('views.units.updated'));
          setIsDetailsOpen(false);
          setIsManageInventoryOpen(false);
        } else {
          const newId = `local-${Date.now()}`;
          const created = formToUnit(newId, addForm, [], photoDataUrl);
          setUnitList((prev) => [created, ...prev]);
          toast.success(t('views.units.addModal.saved'));
        }
        closeAddUnitModal();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
      return;
    }

    const body = formToWriteBody(addForm, existingInventory, photoDataUrl);
    try {
      if (formMode === 'edit' && editingId) {
        const updated = await updateUnit(editingId, body);
        setUnitList((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
        setSelectedUnit((s) => (s?.id === editingId ? updated : s));
        toast.success(t('views.units.updated'));
        setIsDetailsOpen(false);
        setIsManageInventoryOpen(false);
      } else {
        const created = await createUnit(body);
        setUnitList((prev) => [created, ...prev]);
        toast.success(t('views.units.addModal.saved'));
      }
      closeAddUnitModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
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
    () => UNIT_TYPES.map((ut) => ({ value: ut, label: ut })),
    [],
  );

  const addStatusOptions = useMemo(
    () => UNIT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
    [statusLabel],
  );

  const addAreaOptions = useMemo(
    () => AREA_CITIES_LUZON.map((city) => ({ value: city, label: city })),
    [],
  );

  const addFloorOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const floor = `${ordinalFloor(i + 1)} floor`;
        return { value: floor, label: floor };
      }),
    [],
  );

  const columns: ColumnDef<Unit>[] = useMemo(
    () => [
      {
        header: t('views.units.table.unit'),
        render: (unit) => <span className="font-bold text-slate-900">{unit.unitNumber}</span>,
      },
      {
        header: t('views.units.table.building'),
        render: (unit) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-700">{unit.buildingName}</span>
            <span className="text-xs text-slate-500">
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
          <div className="flex items-center gap-1 text-slate-600">
            <MapPin className="w-3 h-3" />
            {areaDisplayLabel(unit.area)}
          </div>
        ),
      },
      {
        header: t('views.units.table.type'),
        render: (unit) => <Badge variant="outline" className="font-normal">{unit.type}</Badge>,
      },
      {
        header: t('views.units.table.status'),
        render: (unit) => (
          <Badge
            variant="outline"
            className={cn(
              'font-medium border shadow-none',
              unit.status === 'Available' &&
                'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50',
              unit.status === 'Occupied' &&
                'border-red-200 bg-red-50 text-red-800 hover:bg-red-50',
              unit.status === 'Maintenance' &&
                'border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100',
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
        render: (unit) => <span className="font-semibold">₱{unit.monthlyRate.toLocaleString()}</span>,
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
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-none">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-9 rounded-lg px-3 gap-1.5 dark:text-slate-200',
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
                'h-9 rounded-lg px-3 gap-1.5 dark:text-slate-200',
                viewMode === 'list' && 'bg-slate-100 shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:shadow-none',
              )}
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('views.units.viewList')}</span>
            </Button>
          </div>
          {canCreate && (
            <Button
              type="button"
              className="h-10 rounded-xl bg-slate-900 shadow-md shadow-slate-900/15 hover:bg-slate-800 dark:bg-indigo-600 dark:shadow-indigo-950/40 dark:hover:bg-indigo-500"
              onClick={openAddUnitModal}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('views.units.addUnit')}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm shadow-slate-200/40 backdrop-blur-sm dark:border-slate-700/90 dark:bg-slate-900/85 dark:shadow-lg dark:shadow-black/30 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
            <Input
              placeholder={t('views.units.searchPlaceholder')}
              className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm transition-all hover:border-slate-300 focus-visible:border-slate-900 focus-visible:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-500 dark:focus-visible:border-indigo-500 dark:focus-visible:ring-indigo-500/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('views.units.filters.property')}
              </Label>
              <Select2
                options={buildingFilterOptions}
                value={filterBuilding}
                onChange={(v) => setFilterBuilding(typeof v === 'string' ? v : null)}
                placeholder={t('views.units.filters.propertyPh')}
                className="text-sm"
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('views.units.filters.floor')}
              </Label>
              <Select2
                options={floorFilterOptions}
                value={filterFloor}
                onChange={(v) => setFilterFloor(typeof v === 'string' ? v : null)}
                placeholder={t('views.units.filters.floorPh')}
                className="text-sm"
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('views.units.filters.type')}
              </Label>
              <Select2
                options={typeFilterOptions}
                value={filterType}
                onChange={(v) => setFilterType(typeof v === 'string' ? v : null)}
                placeholder={t('views.units.filters.typePh')}
                className="text-sm"
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('views.units.filters.status')}
              </Label>
              <Select2
                options={statusFilterOptions}
                value={filterStatus}
                onChange={(v) => setFilterStatus(typeof v === 'string' ? v : null)}
                placeholder={t('views.units.filters.statusPh')}
                className="text-sm"
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('views.units.sort.label')}
              </Label>
              <Select2
                options={sortSelectOptions}
                value={sortBy}
                onChange={(v) => {
                  if (v === 'unit_asc' || v === 'unit_desc' || v === 'rate_asc' || v === 'rate_desc' || v === 'building_asc') {
                    setSortBy(v);
                  } else {
                    setSortBy('unit_asc');
                  }
                }}
                placeholder={t('views.units.sort.unitAsc')}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {unitsLoading ? (
        viewMode === 'list' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <SkeletonTable rows={8} columns={7} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900"
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
        />
      ) : processedUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <Building2 className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('views.units.card.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {processedUnits.map((unit) => {
            const metrics = unitDisplayMetrics(unit.type);
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
                  'group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-lg transition-all duration-300',
                  'border-slate-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50',
                  'dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40 dark:hover:shadow-xl dark:hover:shadow-black/60',
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
                      {unit.type}
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

                  <div className="my-4 border-t border-slate-100 dark:border-slate-800" />

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
                    className="mt-auto flex items-stretch gap-2 pt-4"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 flex-1 rounded-lg border-slate-200 bg-white font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                      onClick={() => handleViewDetails(unit)}
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      {t('views.units.card.view')}
                    </Button>
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 flex-1 rounded-lg border-slate-200 bg-white font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        onClick={() => openEditUnitModal(unit)}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        {t('views.units.card.edit')}
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title={t('views.units.table.moreOptions')}
                            className="h-10 w-10 shrink-0 rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
                          />
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManageInventory(unit);
                          }}
                        >
                          {t('views.units.table.manageInventory')}
                        </DropdownMenuItem>
                        {canDelete ? (
                          <DropdownMenuItem
                            variant="destructive"
                            className="text-rose-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteUnit(unit);
                            }}
                          >
                            {t('views.units.table.delete')}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          selectedUnit ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0" onMouseLeave={scheduleDetailPhotoPeekClose}>
                <div
                  className="h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
                  onMouseEnter={() => {
                    clearDetailPhotoPeekCloseTimer();
                    if (selectedUnit.photoDataUrl) setDetailHeaderPhotoPeek(true);
                  }}
                >
                  {selectedUnit.photoDataUrl ? (
                    <img
                      src={selectedUnit.photoDataUrl}
                      alt={`${selectedUnit.unitNumber} photo`}
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Building2 className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <span className="block text-[32px] leading-none font-bold text-slate-900">
                  {t('views.units.unitLabel', { unitNumber: selectedUnit.unitNumber })}
                </span>
                <span className="mt-1 block text-sm font-normal text-slate-500 truncate">
                  {selectedUnit.buildingName} - {selectedUnit.legalAddress?.trim() || selectedUnit.commonAddress?.trim() || '—'}
                </span>
              </div>
            </div>
          ) : (
            ''
          )
        }
        maxWidth="4xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex flex-wrap gap-2">
              {canDelete && selectedUnit ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  onClick={() => void handleDeleteUnit(selectedUnit)}
                >
                  {t('views.units.table.delete')}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3 ml-auto">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-[120px] rounded-xl"
                onClick={() => setIsDetailsOpen(false)}
              >
                {t('views.units.details.close')}
              </Button>
              {canUpdate && selectedUnit ? (
                <Button
                  type="button"
                  className="h-11 min-w-[120px] rounded-xl bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => openEditUnitModal(selectedUnit)}
                >
                  {t('views.units.details.editUnitInfo')}
                </Button>
              ) : null}
            </div>
          </div>
        }
        variant="default"
      >
        <div className="flex justify-end items-start mb-2 pr-2">
          <Badge
            className={cn(
              selectedUnit?.status === 'Available'
                ? 'bg-emerald-500'
                : selectedUnit?.status === 'Occupied'
                  ? 'bg-indigo-500'
                  : selectedUnit?.status === 'Maintenance'
                    ? 'bg-rose-500'
                    : selectedUnit?.status === 'Reserved'
                      ? 'bg-amber-500'
                      : 'bg-slate-500'
            )}
          >
            {selectedUnit?.status ? statusLabel(selectedUnit.status) : ''}
          </Badge>
        </div>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg border border-slate-100 bg-white">
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('views.units.details.monthlyRate')}</p>
                <p className="text-lg font-bold text-slate-900">₱{selectedUnit?.monthlyRate.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-bold uppercase text-slate-400">{t('views.units.details.unitType')}</p>
                <p className="mt-1 text-3xl leading-none font-bold text-slate-900">{selectedUnit?.type || '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-bold uppercase text-slate-400">{t('views.units.table.area')}</p>
                <p className="mt-1 text-3xl leading-none font-bold text-slate-900">
                  {areaDisplayLabel(selectedUnit?.area ?? '')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-indigo-600" />
                {t('views.units.details.inventoryAssets')}
              </h4>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {!selectedUnit?.inventory?.length ? (
                  <p className="text-sm text-slate-500 px-4 py-8">{t('views.units.inventoryEmpty')}</p>
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
                      {selectedUnit.inventory.map((inv) => (
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
                              {inv.condition === 'New'
                                ? t('views.units.details.conditionNew')
                                : inv.condition === 'Good'
                                  ? t('views.units.details.conditionGood')
                                  : inv.condition === 'Fair'
                                    ? t('views.units.details.conditionFair')
                                    : t('views.units.details.conditionPoor')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                {t('views.units.details.legalAddress')}
              </h4>
              <div className="p-4 rounded-xl border border-slate-100 bg-white text-sm text-slate-600 leading-relaxed">
                {selectedUnit?.legalAddress?.trim() ||
                  selectedUnit?.commonAddress?.trim() ||
                  t('views.units.details.addressTemplate', {
                    unitNumber: selectedUnit?.unitNumber,
                    tower: selectedUnit?.tower,
                    buildingName: selectedUnit?.buildingName,
                  })}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-slate-500">
                <History className="w-4 h-4" />
                {t('views.units.details.historicalTenants')}
              </h4>
              <div className="space-y-2">
                {historicalContractsForSelectedUnit.length > 0 ? (
                  historicalContractsForSelectedUnit.map((c) => {
                    const tenantName = tenantsList.find((x) => x.id === c.tenantId)?.name ?? '—';
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white text-sm"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-semibold text-slate-700 truncate">{tenantName}</span>
                          <span className="text-slate-500">{formatContractPeriod(c)}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {contractStatusLabel(c, t)}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">{t('views.units.details.noHistorical')}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-bold flex items-center gap-2 text-amber-600">
                <Plus className="w-4 h-4" />
                {t('views.units.details.specialRequests')}
              </h4>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-900">
                {unitRemarksAggregated ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{unitRemarksAggregated}</p>
                ) : (
                  <p className="italic text-amber-900/80">{t('views.units.details.noRemarks')}</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
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
            <Button type="button" variant="outline" onClick={() => setIsManageInventoryOpen(false)}>
              {t('views.units.details.close')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {selectedUnit?.buildingName} • {selectedUnit?.tower}
            </div>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-slate-300 bg-white px-4 font-medium text-slate-800 shadow-none hover:bg-slate-50"
                onClick={openInventoryAddModal}
              >
                <Plus className="w-4 h-4 mr-1.5" aria-hidden />
                {t('views.units.details.addInventoryItem')}
              </Button>
            ) : null}
          </div>

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
            <Button type="button" variant="outline" onClick={resetInventoryForm} disabled={inventorySaving}>
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700"
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
            <Button type="button" variant="outline" onClick={resetInventoryForm} disabled={inventorySaving}>
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700"
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
              variant="outline"
              className="h-11 min-w-[120px] rounded-xl"
              onClick={closeAddUnitModal}
            >
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-[120px] rounded-xl bg-indigo-600 hover:bg-indigo-700"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.units.addModal.photo')}</Label>
            <div className="flex flex-col gap-3">
              <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 aspect-[4/3] max-h-[min(20rem,50vh)] sm:max-h-[22rem]">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={openAddUnitPhotoPicker}
                >
                  {t('views.units.addModal.photoUpload')}
                </Button>
                {addUnitPhotoPreview ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
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
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.floor')}</Label>
            <Select2
              options={addFloorOptions}
              value={addForm.floor || null}
              onChange={(v) => setAddForm((f) => ({ ...f, floor: String(v ?? '') }))}
              placeholder="Select floor"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-tower">{t('views.units.addModal.tower')}</Label>
            <Input
              id="add-tower"
              value={addForm.tower}
              onChange={(e) => setAddForm((f) => ({ ...f, tower: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-building">{t('views.units.addModal.buildingName')}</Label>
            <Input
              id="add-building"
              value={addForm.buildingName}
              onChange={(e) => setAddForm((f) => ({ ...f, buildingName: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-legal">{t('views.units.addModal.legalAddress')}</Label>
            <Input
              id="add-legal"
              value={addForm.legalAddress}
              onChange={(e) => setAddForm((f) => ({ ...f, legalAddress: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.type')}</Label>
            <Select2
              options={addTypeOptions}
              value={addForm.type}
              onChange={(v) =>
                setAddForm((f) => ({ ...f, type: (v ?? '1BR') as UnitType }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.status')}</Label>
            <Select2
              options={addStatusOptions}
              value={addForm.status}
              onChange={(v) =>
                setAddForm((f) => ({ ...f, status: (v ?? 'Available') as UnitStatus }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.area')}</Label>
            <Select2
              options={addAreaOptions}
              value={addForm.area || null}
              onChange={(v) =>
                setAddForm((f) => ({ ...f, area: String(v ?? '') }))
              }
              placeholder="Type city to search..."
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
              className="h-12 rounded-xl border-slate-200"
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
            <Button type="button" variant="outline" onClick={closePhotoPreview}>
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

      {typeof document !== 'undefined' &&
        detailHeaderPhotoPeek &&
        selectedUnit?.photoDataUrl &&
        createPortal(
          <div
            role="presentation"
            className="pointer-events-auto fixed left-1/2 top-1/2 z-[160] flex max-h-[min(90vh,52rem)] w-[min(94vw,44rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            onMouseEnter={clearDetailPhotoPeekCloseTimer}
            onMouseLeave={scheduleDetailPhotoPeekClose}
          >
            <div className="animate-in fade-in zoom-in-95 flex w-full max-h-[min(90vh,52rem)] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-2xl ring-4 ring-black/5 duration-150 sm:p-5">
              <img
                src={selectedUnit.photoDataUrl}
                alt=""
                className="mx-auto max-h-[min(86vh,48rem)] w-auto max-w-full object-contain object-center"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
