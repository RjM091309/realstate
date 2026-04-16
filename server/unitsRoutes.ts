import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './db.js';
import { requireAuth, type AuthedRequest } from './authMiddleware.js';
import { loadSessionPayload, type SessionPayload } from './session.js';

const router = Router();
router.use(requireAuth);

const UNIT_TYPES = new Set(['Studio', '1BR', '2BR', '3BR', 'Loft', 'Penthouse']);
const UNIT_STATUSES = new Set(['Available', 'Occupied', 'Maintenance', 'Reserved']);
const AREAS = new Set(['Makati', 'BGC', 'Pasig', 'Quezon City']);

type UnitRow = RowDataPacket & {
  id: string;
  branch_id: number;
  unit_number: string;
  floor: string;
  tower: string;
  building_name: string;
  common_address: string;
  legal_address: string;
  unit_type: string;
  status: string;
  area: string;
  monthly_rate: number;
  inventory_json: string | null;
};

function rowToUnit(row: UnitRow) {
  let inventory: { id: string; name: string; condition: string; quantity: number }[] = [];
  if (row.inventory_json) {
    try {
      const parsed = JSON.parse(String(row.inventory_json));
      if (Array.isArray(parsed)) inventory = parsed;
    } catch {
      /* ignore */
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

function payloadToUnit(id: string, parsed: NonNullable<ReturnType<typeof validatePayload>>) {
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
    inventory: (parsed.inventory ?? []) as { id: string; name: string; condition: string; quantity: number }[],
  };
}

function validatePayload(body: Record<string, unknown>): {
  unitNumber: string;
  floor: string;
  tower: string;
  buildingName: string;
  commonAddress: string;
  legalAddress: string;
  unitType: string;
  status: string;
  area: string;
  monthlyRate: number;
  inventory: unknown[] | undefined;
} | null {
  const unitNumber = String(body.unitNumber ?? '').trim();
  const buildingName = String(body.buildingName ?? '').trim();
  if (!unitNumber || !buildingName) return null;

  const unitType = String(body.type ?? '');
  const status = String(body.status ?? '');
  const area = String(body.area ?? '');
  if (!UNIT_TYPES.has(unitType) || !UNIT_STATUSES.has(status) || !AREAS.has(area)) return null;

  const rate = Number(body.monthlyRate);
  if (!Number.isFinite(rate) || rate < 0) return null;

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
    monthlyRate: rate,
    inventory: inventory as unknown[] | undefined,
  };
}

function canCrud(session: SessionPayload, op: 'create' | 'update' | 'delete'): boolean {
  const u = session.crud?.units;
  if (!u) return false;
  if (op === 'create') return Boolean(u.create);
  if (op === 'update') return Boolean(u.update);
  return Boolean(u.delete);
}

router.get('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, unit_number, floor, tower, building_name, common_address, legal_address,
              unit_type, status, area, monthly_rate, inventory_json
       FROM property_unit WHERE branch_id = ? ORDER BY building_name ASC, unit_number ASC`,
      [session.branchId],
    );
    const units = (rows as UnitRow[]).map(rowToUnit);
    res.json({ units });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load units' });
  }
});

router.post('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!canCrud(session, 'create')) {
    res.status(403).json({ error: 'No permission to create units' });
    return;
  }
  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid unit payload' });
    return;
  }
  const id = `u-${crypto.randomUUID()}`;
  const invJson = JSON.stringify(parsed.inventory ?? []);
  try {
    await pool.query(
      `INSERT INTO property_unit (
        id, branch_id, unit_number, floor, tower, building_name, common_address, legal_address,
        unit_type, status, area, monthly_rate, inventory_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.branchId,
        parsed.unitNumber,
        parsed.floor,
        parsed.tower,
        parsed.buildingName,
        parsed.commonAddress,
        parsed.legalAddress,
        parsed.unitType,
        parsed.status,
        parsed.area,
        parsed.monthlyRate,
        invJson,
      ],
    );
    res.status(201).json({ unit: payloadToUnit(id, parsed) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

router.patch('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!canCrud(session, 'update')) {
    res.status(403).json({ error: 'No permission to update units' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid unit payload' });
    return;
  }
  const invJson = JSON.stringify(parsed.inventory ?? []);
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE property_unit SET
        unit_number = ?, floor = ?, tower = ?, building_name = ?, common_address = ?, legal_address = ?,
        unit_type = ?, status = ?, area = ?, monthly_rate = ?, inventory_json = ?
       WHERE id = ? AND branch_id = ?`,
      [
        parsed.unitNumber,
        parsed.floor,
        parsed.tower,
        parsed.buildingName,
        parsed.commonAddress,
        parsed.legalAddress,
        parsed.unitType,
        parsed.status,
        parsed.area,
        parsed.monthlyRate,
        invJson,
        id,
        session.branchId,
      ],
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, unit_number, floor, tower, building_name, common_address, legal_address,
              unit_type, status, area, monthly_rate, inventory_json
       FROM property_unit WHERE id = ? AND branch_id = ? LIMIT 1`,
      [id, session.branchId],
    );
    const row = (rows as UnitRow[])[0];
    if (!row) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    res.json({ unit: rowToUnit(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update unit' });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!canCrud(session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete units' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM property_unit WHERE id = ? AND branch_id = ?',
      [id, session.branchId],
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
});

export { router as unitsRouter };
