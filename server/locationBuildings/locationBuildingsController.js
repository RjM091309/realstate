import { loadSessionPayload } from '../services/sessionService.js';
import {
  findLocationBuilding,
  getLocationBuildingById,
  listLocationBuildings,
  renameLocationBuilding,
  softDeleteLocationBuilding,
  softDeleteLocationBuildingById,
  upsertLocationBuilding,
} from './locationBuildingsModel.js';

function rowToDto(row) {
  return {
    id: String(row.id),
    location: String(row.location_name ?? ''),
    building: String(row.building_name ?? ''),
    active: Number(row.active) === 1,
  };
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

function canCrud(session, op) {
  const permissions = session.crud?.units;
  if (!permissions) return false;
  if (op === 'create') return Boolean(permissions.create);
  if (op === 'update') return Boolean(permissions.update);
  return Boolean(permissions.delete);
}

export async function listBuildings(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const location = String(req.query.location ?? '').trim() || null;
    const rows = await listLocationBuildings(ctx.session.branchId, { location });
    res.json({ buildings: rows.map(rowToDto) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load location buildings' });
  }
}

export async function createBuilding(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create') && !canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to manage buildings' });
    return;
  }

  const location = String(req.body?.location ?? '').trim();
  const building = String(req.body?.building ?? '').trim();
  if (!location || !building) {
    res.status(400).json({ error: 'location and building are required' });
    return;
  }

  try {
    const existing = await findLocationBuilding(ctx.session.branchId, location, building);
    if (existing && Number(existing.active) === 1) {
      res.status(409).json({ error: 'Building already exists', building: rowToDto(existing) });
      return;
    }
    const row = await upsertLocationBuilding(ctx.session.branchId, location, building);
    res.status(existing ? 200 : 201).json({ building: rowToDto(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save building' });
  }
}

export async function updateBuilding(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update buildings' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  const building = String(req.body?.building ?? '').trim();
  if (!id || !building) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  try {
    const current = await getLocationBuildingById(id, ctx.session.branchId);
    if (!current || Number(current.active) !== 1) {
      res.status(404).json({ error: 'Building not found' });
      return;
    }
    await renameLocationBuilding(id, ctx.session.branchId, building);
    const row = await getLocationBuildingById(id, ctx.session.branchId);
    res.json({ building: rowToDto(row) });
  } catch (e) {
    if (e?.message === 'BUILDING_EXISTS') {
      res.status(409).json({ error: 'Building already exists' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to update building' });
  }
}

export async function deleteBuilding(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete buildings' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  const location = String(req.body?.location ?? '').trim();
  const building = String(req.body?.building ?? '').trim();

  try {
    let result = null;
    if (id) {
      result = await softDeleteLocationBuildingById(id, ctx.session.branchId);
      if (!result) {
        res.status(404).json({ error: 'Building not found' });
        return;
      }
    } else if (location && building) {
      result = await softDeleteLocationBuilding(ctx.session.branchId, location, building);
    } else {
      res.status(400).json({ error: 'id or location+building required' });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to soft-delete building' });
  }
}
