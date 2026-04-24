import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Building2,
  MapPin,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  History,
  Loader2,
  Pencil,
  Trash2,
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
import { format, parseISO } from 'date-fns';
import { units as seedUnits } from '@/lib/mockData';
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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:image/webp;base64,${btoa(binary)}`;
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

function statusBadgeClass(status: string): string {
  if (status === 'Available') return 'bg-emerald-500';
  if (status === 'Occupied') return 'bg-indigo-500';
  if (status === 'Maintenance') return 'bg-rose-500';
  if (status === 'Reserved') return 'bg-amber-500';
  return 'bg-slate-500';
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
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
      setUnitList([...seedUnits]);
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

  const filteredUnits = unitList.filter(
    (u) =>
      u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.buildingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.area.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      const isWebpMime = file.type === 'image/webp';
      const isWebpExt = /\.webp$/i.test(file.name);
      if (!isWebpMime && !isWebpExt) {
        toast.error(t('views.units.addModal.validationPhotoWebp'));
        e.target.value = '';
        return;
      }
      try {
        const dataUrl = await toWebpDataUrl(file);
        setAddUnitPhotoPreview(dataUrl);
      } catch {
        toast.error('Failed to load image.');
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
              'font-medium border-0',
              unit.status === 'Available' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
              unit.status === 'Occupied' && 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
              unit.status === 'Maintenance' && 'bg-rose-100 text-rose-700 hover:bg-rose-100',
              unit.status === 'Reserved' && 'bg-amber-100 text-amber-800 hover:bg-amber-100'
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.units.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.units.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setViewMode('list')} className={cn(viewMode === 'list' && 'bg-slate-100')}>
            <ListIcon className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewMode('grid')} className={cn(viewMode === 'grid' && 'bg-slate-100')}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          {canCreate && (
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={openAddUnitModal}>
              <Plus className="w-4 h-4 mr-2" />
              {t('views.units.addUnit')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder={t('views.units.searchPlaceholder')}
            className="h-10 rounded-xl pl-10 pr-4 border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-100 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm">
          <Filter className="w-4 h-4 mr-2" />
          {t('views.units.filter')}
        </Button>
      </div>

      {unitsLoading ? (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
          <SkeletonTable rows={8} columns={7} />
        </div>
      ) : viewMode === 'list' ? (
        <DataTable
          data={filteredUnits}
          columns={columns}
          keyExtractor={(u) => u.id}
          onRowClick={(unit) => handleViewDetails(unit)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden"
            >
              {/* Photo area */}
              <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden">
                {unit.photoDataUrl ? (
                  <img
                    src={unit.photoDataUrl}
                    alt={`${unit.unitNumber} preview`}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Building2 className="w-14 h-14 text-slate-200" />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

                {/* Status pill — bottom left */}
                <div className="absolute bottom-3 left-3">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm',
                    unit.status === 'Available' && 'bg-emerald-500/90 text-white',
                    unit.status === 'Occupied' && 'bg-indigo-500/90 text-white',
                    unit.status === 'Maintenance' && 'bg-rose-500/90 text-white',
                    unit.status === 'Reserved' && 'bg-amber-500/90 text-white',
                  )}>
                    <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                    {statusLabel(unit.status)}
                  </span>
                </div>

                {/* Actions menu — top right, visible on hover */}
                <div
                  className="absolute top-2.5 right-2.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 rounded-full bg-white/90 border-0 shadow-sm hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(unit); }}>
                        {t('views.units.table.viewDetails')}
                      </DropdownMenuItem>
                      {canUpdate && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditUnitModal(unit); }}>
                          {t('views.units.table.editUnit')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleManageInventory(unit); }}>
                        {t('views.units.table.manageInventory')}
                      </DropdownMenuItem>
                      {canDelete && (
                        <DropdownMenuItem
                          variant="destructive"
                          className="text-rose-600"
                          onClick={(e) => { e.stopPropagation(); void handleDeleteUnit(unit); }}
                        >
                          {t('views.units.table.delete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Card body */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {t('views.units.unitLabel', { unitNumber: unit.unitNumber })}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{unit.buildingName}</p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="text-sm font-bold text-indigo-600 tabular-nums">₱{unit.monthlyRate.toLocaleString()}</span>
                    <span className="block text-[10px] text-slate-400 font-normal">/mo</span>
                  </p>
                </div>

                {/* Info row */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 min-w-0">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{areaDisplayLabel(unit.area)}</span>
                  </span>
                  <span className="h-3 w-px bg-slate-200 shrink-0" />
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                    <LayoutGrid className="w-3 h-3 shrink-0" />
                    {unit.type}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 pb-4">
                <button
                  type="button"
                  className="w-full h-9 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-1.5"
                  onClick={() => handleViewDetails(unit)}
                >
                  {t('views.units.table.viewDetails')}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}



      <Modal
        isOpen={isDetailsOpen && !isAddUnitOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={
          selectedUnit ? (
            <div className="flex items-start gap-3 min-w-0">
              <button
                type="button"
                onClick={() =>
                  openPhotoPreview(
                    selectedUnit.photoDataUrl,
                    `${t('views.units.unitLabel', { unitNumber: selectedUnit.unitNumber })} ${t('views.units.addModal.photo')}`,
                  )
                }
                className={cn(
                  "h-16 w-24 shrink-0 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden",
                  selectedUnit.photoDataUrl ? "cursor-zoom-in" : "cursor-default",
                )}
                title={t('views.units.addModal.photo')}
              >
                {selectedUnit.photoDataUrl ? (
                  <img
                    src={selectedUnit.photoDataUrl}
                    alt={`${selectedUnit.unitNumber} photo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400">
                    <Building2 className="w-6 h-6" />
                  </div>
                )}
              </button>
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
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('views.units.details.monthlyRate')}</p>
                <p className="text-lg font-bold text-slate-900">₱{selectedUnit?.monthlyRate.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-[11px] font-bold uppercase text-slate-400">{t('views.units.details.unitType')}</p>
                <p className="mt-1 text-3xl leading-none font-bold text-slate-900">{selectedUnit?.type || '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
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
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
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
        maxWidth="2xl"
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
          accept="image/webp,.webp"
          className="hidden"
          onChange={handleAddUnitPhotoChange}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.units.addModal.photo')}</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-24 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                {addUnitPhotoPreview ? (
                  <button
                    type="button"
                    className="h-full w-full cursor-zoom-in"
                    onClick={() =>
                      openPhotoPreview(
                        addUnitPhotoPreview,
                        `${addForm.unitNumber ? t('views.units.unitLabel', { unitNumber: addForm.unitNumber }) : t('views.units.addModal.title')} ${t('views.units.addModal.photo')}`,
                      )
                    }
                  >
                    <img src={addUnitPhotoPreview} alt="Unit photo preview" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <Building2 className="w-6 h-6" />
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
            <p className="text-xs text-slate-500">{t('views.units.addModal.photoHint')}</p>
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
    </div>
  );
}
