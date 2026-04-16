import { loadSessionPayload } from '../services/sessionService.js';
import {
  deleteUnitById,
  getUnitById,
  insertUnit,
  listUnitsByBranch,
  updateUnitById,
} from '../models/unitsModel.js';

const UNIT_TYPES = new Set(['Studio', '1BR', '2BR', '3BR', 'Loft', 'Penthouse']);
const UNIT_STATUSES = new Set(['Available', 'Occupied', 'Maintenance', 'Reserved']);
const AREAS = new Set(['Makati', 'BGC', 'Pasig', 'Quezon City']);

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
    monthlyRate: Number(row.monthly_rate),
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
    monthlyRate: parsed.monthlyRate,
    inventory: parsed.inventory ?? [],
  };
}

function validatePayload(body) {
  const unitNumber = String(body.unitNumber ?? '').trim();
  const buildingName = String(body.buildingName ?? '').trim();
  if (!unitNumber || !buildingName) return null;

  const unitType = String(body.type ?? '');
  const status = String(body.status ?? '');
  const area = String(body.area ?? '');
  if (!UNIT_TYPES.has(unitType) || !UNIT_STATUSES.has(status) || !AREAS.has(area)) return null;

  const monthlyRate = Number(body.monthlyRate);
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) return null;

  const inventory = body.inventory;
  if (inventory !== undefined && !Array.isArray(inventory)) return null;

  return {
    unitNumber,
    floor: String(body.floor ?? '').trim() || '—',
    tower: String(body.tower ?? '').trim() || '—',
    buildingName,
    commonAddress: String(body.commonAddress ?? '').trim() || buildingName,
    legalAddress: String(body.legalAddress ?? '').trim() || String(body.commonAddress ?? '').trim() || '—',
    unitType,
    status,
    area,
    monthlyRate,
    inventory,
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
      monthlyRate: parsed.monthlyRate,
      inventoryJson: JSON.stringify(parsed.inventory ?? []),
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
      monthlyRate: parsed.monthlyRate,
      inventoryJson: JSON.stringify(parsed.inventory ?? []),
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
