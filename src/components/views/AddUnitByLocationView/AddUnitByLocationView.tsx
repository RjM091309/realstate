import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, Eye, FolderCog, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button, modalDismissButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/modal';
import { LocEmpty, LocPanel, locBoard } from '@/components/location-board/LocationBoard';
import { CategoryMaintenanceList } from '@/components/file-maintenance/CategoryMaintenanceList';
import { UnitFormModal } from '@/components/units/UnitFormModal';
import { UnitDetailsModal } from '@/components/units/UnitDetailsModal';
import {
  getCoreCategoryName,
  loadFileMaintenanceCategories,
  saveFileMaintenanceCategories,
  type FileMaintenanceCategory,
} from '@/lib/fileMaintenanceCategories';
import { seedAngelesCityBarangays, ANGELES_CITY_NAME, isAngelesCity } from '@/data/angelesCityBarangays';
import {
  seedMabalacatCityBarangays,
  MABALACAT_CITY_NAME,
  isMabalacatCity,
} from '@/data/mabalacatCityBarangays';
import { seedClarkCityAreas, CLARK_CITY_NAME, isClarkCity } from '@/data/clarkCityAreas';
import {
  seedSanFernandoCityBarangays,
  SAN_FERNANDO_CITY_NAME,
  isSanFernandoCity,
} from '@/data/sanFernandoCityBarangays';
import {
  seedMagalangCityBarangays,
  MAGALANG_CITY_NAME,
  isMagalangCity,
} from '@/data/magalangCityBarangays';
import {
  seedPoracCityBarangays,
  PORAC_CITY_NAME,
  isPoracCity,
} from '@/data/poracCityBarangays';
import {
  seedBacolorCityBarangays,
  BACOLOR_CITY_NAME,
  isBacolorCity,
} from '@/data/bacolorCityBarangays';
import {
  softDeleteLocationBuilding,
} from '@/lib/locationBuildingsApi';
import {
  createBrgy,
  createCity,
  deleteBrgy,
  deleteCity,
  fetchBrgys,
  fetchCities,
  renameBrgy,
  renameCity,
  type LocationBrgy,
  type LocationCity,
} from '@/lib/locationsApi';
import { createUnit, deleteUnit, fetchUnits, updateUnit, type UnitWriteBody } from '@/lib/unitsApi';
import { UNIT_FORM_TYPES, formatUnitFloorTowerMeta, formatUnitNumberDisplay, resolveUnitPhotos, unitToFormState, type UnitFormState } from '@/lib/unitFormUtils';
import { normalizeLocationLabel, normalizeLocationAliasLabel, stripLocationOrdinalPrefix, hasLocationOrdinalPrefix, withLocationOrdinalPrefix } from '@/lib/locationNames';
import { cn } from '@/lib/utils';
import type { Unit, UnitStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

type UnitSortField = 'unit' | 'type' | 'sqm' | 'beds' | 'status' | 'rate';
type UnitSortDir = 'asc' | 'desc';

const UNIT_STATUSES: UnitStatus[] = ['Available', 'Occupied', 'Maintenance', 'Reserved'];

function locationKey(unit: Unit): string {
  return String(unit.area ?? '').trim() || '—';
}

function buildingKey(unit: Unit): string {
  return String(unit.buildingName ?? '').trim() || '—';
}

const SEEDED_CITY_NAMES = [
  ANGELES_CITY_NAME,
  MABALACAT_CITY_NAME,
  CLARK_CITY_NAME,
  SAN_FERNANDO_CITY_NAME,
  MAGALANG_CITY_NAME,
  PORAC_CITY_NAME,
  BACOLOR_CITY_NAME,
] as const;

/** Collapse casing / alias / ordinal variants (e.g. "1. Clark" + Clark) into one identity. */
function locationAliasKey(name: string): string {
  const n = normalizeLocationAliasLabel(name);
  if (!n || n === '—') return n;
  if (isAngelesCity(n)) return 'angeles-city';
  if (isMabalacatCity(n)) return 'mabalacat';
  if (isClarkCity(n)) return 'clark';
  if (isSanFernandoCity(n)) return 'san-fernando';
  if (isMagalangCity(n)) return 'magalang';
  if (isPoracCity(n)) return 'porac';
  if (isBacolorCity(n)) return 'bacolor';
  return n.toLowerCase().replace(/\s+/g, ' ');
}

function canonicalLocationName(name: string): string {
  const n = normalizeLocationAliasLabel(name);
  if (!n || n === '—') return n;
  if (isAngelesCity(n)) return ANGELES_CITY_NAME;
  if (isMabalacatCity(n)) return MABALACAT_CITY_NAME;
  if (isClarkCity(n)) return CLARK_CITY_NAME;
  if (isSanFernandoCity(n)) return SAN_FERNANDO_CITY_NAME;
  if (isMagalangCity(n)) return MAGALANG_CITY_NAME;
  if (isPoracCity(n)) return PORAC_CITY_NAME;
  if (isBacolorCity(n)) return BACOLOR_CITY_NAME;
  return normalizeLocationLabel(name);
}

function sameLocation(a: string, b: string): boolean {
  return locationAliasKey(a) === locationAliasKey(b);
}

function dedupeLocations(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const name = canonicalLocationName(raw);
    if (!name) continue;
    const key = locationAliasKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  for (const seed of SEEDED_CITY_NAMES) {
    const key = locationAliasKey(seed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(seed);
  }
  return out;
}

function unitToWriteBody(unit: Unit, patch: Partial<UnitWriteBody> = {}): UnitWriteBody {
  return {
    unitNumber: unit.unitNumber,
    floor: unit.floor || '—',
    tower: unit.tower || '—',
    buildingName: unit.buildingName,
    commonAddress: unit.commonAddress || unit.buildingName,
    legalAddress: unit.legalAddress || unit.buildingName,
    type: unit.type,
    status: unit.status,
    area: unit.area,
    areaSqm: unit.areaSqm ?? null,
    bedrooms: unit.bedrooms ?? null,
    bathrooms: unit.bathrooms ?? null,
    monthlyRate: Number(unit.monthlyRate) || 0,
    photoDataUrl: unit.photoDataUrl ?? null,
    photos: unit.photos ?? (unit.photoDataUrl ? [unit.photoDataUrl] : []),
    moreDetails: unit.moreDetails,
    specialRemarks: unit.specialRemarks,
    inventory: unit.inventory ?? [],
    ...patch,
  };
}

/**
 * Separate Add Unit workspace: Location → Building (subcategory) → Units.
 */
export function AddUnitByLocationView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.units?.create ?? false;
  const canUpdate = session?.crud?.units?.update ?? false;
  const canDelete = session?.crud?.units?.delete ?? false;

  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UnitStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [sortField, setSortField] = useState<UnitSortField>('unit');
  const [sortDir, setSortDir] = useState<UnitSortDir>('asc');

  useEffect(() => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSortField('unit');
    setSortDir('asc');
    setSearch('');
  }, [selectedLocation, selectedBuilding]);
  const [fileMaintenanceOpen, setFileMaintenanceOpen] = useState(false);
  const [categories, setCategories] = useState<FileMaintenanceCategory[]>(() =>
    loadFileMaintenanceCategories(),
  );
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  /** Stable capture so Save always renames the opened city (avoids stale closure → create). */
  const editingCityIdRef = useRef<string | null>(null);
  const locationNameRef = useRef('');
  const [locationName, setLocationName] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);

  const [addBuildingOpen, setAddBuildingOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
  const [editingBrgyId, setEditingBrgyId] = useState<string | null>(null);
  const [buildingName, setBuildingName] = useState('');
  const [buildingBusy, setBuildingBusy] = useState(false);

  const [extraLocations, setExtraLocations] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('realstate.extraLocations');
      if (!raw) return [...SEEDED_CITY_NAMES];
      const parsed = JSON.parse(raw) as unknown;
      const list = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
      return dedupeLocations(list);
    } catch {
      return [...SEEDED_CITY_NAMES];
    }
  });

  const [extraBuildings, setExtraBuildings] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('realstate.extraBuildings');
      let out: Record<string, string[]> = {};
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (!Array.isArray(value)) continue;
            out[key] = value.map(String).map((x) => x.trim()).filter(Boolean);
          }
        }
      }
      const keys = [
        ...Object.keys(out),
        'Angeles City',
        'Mabalacat',
        'Clark',
        'San Fernando',
        'Magalang',
        'Porac',
        'Bacolor',
      ];
      out = seedAngelesCityBarangays(out, keys);
      out = seedMabalacatCityBarangays(out, keys);
      out = seedClarkCityAreas(out, keys);
      out = seedSanFernandoCityBarangays(out, keys);
      out = seedMagalangCityBarangays(out, keys);
      out = seedPoracCityBarangays(out, keys);
      out = seedBacolorCityBarangays(out, keys);
      try {
        localStorage.setItem('realstate.extraBuildings', JSON.stringify(out));
      } catch {
        /* ignore */
      }
      return out;
    } catch {
      return seedBacolorCityBarangays(
        seedPoracCityBarangays(
          seedMagalangCityBarangays(
            seedSanFernandoCityBarangays(
              seedClarkCityAreas(
                seedMabalacatCityBarangays(seedAngelesCityBarangays({}, ['Angeles City']), [
                  'Mabalacat',
                ]),
                ['Clark'],
              ),
              ['San Fernando'],
            ),
            ['Magalang'],
          ),
          ['Porac'],
        ),
        ['Bacolor'],
      );
    }
  });

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [addInitial, setAddInitial] = useState<Partial<UnitFormState>>({});
  const [addInitialPhoto, setAddInitialPhoto] = useState<string | null>(null);
  const [addInitialPhotos, setAddInitialPhotos] = useState<string[]>([]);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  /** Managed cities from `city` table (source of truth for CITY panel). */
  const [managedCities, setManagedCities] = useState<LocationCity[]>([]);
  /** Managed barangays from `brgy` table (source of truth for BRGY panel). */
  const [managedBrgys, setManagedBrgys] = useState<LocationBrgy[]>([]);

  const panelLocation = getCoreCategoryName(
    categories,
    'location',
    t('views.addUnitByLocation.panels.location'),
  );
  const panelBuilding = getCoreCategoryName(
    categories,
    'building',
    t('views.addUnitByLocation.panels.building'),
  );
  const panelUnits = getCoreCategoryName(
    categories,
    'units',
    t('views.addUnitByLocation.panels.units'),
  );

  const updateCategories = useCallback((next: FileMaintenanceCategory[]) => {
    setCategories(next);
    saveFileMaintenanceCategories(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cities, brgys] = await Promise.all([
        fetchUnits(),
        fetchCities(),
        fetchBrgys(),
      ]);
      setUnits(list);
      setManagedCities(cities);
      setManagedBrgys(brgys);
      // Keep local cache in sync with DB cities only — never re-inject seed names.
      const cleaned = cities.map((c) => c.name);
      setExtraLocations(cleaned);
      try {
        localStorage.setItem('realstate.extraLocations', JSON.stringify(cleaned));
      } catch {
        /* ignore */
      }
    } catch {
      toast.warning(t('views.units.loadError'));
      // Keep existing city/brgy rows on transient auth/network errors so a
      // successful rename is not wiped from the CITY panel.
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // One-time rewrite so localStorage drops Angeles / Angeles City duplicates.
  useEffect(() => {
    try {
      localStorage.setItem('realstate.extraLocations', JSON.stringify(extraLocations));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate once on mount
  }, []);

  const locations = useMemo(() => {
    // CITY panel is driven by DB `city` rows only (with cityId).
    // Fold ordinal/bare aliases so "1. Clark" and "Clark" never both show.
    const map = new Map<string, { cityId: string; name: string; count: number }>();

    for (const city of managedCities) {
      const name = String(city.name ?? '').trim();
      if (!name) continue;
      const key = locationAliasKey(name);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { cityId: city.cityId, name, count: 0 });
        continue;
      }
      // Prefer numbered category label ("1. Clark") over bare ("Clark").
      if (hasLocationOrdinalPrefix(name) && !hasLocationOrdinalPrefix(prev.name)) {
        map.set(key, { cityId: city.cityId, name, count: prev.count });
      }
    }

    for (const u of units) {
      const raw = locationKey(u);
      if (!raw || raw === '—') continue;
      for (const loc of map.values()) {
        if (sameLocation(loc.name, raw) || locationAliasKey(loc.name) === locationAliasKey(raw)) {
          loc.count += 1;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const aNum = a.name.match(/^#?(\d+)[.)\]:\-]\s+/u);
      const bNum = b.name.match(/^#?(\d+)[.)\]:\-]\s+/u);
      if (aNum && bNum) return Number(aNum[1]) - Number(bNum[1]);
      if (aNum) return -1;
      if (bNum) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [units, managedCities]);

  const persistExtraLocations = useCallback((next: string[]) => {
    // Dedupe only — do not force-append seeded city names.
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of next) {
      const name = normalizeLocationLabel(raw);
      if (!name) continue;
      const key = locationAliasKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(name);
    }
    setExtraLocations(cleaned);
    try {
      localStorage.setItem('realstate.extraLocations', JSON.stringify(cleaned));
    } catch {
      /* ignore */
    }
  }, []);

  const persistExtraBuildings = useCallback((next: Record<string, string[]>) => {
    setExtraBuildings(next);
    try {
      localStorage.setItem('realstate.extraBuildings', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const selectedCityId = useMemo(() => {
    if (!selectedLocation) return null;
    return (
      managedCities.find(
        (c) =>
          sameLocation(c.name, selectedLocation) ||
          c.name.trim().toLowerCase() === selectedLocation.trim().toLowerCase(),
      )?.cityId ?? null
    );
  }, [managedCities, selectedLocation]);

  const buildingsForLocation = useCallback(
    (location: string) => {
      const city = managedCities.find(
        (c) =>
          sameLocation(c.name, location) ||
          c.name.trim().toLowerCase() === location.trim().toLowerCase(),
      );
      const map = new Map<string, { brgyId?: string; name: string; count: number }>();

      if (city) {
        for (const row of managedBrgys) {
          if (String(row.cityId) !== String(city.cityId)) continue;
          const name = row.name.trim();
          if (!name) continue;
          map.set(row.brgyId, { brgyId: row.brgyId, name, count: 0 });
        }
      }

      for (const u of units) {
        if (!sameLocation(locationKey(u), location)) continue;
        const name = buildingKey(u);
        if (!name || name === '—') continue;
        let matched = false;
        for (const loc of map.values()) {
          if (loc.name.trim().toLowerCase() === name.toLowerCase()) {
            loc.count += 1;
            matched = true;
            break;
          }
        }
        // Orphan unit buildings not in brgy table — show only if no DB brgys yet.
        if (!matched && map.size === 0) {
          const key = `orphan:${name.toLowerCase()}`;
          const cur = map.get(key) ?? { name, count: 0 };
          cur.count += 1;
          map.set(key, cur);
        }
      }

      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    [managedBrgys, managedCities, units],
  );

  const openAddLocation = useCallback(() => {
    setEditingLocation(null);
    setEditingCityId(null);
    editingCityIdRef.current = null;
    locationNameRef.current = '';
    setLocationName('');
    setAddLocationOpen(true);
  }, []);

  const openEditLocation = useCallback((loc: { cityId?: string; name: string }) => {
    const cityId =
      loc.cityId ||
      managedCities.find(
        (c) =>
          sameLocation(c.name, loc.name) ||
          c.name.trim().toLowerCase() === loc.name.trim().toLowerCase(),
      )?.cityId ||
      null;
    if (!cityId) {
      toast.error(t('views.addUnitByLocation.locationRequired'));
      return;
    }
    const initial = loc.name === '—' ? '' : loc.name;
    setEditingLocation(loc.name);
    setEditingCityId(String(cityId));
    editingCityIdRef.current = String(cityId);
    locationNameRef.current = initial;
    setLocationName(initial);
    setAddLocationOpen(true);
  }, [managedCities, t]);

  const closeAddLocation = useCallback(() => {
    setAddLocationOpen(false);
    setEditingLocation(null);
    setEditingCityId(null);
    editingCityIdRef.current = null;
    locationNameRef.current = '';
    setLocationName('');
  }, []);

  const saveLocation = useCallback(async () => {
    // Prefer live DOM value — controlled state/ref can lag if the field remounts mid-type.
    const inputEl = document.getElementById('add-location-name') as HTMLInputElement | null;
    const typed = (inputEl?.value ?? locationNameRef.current) || locationName;
    const name = normalizeLocationLabel(typed);
    if (!name) {
      toast.error(t('views.addUnitByLocation.locationRequired'));
      return;
    }
    locationNameRef.current = name;
    setLocationName(name);

    // EDIT must use captured cityId — never fall through to create.
    const cityIdToEdit = editingCityIdRef.current || editingCityId;
    if (cityIdToEdit) {
      const matched = managedCities.find((c) => String(c.cityId) === String(cityIdToEdit));
      const previousName = matched?.name || editingLocation || name;

      if (previousName.trim() === name) {
        closeAddLocation();
        return;
      }

      const clash = managedCities.some(
        (c) =>
          String(c.cityId) !== String(cityIdToEdit) &&
          (sameLocation(c.name, name) || c.name.trim().toLowerCase() === name.toLowerCase()),
      );
      if (clash) {
        toast.error(t('views.addUnitByLocation.locationExists'));
        return;
      }

      setLocationBusy(true);
      try {
        const updated = await renameCity(String(cityIdToEdit), name);
        const affected = units.filter(
          (u) =>
            sameLocation(locationKey(u), previousName) ||
            locationKey(u).trim().toLowerCase() === previousName.trim().toLowerCase(),
        );
        for (const unit of affected) {
          try {
            await updateUnit(unit.id, unitToWriteBody(unit, { area: updated.name }));
          } catch (unitErr) {
            console.warn('[saveLocation] unit area sync skipped:', unitErr);
          }
        }
        // Move local building cache key with the city rename.
        if (previousName.trim().toLowerCase() !== updated.name.trim().toLowerCase()) {
          const nextBuildings = { ...extraBuildings };
          let buildingsChanged = false;
          for (const key of Object.keys(nextBuildings)) {
            if (
              !sameLocation(key, previousName) &&
              key.trim().toLowerCase() !== previousName.trim().toLowerCase()
            ) {
              continue;
            }
            nextBuildings[updated.name] = nextBuildings[key] ?? nextBuildings[updated.name] ?? [];
            if (key !== updated.name) {
              delete nextBuildings[key];
              buildingsChanged = true;
            }
          }
          if (buildingsChanged) persistExtraBuildings(nextBuildings);
        }
        persistExtraLocations(
          extraLocations
            .filter(
              (x) =>
                !sameLocation(x, previousName) &&
                x.trim().toLowerCase() !== previousName.trim().toLowerCase(),
            )
            .concat(updated.name),
        );
        if (
          selectedLocation &&
          (sameLocation(selectedLocation, previousName) ||
            selectedLocation.trim().toLowerCase() === previousName.trim().toLowerCase())
        ) {
          setSelectedLocation(updated.name);
        }
        // Optimistic update so the CITY list reflects the new name immediately.
        setManagedCities((prev) =>
          prev.map((c) =>
            String(c.cityId) === String(cityIdToEdit) ? { ...c, name: updated.name } : c,
          ),
        );
        toast.success(t('views.addUnitByLocation.locationUpdated'));
        closeAddLocation();
        // Refresh from DB, but do not wipe the optimistic name if reload fails.
        try {
          await load();
        } catch {
          /* load() already toasts */
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      } finally {
        setLocationBusy(false);
      }
      return;
    }

    if (editingLocation) {
      toast.error(t('views.addUnitByLocation.locationRequired'));
      return;
    }

    // Create: CITY category always uses "N. Name".
    const createName = withLocationOrdinalPrefix(
      name,
      managedCities.map((c) => c.name),
    );
    const exists = managedCities.some(
      (c) =>
        sameLocation(c.name, createName) ||
        c.name.trim().toLowerCase() === createName.toLowerCase(),
    );
    if (exists) {
      toast.message(t('views.addUnitByLocation.locationExists'));
      setSelectedLocation(
        managedCities.find(
          (c) =>
            sameLocation(c.name, createName) ||
            c.name.trim().toLowerCase() === createName.toLowerCase(),
        )?.name ?? createName,
      );
      closeAddLocation();
      return;
    }

    setLocationBusy(true);
    try {
      const created = await createCity(createName);
      persistExtraLocations([...extraLocations, created.name]);
      setSelectedLocation(created.name);
      setSelectedBuilding(null);
      setManagedCities((prev) => [...prev, created]);
      toast.success(t('views.addUnitByLocation.locationAdded'));
      closeAddLocation();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLocationBusy(false);
    }
  }, [
    closeAddLocation,
    editingCityId,
    editingLocation,
    extraBuildings,
    extraLocations,
    load,
    locationName,
    managedCities,
    persistExtraBuildings,
    persistExtraLocations,
    selectedLocation,
    t,
    units,
  ]);

  const deleteLocation = useCallback(
    async (loc: { cityId?: string; name: string }) => {
      const name = loc.name;
      const affected = units.filter((u) => sameLocation(locationKey(u), name));
      if (affected.length > 0) {
        if (
          !window.confirm(
            t('views.addUnitByLocation.deleteLocationWithUnitsConfirm', {
              name,
              count: affected.length,
            }),
          )
        ) {
          return;
        }
        try {
          for (const unit of affected) {
            await deleteUnit(unit.id);
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Error');
          return;
        }
      } else if (!window.confirm(t('views.addUnitByLocation.deleteLocationConfirm', { name }))) {
        return;
      }

      try {
        const cityId =
          loc.cityId ||
          managedCities.find((c) => sameLocation(c.name, name))?.cityId ||
          null;
        if (cityId) {
          await deleteCity(cityId);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
        return;
      }

      persistExtraLocations(extraLocations.filter((x) => !sameLocation(x, name)));
      const nextBuildings = { ...extraBuildings };
      let buildingsChanged = false;
      for (const key of Object.keys(nextBuildings)) {
        if (!sameLocation(key, name)) continue;
        delete nextBuildings[key];
        buildingsChanged = true;
      }
      if (buildingsChanged) persistExtraBuildings(nextBuildings);
      if (selectedLocation && sameLocation(selectedLocation, name)) {
        setSelectedLocation(null);
        setSelectedBuilding(null);
      }
      toast.success(t('views.addUnitByLocation.locationDeleted'));
      await load();
    },
    [
      extraBuildings,
      extraLocations,
      load,
      managedCities,
      persistExtraBuildings,
      persistExtraLocations,
      selectedLocation,
      t,
      units,
    ],
  );

  const openAddBuilding = useCallback(() => {
    if (!selectedLocation) {
      toast.message(t('views.addUnitByLocation.selectPanel', { panel: panelLocation.toUpperCase() }));
      return;
    }
    setEditingBuilding(null);
    setEditingBrgyId(null);
    setBuildingName('');
    setAddBuildingOpen(true);
  }, [panelLocation, selectedLocation, t]);

  const openEditBuilding = useCallback(
    (b: { brgyId?: string; name: string }) => {
      if (!b.brgyId) {
        toast.error(t('views.addUnitByLocation.buildingRequired'));
        return;
      }
      setEditingBuilding(b.name);
      setEditingBrgyId(b.brgyId);
      setBuildingName(b.name === '—' ? '' : b.name);
      setAddBuildingOpen(true);
    },
    [t],
  );

  const closeBuildingModal = useCallback(() => {
    setAddBuildingOpen(false);
    setEditingBuilding(null);
    setEditingBrgyId(null);
    setBuildingName('');
  }, []);

  const saveBuilding = useCallback(async () => {
    if (!selectedLocation) {
      toast.message(t('views.addUnitByLocation.selectPanel', { panel: panelLocation.toUpperCase() }));
      return;
    }
    const name = normalizeLocationLabel(buildingName);
    if (!name) {
      toast.error(t('views.addUnitByLocation.buildingRequired'));
      return;
    }

    const cityId =
      selectedCityId ||
      managedCities.find((c) => sameLocation(c.name, selectedLocation))?.cityId ||
      null;
    const currentList = buildingsForLocation(selectedLocation);

    // EDIT — update by brgy_id only; never create.
    if (editingBrgyId || editingBuilding) {
      const matched =
        (editingBrgyId
          ? managedBrgys.find((b) => String(b.brgyId) === String(editingBrgyId))
          : undefined) ||
        managedBrgys.find(
          (b) =>
            (!cityId || String(b.cityId) === String(cityId)) &&
            b.name.trim().toLowerCase() === String(editingBuilding ?? '').trim().toLowerCase(),
        );

      if (!matched?.brgyId) {
        toast.error(t('views.addUnitByLocation.buildingRequired'));
        return;
      }

      if (matched.name.trim().toLowerCase() === name.toLowerCase()) {
        closeBuildingModal();
        return;
      }

      const exists = currentList.some(
        (b) =>
          b.name.toLowerCase() === name.toLowerCase() &&
          String(b.brgyId ?? '') !== String(matched.brgyId),
      );
      if (exists) {
        toast.error(t('views.addUnitByLocation.buildingExists'));
        return;
      }

      setBuildingBusy(true);
      try {
        const updated = await renameBrgy(matched.brgyId, name);
        const affected = units.filter(
          (u) =>
            sameLocation(locationKey(u), selectedLocation) &&
            buildingKey(u).trim().toLowerCase() === matched.name.trim().toLowerCase(),
        );
        for (const unit of affected) {
          await updateUnit(
            unit.id,
            unitToWriteBody(unit, {
              buildingName: updated.name,
              commonAddress: updated.name,
              legalAddress: updated.name,
            }),
          );
        }
        if (selectedBuilding === editingBuilding || selectedBuilding === matched.name) {
          setSelectedBuilding(updated.name);
        }
        toast.success(t('views.addUnitByLocation.buildingUpdated'));
        closeBuildingModal();
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      } finally {
        setBuildingBusy(false);
      }
      return;
    }

    // CREATE
    if (!cityId) {
      toast.message(t('views.addUnitByLocation.selectPanel', { panel: panelLocation.toUpperCase() }));
      return;
    }
    const exists = currentList.some((b) => b.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast.message(t('views.addUnitByLocation.buildingExists'));
      setSelectedBuilding(name);
      closeBuildingModal();
      return;
    }
    setBuildingBusy(true);
    try {
      const created = await createBrgy(cityId, name);
      setSelectedBuilding(created.name);
      toast.success(t('views.addUnitByLocation.buildingAdded'));
      closeBuildingModal();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBuildingBusy(false);
    }
  }, [
    buildingName,
    buildingsForLocation,
    closeBuildingModal,
    editingBrgyId,
    editingBuilding,
    load,
    managedBrgys,
    managedCities,
    panelLocation,
    selectedBuilding,
    selectedCityId,
    selectedLocation,
    t,
    units,
  ]);

  const deleteBuilding = useCallback(
    async (b: { brgyId?: string; name: string }) => {
      if (!selectedLocation) return;
      if (!canDelete) {
        toast.error(t('views.addUnitByLocation.noPermission'));
        return;
      }
      const name = b.name;
      const affected = units.filter(
        (u) => sameLocation(locationKey(u), selectedLocation) && buildingKey(u) === name,
      );
      if (affected.length > 0) {
        if (
          !window.confirm(
            t('views.addUnitByLocation.deleteBuildingConfirm', {
              name,
              count: affected.length,
            }),
          )
        ) {
          return;
        }
      } else if (!window.confirm(t('views.addUnitByLocation.deleteBuildingOnlyConfirm', { name }))) {
        return;
      }

      try {
        const brgyId =
          b.brgyId ||
          managedBrgys.find(
            (row) =>
              (!selectedCityId || String(row.cityId) === String(selectedCityId)) &&
              row.name.trim().toLowerCase() === name.trim().toLowerCase(),
          )?.brgyId ||
          null;
        if (brgyId) {
          await deleteBrgy(brgyId);
        } else {
          await softDeleteLocationBuilding(canonicalLocationName(selectedLocation), name);
        }
        for (const unit of affected) {
          try {
            await deleteUnit(unit.id);
          } catch {
            /* already soft-deleted with the building */
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
        return;
      }

      if (selectedBuilding === name) setSelectedBuilding(null);
      toast.success(t('views.addUnitByLocation.buildingDeleted'));
      await load();
    },
    [
      canDelete,
      load,
      managedBrgys,
      selectedBuilding,
      selectedCityId,
      selectedLocation,
      t,
      units,
    ],
  );

  const buildings = useMemo(() => {
    if (!selectedLocation) return [];
    return buildingsForLocation(selectedLocation);
  }, [buildingsForLocation, selectedLocation]);

  const filteredUnits = useMemo(() => {
    // Wait for a barangay/building click before showing any unit rows.
    if (!selectedLocation || !selectedBuilding) return [];

    const isBlankBuilding = (v?: string | null) => {
      const s = String(v ?? '').trim();
      return !s || s === '—' || s === '-';
    };
    const brgy = selectedBuilding.trim().toLowerCase();
    let list = units.filter((u) => {
      if (!sameLocation(locationKey(u), selectedLocation)) return false;
      const key = buildingKey(u).trim().toLowerCase();
      // Match barangay, or orphan units (saved as —) under this city so BRGY can sync visually.
      return key === brgy || isBlankBuilding(key);
    });
    if (statusFilter !== 'all') {
      list = list.filter((u) => u.status === statusFilter);
    }
    if (typeFilter !== 'all') {
      list = list.filter((u) => u.type === typeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        [
          u.unitNumber,
          u.buildingName,
          u.tower,
          u.floor,
          u.type,
          u.status,
          u.area,
          u.areaSqm,
          u.bedrooms,
          u.monthlyRate,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    const num = (v: number | null | undefined) => {
      const n = Number(v);
      return v == null || !Number.isFinite(n) ? Number.NEGATIVE_INFINITY : n;
    };
    const statusRank: Record<string, number> = {
      Available: 0,
      Reserved: 1,
      Occupied: 2,
      Maintenance: 3,
    };
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'type':
          cmp = String(a.type).localeCompare(String(b.type));
          break;
        case 'sqm':
          cmp = num(a.areaSqm) - num(b.areaSqm);
          break;
        case 'beds':
          cmp = num(a.bedrooms) - num(b.bedrooms);
          break;
        case 'status':
          cmp = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
          break;
        case 'rate':
          cmp = (Number(a.monthlyRate) || 0) - (Number(b.monthlyRate) || 0);
          break;
        case 'unit':
        default:
          cmp = a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
          break;
      }
      if (cmp !== 0) return cmp * dir;
      // Stable tie-breaker so sort always visibly reorders when primary values match.
      return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }) * dir;
    });
  }, [
    units,
    selectedLocation,
    selectedBuilding,
    search,
    statusFilter,
    typeFilter,
    sortField,
    sortDir,
  ]);

  const typeFilterOptions = useMemo(() => {
    const set = new Set<string>(UNIT_FORM_TYPES);
    for (const u of units) {
      if (u.type) set.add(String(u.type));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [units]);

  const toggleSort = useCallback((field: UnitSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const renderSortTh = (
    field: UnitSortField,
    label: string,
    align: 'left' | 'right' | 'center' = 'left',
    className?: string,
  ) => {
    const active = sortField === field;
    return (
      <th
        className={cn(
          'whitespace-nowrap px-3 py-2.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-500',
          align === 'right' && 'text-right',
          align === 'center' && 'text-center',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={cn(
            'inline-flex max-w-full items-center gap-1 transition hover:text-slate-800 dark:hover:text-slate-100',
            align === 'right' && 'w-full justify-end',
            align === 'center' && 'w-full justify-center',
            active && 'text-brand-blue',
          )}
          title={`${t('views.units.sort.label')}: ${label}`}
        >
          <span className="whitespace-nowrap">{label}</span>
          {active ? (
            sortDir === 'asc' ? (
              <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 shrink-0 opacity-35" aria-hidden />
          )}
        </button>
      </th>
    );
  };

  const totalMonthlyRate = useMemo(
    () => filteredUnits.reduce((sum, unit) => sum + (Number(unit.monthlyRate) || 0), 0),
    [filteredUnits],
  );

  const openAdd = useCallback(
    (opts?: { location?: string | null; building?: string | null }) => {
      if (!canCreate) {
        toast.error(t('views.addUnitByLocation.noPermission'));
        return;
      }
      const area =
        opts?.location && opts.location !== '—'
          ? opts.location
          : selectedLocation && selectedLocation !== '—'
            ? selectedLocation
            : '';
      const building =
        opts?.building && opts.building !== '—'
          ? opts.building
          : selectedBuilding && selectedBuilding !== '—'
            ? selectedBuilding
            : '';
      if (!area) {
        toast.message(t('views.addUnitByLocation.selectPanel', { panel: panelLocation.toUpperCase() }));
        return;
      }
      if (!building) {
        toast.message(t('views.addUnitByLocation.selectPanel', { panel: panelBuilding.toUpperCase() }));
        return;
      }
      setFormMode('create');
      setEditingUnitId(null);
      setAddInitialPhoto(null);
      setAddInitialPhotos([]);
      setAddInitial({
        area,
        buildingName: building,
      });
      setAddOpen(true);
    },
    [canCreate, panelBuilding, panelLocation, selectedBuilding, selectedLocation, t],
  );

  const openEdit = useCallback(
    (unit: Unit) => {
      if (!canUpdate) {
        toast.error(t('views.addUnitByLocation.noPermission'));
        return;
      }
      const blank = (v?: string | null) => {
        const s = String(v ?? '').trim();
        return !s || s === '—' || s === '-';
      };
      const base = unitToFormState(unit);
      const building =
        !blank(base.buildingName)
          ? base.buildingName
          : selectedBuilding && selectedBuilding !== '—'
            ? selectedBuilding
            : base.buildingName;
      const area =
        !blank(base.area)
          ? base.area
          : selectedLocation && selectedLocation !== '—'
            ? selectedLocation
            : base.area;
      // Prefer the full Village/Building Name the user typed (legal/common address).
      const savedVillage =
        [unit.legalAddress, unit.commonAddress, base.legalAddress]
          .map((v) => String(v ?? '').trim())
          .find((v) => v && v !== '—' && v !== '-') || '';
      setFormMode('edit');
      setEditingUnitId(unit.id);
      setAddInitial({
        ...base,
        area,
        buildingName: building,
        legalAddress: savedVillage || building,
      });
      setAddInitialPhoto(unit.photoDataUrl ?? null);
      setAddInitialPhotos(resolveUnitPhotos(unit));
      setDetailUnit(null);
      setAddOpen(true);
    },
    [canUpdate, selectedBuilding, selectedLocation, t],
  );

  const handleSaveUnit = useCallback(
    async (body: UnitWriteBody) => {
      setSaving(true);
      try {
        const isBlank = (v?: string | null) => {
          const s = String(v ?? '').trim();
          return !s || s === '—' || s === '-';
        };
        // Prefer values from the form (already auto-synced from panels; user may override).
        // Fall back to selected panels only when the form field is blank.
        const area = !isBlank(body.area)
          ? body.area.trim()
          : selectedLocation && selectedLocation !== '—'
            ? selectedLocation
            : body.area;
        const brgy = !isBlank(body.buildingName)
          ? body.buildingName.trim()
          : selectedBuilding && selectedBuilding !== '—'
            ? selectedBuilding
            : body.buildingName;
        // Keep the full Village/Building Name the user typed (do not overwrite with brgy).
        const village =
          !isBlank(body.legalAddress)
            ? body.legalAddress.trim()
            : !isBlank(body.commonAddress)
              ? body.commonAddress.trim()
              : brgy;
        const patched: UnitWriteBody = {
          ...body,
          area,
          buildingName: brgy,
          legalAddress: village,
          commonAddress: village,
        };
        if (isBlank(patched.buildingName) && body.unitNumber) {
          // Last resort: text after unit# / floor in the unit number field.
          const leftover = String(body.unitNumber)
            .replace(/\b\d+(?:st|nd|rd|th)?\s*floor\b/gi, ' ')
            .replace(/^\d+[a-zA-Z]?\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (leftover) patched.buildingName = leftover;
        }
        if (isBlank(patched.area) || isBlank(patched.buildingName)) {
          toast.message(
            t('views.addUnitByLocation.selectPanel', {
              panel: isBlank(patched.area)
                ? panelLocation.toUpperCase()
                : panelBuilding.toUpperCase(),
            }),
          );
          return;
        }

        if (formMode === 'edit' && editingUnitId) {
          await updateUnit(editingUnitId, patched);
          await Swal.fire({
            icon: 'success',
            title: t('views.units.addModal.saved'),
            text: t('views.units.saveSuccessEditDetail'),
            timer: 1600,
            showConfirmButton: false,
          });
        } else {
          await createUnit(patched);
          await Swal.fire({
            icon: 'success',
            title: t('views.units.addModal.saved'),
            text: t('views.units.saveSuccessAddDetail'),
            timer: 1600,
            showConfirmButton: false,
          });
        }
        setAddOpen(false);
        setEditingUnitId(null);
        setFormMode('create');
        if (patched.area?.trim()) setSelectedLocation(patched.area.trim());
        if (patched.buildingName?.trim()) setSelectedBuilding(patched.buildingName.trim());
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      } finally {
        setSaving(false);
      }
    },
    [editingUnitId, formMode, load, panelBuilding, panelLocation, selectedBuilding, selectedLocation, t],
  );

  const handleDelete = useCallback(
    async (unit: Unit) => {
      if (!canDelete) return;
      if (!window.confirm(t('views.units.deleteConfirm', { unitNumber: unit.unitNumber }))) return;
      try {
        await deleteUnit(unit.id);
        toast.success(t('views.units.deleted'));
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    },
    [canDelete, load, t],
  );

  const cityAreaOptions = useMemo(() => locations.map((loc) => loc.name), [locations]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {t('views.addUnitByLocation.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('views.addUnitByLocation.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className={cn(locBoard.primaryCta, 'gap-2')}
            onClick={() => setFileMaintenanceOpen(true)}
          >
            <FolderCog className="h-3.5 w-3.5" />
            {t('views.addUnitByLocation.fileMaintenance')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl border-slate-200 px-4 text-xs font-bold uppercase tracking-widest text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {t('views.addUnitByLocation.refresh')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('views.addUnitByLocation.loading')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch">
          <div className="lg:col-span-3">
            <LocPanel
              title={panelLocation}
              bodyClassName="max-h-[min(720px,65vh)]"
              actions={
                <button
                  type="button"
                  className={locBoard.navyBtn}
                  title={t('views.addUnitByLocation.addPanel', { panel: panelLocation })}
                  onClick={openAddLocation}
                >
                  <Plus className="h-4 w-4" />
                </button>
              }
            >
              {locations.length === 0 ? (
                <LocEmpty>{t('views.addUnitByLocation.emptyLocations')}</LocEmpty>
              ) : (
                <div className="rounded-md border border-slate-200 dark:border-slate-700">
                  {locations.map((loc) => (
                    <div
                      key={loc.cityId ?? loc.name}
                      className={cn(
                        locBoard.listItem,
                        selectedLocation &&
                          sameLocation(selectedLocation, loc.name) &&
                          locBoard.listItemActive,
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setSelectedLocation((prev) =>
                            prev && sameLocation(prev, loc.name) ? null : loc.name,
                          );
                          setSelectedBuilding(null);
                        }}
                      >
                        <div className={cn(locBoard.listName, 'min-w-0')}>{loc.name}</div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={locBoard.editBtn}
                          title={t('views.addUnitByLocation.editPanel', { panel: panelLocation })}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditLocation(loc);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={locBoard.deleteBtn}
                          title={t('views.addUnitByLocation.deletePanel', { panel: panelLocation })}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteLocation(loc);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </LocPanel>
          </div>

          <div className="lg:col-span-3">
            <LocPanel
              title={panelBuilding}
              bodyClassName="max-h-[min(720px,65vh)]"
              actions={
                selectedLocation ? (
                  <button
                    type="button"
                    className={locBoard.navyBtn}
                    title={t('views.addUnitByLocation.addPanel', { panel: panelBuilding })}
                    onClick={openAddBuilding}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" className={locBoard.iconBtn} onClick={() => void load()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )
              }
            >
              {!selectedLocation ? (
                <LocEmpty>
                  {t('views.addUnitByLocation.selectPanel', { panel: panelLocation.toUpperCase() })}
                </LocEmpty>
              ) : buildings.length === 0 ? (
                <LocEmpty>{t('views.addUnitByLocation.emptyBuildings')}</LocEmpty>
              ) : (
                <div className="rounded-md border border-slate-200 dark:border-slate-700">
                  {buildings.map((b) => (
                    <div
                      key={b.brgyId ?? b.name}
                      className={cn(
                        locBoard.listItem,
                        selectedBuilding === b.name && locBoard.listItemActive,
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() =>
                          setSelectedBuilding((prev) => (prev === b.name ? null : b.name))
                        }
                      >
                        <div className={cn(locBoard.listName, 'min-w-0')}>{b.name}</div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={locBoard.editBtn}
                          title={t('views.addUnitByLocation.editPanel', { panel: panelBuilding })}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditBuilding(b);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className={locBoard.deleteBtn}
                            title={t('views.addUnitByLocation.deletePanel', { panel: panelBuilding })}
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteBuilding(b);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </LocPanel>
          </div>

          <div className="lg:col-span-6">
            <LocPanel
              title={panelUnits}
              bodyClassName="max-h-[min(720px,65vh)]"
              actions={
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as 'all' | UnitStatus)
                    }
                    aria-label={t('views.units.filters.status')}
                    className="hidden h-8 max-w-[8.5rem] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 shadow-none sm:block dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
                  >
                    <option value="all">{t('views.units.filters.statusPh')}</option>
                    {UNIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s === 'Available'
                          ? t('views.units.statuses.available')
                          : s === 'Occupied'
                            ? t('views.units.statuses.occupied')
                            : s === 'Maintenance'
                              ? t('views.units.statuses.maintenance')
                              : t('views.units.statuses.reserved')}
                      </option>
                    ))}
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label={t('views.units.filters.type')}
                    className="hidden h-8 max-w-[12rem] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 shadow-none sm:block dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
                  >
                    <option value="all">{t('views.units.filters.typePh')}</option>
                    {typeFilterOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <div className="relative hidden min-w-[11rem] sm:block">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('views.addUnitByLocation.searchPlaceholder')}
                      className="h-8 rounded-lg border-slate-200 bg-white pl-8 text-xs shadow-none dark:border-slate-600 dark:bg-slate-950"
                    />
                  </div>
                  {canCreate ? (
                    <button
                      type="button"
                      className={locBoard.navyBtn}
                      title={t('views.addUnitByLocation.addUnit')}
                      onClick={() =>
                        openAdd({ location: selectedLocation, building: selectedBuilding })
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  ) : null}
                </>
              }
            >
              <div className="mb-2 space-y-2 sm:hidden">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('views.addUnitByLocation.searchPlaceholder')}
                    className="h-9 rounded-lg border-slate-200 bg-white pl-8 text-xs dark:border-slate-600 dark:bg-slate-950"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as 'all' | UnitStatus)
                    }
                    aria-label={t('views.units.filters.status')}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
                  >
                    <option value="all">{t('views.units.filters.statusPh')}</option>
                    {UNIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s === 'Available'
                          ? t('views.units.statuses.available')
                          : s === 'Occupied'
                            ? t('views.units.statuses.occupied')
                            : s === 'Maintenance'
                              ? t('views.units.statuses.maintenance')
                              : t('views.units.statuses.reserved')}
                      </option>
                    ))}
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label={t('views.units.filters.type')}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
                  >
                    <option value="all">{t('views.units.filters.typePh')}</option>
                    {typeFilterOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>              {!selectedLocation ? (
                <LocEmpty>
                  {t('views.addUnitByLocation.selectPanelForUnits', {
                    panel: panelLocation.toUpperCase(),
                  })}
                </LocEmpty>
              ) : !selectedBuilding ? (
                <LocEmpty>
                  {t('views.addUnitByLocation.selectPanelForUnits', {
                    panel: panelBuilding.toUpperCase(),
                  })}
                </LocEmpty>
              ) : filteredUnits.length === 0 ? (
                <LocEmpty>{t('views.addUnitByLocation.emptyUnits')}</LocEmpty>
              ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="w-full min-w-[58rem] border-collapse text-left text-xs">
                    <colgroup>
                      <col className="w-[10%]" />
                      <col className="w-[28%]" />
                      <col className="w-[12%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                        {renderSortTh('unit', t('views.units.table.unit'))}
                        <th className="whitespace-nowrap px-3 py-2.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {t('views.units.table.area')}
                        </th>
                        {renderSortTh('type', t('views.units.table.type'))}
                        {renderSortTh('sqm', t('views.units.addModal.sqm'), 'center')}
                        {renderSortTh('beds', t('views.units.addModal.bedrooms'), 'center')}
                        {renderSortTh('status', t('views.units.table.status'), 'center')}
                        {renderSortTh('rate', t('views.units.table.monthlyRate'), 'right')}
                        <th className="whitespace-nowrap px-3 py-2.5 text-center align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {t('views.units.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUnits.map((unit) => {
                        const villageName =
                          [unit.legalAddress, unit.commonAddress]
                            .map((v) => String(v ?? '').trim())
                            .find((v) => v && v !== '—' && v !== '-') || '';
                        const brgyLabel =
                          selectedBuilding && selectedBuilding !== '—'
                            ? stripLocationOrdinalPrefix(selectedBuilding)
                            : unit.buildingName &&
                                unit.buildingName !== '—' &&
                                unit.buildingName !== '-'
                              ? stripLocationOrdinalPrefix(unit.buildingName)
                              : '';
                        const cityLabel = stripLocationOrdinalPrefix(
                          selectedLocation && selectedLocation !== '—'
                            ? selectedLocation
                            : unit.area || '',
                        );
                        const primaryLabel = villageName || brgyLabel || '—';
                        const floorMeta = formatUnitFloorTowerMeta(unit);
                        const villageLower = villageName.toLowerCase();
                        const includesPart = (part: string) =>
                          Boolean(part) &&
                          villageLower.includes(part.toLowerCase());
                        const secondaryParts = villageName
                          ? [
                              brgyLabel && !includesPart(brgyLabel) ? brgyLabel : null,
                              cityLabel && !includesPart(cityLabel) ? cityLabel : null,
                              floorMeta || null,
                            ]
                          : [cityLabel || null, floorMeta || null];
                        const secondaryLabel = secondaryParts.filter(Boolean).join(' · ');
                        const areaTitle = [primaryLabel, secondaryLabel]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <tr
                            key={unit.id}
                            className="border-b border-slate-100 last:border-b-0 even:bg-slate-50/60 hover:bg-slate-50 dark:border-slate-800 dark:even:bg-slate-900/40"
                          >
                            <td className="px-3 py-2.5 align-middle font-bold text-slate-800 dark:text-slate-100">
                              <span className="block break-words" title={formatUnitNumberDisplay(unit)}>
                                {formatUnitNumberDisplay(unit)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-middle text-slate-600 dark:text-slate-300">
                              <div className="min-w-0 space-y-0.5" title={areaTitle}>
                                <div className="whitespace-normal break-words font-semibold leading-snug">
                                  {primaryLabel}
                                </div>
                                {secondaryLabel ? (
                                  <div className="whitespace-normal break-words text-[11px] leading-snug text-slate-400">
                                    {secondaryLabel}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-middle text-slate-600 dark:text-slate-300">
                              <span className="block truncate" title={unit.type}>
                                {unit.type}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-middle text-center tabular-nums text-slate-600 dark:text-slate-300">
                              {unit.areaSqm != null ? unit.areaSqm : '—'}
                            </td>
                            <td className="px-3 py-2.5 align-middle text-center tabular-nums text-slate-600 dark:text-slate-300">
                              {unit.bedrooms != null ? unit.bedrooms : '—'}
                            </td>
                            <td className="px-3 py-2.5 align-middle text-center">
                              <Badge
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                  unit.status === 'Available' && 'bg-emerald-500 text-white',
                                  unit.status === 'Occupied' && 'bg-brand-blue text-white',
                                  unit.status === 'Maintenance' && 'bg-rose-500 text-white',
                                  unit.status === 'Reserved' && 'bg-amber-500 text-amber-950',
                                )}
                              >
                                {unit.status === 'Available'
                                  ? t('views.units.statuses.available')
                                  : unit.status === 'Occupied'
                                    ? t('views.units.statuses.occupied')
                                    : unit.status === 'Maintenance'
                                      ? t('views.units.statuses.maintenance')
                                      : t('views.units.statuses.reserved')}
                              </Badge>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 align-middle text-right font-semibold tabular-nums text-slate-700">
                              ₱{Number(unit.monthlyRate).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 align-middle">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  className={locBoard.editBtn}
                                  title={t('views.units.table.viewDetails')}
                                  onClick={() => setDetailUnit(unit)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                {canUpdate ? (
                                  <button
                                    type="button"
                                    className={locBoard.editBtn}
                                    title={t('views.units.table.editUnit')}
                                    onClick={() => openEdit(unit)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                                {canDelete ? (
                                  <button
                                    type="button"
                                    className={locBoard.deleteBtn}
                                    title={t('views.units.table.delete')}
                                    onClick={() => void handleDelete(unit)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                        <td
                          colSpan={6}
                          className="px-3 py-2.5 text-right align-middle font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {t('views.units.table.totalAmount')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                          ₱{totalMonthlyRate.toLocaleString()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </LocPanel>
          </div>
        </div>
      )}

      <Modal
        isOpen={addLocationOpen}
        onClose={() => {
          if (!locationBusy) closeAddLocation();
        }}
        title={
          editingLocation || editingCityId
            ? t('views.addUnitByLocation.editPanel', { panel: panelLocation })
            : t('views.addUnitByLocation.addPanel', { panel: panelLocation })
        }
        maxWidth="sm"
        compact
        shellClassName="gd-simple-modal-shell"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              className="h-9 min-w-[5.5rem] rounded-md bg-slate-700 px-4 text-sm font-semibold text-white shadow-none hover:bg-slate-800 disabled:opacity-60"
              disabled={locationBusy}
              onClick={() => void saveLocation()}
            >
              {locationBusy ? t('views.addUnitByLocation.saving') : t('views.addUnitByLocation.save')}
            </Button>
            <Button
              type="button"
              className="h-9 min-w-[5.5rem] rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-none hover:bg-slate-50"
              disabled={locationBusy}
              onClick={closeAddLocation}
            >
              {t('views.addUnitByLocation.close')}
            </Button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveLocation();
          }}
        >
          <input
            key={editingCityId ? `edit-city-${editingCityId}` : 'add-city'}
            id="add-location-name"
            value={locationName}
            onChange={(e) => {
              locationNameRef.current = e.target.value;
              setLocationName(e.target.value);
            }}
            placeholder={t('views.addUnitByLocation.panelNamePlaceholder', { panel: panelLocation })}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            autoFocus
            disabled={locationBusy}
          />
        </form>
      </Modal>

      <Modal
        isOpen={addBuildingOpen}
        onClose={() => {
          if (!buildingBusy) closeBuildingModal();
        }}
        title={
          editingBuilding
            ? t('views.addUnitByLocation.editPanel', { panel: panelBuilding })
            : t('views.addUnitByLocation.addPanel', { panel: panelBuilding })
        }
        maxWidth="sm"
        compact
        shellClassName="gd-simple-modal-shell"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              className="h-9 min-w-[5.5rem] rounded-md bg-slate-700 px-4 text-sm font-semibold text-white shadow-none hover:bg-slate-800 disabled:opacity-60"
              disabled={buildingBusy}
              onClick={() => void saveBuilding()}
            >
              {buildingBusy ? t('views.addUnitByLocation.saving') : t('views.addUnitByLocation.save')}
            </Button>
            <Button
              type="button"
              className="h-9 min-w-[5.5rem] rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-none hover:bg-slate-50"
              disabled={buildingBusy}
              onClick={closeBuildingModal}
            >
              {t('views.addUnitByLocation.close')}
            </Button>
          </div>
        }
      >
        <input
          id="edit-building-name"
          value={buildingName}
          onChange={(e) => setBuildingName(e.target.value)}
          placeholder={t('views.addUnitByLocation.panelNamePlaceholder', { panel: panelBuilding })}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          autoFocus
          disabled={buildingBusy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void saveBuilding();
            }
          }}
        />
      </Modal>

      <Modal
        isOpen={fileMaintenanceOpen}
        onClose={() => setFileMaintenanceOpen(false)}
        title={t('views.fileMaintenance.title')}
        subtitle={t('views.fileMaintenance.listSubtitle')}
        maxWidth="3xl"
        footer={
          <div className="flex w-full justify-end">
            <Button
              type="button"
              className={modalDismissButtonClass}
              onClick={() => setFileMaintenanceOpen(false)}
            >
              {t('views.fileMaintenance.close')}
            </Button>
          </div>
        }
      >
        <CategoryMaintenanceList items={categories} onChange={updateCategories} />
      </Modal>

      <UnitFormModal
        isOpen={addOpen}
        onClose={() => {
          if (!saving) {
            setAddOpen(false);
            setEditingUnitId(null);
            setFormMode('create');
          }
        }}
        mode={formMode}
        initialValues={addInitial}
        initialPhoto={addInitialPhoto}
        initialPhotos={addInitialPhotos}
        contextArea={selectedLocation}
        contextBuilding={selectedBuilding}
        extraAreaOptions={cityAreaOptions}
        extraBuildingOptions={buildings.map((b) => b.name)}
        saving={saving}
        onSubmit={handleSaveUnit}
      />

      <UnitDetailsModal
        unit={detailUnit}
        isOpen={Boolean(detailUnit)}
        onClose={() => setDetailUnit(null)}
        canEdit={canUpdate}
        onEdit={(unit) => {
          setDetailUnit(null);
          openEdit(unit);
        }}
        cityLabel={selectedLocation}
        buildingLabel={selectedBuilding}
      />
    </div>
  );
}
