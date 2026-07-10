import { loadSessionPayload } from '../services/sessionService.js';
import {
  deleteUnitById,
  getUnitById,
  insertUnit,
  listUnitsByBranch,
  updateUnitById,
} from '../models/unitsModel.js';

const UNIT_TYPES = new Set([
  'House and Lot',
  'Condominium',
  'Apartment',
  'Commercial Building',
  'Warehouse',
  'Hotel',
  'Office Space',
  // Legacy types (kept for existing saved units)
  'Studio',
  '1BR',
  '2BR',
  '3BR',
  'Loft',
  'Penthouse',
]);
const UNIT_STATUSES = new Set(['Available', 'Occupied', 'Maintenance', 'Reserved']);

function rowToUnit(row) {
  let inventory = [];
  if (row.inventory_json) {
    try {
      const parsed = JSON.parse(String(row.inventory_json));
      if (Array.isArray(parsed)) inventory = parsed;
    } catch {
      /* ignore malformed inventory_json */
    }
  }
  return {
    id: String(row.id),
    unitNumber: String(row.unit_number),
    floor: String(row.floor ?? ''),
    tower: String(row.tower ?? ''),
    buildingName: String(row.building_name),
    commonAddress: String(row.common_address ?? ''),
    legalAddress: String(row.legal_address ?? ''),
    type: row.unit_type,
    status: row.status,
    area: row.area,
    areaSqm: row.area_sqm == null ? undefined : Number(row.area_sqm),
    bedrooms: row.bedrooms == null ? undefined : Number(row.bedrooms),
    bathrooms: row.bathrooms == null ? undefined : Number(row.bathrooms),
    monthlyRate: Number(row.monthly_rate),
    photoDataUrl: row.photo_data ? String(row.photo_data) : null,
    specialRemarks: row.special_remarks ? String(row.special_remarks) : undefined,
    inventory,
  };
}

function payloadToUnit(id, parsed) {
  return {
    id,
    unitNumber: parsed.unitNumber,
    floor: parsed.floor,
    tower: parsed.tower,
    buildingName: parsed.buildingName,
    commonAddress: parsed.commonAddress,
    legalAddress: parsed.legalAddress,
    type: parsed.unitType,
    status: parsed.status,
    area: parsed.area,
    areaSqm: parsed.areaSqm,
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    monthlyRate: parsed.monthlyRate,
    photoDataUrl: parsed.photoDataUrl,
    specialRemarks: parsed.specialRemarks,
    inventory: parsed.inventory ?? [],
  };
}

function deriveBuildingName(addressOrBuilding, fallbackBuilding = '') {
  const raw = String(addressOrBuilding ?? '').trim();
  const fallback = String(fallbackBuilding ?? '').trim();
  if (!raw) return fallback;

  const first = raw
    .split(/[,\u00B7-]/)
    .map((s) => s.trim())
    .filter(Boolean)[0];

  return first || fallback || raw;
}

function normalizePhotoDataUrl(photoRaw) {
  if (photoRaw === undefined || photoRaw === null || String(photoRaw).trim() === '') return null;
  const value = String(photoRaw).trim();

  // Accept data URLs for common image formats (legacy rows may not be WEBP).
  if (value.startsWith('data:image/') && value.includes(';base64,')) {
    if (value.length > 20 * 1024 * 1024) return null;
    return value;
  }

  // Accept http(s) URLs used by older seed/demo rows.
  if (/^https?:\/\/.+/i.test(value) && value.length <= 2048) {
    return value;
  }

  return null;
}

function validatePayload(body) {
  const unitNumber = String(body.unitNumber ?? '').trim();
  const legalAddress = String(body.legalAddress ?? '').trim();
  const commonAddress = String(body.commonAddress ?? '').trim();
  const buildingName =
    String(body.buildingName ?? '').trim() ||
    deriveBuildingName(legalAddress, commonAddress);
  if (!unitNumber || !buildingName) return null;

  const unitType = String(body.type ?? '');
  const status = String(body.status ?? '');
  const area = String(body.area ?? '').trim();
  if (!UNIT_TYPES.has(unitType) || !UNIT_STATUSES.has(status) || !area) return null;

  const monthlyRate = Number(body.monthlyRate);
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) return null;

  const photoRaw = body.photoDataUrl;
  const photoDataUrl = normalizePhotoDataUrl(photoRaw);
  // If client sent a non-empty photo but we could not normalize it, reject payload.
  if (photoRaw !== undefined && photoRaw !== null && String(photoRaw).trim() !== '' && !photoDataUrl) {
    return null;
  }

  const inventory = body.inventory;
  if (inventory !== undefined && !Array.isArray(inventory)) return null;

  const specialRemarksRaw = body.specialRemarks;
  const specialRemarks =
    specialRemarksRaw === null || specialRemarksRaw === undefined
      ? null
      : String(specialRemarksRaw).trim() || null;

  const parseMetric = (raw, { max, allowDecimal }) => {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    const value = allowDecimal ? Math.round(n * 100) / 100 : Math.floor(n);
    return max != null ? Math.min(value, max) : value;
  };

  const areaSqm = parseMetric(body.areaSqm, { max: 99999, allowDecimal: true });
  const bedrooms = parseMetric(body.bedrooms, { max: 255, allowDecimal: false });
  const bathrooms = parseMetric(body.bathrooms, { max: 255, allowDecimal: false });

  return {
    unitNumber,
    floor: String(body.floor ?? '').trim() || '—',
    tower: String(body.tower ?? '').trim() || '—',
    buildingName,
    commonAddress: commonAddress || legalAddress || buildingName,
    legalAddress: legalAddress || commonAddress || '—',
    unitType,
    status,
    area,
    areaSqm,
    bedrooms,
    bathrooms,
    monthlyRate,
    photoDataUrl,
    inventory,
    specialRemarks,
  };
}

function canCrud(session, op) {
  const permissions = session.crud?.units;
  if (!permissions) return false;
  if (op === 'create') return Boolean(permissions.create);
  if (op === 'update') return Boolean(permissions.update);
  return Boolean(permissions.delete);
}

async function getAuthContext(req, res) {
  const userId = req.userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { userId, session };
}

export async function listUnits(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listUnitsByBranch(ctx.session.branchId);
    res.json({ units: rows.map(rowToUnit) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load units' });
  }
}

export async function createUnit(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create units' });
    return;
  }

  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    console.warn('[createUnit] Invalid payload — photoLen:', String(req.body?.photoDataUrl ?? '').length, 'area:', req.body?.area, 'type:', req.body?.type);
    res.status(400).json({ error: 'Invalid unit payload' });
    return;
  }

  try {
    const row = await insertUnit(ctx.session.branchId, {
      unitNumber: parsed.unitNumber,
      floor: parsed.floor,
      tower: parsed.tower,
      buildingName: parsed.buildingName,
      commonAddress: parsed.commonAddress,
      legalAddress: parsed.legalAddress,
      unitType: parsed.unitType,
      status: parsed.status,
      area: parsed.area,
      areaSqm: parsed.areaSqm,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms,
      monthlyRate: parsed.monthlyRate,
      photoDataUrl: parsed.photoDataUrl,
      inventoryJson: JSON.stringify(parsed.inventory ?? []),
      specialRemarks: parsed.specialRemarks,
    });
    if (!row) {
      res.status(500).json({ error: 'Failed to create unit' });
      return;
    }
    res.status(201).json({ unit: rowToUnit(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create unit' });
  }
}

export async function updateUnit(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update units' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    console.warn('[updateUnit] Invalid payload — photoLen:', String(req.body?.photoDataUrl ?? '').length, 'area:', req.body?.area, 'type:', req.body?.type);
    res.status(400).json({ error: 'Invalid unit payload' });
    return;
  }

  try {
    const affectedRows = await updateUnitById(id, ctx.session.branchId, {
      unitNumber: parsed.unitNumber,
      floor: parsed.floor,
      tower: parsed.tower,
      buildingName: parsed.buildingName,
      commonAddress: parsed.commonAddress,
      legalAddress: parsed.legalAddress,
      unitType: parsed.unitType,
      status: parsed.status,
      area: parsed.area,
      areaSqm: parsed.areaSqm,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms,
      monthlyRate: parsed.monthlyRate,
      photoDataUrl: parsed.photoDataUrl,
      inventoryJson: JSON.stringify(parsed.inventory ?? []),
      specialRemarks: parsed.specialRemarks,
    });
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }

    const row = await getUnitById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    res.json({ unit: rowToUnit(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update unit' });
  }
}

export async function deleteUnit(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete units' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  try {
    const affectedRows = await deleteUnitById(id, ctx.session.branchId);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
}
